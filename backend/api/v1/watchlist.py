"""Watchlist and chart visualization API routes."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import SysValue, Watchlist
from backend.db.session import get_db_session
from backend.dependencies import get_current_user_optional
from backend.repositories.market_repo import (
    get_eod_data,
    get_tick_data,
    get_watchlist,
)
from backend.repositories.portfolio_repo import get_trades
from backend.repositories.watchlist_repo import (
    add_watchlist_item,
    get_user_watchlist_names,
    get_watchlist_items,
    remove_watchlist_item,
    update_watchlist_item,
)
from backend.schemas.auth import UserProfileResponse
from backend.schemas.market import WatchlistDataResponse, WatchlistSymbolItem
from backend.schemas.transactions import (
    MAX_SECURITY_NAME_LEN,
    MAX_SYMBOL_LEN,
    MAX_WATCHLIST_NAME_LEN,
)
from backend.services.chart_runner import generate_candlestick_png


class WatchlistUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=MAX_SECURITY_NAME_LEN)
    watchlistname: Optional[str] = Field(default=None, max_length=MAX_WATCHLIST_NAME_LEN)
    original_watchlistname: Optional[str] = Field(default="Default", max_length=MAX_WATCHLIST_NAME_LEN)


class WatchlistAddRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=MAX_SYMBOL_LEN)
    name: Optional[str] = Field(default=None, max_length=MAX_SECURITY_NAME_LEN)
    watchlistname: Optional[str] = Field(default="Default", max_length=MAX_WATCHLIST_NAME_LEN)


logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/lists", response_model=list[str])
def get_lists(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[str]:
    """Return all distinct watchlist group names for the authenticated user."""
    uid = user.id if user else 1
    return get_user_watchlist_names(db, user_id=uid)


@router.get("/items")
def list_watchlist_items(
    watchlist_name: Optional[str] = Query(default=None, alias="watchlistName"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
):
    """Return watchlist items enriched with real-time quote and 52-week data."""
    uid = user.id if user else 1
    items = get_watchlist_items(db, user_id=uid, watchlist_name=watchlist_name)
    if not items and uid != 1:
        items = get_watchlist_items(db, user_id=1, watchlist_name=watchlist_name)
    return items


@router.post("/items")
def add_item_to_watchlist(
    payload: WatchlistAddRequest,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
):
    """Add a ticker symbol to the user's watchlist."""
    uid = user.id if user else 1
    item = add_watchlist_item(
        db,
        user_id=uid,
        symbol=payload.symbol,
        name=payload.name,
        watchlist_name=payload.watchlistname or "Default",
    )
    return {
        "status": "success",
        "item": {
            "user_id": item.user_id,
            "symbol": item.symbol,
            "name": item.name,
            "watchlistname": item.watchlistname,
        },
    }


@router.put("/items/{symbol}")
def update_item_in_watchlist(
    symbol: str,
    payload: WatchlistUpdateRequest,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
):
    """Update a ticker's display name or watchlist group."""
    uid = user.id if user else 1
    item = update_watchlist_item(
        db,
        user_id=uid,
        symbol=symbol,
        original_watchlist_name=payload.original_watchlistname or "Default",
        new_name=payload.name,
        new_watchlist_name=payload.watchlistname,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    return {
        "status": "success",
        "item": {
            "user_id": item.user_id,
            "symbol": item.symbol,
            "name": item.name,
            "watchlistname": item.watchlistname,
        },
    }


@router.delete("/items/{symbol}")
def remove_item_from_watchlist(
    symbol: str,
    watchlist_name: Optional[str] = Query(default="Default", alias="watchlistName"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
):
    """Delete a ticker item from the user's watchlist."""
    uid = user.id if user else 1
    deleted = remove_watchlist_item(db, user_id=uid, symbol=symbol, watchlist_name=watchlist_name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    return {"status": "success", "symbol": symbol}


@router.get("", response_model=list[str])
def list_watchlist_names(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[str]:
    """Return distinct security display names tracked on the user's watchlist."""
    uid = user.id if user else 1
    items = get_watchlist(db, user_id=uid)
    # If no user-specific items, fallback to user_id=1
    if not items and uid != 1:
        items = get_watchlist(db, user_id=1)
    names = [w.name or w.symbol for w in items]
    return list(dict.fromkeys(names))  # Preserve insertion order while deduplicating


@router.get("/symbols", response_model=list[WatchlistSymbolItem])
def list_watchlist_symbols(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[WatchlistSymbolItem]:
    """Return all watchlist entries with symbol, name, timezone, and currency."""
    uid = user.id if user else 1
    items = get_watchlist(db, user_id=uid)
    if not items and uid != 1:
        items = get_watchlist(db, user_id=1)
    return [
        WatchlistSymbolItem(
            user_id=w.user_id,
            watchlistname=w.watchlistname,
            symbol=w.symbol,
            name=w.name or w.symbol,
            timezone=w.timezone or "America/New_York",
            currency=w.currency or "USD",
        )
        for w in items
    ]


@router.get("/data", response_model=WatchlistDataResponse)
def get_watchlist_data(
    symbol: Optional[str] = Query(default=None),
    name: Optional[str] = Query(default=None),
    zoom_start: Optional[str] = Query(default=None),
    zoom_start_alias: Optional[str] = Query(default=None, alias="zoomStart"),
    zoom_end: Optional[str] = Query(default=None),
    zoom_end_alias: Optional[str] = Query(default=None, alias="zoomEnd"),
    show_trades: Optional[bool] = Query(default=True, alias="showTrades"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> WatchlistDataResponse:
    """Return OHLCV price series, trades, sysDates, and base64 candlestick chart screenshot."""
    uid = user.id if user else 1
    effective_zoom_start = zoom_start or zoom_start_alias
    effective_zoom_end = zoom_end or zoom_end_alias

    target_symbol = (symbol or "").strip().upper()
    timezone_str = "America/New_York"
    currency_str = "USD"

    # Lookup metadata in watchlist if symbol is provided or lookup by name
    if target_symbol:
        wl_meta = db.scalar(select(Watchlist).where(Watchlist.symbol == target_symbol))
        if wl_meta:
            timezone_str = wl_meta.timezone or timezone_str
            currency_str = wl_meta.currency or currency_str
    elif name:
        stmt = select(Watchlist).where(Watchlist.name == name)
        item = db.scalar(stmt)
        if item:
            target_symbol = item.symbol
            timezone_str = item.timezone or timezone_str
            currency_str = item.currency or currency_str
        else:
            target_symbol = name.strip().upper()

    if not target_symbol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symbol or name parameter is required",
        )

    # 1. Fetch EOD OHLCV data
    eod_rows = get_eod_data(db, target_symbol, limit=365)
    eod_values = []
    for r in eod_rows:
        if r.close is None:
            continue
        c_val = float(r.close)
        o_val = float(r.open) if r.open is not None else c_val
        h_val = float(r.high) if r.high is not None else max(o_val, c_val)
        l_val = float(r.low) if r.low is not None else min(o_val, c_val)
        v_val = float(r.volume) if r.volume is not None else 0.0
        d_iso = r.date.isoformat()
        eod_values.append(
            {
                "timestamp": d_iso,
                "datetime": d_iso,
                "date": d_iso,
                "open": o_val,
                "high": h_val,
                "low": l_val,
                "close": c_val,
                "volume": v_val,
            }
        )

    eod_payload = {
        "meta": {
            "symbol": target_symbol,
            "interval": "1d",
            "timezone": timezone_str,
            "currency": currency_str,
        },
        "values": eod_values,
    }

    # 2. Fetch Tick OHLCV data (last 5 days)
    tick_start = date.today() - timedelta(days=5)
    tick_rows = get_tick_data(db, target_symbol, interval="5m", limit=500, start_date=tick_start)
    tick_values = []
    for t in tick_rows:
        if t.close is None:
            continue
        c_val = float(t.close)
        o_val = float(t.open) if t.open is not None else c_val
        h_val = float(t.high) if t.high is not None else max(o_val, c_val)
        l_val = float(t.low) if t.low is not None else min(o_val, c_val)
        v_val = float(t.volume) if t.volume is not None else 0.0
        ts_iso = t.timestamp.isoformat()
        tick_values.append(
            {
                "timestamp": ts_iso,
                "datetime": ts_iso,
                "date": t.timestamp.date().isoformat(),
                "open": o_val,
                "high": h_val,
                "low": l_val,
                "close": c_val,
                "volume": v_val,
            }
        )

    tick_payload = {
        "meta": {
            "symbol": target_symbol,
            "interval": "5m",
            "timezone": timezone_str,
            "currency": currency_str,
        },
        "values": tick_values,
    }

    # 3. Fetch user trades for this symbol
    trades_data = []
    if show_trades is not False:
        user_trades = get_trades(db, user_id=uid, symbol=target_symbol)
        if not user_trades and uid != 1:
            user_trades = get_trades(db, user_id=1, symbol=target_symbol)
        for tr in user_trades:
            trades_data.append(
                {
                    "id": tr.id,
                    "symbol": tr.symbol,
                    "buysell": tr.buysell,
                    "tradedate": tr.tradedate.isoformat(),
                    "investment": tr.investment,
                    "price": float(tr.price) if tr.price is not None else 0.0,
                    "quantity": float(tr.quantity) if tr.quantity is not None else 0.0,
                    "remarks": tr.remarks,
                }
            )

    # 4. Fetch system dates
    sys_dates: dict[str, Optional[str]] = {}
    g_start = db.scalar(select(SysValue.datevalue).where(SysValue.name == "GLOBAL_STARTDATE"))
    g_today = db.scalar(select(SysValue.datevalue).where(SysValue.name == "GLOBAL_TODAY"))
    sys_dates["global_startdate"] = g_start.isoformat() if g_start else None
    sys_dates["global_today"] = g_today.isoformat() if g_today else None

    # 5. Calculate default 6-month zoom start if omitted
    start_limit = effective_zoom_start
    if not start_limit and eod_values:
        try:
            latest_date_str = str(eod_values[-1]["timestamp"])
            latest_dt = datetime.fromisoformat(latest_date_str)
            # Subtract roughly 180 days
            six_months_ago = (latest_dt - timedelta(days=180)).date().isoformat()
            first_avail = str(eod_values[0]["timestamp"])
            start_limit = max(first_avail, six_months_ago)
        except Exception as z_err:
            logger.debug("Failed computing 6-month zoom limit: %s", z_err)

    # 6. Generate Candlestick Screenshot via charting.py
    chart_screenshot = None
    if eod_values:
        chart_screenshot = generate_candlestick_png(
            eod_data=eod_payload,
            trades=trades_data,
            zoom_start=start_limit,
            zoom_end=effective_zoom_end,
        )

    return WatchlistDataResponse(
        symbol=target_symbol,
        eodData=eod_payload,
        tickData=tick_payload,
        trades=trades_data,
        sysDates=sys_dates,
        chartScreenshot=chart_screenshot,
    )
