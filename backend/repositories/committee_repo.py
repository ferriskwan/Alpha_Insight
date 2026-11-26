"""Repository for the 4-Analyst Committee, historical output lookup, and run persistence."""

from __future__ import annotations

import math
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.db.models import (
    AgentAnalystOutput,
    AgentChatMessageRecord,
    AgentCommitteeRun,
    EodData,
    ExchangeRate,
    Trade,
    TransCost,
    Watchlist,
)
from backend.repositories import audit_repo, portfolio_repo, research_repo


def _sanitize_json_payload(obj: Any) -> Any:
    """Recursively replace NaN or Inf floats with None so PostgreSQL JSON and FastAPI serialization never fail."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {str(k): _sanitize_json_payload(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_json_payload(v) for v in obj]
    return obj


def serialize_analyst_output(row: AgentAnalystOutput) -> dict[str, Any]:
    """Convert an AgentAnalystOutput ORM row into a dictionary matching AgentAnalystOutputResponse."""
    return {
        "id": row.id,
        "run_id": row.run_id,
        "user_id": row.user_id,
        "symbol": row.symbol,
        "analyst_role": row.analyst_role,
        "directional_bias": row.directional_bias,
        "confidence_score": int(row.confidence_score or 50),
        "trend_status": row.trend_status or "Initiation",
        "summary_headline": row.summary_headline,
        "markdown_output": row.markdown_output,
        "structured_metrics": row.structured_metrics if isinstance(row.structured_metrics, dict) else {},
        "referenced_output_ids": (
            [int(x) for x in row.referenced_output_ids] if isinstance(row.referenced_output_ids, list) else []
        ),
        "created_at": row.created_at,
    }


def get_past_outputs_for_symbol(
    db: Session,
    symbol: str,
    lookback_runs: int = 3,
) -> list[dict[str, Any]]:
    """Retrieve historical outputs across all 4 analyst roles and Executive Summaries for symbol."""
    clean_symbol = symbol.strip().upper()
    if lookback_runs <= 0:
        return []

    max_rows = lookback_runs * 5
    stmt = (
        select(AgentAnalystOutput)
        .where(AgentAnalystOutput.symbol == clean_symbol)
        .order_by(desc(AgentAnalystOutput.created_at), desc(AgentAnalystOutput.id))
        .limit(max_rows)
    )
    rows = list(db.scalars(stmt).all())
    return [serialize_analyst_output(r) for r in rows]


def build_domain_contexts_for_symbol(
    db: Session,
    symbol: str,
    user_id: int = 1,
) -> dict[str, Any]:
    """Assemble segregated domain payloads for Technical, Fundamental, Macro, and Risk analysts."""
    clean_symbol = symbol.strip().upper()

    # 1. Technical & Chart Series (from research_repo)
    analyst_data = research_repo.get_stock_analyst_data(db, symbol=clean_symbol, user_id=user_id)
    series = analyst_data.get("series", [])
    latest_bar = series[-1] if series else {}
    fib_levels_data = analyst_data.get("fibonacciLevels", {})
    highs = [float(c.get("high") or 0.0) for c in series if float(c.get("high") or 0.0) > 0]
    lows = [float(c.get("low") or 0.0) for c in series if float(c.get("low") or 0.0) > 0]
    cycle_high = float(
        fib_levels_data.get("cycleHigh")
        or (max(highs) if highs else float(analyst_data.get("latestPrice") or 185.0) * 1.1)
    )
    cycle_low = float(
        fib_levels_data.get("cycleLow")
        or (min(lows) if lows else float(analyst_data.get("latestPrice") or 185.0) * 0.85)
    )
    rng = max(0.01, cycle_high - cycle_low)

    latest_px = float(analyst_data.get("latestPrice", 185.0))
    daily_atr = analyst_data.get("latestAtr") or round(latest_px * 0.015, 2)
    microstructure = research_repo.get_intraday_microstructure_data(db, symbol=clean_symbol, latest_price=latest_px)
    microstructure["atr_14_daily"] = round(float(daily_atr), 2)

    technical_context = {
        "symbol": clean_symbol,
        "latest_close": latest_px,
        "day_change": analyst_data.get("dayChange", 0.0),
        "day_change_pct": analyst_data.get("dayChangePct", 0.0),
        "sma_30": latest_bar.get("sma"),
        "ema_100": latest_bar.get("ema"),
        "bb_upper": latest_bar.get("bbUpper"),
        "bb_middle": latest_bar.get("bbMiddle"),
        "bb_lower": latest_bar.get("bbLower"),
        "rsi_13": latest_bar.get("rsi"),
        "macd": latest_bar.get("macd"),
        "macd_signal": latest_bar.get("macdSignal"),
        "macd_hist": latest_bar.get("macdHist"),
        "atr_14": round(float(daily_atr), 2),
        "fibonacci_levels": {
            "lookback_bars": fib_levels_data.get("lookbackBars", 252),
            "cycle_high": round(cycle_high, 2),
            "fib_236": round(float(fib_levels_data.get("fib236", cycle_high - 0.236 * rng)), 2),
            "fib_382": round(float(fib_levels_data.get("fib382", cycle_high - 0.382 * rng)), 2),
            "fib_500": round(float(fib_levels_data.get("fib500", cycle_high - 0.500 * rng)), 2),
            "fib_618": round(float(fib_levels_data.get("fib618", cycle_high - 0.618 * rng)), 2),
            "fib_786": round(float(fib_levels_data.get("fib786", cycle_high - 0.786 * rng)), 2),
            "cycle_low": round(cycle_low, 2),
        },
        "intraday_microstructure": microstructure,
        "recent_candles": series[-10:],
    }

    # 2. Fundamental Context
    watch_row = db.scalar(select(Watchlist).where(Watchlist.symbol == clean_symbol).limit(1))
    fundamental_context = {
        "symbol": clean_symbol,
        "company_name": (watch_row.name if watch_row and watch_row.name else clean_symbol),
        "currency": (watch_row.currency if watch_row and watch_row.currency else "USD"),
        "latest_price": analyst_data.get("latestPrice", 185.0),
        "cycle_high_52w": round(cycle_high, 2),
        "cycle_low_52w": round(cycle_low, 2),
        "evaluation_focus": [
            "7-Day News & Catalyst Scan",
            "Revenue & Operating Margin Trajectory",
            "Valuation Multiples (Forward P/E, EV/EBITDA, P/FCF)",
            "Balance Sheet Net Liquidity & Solvency",
        ],
    }

    # 3. Macro & Sector Context (incorporating latest stored [Macroeconomics] outputs)
    macro_data = research_repo.get_macroeconomics_data(db)
    sector_data = research_repo.get_sector_performance(db, horizon="1M")
    yield_spread = "-0.40%"
    for ind in macro_data.get("macroIndicators", []):
        if "10Y - 2Y" in str(ind.get("name", "")):
            yield_spread = str(ind.get("value", "-0.40%"))
    stored_macro_rows = list(
        db.scalars(
            select(AgentAnalystOutput)
            .where(AgentAnalystOutput.symbol == "MACRO")
            .order_by(desc(AgentAnalystOutput.created_at), desc(AgentAnalystOutput.id))
            .limit(4)
        ).all()
    )
    latest_stored_macro = [
        {
            "id": r.id,
            "analyst_role": r.analyst_role,
            "directional_bias": r.directional_bias,
            "confidence_score": r.confidence_score,
            "summary_headline": r.summary_headline,
        }
        for r in stored_macro_rows
    ]
    macro_context = {
        "symbol": clean_symbol,
        "yield_spread_10y_2y": yield_spread,
        "yield_curve": macro_data.get("yieldCurve", []),
        "macro_indicators": macro_data.get("macroIndicators", []),
        "fx_crosses": macro_data.get("fxCrosses", []),
        "top_gics_sectors_1m": sector_data.get("sectors", [])[:5],
        "latest_stored_macro_outputs": latest_stored_macro,
    }

    # 4. Risk Manager Context (Bidirectional Cost Accounting, Margin & Trans Cost)
    user_trades = list(
        db.scalars(
            select(Trade).where(Trade.user_id == user_id, Trade.symbol == clean_symbol).order_by(Trade.tradedate)
        ).all()
    )
    if not user_trades and user_id != 1:
        user_trades = list(
            db.scalars(
                select(Trade).where(Trade.user_id == 1, Trade.symbol == clean_symbol).order_by(Trade.tradedate)
            ).all()
        )
    latest_px = float(analyst_data.get("latestPrice") or 185.0)
    accounting = portfolio_repo.compute_bidirectional_position_accounting(
        user_trades,
        eod_price=latest_px,
        current_market_price=latest_px,
    )
    trans_costs = list(db.scalars(select(TransCost).where(TransCost.user_id == user_id).limit(20)).all())
    total_fees = round(sum(float(c.amount or 0.0) for c in trans_costs), 2)

    risk_context = {
        "symbol": clean_symbol,
        "current_price": latest_px,
        "net_open_quantity": accounting["net_open_qty"],
        "is_short": accounting["is_short"],
        "avg_buy_cost": accounting["avg_buy_cost"],
        "avg_sell_cost": accounting["avg_sell_cost"],
        "avg_cost": accounting["avg_cost"],
        "unrealized_pnl": accounting["unrealized_pnl"],
        "realized_pnl": accounting["realized_pnl"],
        "cumulative_trans_cost_usd": total_fees,
        "suggested_atr_stop_loss": round(latest_px - (1.5 * float(daily_atr)), 2),
        "max_single_position_risk_pct_nav": 1.25,
    }

    return {
        "technical_context": _sanitize_json_payload(technical_context),
        "fundamental_context": _sanitize_json_payload(fundamental_context),
        "macro_context": _sanitize_json_payload(macro_context),
        "risk_context": _sanitize_json_payload(risk_context),
        "chart_candles": _sanitize_json_payload(series),
        "chart_trades": _sanitize_json_payload(analyst_data.get("trades", [])),
    }


def create_committee_run_with_outputs(
    db: Session,
    user_id: int,
    orchestration_result: dict[str, Any],
) -> tuple[AgentCommitteeRun, list[AgentAnalystOutput]]:
    """Persist a completed 4-analyst committee run and all 5 output records in PostgreSQL."""
    run_row = AgentCommitteeRun(
        user_id=user_id,
        symbol=orchestration_result["symbol"],
        provider=orchestration_result["provider"],
        model=orchestration_result["model"],
        consensus_bias=orchestration_result["consensus_bias"],
        consensus_confidence=int(orchestration_result["consensus_confidence"]),
        executive_summary=orchestration_result["executive_summary"],
        vote_breakdown=orchestration_result["vote_breakdown"],
    )
    db.add(run_row)
    db.flush()

    output_rows: list[AgentAnalystOutput] = []
    for item in orchestration_result.get("outputs", []):
        out_row = AgentAnalystOutput(
            run_id=run_row.id,
            user_id=user_id,
            symbol=orchestration_result["symbol"],
            analyst_role=item["analyst_role"],
            directional_bias=item["directional_bias"],
            confidence_score=int(item["confidence_score"]),
            trend_status=item["trend_status"],
            summary_headline=item["summary_headline"],
            markdown_output=item["markdown_output"],
            structured_metrics=_sanitize_json_payload(item.get("structured_metrics") or {}),
            referenced_output_ids=item.get("referenced_output_ids") or [],
        )
        db.add(out_row)
        output_rows.append(out_row)

    db.commit()
    db.refresh(run_row)
    for r in output_rows:
        db.refresh(r)

    try:
        audit_repo.log_action(
            db=db,
            user_id=user_id,
            action="COMMITTEE_RUN_CREATED",
            entity="agent_committee_runs",
            entity_id=str(run_row.id),
            new_values={
                "symbol": run_row.symbol,
                "model": run_row.model,
                "consensus_bias": run_row.consensus_bias,
                "output_ids": [r.id for r in output_rows],
            },
        )
    except Exception:
        pass

    return run_row, output_rows


def list_committee_runs(
    db: Session,
    symbol: Optional[str] = None,
    limit: int = 20,
) -> list[AgentCommitteeRun]:
    """List recent committee runs ordered newest first."""
    stmt = select(AgentCommitteeRun).order_by(desc(AgentCommitteeRun.created_at), desc(AgentCommitteeRun.id))
    if symbol and symbol.strip():
        stmt = stmt.where(AgentCommitteeRun.symbol == symbol.strip().upper())
    stmt = stmt.limit(max(1, min(limit, 100)))
    return list(db.scalars(stmt).all())


def get_committee_run_by_id(
    db: Session,
    run_id: int,
) -> Optional[tuple[AgentCommitteeRun, list[AgentAnalystOutput]]]:
    """Retrieve a specific committee run and its associated analyst outputs."""
    run_row = db.scalar(select(AgentCommitteeRun).where(AgentCommitteeRun.id == run_id))
    if not run_row:
        return None
    outputs = list(
        db.scalars(
            select(AgentAnalystOutput).where(AgentAnalystOutput.run_id == run_id).order_by(AgentAnalystOutput.id)
        ).all()
    )
    return run_row, outputs


def list_analyst_outputs(
    db: Session,
    symbol: Optional[str] = None,
    analyst_role: Optional[str] = None,
    trend_status: Optional[str] = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Query individual analyst outputs for historical inspection and Investment Notes 0..N linking."""
    stmt = select(AgentAnalystOutput).order_by(desc(AgentAnalystOutput.created_at), desc(AgentAnalystOutput.id))
    if symbol and symbol.strip() and symbol.strip().lower() != "all":
        stmt = stmt.where(AgentAnalystOutput.symbol == symbol.strip().upper())
    if analyst_role and analyst_role.strip() and analyst_role.strip().lower() != "all":
        stmt = stmt.where(AgentAnalystOutput.analyst_role == analyst_role.strip().lower())
    if trend_status and trend_status.strip() and trend_status.strip().lower() != "all":
        stmt = stmt.where(AgentAnalystOutput.trend_status == trend_status.strip().capitalize())
    stmt = stmt.limit(max(1, min(limit, 200)))
    rows = list(db.scalars(stmt).all())
    return [serialize_analyst_output(r) for r in rows]


def save_chat_turn(
    db: Session,
    user_id: int,
    symbol: str,
    run_id: Optional[int],
    user_content: str,
    assistant_reply: str,
    model: Optional[str] = None,
) -> list[AgentChatMessageRecord]:
    """Persist user question and assistant reply tied to the Stock Analysis run and symbol."""
    clean_symbol = (symbol or "AAPL").strip().upper()
    resolved_run_id = run_id
    if resolved_run_id is not None:
        exists = db.scalar(select(AgentCommitteeRun.id).where(AgentCommitteeRun.id == resolved_run_id))
        if not exists:
            resolved_run_id = None
    if resolved_run_id is None:
        latest_run = db.scalar(
            select(AgentCommitteeRun.id)
            .where(AgentCommitteeRun.symbol == clean_symbol)
            .order_by(desc(AgentCommitteeRun.created_at), desc(AgentCommitteeRun.id))
            .limit(1)
        )
        if latest_run:
            resolved_run_id = int(latest_run)

    user_row = AgentChatMessageRecord(
        run_id=resolved_run_id,
        user_id=user_id,
        symbol=clean_symbol,
        role="user",
        content=user_content,
        model=model,
    )
    assistant_row = AgentChatMessageRecord(
        run_id=resolved_run_id,
        user_id=user_id,
        symbol=clean_symbol,
        role="assistant",
        content=assistant_reply,
        model=model,
    )
    db.add(user_row)
    db.add(assistant_row)
    db.commit()
    db.refresh(user_row)
    db.refresh(assistant_row)
    return [user_row, assistant_row]


def get_chat_history(
    db: Session,
    symbol: str,
    run_id: Optional[int] = None,
    user_id: int = 1,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Retrieve stored Chat Session messages tied to a symbol and optional analysis run_id."""
    clean_symbol = symbol.strip().upper()
    stmt = select(AgentChatMessageRecord).where(AgentChatMessageRecord.symbol == clean_symbol)
    if run_id is not None:
        stmt = stmt.where(AgentChatMessageRecord.run_id == run_id)
    stmt = stmt.order_by(AgentChatMessageRecord.created_at.asc(), AgentChatMessageRecord.id.asc()).limit(limit)
    rows = list(db.scalars(stmt).all())
    return [
        {
            "id": r.id,
            "run_id": r.run_id,
            "user_id": r.user_id,
            "symbol": r.symbol,
            "role": "assistant" if r.role == "assistant" else "user",
            "content": r.content,
            "model": r.model,
            "created_at": r.created_at,
        }
        for r in rows
    ]


def clear_chat_history(
    db: Session,
    symbol: str,
    run_id: Optional[int] = None,
    user_id: int = 1,
) -> int:
    """Delete stored Chat Session messages for a symbol and optional run_id."""
    from sqlalchemy import delete

    clean_symbol = symbol.strip().upper()
    stmt = delete(AgentChatMessageRecord).where(AgentChatMessageRecord.symbol == clean_symbol)
    if run_id is not None:
        stmt = stmt.where(AgentChatMessageRecord.run_id == run_id)
    res = db.execute(stmt)
    db.commit()
    return int(getattr(res, "rowcount", 0) or 0)


def build_macro_workbench_context(
    db: Session,
    benchmark_symbol: str = "^SPX",
    user_id: int = 1,
) -> dict[str, Any]:
    """Build Watchlist-derived Macroeconomics context from watchlist, exchange_rate, and eoddata."""
    clean_bench = (benchmark_symbol or "^SPX").strip().upper()

    watch_rows = list(db.scalars(select(Watchlist).order_by(Watchlist.symbol)).all())
    seen_syms: set[str] = set()
    unique_watch: list[Watchlist] = []
    for w in watch_rows:
        sym = (w.symbol or "").strip().upper()
        if sym and sym not in seen_syms:
            seen_syms.add(sym)
            unique_watch.append(w)

    watchlist_symbols = [w.symbol.strip().upper() for w in unique_watch]
    secular_set = {"NVDA", "ASML", "MU", "TSM", "GLW", "SOXX", "XE", "IBIT", "AA"}
    benchmark_set = {"^SPX", "^NDX", "^DJI", "^STI", "SOXX", "IBIT"}

    us_equities: list[str] = []
    sgx_apac: list[str] = []
    secular_thematic: list[str] = []
    benchmarks: list[str] = []

    for sym in watchlist_symbols:
        if sym in benchmark_set or sym.startswith("^"):
            benchmarks.append(sym)
        if sym.endswith((".SI", ".HK", ".SS", ".SZ", ".T")) or sym in ("^STI", "^HSI", "^N225", "TSM"):
            sgx_apac.append(sym)
        elif not sym.startswith("^"):
            us_equities.append(sym)
        if sym in secular_set:
            secular_thematic.append(sym)

    if not benchmarks:
        benchmarks = ["^SPX", "^NDX", "^DJI", "^STI"]

    watchlist_exposure = {
        "us_equities_and_etfs": us_equities,
        "sgx_and_apac": sgx_apac,
        "secular_and_thematic": secular_thematic,
        "benchmarks": benchmarks,
    }

    # Live FX from public.exchange_rate
    fx_rows = list(db.scalars(select(ExchangeRate).order_by(desc(ExchangeRate.date)).limit(15)).all())
    fx_rates: list[dict[str, Any]] = []
    seen_pairs: set[str] = set()
    for fx in fx_rows:
        base_c = (fx.base_currency or "USD").strip().upper()
        quote_c = (fx.currency or "SGD").strip().upper()
        pair = f"{base_c}/{quote_c}"
        if pair not in seen_pairs and fx.rate and not math.isnan(float(fx.rate)):
            seen_pairs.add(pair)
            fx_rates.append(
                {
                    "pair": pair,
                    "rate": round(float(fx.rate), 4),
                    "date": fx.date.isoformat() if hasattr(fx.date, "isoformat") else str(fx.date),
                }
            )
    if not fx_rates:
        fx_rates.append({"pair": "USD/SGD", "rate": 1.3450, "date": "2026-11-18"})

    # Live Benchmark Index Snapshots from public.eoddata
    target_bench_syms = benchmarks if benchmarks else watchlist_symbols[:6]
    name_map = {w.symbol.strip().upper(): (w.name or w.symbol.strip().upper()) for w in unique_watch}
    curr_map = {w.symbol.strip().upper(): (w.currency or "USD") for w in unique_watch}

    benchmark_snapshots: list[dict[str, Any]] = []
    for b_sym in target_bench_syms:
        eod_bars = list(
            db.scalars(select(EodData).where(EodData.symbol == b_sym).order_by(desc(EodData.date)).limit(5)).all()
        )
        valid_closes = [
            float(b.close)
            for b in eod_bars
            if b.close is not None and not math.isnan(float(b.close)) and float(b.close) > 0
        ]
        if valid_closes:
            latest_close = round(valid_closes[0], 2)
            prev_close = round(valid_closes[1], 2) if len(valid_closes) > 1 else latest_close
            chg = round(latest_close - prev_close, 2)
            chg_pct = round((chg / prev_close) * 100.0, 2) if prev_close else 0.0
            benchmark_snapshots.append(
                {
                    "symbol": b_sym,
                    "name": name_map.get(b_sym, b_sym),
                    "last_price": latest_close,
                    "change": chg,
                    "change_pct": chg_pct,
                    "currency": curr_map.get(b_sym, "SGD" if b_sym == "^STI" else "USD"),
                }
            )

    # Interactive Canvas Chart data (Multi-day EOD + Intraday 5m) for selected benchmark
    chart_data = research_repo.get_stock_analyst_data(db, symbol=clean_bench, user_id=user_id)

    return {
        "benchmark_symbol": clean_bench,
        "watchlist_symbols": watchlist_symbols,
        "watchlist_exposure": watchlist_exposure,
        "benchmark_snapshots": _sanitize_json_payload(benchmark_snapshots),
        "fx_rates": _sanitize_json_payload(fx_rates),
        "chart_candles": _sanitize_json_payload(chart_data.get("series", [])),
        "intraday_candles": _sanitize_json_payload(chart_data.get("intradaySeries", [])),
    }


def get_latest_macro_workbench_payload(
    db: Session,
    benchmark_symbol: str = "^SPX",
    user_id: int = 1,
) -> dict[str, Any]:
    """Load the latest stored [Macroeconomics] run and outputs along with live Watchlist/FX/Benchmark context."""
    ctx = build_macro_workbench_context(db=db, benchmark_symbol=benchmark_symbol, user_id=user_id)
    latest_run = db.scalar(
        select(AgentCommitteeRun)
        .where(AgentCommitteeRun.symbol == "MACRO")
        .order_by(desc(AgentCommitteeRun.created_at), desc(AgentCommitteeRun.id))
        .limit(1)
    )
    outputs: list[dict[str, Any]] = []
    past_outputs: list[dict[str, Any]] = []
    if latest_run:
        out_rows = list(
            db.scalars(
                select(AgentAnalystOutput)
                .where(AgentAnalystOutput.run_id == latest_run.id)
                .order_by(AgentAnalystOutput.id)
            ).all()
        )
        outputs = [serialize_analyst_output(r) for r in out_rows]
        past_rows = list(
            db.scalars(
                select(AgentAnalystOutput)
                .where(
                    AgentAnalystOutput.symbol == "MACRO",
                    AgentAnalystOutput.run_id < latest_run.id,
                )
                .order_by(desc(AgentAnalystOutput.created_at), desc(AgentAnalystOutput.id))
                .limit(12)
            ).all()
        )
        past_outputs = [serialize_analyst_output(r) for r in past_rows]

    return {
        "run": latest_run,
        "outputs": outputs,
        "past_outputs": past_outputs,
        **ctx,
    }


# ==============================================================================
# Epic 1.1: Sector Committee Context, History & Payloads
# ==============================================================================

GICS_SECTOR_NAMES: dict[str, str] = {
    "XLK": "Information Technology",
    "XLF": "Financials",
    "XLV": "Healthcare",
    "XLY": "Consumer Discretionary",
    "XLC": "Communication Services",
    "XLI": "Industrials",
    "XLP": "Consumer Staples",
    "XLE": "Energy",
    "XLB": "Materials",
    "XLU": "Utilities",
    "XLRE": "Real Estate",
}


def build_sector_committee_context(
    db: Session,
    symbol: str,
    user_id: int = 1,
) -> dict[str, Any]:
    """Assemble quantitative market metrics, rotation parameters, and news for a GICS sector ETF."""
    from backend.repositories.research_repo import get_sector_performance
    from backend.services.rss_service import fetch_sector_rss_news

    clean_sym = (symbol or "XLK").strip().upper()
    sector_name = GICS_SECTOR_NAMES.get(clean_sym, f"Sector {clean_sym}")

    # 1. Multi-horizon returns and rotation metrics
    perf_data = get_sector_performance(db=db, horizon="1M")
    matched_sector = next((s for s in perf_data.get("sectors", []) if s.get("ticker") == clean_sym), None)

    rotation_info = {
        "quadrant": matched_sector.get("relativeRotation", "Leading") if matched_sector else "Leading",
        "rs_score": matched_sector.get("rsScore", 1.0) if matched_sector else 1.0,
        "rs_momentum": matched_sector.get("rsMomentum", 0.0) if matched_sector else 0.0,
    }

    weight = matched_sector.get("weight", 0.0) if matched_sector else 0.0

    # Collect returns across horizons for this sector
    returns_by_horizon: dict[str, float] = {}
    for hz in ("1D", "1W", "1M", "3M", "6M", "1Y"):
        hz_perf = get_sector_performance(db=db, horizon=hz)
        hz_match = next((s for s in hz_perf.get("sectors", []) if s.get("ticker") == clean_sym), None)
        returns_by_horizon[hz] = hz_match.get("value", 0.0) if hz_match else 0.0

    sector_metrics = {
        "symbol": clean_sym,
        "sector_name": sector_name,
        "weight": weight,
        "returns": returns_by_horizon,
        "rotation": rotation_info,
        "benchmark_return_1m": perf_data.get("benchmarkReturn", 0.0),
    }

    # 2. Fetch top 5 headlines from Yahoo Finance RSS
    news_items = fetch_sector_rss_news(clean_sym, limit=5)

    # 3. Retrieve past committee runs for historical memory
    past_rows = list(
        db.scalars(
            select(AgentAnalystOutput)
            .where(AgentAnalystOutput.symbol == clean_sym)
            .order_by(desc(AgentAnalystOutput.created_at), desc(AgentAnalystOutput.id))
            .limit(12)
        ).all()
    )
    past_outputs = [serialize_analyst_output(r) for r in past_rows]

    return {
        "symbol": clean_sym,
        "sector_name": sector_name,
        "sector_metrics": sector_metrics,
        "news_items": news_items,
        "past_outputs": past_outputs,
    }


def get_latest_sector_committee_payload(
    db: Session,
    symbol: str,
    run_id: Optional[int] = None,
    user_id: int = 1,
) -> dict[str, Any]:
    """Retrieve the latest (or specific run_id) sector committee run and historical runs list."""
    clean_sym = (symbol or "XLK").strip().upper()
    sector_name = GICS_SECTOR_NAMES.get(clean_sym, f"Sector {clean_sym}")

    if run_id:
        target_run = db.scalar(
            select(AgentCommitteeRun)
            .where(AgentCommitteeRun.id == run_id, AgentCommitteeRun.symbol == clean_sym)
            .limit(1)
        )
    else:
        target_run = db.scalar(
            select(AgentCommitteeRun)
            .where(AgentCommitteeRun.symbol == clean_sym)
            .order_by(desc(AgentCommitteeRun.created_at), desc(AgentCommitteeRun.id))
            .limit(1)
        )

    outputs: list[dict[str, Any]] = []
    if target_run:
        out_rows = list(
            db.scalars(
                select(AgentAnalystOutput)
                .where(AgentAnalystOutput.run_id == target_run.id)
                .order_by(AgentAnalystOutput.id)
            ).all()
        )
        outputs = [serialize_analyst_output(r) for r in out_rows]

    # Historical runs list for stepper
    history_rows = list(
        db.scalars(
            select(AgentCommitteeRun)
            .where(AgentCommitteeRun.symbol == clean_sym)
            .order_by(desc(AgentCommitteeRun.created_at), desc(AgentCommitteeRun.id))
            .limit(10)
        ).all()
    )
    history = [
        {
            "run_id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "consensus_bias": r.consensus_bias,
            "model": r.model,
        }
        for r in history_rows
    ]

    from backend.services.rss_service import fetch_sector_rss_news

    news_items = fetch_sector_rss_news(clean_sym, limit=5)

    return {
        "run": (
            {
                "id": target_run.id,
                "created_at": target_run.created_at.isoformat() if target_run.created_at else "",
                "consensus_bias": target_run.consensus_bias,
                "consensus_confidence": target_run.consensus_confidence,
                "model": target_run.model,
                "provider": target_run.provider,
            }
            if target_run
            else None
        ),
        "run_id": target_run.id if target_run else 0,
        "symbol": clean_sym,
        "sector_name": sector_name,
        "provider": target_run.provider if target_run else "gemini",
        "model": target_run.model if target_run else "gemini-2.5-flash",
        "consensus_bias": target_run.consensus_bias if target_run else "Neutral",
        "consensus_confidence": target_run.consensus_confidence if target_run else 50,
        "executive_summary": target_run.executive_summary if target_run else "",
        "vote_breakdown": target_run.vote_breakdown if target_run else {},
        "outputs": outputs,
        "history": history,
        "news_sources": news_items,
        "created_at": target_run.created_at.isoformat() if target_run and target_run.created_at else "",
    }
