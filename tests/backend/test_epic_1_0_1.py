"""Unit tests for Epic 1.0.1 requirements (Items 1, 2, 3, 7)."""

from __future__ import annotations

import math
from datetime import date, datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import main as main_module
import ProcessData as pd_module
from backend.config import Settings
from backend.db.models import Base, Capital, DailyPortfolioSummary, Position, Trade, Watchlist
from backend.repositories.portfolio_repo import get_portfolio_4chart_overview
from backend.services.agent_orchestrator import get_supported_models


def test_supported_models_includes_gemini_4_neon_and_excludes_pre_v4() -> None:
    """Item 7: Gemini 4 Neon is present and all Gemini < 4 models are removed."""
    models = get_supported_models()
    ids = [m.id for m in models]

    assert "gemini-4-neon" in ids
    assert "gemini-4-argon" in ids
    assert "kimi-k2-0711-preview" in ids
    neon = next(m for m in models if m.id == "gemini-4-neon")
    assert neon.is_default is True
    for removed in ("gemini-3.8-flash", "gemini-2.5-pro", "gemini-2.5-flash"):
        assert removed not in ids


def test_config_exposes_bounded_db_pool_defaults() -> None:
    """Item 3: DB connection pool settings are bounded and configurable."""
    cfg = Settings()
    assert cfg.db_pool_size == 3
    assert cfg.db_max_overflow == 5
    assert cfg.db_pool_recycle == 300
    assert cfg.db_pool_timeout == 30
    assert cfg.db_raw_pool_maxconn == 5


def test_validate_runtime_api_url_blocks_localhost_in_cloud_run_job(monkeypatch: pytest.MonkeyPatch) -> None:
    """Item 3: Fail fast if CLOUD_RUN_JOB is set and API_URL targets localhost."""
    monkeypatch.setenv("CLOUD_RUN_JOB", "alpha-insight-daily-job-dev")
    with pytest.raises(RuntimeError, match="Invalid API_URL"):
        main_module.validate_runtime_api_url("http://localhost:8080")
    with pytest.raises(RuntimeError, match="Invalid API_URL"):
        main_module.validate_runtime_api_url("http://127.0.0.1:8080")

    # Deployed HTTPS URL passes
    main_module.validate_runtime_api_url("https://alpha-insight-web-dev-db25tnv5aa-as.a.run.app")


def test_insert_eoddata_skips_nan_and_non_positive_close() -> None:
    """Item 2: insert_EODData rejects NaN and <= 0 close rows."""
    mock_cursor = MagicMock()
    mock_cursor.rowcount = 1
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

    payload = {
        "meta": {"symbol": "GLW", "interval": "1d"},
        "values": [
            {"datetime": "2026-11-16", "open": 105.0, "high": 107.0, "low": 104.0, "close": 106.17, "volume": 1000},
            {"datetime": "2026-11-17", "open": 0.0, "high": 0.0, "low": 0.0, "close": math.nan, "volume": 0},
            {"datetime": "2026-11-18", "open": 0.0, "high": 0.0, "low": 0.0, "close": 0.0, "volume": 0},
        ],
    }

    inserted = pd_module.insert_EODData(mock_conn, payload)
    assert inserted == 1
    assert mock_cursor.executemany.call_count == 1
    inserted_rows = mock_cursor.executemany.call_args[0][1]
    assert len(inserted_rows) == 1
    assert inserted_rows[0][1] == "2026-11-16"
    assert inserted_rows[0][5] == pytest.approx(106.17)


def test_portfolio_overview_all_symbols_forward_fill_and_annotations() -> None:
    """Item 2: All symbols returned (no top-5 cap), invalid eodprice forward-fills, annotations included."""
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, future=True)
    db = Session()

    try:
        symbols = ["0700.HK", "5E2.SI", "9988.HK", "BN4.SI", "D05.SI", "GLW", "IBIT"]
        for sym in symbols:
            ccy = "HKD" if sym.endswith(".HK") else ("SGD" if sym.endswith(".SI") else "USD")
            db.add(Watchlist(user_id=1, watchlistname="Default", symbol=sym, name=sym, currency=ccy))

        # Two weekday summary dates
        for d in (date(2026, 11, 16), date(2026, 11, 17)):
            db.add(
                DailyPortfolioSummary(
                    user_id=1,
                    date=d,
                    currency="SGD",
                    investment=True,
                    total_capital=100000.0,
                    position_market_value=120000.0,
                    realized_pnl=5000.0,
                    unrealized_pnl=15000.0,
                    margin_loan_balance=10000.0,
                    daily_interest_accrued=5.0,
                    cumulative_interest_accrued=50.0,
                    total_asset_value=225000.0,
                    total_pnl=19950.0,
                    pct_pnl=19.95,
                )
            )

        # Positions for all 7 symbols on Nov 16; GLW has invalid 0.0 on Nov 17 (should forward-fill)
        for sym in symbols:
            db.add(
                Position(
                    user_id=1,
                    tradedate=date(2026, 11, 16),
                    symbol=sym,
                    investment=True,
                    avgprice=100.0,
                    quantity=10.0,
                    eodprice=110.0,
                )
            )
        db.add(
            Position(
                user_id=1,
                tradedate=date(2026, 11, 17),
                symbol="GLW",
                investment=True,
                avgprice=100.0,
                quantity=10.0,
                eodprice=0.0,
            )
        )

        # Trade and Capital annotations inside window
        db.add(
            Trade(
                user_id=1,
                symbol="9988.HK",
                buysell="B",
                tradedate=datetime(2026, 11, 16, 10, 0, 0),
                investment=True,
                price=115.0,
                quantity=100.0,
                remarks="Add Alibaba",
            )
        )
        db.add(
            Capital(
                user_id=1,
                broker="Saxo",
                transtype="D",
                accounttype="C",
                amount=25000.0,
                currency="SGD",
                date=date(2026, 11, 17),
                remarks="Top up",
            )
        )
        db.commit()

        res = get_portfolio_4chart_overview(db, user_id=1, end_date="2026-11-17", currency="SGD", timeframe="1M")

        stocks = res["chart2_pnl_breakdown"]["stocks"]
        # All 7 symbols present (no 5-symbol cap)
        assert sorted(stocks.keys()) == sorted(symbols)

        # GLW on Nov 17 forward-filled from Nov 16 (+100.0) instead of plunging to -1000.0
        glw_series = {pt["date"]: pt["pnl"] for pt in stocks["GLW"]}
        assert glw_series["2026-11-16"] == pytest.approx(100.0)
        assert glw_series["2026-11-17"] == pytest.approx(100.0)

        # Annotations returned
        assert len(res["trade_annotations"]) == 1
        assert res["trade_annotations"][0]["symbol"] == "9988.HK"
        assert res["trade_annotations"][0]["currency"] == "HKD"
        assert len(res["capital_annotations"]) == 1
        assert res["capital_annotations"][0]["transtype"] == "D"
        assert res["capital_annotations"][0]["amount"] == pytest.approx(25000.0)
    finally:
        db.close()
        engine.dispose()


def test_workflows_configure_daily_jobs_with_api_url_and_api_key() -> None:
    """Item 3: Both deploy-dev.yml and deploy-prod.yml wire API_URL and API_KEY for daily jobs."""
    dev_wf = Path(".github/workflows/deploy-dev.yml").read_text(encoding="utf-8")
    assert "alpha-insight-daily-job-dev" in dev_wf
    assert "API_URL=${WEB_URL}" in dev_wf
    assert "API_KEY=alpha-api-key-dev:latest" in dev_wf

    prod_wf = Path(".github/workflows/deploy-prod.yml").read_text(encoding="utf-8")
    assert "alpha-insight-daily-job-prod" in prod_wf
    assert "API_URL=${WEB_URL}" in prod_wf
    assert "API_KEY=alpha-api-key:latest" in prod_wf


def test_update_watchlist_item_repo_and_endpoint() -> None:
    """Item 9: update_watchlist_item updates display name and transfers between watchlist groups."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    from sqlalchemy import select

    from backend.repositories.watchlist_repo import add_watchlist_item, update_watchlist_item

    # Add initial item in 'Watchlist'
    add_watchlist_item(db, user_id=1, symbol="GLW", name="Corning", watchlist_name="Watchlist")

    # Update name and group to 'Holding'
    updated = update_watchlist_item(
        db,
        user_id=1,
        symbol="GLW",
        original_watchlist_name="Watchlist",
        new_name="Corning Incorporated",
        new_watchlist_name="Holding",
    )
    assert updated is not None
    assert updated.symbol == "GLW"
    assert updated.name == "Corning Incorporated"
    assert updated.watchlistname == "Holding"

    # Verify old row under 'Watchlist' no longer exists and new row under 'Holding' exists
    old = db.scalar(
        select(Watchlist).where(
            Watchlist.user_id == 1, Watchlist.symbol == "GLW", Watchlist.watchlistname == "Watchlist"
        )
    )
    assert old is None
    new = db.scalar(
        select(Watchlist).where(Watchlist.user_id == 1, Watchlist.symbol == "GLW", Watchlist.watchlistname == "Holding")
    )
    assert new is not None
    assert new.name == "Corning Incorporated"
    db.close()


def test_upsert_eod_and_tick_data_populates_updatetimestamp() -> None:
    """Item 10: upsert_eod_data and upsert_tick_data populate updatetimestamp."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    from sqlalchemy import select

    from backend.db.models import EodData, TickData
    from backend.repositories.market_repo import upsert_eod_data, upsert_tick_data

    # Test EOD upsert
    bars_eod = [{"date": "2026-11-20", "open": 100.0, "high": 105.0, "low": 98.0, "close": 102.0, "volume": 1000.0}]
    count = upsert_eod_data(db, "GLW", bars_eod)
    assert count == 1

    eod_record = db.scalar(select(EodData).where(EodData.symbol == "GLW", EodData.date == date(2026, 11, 20)))
    assert eod_record is not None
    assert eod_record.updatetimestamp is not None
    assert isinstance(eod_record.updatetimestamp, datetime)

    # Test Tick upsert
    bars_tick = [
        {
            "datetime": "2026-11-20T10:00:00",
            "open": 100.0,
            "high": 105.0,
            "low": 98.0,
            "close": 102.0,
            "volume": 1000.0,
        }
    ]
    tick_count = upsert_tick_data(db, "GLW", "5m", bars_tick)
    assert tick_count == 1

    tick_record = db.scalar(select(TickData).where(TickData.symbol == "GLW", TickData.interval == "5m"))
    assert tick_record is not None
    assert tick_record.updatetimestamp is not None
    assert isinstance(tick_record.updatetimestamp, datetime)

    db.close()
