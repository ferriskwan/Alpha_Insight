"""Research sub-application API routes: Stock Analyst, Macroeconomics, and GICS Sector Heatmap."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.db.models import AgentCommitteeRun
from backend.db.session import get_db_session
from backend.dependencies import get_current_user_optional
from backend.repositories.committee_repo import (
    build_sector_committee_context,
    create_committee_run_with_outputs,
    get_latest_sector_committee_payload,
)
from backend.repositories.market_repo import get_eod_data
from backend.repositories.portfolio_repo import get_trades
from backend.repositories.research_repo import (
    get_macroeconomics_data,
    get_sector_performance,
    get_stock_analyst_data,
)
from backend.schemas.auth import UserProfileResponse
from backend.services.agent_orchestrator import run_sector_committee_orchestration
from backend.services.chart_runner import generate_candlestick_png

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stock-analyst/{symbol}")
def get_stock_analyst(
    symbol: str,
    timeframe: str = Query(default="1Y"),
    sma: int = Query(default=20),
    ema: int = Query(default=50),
    bb: int = Query(default=20),
    bb_std: float = Query(default=2.0),
    rsi: int = Query(default=14),
    macd_fast: int = Query(default=12),
    macd_slow: int = Query(default=26),
    macd_signal: int = Query(default=9),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve comprehensive candlestick series, technical indicators, and user trade execution markers."""
    uid = user.id if user else 1
    indicators = {
        "smaPeriod": sma,
        "emaPeriod": ema,
        "bbPeriod": bb,
        "bbStd": bb_std,
        "rsiPeriod": rsi,
        "macdFast": macd_fast,
        "macdSlow": macd_slow,
        "macdSignal": macd_signal,
    }
    return get_stock_analyst_data(
        db=db,
        symbol=symbol,
        timeframe=timeframe,
        indicators=indicators,
        user_id=uid,
    )


@router.get("/stock-analyst/{symbol}/matplotlib-chart")
def get_stock_analyst_matplotlib(
    symbol: str,
    zoom_start: Optional[str] = Query(default=None, alias="zoomStart"),
    zoom_end: Optional[str] = Query(default=None, alias="zoomEnd"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> Response:
    """Render and return server-side Matplotlib chart screenshot matching the charting.py standard."""
    uid = user.id if user else 1
    clean_sym = symbol.strip().upper()
    eod_rows = get_eod_data(db, symbol=clean_sym)
    trades = get_trades(db, user_id=uid, symbol=clean_sym)
    if not trades and uid != 1:
        trades = get_trades(db, user_id=1, symbol=clean_sym)

    eod_payload = {
        "meta": {"symbol": clean_sym, "currency": "USD"},
        "values": [
            {
                "timestamp": r.date.isoformat(),
                "open": float(r.open or 0.0),
                "high": float(r.high or 0.0),
                "low": float(r.low or 0.0),
                "close": float(r.close or 0.0),
                "volume": float(r.volume or 0.0),
            }
            for r in eod_rows
        ],
    }
    trades_payload = [
        {
            "id": t.id,
            "symbol": t.symbol,
            "buysell": t.buysell,
            "tradedate": t.tradedate.isoformat(),
            "investment": t.investment,
            "price": float(t.price or 0.0),
            "quantity": float(t.quantity or 0.0),
        }
        for t in trades
    ]

    img_b64 = generate_candlestick_png(
        eod_data=eod_payload,
        trades=trades_payload,
        zoom_start=zoom_start,
        zoom_end=zoom_end,
    )
    if not img_b64:
        return Response(content=b"", media_type="image/png", status_code=status.HTTP_204_NO_CONTENT)

    import base64

    img_bytes = base64.b64decode(img_b64)
    return Response(content=img_bytes, media_type="image/png")


@router.get("/macroeconomics")
def get_macroeconomics(
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve US Treasury Yield Curve, benchmark macroeconomic indicators, and FX currency crosses."""
    return get_macroeconomics_data(db)


@router.get("/sectors")
def get_sectors(
    horizon: str = Query(default="1D"),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Retrieve 11 GICS sector performance metrics, weighting, and relative rotation categories."""
    return get_sector_performance(db, horizon=horizon)


@router.get("/sectors/{symbol}/committee")
def get_sector_committee(
    symbol: str,
    run_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db_session),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Retrieve the latest or specific historical sector committee run and citations."""
    user_id = user.id if user else 1
    return get_latest_sector_committee_payload(db=db, symbol=symbol, run_id=run_id, user_id=user_id)


@router.post("/sectors/{symbol}/committee/refresh")
async def refresh_sector_committee(
    symbol: str,
    provider: str = Query(default="gemini"),
    model: Optional[str] = Query(default=None),
    db: Session = Depends(get_db_session),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """On-demand execution of the 4-analyst Sector Committee with RSS & Gemini Grounding."""
    user_id = user.id if user else 1
    clean_sym = symbol.strip().upper()

    # Enforce strict 1-analysis-per-day quota
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing_today_run = db.scalar(
        select(AgentCommitteeRun)
        .where(AgentCommitteeRun.created_at >= today_start)
        .order_by(desc(AgentCommitteeRun.created_at), desc(AgentCommitteeRun.id))
        .limit(1)
    )
    if existing_today_run:
        res = get_latest_sector_committee_payload(
            db=db, symbol=clean_sym, run_id=existing_today_run.id, user_id=user_id
        )
        res["daily_quota_reached"] = True
        res["daily_quota_message"] = (
            f"Daily AI Analysis quota reached (1 run per day). "
            f"Loaded today's active analysis (Run #{existing_today_run.id})."
        )
        return res

    ctx = build_sector_committee_context(db=db, symbol=clean_sym, user_id=user_id)
    orch_res = await run_sector_committee_orchestration(
        symbol=clean_sym,
        provider=provider,
        model=model,
        sector_metrics=ctx["sector_metrics"],
        news_items=ctx["news_items"],
        past_outputs=ctx["past_outputs"],
    )
    run_row, output_rows = create_committee_run_with_outputs(
        db=db,
        user_id=user_id,
        orchestration_result=orch_res,
    )
    res = get_latest_sector_committee_payload(db=db, symbol=clean_sym, run_id=run_row.id, user_id=user_id)
    if orch_res.get("fallback_warning"):
        res["fallback_warning"] = orch_res["fallback_warning"]
    return res
