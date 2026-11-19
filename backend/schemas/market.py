"""Market data and watchlist Pydantic v2 schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class WatchlistSymbolItem(BaseModel):
    """Single tracked watchlist security."""

    user_id: Optional[int] = 1
    watchlistname: Optional[str] = "Default"
    symbol: str
    name: Optional[str] = ""
    timezone: Optional[str] = "America/New_York"
    currency: Optional[str] = "USD"


class OhlcvBar(BaseModel):
    """Single OHLCV bar item."""

    datetime: str
    open: str | float
    high: str | float
    low: str | float
    close: str | float
    volume: str | float


class MarketSeriesMeta(BaseModel):
    """Metadata header for EOD or Tick series."""

    symbol: str
    interval: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    timezone: Optional[str] = "UTC"
    currency: Optional[str] = "USD"


class MarketSeriesPayload(BaseModel):
    """Series structure containing meta and OHLCV values."""

    meta: dict[str, Any]
    values: list[dict[str, Any]] = Field(default_factory=list)


class FxRateItem(BaseModel):
    """Single foreign exchange rate entry."""

    date: str
    currency: str
    base_currency: str = "USD"
    rate: float | str


class WatchlistDataResponse(BaseModel):
    """Response returned by GET /api/watchlist/data."""

    symbol: str
    eodData: Optional[dict[str, Any]] = None
    tickData: Optional[dict[str, Any]] = None
    trades: list[dict[str, Any]] = Field(default_factory=list)
    sysDates: dict[str, Optional[str]] = Field(default_factory=dict)
    chartScreenshot: Optional[str] = None
