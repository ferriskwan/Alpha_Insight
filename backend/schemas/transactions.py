"""Transaction Editor CRUD Pydantic v2 schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Union

from pydantic import BaseModel, ConfigDict


class WatchlistTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/watchlist."""

    watchlistname: str = "Default"
    symbol: str
    name: Optional[str] = ""
    timezone: Optional[str] = "America/New_York"
    currency: Optional[str] = "USD"


class TradeTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/trade."""

    id: Optional[int] = None
    symbol: str
    buysell: str
    tradedate: str
    investment: bool = True
    price: float
    quantity: float
    remarks: Optional[str] = ""


class CapitalTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/capital."""

    id: Optional[int] = None
    broker: str = "Saxo"
    transtype: str = "D"
    accounttype: str = "Cash"
    amount: float
    date: str
    currency: str = "USD"
    remarks: Optional[str] = ""


class SysValueTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/sysvalue."""

    name: str
    type: str = "STR"
    strvalue: Optional[str] = None
    numvalue: Optional[float] = None
    datevalue: Optional[str] = None
    description: Optional[str] = ""


class TransCostDTO(BaseModel):
    """Data transfer object for transaction cost records."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    trade_id: Optional[int] = None
    cost_type: str
    amount: float
    currency: str = "USD"
    date: Union[date, str]
    remarks: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None


class TransCostCreate(BaseModel):
    """Payload for creating a transaction cost entry."""

    user_id: Optional[int] = None
    trade_id: Optional[int] = None
    cost_type: str
    amount: float
    currency: Optional[str] = "USD"
    date: str
    remarks: Optional[str] = None
