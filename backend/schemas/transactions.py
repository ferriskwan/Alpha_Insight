"""Transaction Editor CRUD Pydantic v2 schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

# PROD 4leafclover legacy column length & constraint constants
MAX_WATCHLIST_NAME_LEN = 64
MAX_SYMBOL_LEN = 10
MAX_SECURITY_NAME_LEN = 64
MAX_TIMEZONE_LEN = 20
MAX_LEGACY_CURRENCY_LEN = 3
MAX_TRADE_REMARKS_LEN = 200
MAX_CAPITAL_BROKER_LEN = 64
MAX_CAPITAL_CURRENCY_LEN = 16
MAX_SYSVALUE_NAME_LEN = 20
MAX_SYSVALUE_TYPE_LEN = 20
MAX_SYSVALUE_STRVALUE_LEN = 64
MAX_SYSVALUE_DESC_LEN = 200


def normalize_capital_accounttype(value: str) -> str:
    """Normalize capital account type to PROD 4leafclover CHECK values ('C' or 'M').

    PROD public.capital enforces CHECK (accounttype = ANY (ARRAY['M', 'C'])).
    Mapping 'Leverage'/'L' to 'M' preserves backward compatibility with legacy 4leafclover.
    """
    cleaned = str(value or "").strip().upper()
    if cleaned in ("CASH", "C", "INVESTMENT"):
        return "C"
    if cleaned in ("MARGIN", "M", "LEVERAGE", "L"):
        return "M"
    raise ValueError("accounttype must be one of Cash/C/Investment or Margin/M/Leverage/L")


def normalize_capital_transtype(value: str) -> str:
    """Normalize capital transaction type to PROD 4leafclover CHECK values ('D', 'F', 'W')."""
    cleaned = str(value or "D").strip().upper()
    if cleaned in ("D", "DEPOSIT"):
        return "D"
    if cleaned in ("W", "WITHDRAWAL"):
        return "W"
    if cleaned in ("F", "FEE", "FUNDING"):
        return "F"
    raise ValueError("transtype must be one of D (Deposit), W (Withdrawal), or F (Fee/Funding)")


def normalize_trade_buysell(value: str) -> str:
    """Normalize trade buysell indicator to PROD 4leafclover char(1) values ('B' or 'S')."""
    cleaned = str(value or "").strip().upper()
    if cleaned in ("B", "BUY"):
        return "B"
    if cleaned in ("S", "SELL"):
        return "S"
    raise ValueError("buysell must be one of B (Buy) or S (Sell)")


class WatchlistTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/watchlist."""

    watchlistname: str = Field(default="Default", max_length=MAX_WATCHLIST_NAME_LEN)
    symbol: str = Field(..., min_length=1, max_length=MAX_SYMBOL_LEN)
    name: Optional[str] = Field(default="", max_length=MAX_SECURITY_NAME_LEN)
    timezone: Optional[str] = Field(default="America/New_York", max_length=MAX_TIMEZONE_LEN)
    currency: Optional[str] = Field(default="USD", max_length=MAX_LEGACY_CURRENCY_LEN)


class TradeTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/trade."""

    id: Optional[int] = None
    symbol: str = Field(..., min_length=1, max_length=MAX_SYMBOL_LEN)
    buysell: str
    tradedate: str
    investment: bool = True
    price: float
    quantity: float
    remarks: Optional[str] = Field(default="", max_length=MAX_TRADE_REMARKS_LEN)

    @field_validator("buysell")
    @classmethod
    def validate_buysell(cls, v: str) -> str:
        """Ensure buysell fits PROD trade.buysell char(1) ('B' or 'S')."""
        return normalize_trade_buysell(v)


class CapitalTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/capital."""

    id: Optional[int] = None
    broker: str = Field(default="Saxo", min_length=1, max_length=MAX_CAPITAL_BROKER_LEN)
    transtype: str = "D"
    accounttype: str = "Cash"
    amount: float
    date: str
    currency: str = Field(default="USD", min_length=1, max_length=MAX_CAPITAL_CURRENCY_LEN)
    remarks: Optional[str] = ""

    @field_validator("transtype")
    @classmethod
    def validate_transtype(cls, v: str) -> str:
        """Normalize and validate transtype against PROD capital_transtype_check."""
        return normalize_capital_transtype(v)

    @field_validator("accounttype")
    @classmethod
    def validate_accounttype(cls, v: str) -> str:
        """Normalize and validate accounttype against PROD capital_accounttype_check."""
        return normalize_capital_accounttype(v)


class SysValueTransactionInput(BaseModel):
    """Payload for POST/PUT /api/transactions/sysvalue."""

    name: str = Field(..., min_length=1, max_length=MAX_SYSVALUE_NAME_LEN)
    type: str = Field(default="STR", max_length=MAX_SYSVALUE_TYPE_LEN)
    strvalue: Optional[str] = Field(default=None, max_length=MAX_SYSVALUE_STRVALUE_LEN)
    numvalue: Optional[float] = None
    datevalue: Optional[str] = None
    description: Optional[str] = Field(default="", max_length=MAX_SYSVALUE_DESC_LEN)


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
