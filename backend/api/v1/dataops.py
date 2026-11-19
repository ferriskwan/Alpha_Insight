"""DataOps market data ingestion and system date management routes."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.config import Settings
from backend.db.models import EodData, ExchangeRate, SysValue, Watchlist
from backend.db.session import get_db_session
from backend.dependencies import get_current_settings
from backend.repositories.market_repo import (
    get_eod_data,
    get_tick_data,
    upsert_eod_data,
    upsert_fx_rates,
    upsert_tick_data,
)
from backend.schemas.market import FxRateItem, MarketSeriesPayload

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sys/init")
def sys_init(
    db: Session = Depends(get_db_session),
    settings: Settings = Depends(get_current_settings),
) -> dict[str, str]:
    """Initialize system execution dates and update GLOBAL_TODAY to current date."""
    today_date = date.today()

    # Update or insert GLOBAL_TODAY
    today_rec = db.scalar(select(SysValue).where(SysValue.name == "GLOBAL_TODAY"))
    if not today_rec:
        today_rec = SysValue(
            name="GLOBAL_TODAY",
            type="DATE",
            datevalue=today_date,
            description="Active batch calculation valuation date",
        )
        db.add(today_rec)
    else:
        today_rec.datevalue = today_date

    # Retrieve GLOBAL_STARTDATE
    start_rec = db.scalar(select(SysValue).where(SysValue.name == "GLOBAL_STARTDATE"))
    if not start_rec:
        default_start = today_date - timedelta(days=365)
        start_rec = SysValue(
            name="GLOBAL_STARTDATE",
            type="DATE",
            datevalue=default_start,
            description="Global historical market data ingestion start date",
        )
        db.add(start_rec)

    db.commit()

    global_start = (
        start_rec.datevalue.isoformat() if start_rec.datevalue else (today_date - timedelta(days=365)).isoformat()
    )
    global_today = today_date.isoformat()

    return {
        "global_startdate": global_start,
        "global_today": global_today,
    }


@router.get("/sys/env")
def sys_env(settings: Settings = Depends(get_current_settings)) -> dict[str, str]:
    """Return system environment mode for backwards compatibility."""
    return {"env": settings.env}


@router.get("/eod/symbols")
def get_eod_symbols(
    global_startdate: str = Query(..., description="Default global start date"),
    db: Session = Depends(get_db_session),
) -> list[dict[str, str]]:
    """Return list of distinct watchlist symbols paired with their incremental start dates."""
    symbols = list(db.scalars(select(Watchlist.symbol).distinct().order_by(Watchlist.symbol)).all())
    result = []
    for s in symbols:
        max_date = db.scalar(select(func.max(EodData.date)).where(EodData.symbol == s))
        if max_date:
            next_start = (max_date + timedelta(days=1)).isoformat()
        else:
            next_start = global_startdate
        result.append({"symbol": s, "start_date": next_start})
    return result


@router.post("/eod")
def upload_eod_data(
    payload: MarketSeriesPayload,
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Upsert daily EOD OHLCV records."""
    symbol = payload.meta.get("symbol", "").upper()
    if not symbol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload meta missing 'symbol'",
        )

    count = upsert_eod_data(db, symbol, payload.values)
    return {
        "status": "success",
        "symbol": symbol,
        "inserted_or_updated": count,
    }


@router.get("/eod/{symbol}")
def fetch_eod_series(
    symbol: str,
    days_to_extract: int = Query(default=365),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Fetch stored historical daily OHLCV bars for a symbol."""
    sym = symbol.upper()
    rows = get_eod_data(db, sym, limit=days_to_extract)
    values = [
        {
            "datetime": r.date.isoformat(),
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
        }
        for r in rows
    ]
    return {
        "meta": {
            "symbol": sym,
            "interval": "1d",
            "values_count": len(values),
        },
        "values": values,
    }


@router.get("/fx/symbols")
def get_fx_symbols(
    global_startdate: str = Query(..., description="Default global start date"),
    db: Session = Depends(get_db_session),
) -> list[dict[str, str]]:
    """Return distinct foreign currencies from watchlist with incremental fetch start dates."""
    currencies = list(
        db.scalars(
            select(Watchlist.currency).where(Watchlist.currency.isnot(None), Watchlist.currency != "USD").distinct()
        ).all()
    )
    result = []
    for cur in currencies:
        if not cur:
            continue
        # Yahoo Finance convention: USDSGD=X or SGD=X
        yahoo_symbol = f"{cur}=X" if not cur.startswith("USD") else f"{cur}USD=X"
        max_date = db.scalar(
            select(func.max(ExchangeRate.date)).where(
                ExchangeRate.currency == cur,
                ExchangeRate.base_currency == "USD",
                ExchangeRate.date <= func.current_date(),
            )
        )
        if max_date:
            next_start = (max_date + timedelta(days=1)).isoformat()
        else:
            next_start = global_startdate
        result.append(
            {
                "symbol": yahoo_symbol,
                "currency": cur,
                "start_date": next_start,
            }
        )
    return result


@router.post("/fx")
def upload_fx_rates(
    payload: list[FxRateItem] | list[dict[str, Any]],
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Upsert foreign exchange rates."""
    items = [item.model_dump() if isinstance(item, FxRateItem) else item for item in payload]
    count = upsert_fx_rates(db, items)
    return {
        "status": "success",
        "inserted_or_updated": count,
    }


@router.get("/tick/symbols")
def get_tick_symbols(
    global_today: str = Query(..., description="Valuation today date"),
    db: Session = Depends(get_db_session),
) -> list[dict[str, str]]:
    """Return watchlist symbols for intraday tick data download."""
    symbols = list(db.scalars(select(Watchlist.symbol).distinct().order_by(Watchlist.symbol)).all())
    # 5-minute ticks are fetched for today's market session
    return [{"symbol": s, "start_date": global_today} for s in symbols]


@router.post("/tick")
def upload_tick_data(
    payload: MarketSeriesPayload,
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Upsert intraday 5-minute OHLCV tick records."""
    symbol = payload.meta.get("symbol", "").upper()
    interval = payload.meta.get("interval", "5m")
    if not symbol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload meta missing 'symbol'",
        )

    count = upsert_tick_data(db, symbol, interval, payload.values)
    return {
        "status": "success",
        "symbol": symbol,
        "interval": interval,
        "inserted_or_updated": count,
    }


@router.get("/tick/{symbol}")
def fetch_tick_series(
    symbol: str,
    days_to_extract: int = Query(default=5),
    interval: str = Query(default="5m"),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Fetch stored intraday Tick bars for a symbol."""
    sym = symbol.upper()
    start_d = date.today() - timedelta(days=days_to_extract)
    rows = get_tick_data(db, sym, interval=interval, limit=1000, start_date=start_d)
    values = [
        {
            "datetime": r.timestamp.isoformat(),
            "open": r.open,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
        }
        for r in rows
    ]
    return {
        "meta": {
            "symbol": sym,
            "interval": interval,
            "values_count": len(values),
        },
        "values": values,
    }
