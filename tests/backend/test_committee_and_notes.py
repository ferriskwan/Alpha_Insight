"""Unit and integration tests for Epic 0.4: 4-Analyst Committee, Historical Agent Output Storage & Investment Notes.

Verifies:
- SC-01: Default agent model is 'gemini-4-argon' and exposed via /api/v1/committee/models
- SC-02: Segregated 4-analyst prompt generation (Technical, Fundamental, Macro, Risk) with zero live cross-contamination
- SC-03: Executive Summary consolidation and voting breakdown
- SC-04: Historical output storage in agent_committee_runs & agent_analyst_outputs and
  cross-role trend lookup across consecutive runs
- SC-07: Watchlist ticker validation in Investment Notes (rejects symbols not in [watchlist])
- SC-08: 0 to multiple (0..N) relational linking between Investment Notes and agent_analyst_outputs
- Contextual chat endpoint (/api/v1/committee/chat) grounded in displayed screen context
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db.models import EodData, User, Watchlist
from backend.services.prompt_builder import (
    build_executive_summary_prompt,
    build_fundamental_analyst_prompt,
    build_macro_strategist_prompt,
    build_risk_manager_prompt,
    build_technical_analyst_prompt,
)


def _seed_user_and_watchlist(db_session: Session) -> None:
    """Seed baseline user id=1 and watchlist tickers AAPL and NVDA."""
    existing_user = db_session.query(User).filter(User.id == 1).first()
    if not existing_user:
        db_session.add(
            User(
                id=1,
                email="ferriskwan@gmail.com",
                name="Ferris Kwan",
                status="active",
            )
        )
    existing_aapl = db_session.query(Watchlist).filter(Watchlist.symbol == "AAPL").first()
    if not existing_aapl:
        db_session.add(
            Watchlist(
                user_id=1,
                watchlistname="Default",
                symbol="AAPL",
                name="Apple Inc.",
                currency="USD",
            )
        )
    existing_nvda = db_session.query(Watchlist).filter(Watchlist.symbol == "NVDA").first()
    if not existing_nvda:
        db_session.add(
            Watchlist(
                user_id=1,
                watchlistname="Default",
                symbol="NVDA",
                name="NVIDIA Corp.",
                currency="USD",
            )
        )
    db_session.commit()


def test_default_model_is_gemini_4_argon(client: TestClient) -> None:
    """SC-01: Verify default model in Settings and /api/v1/committee/models is gemini-4-argon."""
    settings = get_settings()
    assert settings.gemini_default_model == "gemini-4-argon"

    res = client.get("/api/v1/committee/models")
    assert res.status_code == 200
    models = res.json()
    assert isinstance(models, list)
    assert any(m["id"] == "gemini-4-argon" and m["is_default"] is True for m in models)


def test_segregated_4_analyst_prompts_and_executive_summary() -> None:
    """SC-02 & SC-03: Verify all 4 analyst prompts have segregated roles and historical ledger injection."""
    past = [
        {
            "id": 10,
            "analyst_role": "technical",
            "directional_bias": "Bullish",
            "confidence_score": 82,
            "trend_status": "Initiation",
            "created_at": "2026-11-17T10:00:00Z",
            "summary_headline": "AAPL holds Fib 61.8% support.",
        },
        {
            "id": 11,
            "analyst_role": "macro",
            "directional_bias": "Neutral",
            "confidence_score": 65,
            "trend_status": "Initiation",
            "created_at": "2026-11-17T10:00:00Z",
            "summary_headline": "10Y-2Y Treasury spread inverted.",
        },
    ]

    tech_p = build_technical_analyst_prompt("AAPL", {"latest_close": 185.0}, past)
    fund_p = build_fundamental_analyst_prompt("AAPL", {"company_name": "Apple Inc."}, past)
    macro_p = build_macro_strategist_prompt("AAPL", {"yield_spread_10y_2y": "-0.40%"}, past)
    risk_p = build_risk_manager_prompt("AAPL", {"net_open_quantity": 100.0}, past)

    assert "You are the **Technical Analyst**" in tech_p
    assert "Fibonacci Retracement Matrix" in tech_p
    assert "Strict Grounding & Parameter Fidelity" in tech_p
    assert "Strict Pattern Discipline" in tech_p
    assert "Missing Data & Cold-Start Rule" in tech_p
    assert "Intraday Microstructure & Execution Friction" in tech_p
    assert "Output #10" in tech_p and "Output #11" in tech_p

    assert "You are the **Fundamental Analyst**" in fund_p
    assert "7-Day News & Catalyst Scan" in fund_p

    assert "You are the **Macro Strategist**" in macro_p
    assert "US Treasury Sovereign Yield Curve" in macro_p

    assert "You are the **Risk Manager**" in risk_p
    assert "Bidirectional Position & Cost Basis Exposure" in risk_p

    exec_p = build_executive_summary_prompt(
        "AAPL",
        {
            "technical": {"directional_bias": "Bullish"},
            "fundamental": {"directional_bias": "Bullish"},
            "macro": {"directional_bias": "Neutral"},
            "risk": {"directional_bias": "Bullish"},
        },
        past,
    )
    assert "Committee Chair & Executive Summary Synthesizer" in exec_p
    assert "Consolidated Committee Synthesis" in exec_p


def test_committee_run_persistence_and_historical_lookup(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """SC-04: Verify running the committee persists 5 outputs and subsequent runs reference past outputs."""
    _seed_user_and_watchlist(db_session)
    # Use deterministic fallback mode in unit tests for fast, repeatable verification
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")

    # Run #1: First invocation -> Initiation
    r1 = client.post(
        "/api/v1/committee/run",
        json={"symbol": "AAPL", "provider": "gemini", "model": "gemini-4-argon", "lookback_runs": 3},
    )
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["symbol"] == "AAPL"
    assert data1["model"] == "gemini-4-argon"
    assert len(data1["outputs"]) == 5
    roles1 = {o["analyst_role"] for o in data1["outputs"]}
    assert roles1 == {"executive_summary", "technical", "fundamental", "macro", "risk"}
    for out in data1["outputs"]:
        assert out["trend_status"] == "Initiation"
        assert out["referenced_output_ids"] == []

    run1_output_ids = [o["id"] for o in data1["outputs"]]

    # Run #2: Second invocation for AAPL -> references Run #1 outputs and marks Continuation
    r2 = client.post(
        "/api/v1/committee/run",
        json={"symbol": "AAPL", "provider": "gemini", "model": "gemini-4-argon", "lookback_runs": 3},
    )
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["id"] > data1["id"]
    for out in data2["outputs"]:
        assert out["trend_status"] in ("Continuation", "Reversal")
        for r1_id in run1_output_ids:
            assert r1_id in out["referenced_output_ids"]

    # Verify GET /api/v1/committee/outputs returns stored outputs across both runs
    outputs_res = client.get("/api/v1/committee/outputs?symbol=AAPL")
    assert outputs_res.status_code == 200
    stored_outputs = outputs_res.json()
    assert len(stored_outputs) >= 10


def test_investment_notes_watchlist_validation_and_0_to_n_linking(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """SC-07 & SC-08: Verify Watchlist symbol validation and 0, 1, and multiple (N) analyst output links."""
    _seed_user_and_watchlist(db_session)
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")

    # Generate a committee run so we have analyst outputs to link
    run_res = client.post("/api/v1/committee/run", json={"symbol": "AAPL"})
    assert run_res.status_code == 200
    run_outputs = run_res.json()["outputs"]
    exec_out_id = next(o["id"] for o in run_outputs if o["analyst_role"] == "executive_summary")
    tech_out_id = next(o["id"] for o in run_outputs if o["analyst_role"] == "technical")
    risk_out_id = next(o["id"] for o in run_outputs if o["analyst_role"] == "risk")

    # 1. Reject ticker symbol NOT in [watchlist]
    bad_res = client.post(
        "/api/v1/notes",
        json={
            "symbol": "NOT_IN_WATCHLIST",
            "title": "Invalid Ticker Note",
            "content_markdown": "Should fail validation",
            "thesis_status": "In-Progress",
            "analyst_output_ids": [],
        },
    )
    assert bad_res.status_code == 422
    assert "watchlist" in bad_res.json()["detail"].lower()

    # 2. Create note with 0 linked analyst outputs
    note0_res = client.post(
        "/api/v1/notes",
        json={
            "symbol": "AAPL",
            "title": "AAPL Standalone Thesis (0 Outputs)",
            "content_markdown": "Initial thesis before attaching analyst outputs.",
            "thesis_status": "In-Progress",
            "analyst_output_ids": [],
        },
    )
    assert note0_res.status_code == 201
    note0 = note0_res.json()
    assert note0["symbol"] == "AAPL"
    assert note0["analyst_output_ids"] == []
    assert note0["linked_analyst_outputs"] == []

    # 3. Update note to link multiple (3) analyst outputs (Executive Summary + Technical + Risk)
    update_res = client.put(
        f"/api/v1/notes/{note0['id']}",
        json={
            "thesis_status": "Validated",
            "analyst_output_ids": [exec_out_id, tech_out_id, risk_out_id],
        },
    )
    assert update_res.status_code == 200
    updated_note = update_res.json()
    assert updated_note["thesis_status"] == "Validated"
    assert set(updated_note["analyst_output_ids"]) == {exec_out_id, tech_out_id, risk_out_id}
    assert len(updated_note["linked_analyst_outputs"]) == 3

    # 4. List notes and verify linked outputs are returned
    list_res = client.get("/api/v1/notes?symbol=AAPL")
    assert list_res.status_code == 200
    notes_list = list_res.json()
    assert any(n["id"] == note0["id"] and len(n["linked_analyst_outputs"]) == 3 for n in notes_list)

    # 5. Delete note
    del_res = client.delete(f"/api/v1/notes/{note0['id']}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True


def test_contextual_agent_chat_endpoint(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """Verify POST /api/v1/committee/chat persists chat turns tied to run_id and GET /chat/history returns them."""
    _seed_user_and_watchlist(db_session)
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")

    run_res = client.post("/api/v1/committee/run", json={"symbol": "AAPL"})
    assert run_res.status_code == 200
    run_id = run_res.json()["id"]

    chat_res = client.post(
        "/api/v1/committee/chat",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "Why did Macro stay Neutral while Technical voted Bullish?",
                }
            ],
            "symbol": "AAPL",
            "run_id": run_id,
            "active_route": "/research/committee",
            "displayed_context": {
                "symbol": "AAPL",
                "activeRunId": run_id,
                "consensusBias": "Bullish",
                "voteBreakdown": {
                    "technical": "Bullish",
                    "fundamental": "Bullish",
                    "macro": "Neutral",
                    "risk": "Bullish",
                },
            },
            "provider": "gemini",
            "model": "gemini-4-argon",
        },
    )
    assert chat_res.status_code == 200
    body = chat_res.json()
    assert body["model"] == "gemini-4-argon"
    assert body["run_id"] == run_id
    assert "AAPL" in body["reply"]

    # Verify chat turn is persisted in public.agent_chat_messages tied to run_id
    hist_res = client.get(f"/api/v1/committee/chat/history?symbol=AAPL&run_id={run_id}")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist) >= 2
    assert hist[0]["role"] == "user"
    assert hist[0]["run_id"] == run_id
    assert hist[1]["role"] == "assistant"
    assert hist[1]["run_id"] == run_id

    # Verify clearing chat history
    del_res = client.delete(f"/api/v1/committee/chat/history?symbol=AAPL&run_id={run_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] >= 2


def test_committee_run_handles_nan_eod_rows_cleanly(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """Verify symbols like GLW with NaN EOD rows do not fail JSON serialization or DB persistence."""
    from datetime import date

    _seed_user_and_watchlist(db_session)
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")

    db_session.add(
        EodData(
            symbol="GLW",
            date=date(2026, 11, 16),
            open=105.0,
            high=108.0,
            low=104.0,
            close=106.17,
            volume=5000000.0,
        )
    )
    db_session.add(
        EodData(
            symbol="GLW",
            date=date(2026, 11, 17),
            open=float("nan"),
            high=float("nan"),
            low=float("nan"),
            close=float("nan"),
            volume=float("nan"),
        )
    )
    db_session.commit()

    res = client.post(
        "/api/v1/committee/run",
        json={"symbol": "GLW", "provider": "gemini", "model": "gemini-4-argon", "lookback_runs": 3},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["symbol"] == "GLW"
    assert len(body["outputs"]) == 5
    tech_out = next(o for o in body["outputs"] if o["analyst_role"] == "technical")
    assert tech_out["structured_metrics"]["latest_close"] == 106.17


def test_macro_workbench_run_and_latest_with_grounding_citations(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """SC-10 & SC-11: Verify Watchlist-derived Macroeconomics workbench run, citations, and persistence."""
    _seed_user_and_watchlist(db_session)
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")

    # 1. Execute Macroeconomics analysis run
    run_res = client.post(
        "/api/v1/committee/macro/run",
        json={"benchmark_symbol": "^SPX", "provider": "gemini", "model": "gemini-4-argon", "lookback_runs": 3},
    )
    assert run_res.status_code == 200
    body = run_res.json()
    assert body["benchmark_symbol"] == "^SPX"
    assert body["run"]["symbol"] == "MACRO"
    assert len(body["outputs"]) == 4
    roles = {o["analyst_role"] for o in body["outputs"]}
    assert roles == {"macro_us", "macro_apac", "macro_secular", "macro"}

    # Verify every macro specialist output includes verified grounding citation links
    for out in body["outputs"]:
        links = out["structured_metrics"].get("grounding_links", [])
        assert len(links) >= 1
        assert all("title" in item and "uri" in item for item in links)

    # 2. Verify GET /api/v1/committee/macro/latest returns the persisted run and outputs
    latest_res = client.get("/api/v1/committee/macro/latest?benchmark_symbol=^SPX")
    assert latest_res.status_code == 200
    latest_body = latest_res.json()
    assert latest_body["run"]["id"] == body["run"]["id"]
    assert len(latest_body["outputs"]) == 4


def test_fibonacci_52w_harmonization_and_multi_currency_transactions(
    client: TestClient,
    db_session: Session,
) -> None:
    """Verify 52-week Fibonacci calculation and Trade currency & previous-day FX rate enrichment."""
    from datetime import date, datetime

    from backend.db.models import ExchangeRate, RefChartSettings, Trade, Watchlist

    _seed_user_and_watchlist(db_session)

    # 1. Seed RefChartSettings with fibonacci lookbacks
    settings = RefChartSettings(
        user_id=1,
        symbol=None,
        fib_lookback_bars=252,
        fib_intraday_bars=78,
    )
    db_session.add(settings)

    # 2. Seed ExchangeRate
    db_session.add(ExchangeRate(date=date(2026, 5, 10), currency="SGD", base_currency="USD", rate=1.35))
    db_session.add(ExchangeRate(date=date(2026, 5, 11), currency="SGD", base_currency="USD", rate=1.34))

    # 3. Seed Watchlist item with SGD
    db_session.add(
        Watchlist(
            user_id=1,
            watchlistname="Default",
            symbol="D05.SI",
            name="DBS Group",
            currency="SGD",
        )
    )

    # 4. Seed Trades (one in USD, one in SGD on 2026-05-12)
    db_session.add(
        Trade(
            user_id=1,
            symbol="GLW",
            buysell="B",
            tradedate=datetime(2026, 5, 12, 10, 0),
            investment=True,
            price=100.0,
            quantity=10.0,
            remarks="Buy Corning",
        )
    )
    db_session.add(
        Trade(
            user_id=1,
            symbol="D05.SI",
            buysell="B",
            tradedate=datetime(2026, 5, 12, 10, 0),
            investment=True,
            price=30.0,
            quantity=100.0,
            remarks="Buy DBS",
        )
    )
    db_session.commit()

    # 5. Verify /api/v1/transactions/trade
    trade_res = client.get("/api/v1/transactions/trade")
    assert trade_res.status_code == 200
    trades = trade_res.json()
    assert len(trades) >= 2
    glw = next(t for t in trades if t["symbol"] == "GLW")
    dbs = next(t for t in trades if t["symbol"] == "D05.SI")

    assert glw["currency"] == "USD"
    assert glw["fx_rate"] == 1.0

    assert dbs["currency"] == "SGD"
    # Previous day rate before 2026-05-12 is 2026-05-11 (1.34)
    assert dbs["fx_rate"] == 1.34

    # 6. Verify /api/v1/transactions/exchange-rates
    fx_res = client.get("/api/v1/transactions/exchange-rates?currency=SGD")
    assert fx_res.status_code == 200
    fx_list = fx_res.json()
    assert any(r["currency"] == "SGD" and r["rate"] == 1.34 for r in fx_list)


def test_intraday_microstructure_and_atr_vwap_calculations(db_session: Session) -> None:
    """Verify deterministic calculation of 14-period ATR, session VWAP, and execution friction."""
    from backend.repositories.committee_repo import build_domain_contexts_for_symbol
    from backend.repositories.research_repo import (
        _calculate_atr,
        _calculate_session_vwap,
        _synthesize_execution_friction,
        get_intraday_microstructure_data,
    )

    # 1. Test _calculate_atr
    highs = [10.0 + i * 0.5 for i in range(25)]
    lows = [9.0 + i * 0.5 for i in range(25)]
    closes = [9.5 + i * 0.5 for i in range(25)]
    atr_series = _calculate_atr(highs, lows, closes, period=14)
    assert len(atr_series) == 25
    assert atr_series[0] is None
    assert atr_series[13] is not None
    assert round(atr_series[13], 2) == 1.0

    # 2. Test _calculate_session_vwap
    test_candles = [
        {"high": 105.0, "low": 95.0, "close": 100.0, "volume": 1000},  # typical 100.0 * 1000 = 100,000
        {"high": 115.0, "low": 105.0, "close": 110.0, "volume": 2000},  # typical 110.0 * 2000 = 220,000
    ]
    vwap_res = _calculate_session_vwap(test_candles)
    # Total volume = 3000, Total PV = 320,000 => VWAP = 106.67
    assert vwap_res["session_vwap"] == 106.67
    assert vwap_res["session_volume"] == 3000.0
    assert round(vwap_res["vwap_deviation_pct"], 1) == 3.1

    # 3. Test _synthesize_execution_friction
    friction = _synthesize_execution_friction(0.50, 100.0, test_candles)
    assert "total_roundtrip_friction" in friction
    assert "friction_to_atr_ratio_pct" in friction
    assert friction["friction_status"] in ("Negligible", "Moderate", "Severe")

    # 4. Test get_intraday_microstructure_data
    micro = get_intraday_microstructure_data(db_session, "AAPL", 185.0)
    assert "atr_14_5m" in micro
    assert "session_vwap" in micro
    assert "execution_friction" in micro
    assert micro["volatility_regime"] in ("Trending", "Mean-Reverting", "Choppy")

    # 5. Test build_domain_contexts_for_symbol includes microstructure
    contexts = build_domain_contexts_for_symbol(db_session, "AAPL", user_id=1)
    tech_ctx = contexts["technical_context"]
    assert "intraday_microstructure" in tech_ctx
    assert "atr_14" in tech_ctx
    assert tech_ctx["intraday_microstructure"]["atr_14_5m"] > 0
    assert tech_ctx["intraday_microstructure"]["session_vwap"] > 0
