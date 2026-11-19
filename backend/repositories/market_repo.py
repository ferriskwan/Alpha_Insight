"""Repository for Watchlist, EodData, TickData, and ExchangeRate operations."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.db.models import EodData, ExchangeRate, TickData, Watchlist
from backend.schemas.transactions import WatchlistTransactionInput


def get_watchlist(
    db: Session,
    user_id: int = 1,
    watchlistname: Optional[str] = None,
) -> list[Watchlist]:
    """Retrieve watchlist entries for a specific user and optional watchlist name."""
    stmt = select(Watchlist).where(Watchlist.user_id == user_id)
    if watchlistname:
        stmt = stmt.where(Watchlist.watchlistname == watchlistname)
    stmt = stmt.order_by(Watchlist.symbol)
    return list(db.scalars(stmt).all())


def get_watchlist_item(
    db: Session,
    symbol: str,
    user_id: int = 1,
    watchlistname: str = "Default",
) -> Optional[Watchlist]:
    """Retrieve a single watchlist entry by user, watchlist name, and ticker symbol."""
    stmt = select(Watchlist).where(
        Watchlist.user_id == user_id,
        Watchlist.watchlistname == watchlistname,
        Watchlist.symbol == symbol,
    )
    return db.scalar(stmt)


def upsert_watchlist_item(
    db: Session,
    item: WatchlistTransactionInput,
    user_id: int = 1,
) -> Watchlist:
    """Create or update a watchlist entry."""
    existing = get_watchlist_item(db, item.symbol, user_id, item.watchlistname)
    if existing:
        existing.name = item.name or existing.name
        existing.timezone = item.timezone or existing.timezone
        existing.currency = item.currency or existing.currency
        db.commit()
        db.refresh(existing)
        return existing

    new_item = Watchlist(
        user_id=user_id,
        watchlistname=item.watchlistname,
        symbol=item.symbol,
        name=item.name or item.symbol,
        timezone=item.timezone or "America/New_York",
        currency=item.currency or "USD",
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


def delete_watchlist_item(
    db: Session,
    symbol: str,
    user_id: int = 1,
    watchlistname: str = "Default",
) -> bool:
    """Delete a watchlist entry."""
    item = get_watchlist_item(db, symbol, user_id, watchlistname)
    if item:
        db.delete(item)
        db.commit()
        return True
    return False


def get_eod_data(
    db: Session,
    symbol: str,
    limit: int = 365,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[EodData]:
    """Retrieve sorted EOD OHLCV records for a given symbol."""
    stmt = select(EodData).where(EodData.symbol == symbol)
    if start_date:
        stmt = stmt.where(EodData.date >= start_date)
    if end_date:
        stmt = stmt.where(EodData.date <= end_date)
    stmt = stmt.order_by(desc(EodData.date)).limit(limit)
    rows = list(db.scalars(stmt).all())
    rows.reverse()  # Return in chronological order (oldest to newest)
    return rows


def upsert_eod_data(db: Session, symbol: str, bars: list[dict[str, Any]]) -> int:
    """Upsert daily OHLCV bars into EodData."""
    count = 0
    for b in bars:
        raw_date = b.get("datetime") or b.get("date") or b.get("timestamp")
        if not raw_date:
            continue
        if isinstance(raw_date, str):
            dt_obj = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).date()
        elif isinstance(raw_date, datetime):
            dt_obj = raw_date.date()
        else:
            dt_obj = raw_date

        stmt = select(EodData).where(EodData.symbol == symbol, EodData.date == dt_obj)
        record = db.scalar(stmt)
        if not record:
            record = EodData(symbol=symbol, date=dt_obj)
            db.add(record)

        record.open = float(b["open"]) if b.get("open") is not None else None
        record.high = float(b["high"]) if b.get("high") is not None else None
        record.low = float(b["low"]) if b.get("low") is not None else None
        record.close = float(b["close"]) if b.get("close") is not None else None
        record.volume = float(b["volume"]) if b.get("volume") is not None else None
        count += 1

    db.commit()
    return count


def get_tick_data(
    db: Session,
    symbol: str,
    interval: str = "5m",
    limit: int = 500,
    start_date: Optional[date] = None,
) -> list[TickData]:
    """Retrieve sorted intraday Tick bars for a given symbol."""
    stmt = select(TickData).where(
        TickData.symbol == symbol,
        TickData.interval == interval,
    )
    if start_date:
        stmt = stmt.where(TickData.timestamp >= datetime.combine(start_date, datetime.min.time()))
    stmt = stmt.order_by(desc(TickData.timestamp)).limit(limit)
    rows = list(db.scalars(stmt).all())
    rows.reverse()
    return rows


def upsert_tick_data(
    db: Session,
    symbol: str,
    interval: str,
    bars: list[dict[str, Any]],
) -> int:
    """Upsert intraday Tick bars into TickData."""
    count = 0
    for b in bars:
        raw_ts = b.get("datetime") or b.get("timestamp")
        if not raw_ts:
            continue
        if isinstance(raw_ts, str):
            dt_obj = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            # remove tzinfo for naive database storage
            if dt_obj.tzinfo is not None:
                dt_obj = dt_obj.replace(tzinfo=None)
        elif isinstance(raw_ts, datetime):
            dt_obj = raw_ts.replace(tzinfo=None) if raw_ts.tzinfo is not None else raw_ts
        else:
            continue

        stmt = select(TickData).where(
            TickData.symbol == symbol,
            TickData.interval == interval,
            TickData.timestamp == dt_obj,
        )
        record = db.scalar(stmt)
        if not record:
            record = TickData(symbol=symbol, interval=interval, timestamp=dt_obj)
            db.add(record)

        record.open = float(b["open"]) if b.get("open") is not None else None
        record.high = float(b["high"]) if b.get("high") is not None else None
        record.low = float(b["low"]) if b.get("low") is not None else None
        record.close = float(b["close"]) if b.get("close") is not None else None
        record.volume = float(b["volume"]) if b.get("volume") is not None else None
        count += 1

    db.commit()
    return count


def get_latest_fx_rates(db: Session, base_currency: str = "USD") -> dict[str, float]:
    """Retrieve the most recent exchange rate for each currency relative to base_currency."""
    rates = {base_currency: 1.0}
    stmt = select(ExchangeRate).where(ExchangeRate.base_currency == base_currency).order_by(desc(ExchangeRate.date))
    all_rates = db.scalars(stmt).all()
    for r in all_rates:
        if r.currency not in rates:
            rates[r.currency] = float(r.rate)
    return rates


def upsert_fx_rates(db: Session, rates: list[dict[str, Any]]) -> int:
    """Upsert foreign exchange rates into ExchangeRate."""
    count = 0
    for r in rates:
        raw_date = r.get("date")
        if not raw_date:
            continue
        if isinstance(raw_date, str):
            dt_obj = datetime.fromisoformat(raw_date).date()
        elif isinstance(raw_date, datetime):
            dt_obj = raw_date.date()
        else:
            dt_obj = raw_date

        currency = r["currency"]
        base_currency = r.get("base_currency", "USD")
        rate_val = float(r["rate"])

        stmt = select(ExchangeRate).where(
            ExchangeRate.date == dt_obj,
            ExchangeRate.currency == currency,
            ExchangeRate.base_currency == base_currency,
        )
        record = db.scalar(stmt)
        if not record:
            record = ExchangeRate(
                date=dt_obj,
                currency=currency,
                base_currency=base_currency,
                rate=rate_val,
            )
            db.add(record)
        else:
            record.rate = rate_val
        count += 1

    db.commit()
    return count
