"""SQLAlchemy 2.0 declarative models for all 13 existing 4leafclover tables and 2 new tables."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for all Alpha_Insight database models."""


class User(Base):
    """Existing public.users table."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    picture: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class UserRole(Base):
    """Existing public.user_roles table."""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    assigned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class SysValue(Base):
    """Existing public.sysvalue table."""

    __tablename__ = "sysvalue"

    name: Mapped[str] = mapped_column(String(128), primary_key=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    strvalue: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    numvalue: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    datevalue: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class Watchlist(Base):
    """Existing public.watchlist table."""

    __tablename__ = "watchlist"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    watchlistname: Mapped[str] = mapped_column(String(128), primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class EodData(Base):
    """Existing public.eoddata table."""

    __tablename__ = "eoddata"

    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    open: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    close: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class TickData(Base):
    """Existing public.tickdata table."""

    __tablename__ = "tickdata"

    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    interval: Mapped[str] = mapped_column(String(16), primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=False), primary_key=True)
    open: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    close: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class ExchangeRate(Base):
    """Existing public.exchange_rate table."""

    __tablename__ = "exchange_rate"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    currency: Mapped[str] = mapped_column(String(16), primary_key=True)
    base_currency: Mapped[str] = mapped_column(String(16), primary_key=True, default="USD")
    rate: Mapped[float] = mapped_column(Float, nullable=False)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class Trade(Base):
    """Existing public.trade table."""

    __tablename__ = "trade"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    buysell: Mapped[str] = mapped_column(String(8), nullable=False)
    tradedate: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    investment: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class Capital(Base):
    """Existing public.capital table."""

    __tablename__ = "capital"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    broker: Mapped[str] = mapped_column(String(64), nullable=False)
    transtype: Mapped[str] = mapped_column(String(16), nullable=False)
    accounttype: Mapped[str] = mapped_column(String(32), default="Cash", nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(16), default="USD", nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class Position(Base):
    """Existing public.position table."""

    __tablename__ = "position"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    tradedate: Mapped[date] = mapped_column(Date, primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    investment: Mapped[bool] = mapped_column(Boolean, primary_key=True, default=True)
    avgprice: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    eodprice: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class MarginInterestRate(Base):
    """Existing public.margin_interest_rate table."""

    __tablename__ = "margin_interest_rate"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    broker: Mapped[str] = mapped_column(String(64), nullable=False)
    currency: Mapped[str] = mapped_column(String(16), nullable=False)
    accounttype: Mapped[str] = mapped_column(String(32), default="MARGIN", nullable=False)
    annual_rate: Mapped[float] = mapped_column(Float, nullable=False)
    day_count_basis: Mapped[int] = mapped_column(Integer, default=360, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)


class DailyMarginInterest(Base):
    """Existing public.daily_margin_interest table."""

    __tablename__ = "daily_margin_interest"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    broker: Mapped[str] = mapped_column(String(64), primary_key=True)
    currency: Mapped[str] = mapped_column(String(16), primary_key=True)
    loan_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    daily_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    daily_interest: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cumulative_interest: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class DailyPortfolioSummary(Base):
    """Existing public.daily_portfolio_summary table."""

    __tablename__ = "daily_portfolio_summary"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    currency: Mapped[str] = mapped_column(String(16), primary_key=True)
    investment: Mapped[bool] = mapped_column(Boolean, primary_key=True)
    total_capital: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    position_market_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    margin_loan_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    daily_interest_accrued: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cumulative_interest_accrued: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_asset_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    pct_pnl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    updatetimestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        server_default=func.current_timestamp(),
    )


class UserSession(Base):
    """New public.user_sessions table for persistent Cloud Run authentication sessions."""

    __tablename__ = "user_sessions"

    sid: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )


class JobExecutionLog(Base):
    """New public.job_execution_log table tracking daily Cloud Run Job & manual batch runs."""

    __tablename__ = "job_execution_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_name: Mapped[str] = mapped_column(String(64), nullable=False)
    trigger_source: Mapped[str] = mapped_column(String(32), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    global_today: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class SiteMap(Base):
    """Dynamic navigation hierarchy supporting role-based filtering and admin modification."""

    __tablename__ = "site_map"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("site_map.id", ondelete="CASCADE"), nullable=True, index=True
    )
    menu_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    route: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    role_required: Mapped[str] = mapped_column(String(64), server_default="user", nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )


class AuditLog(Base):
    """System and administrative audit trail recording mutations across all entities."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    old_values: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    new_values: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )


class TransCost(Base):
    """Transaction cost breakdown linked to trades or general portfolio cash deductions."""

    __tablename__ = "trans_cost"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=1, nullable=False, index=True)
    trade_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trade.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cost_type: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), server_default="USD", nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )


class RefChartSettings(Base):
    """Technical indicator settings per user and symbol or global defaults stored as JSONB."""

    __tablename__ = "ref_chart_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    symbol: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    parameters: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )

    def __init__(self, **kwargs: Any) -> None:
        params = kwargs.pop("parameters", None) or {}
        ma = params.setdefault("moving_averages", {})
        bb = params.setdefault("bollinger_bands", {})
        rsi = params.setdefault("rsi", {})
        macd = params.setdefault("macd", {})
        fib = params.setdefault("fibonacci", {})

        if "sma_period" in kwargs:
            ma["sma_period"] = kwargs.pop("sma_period")
        if "ema_period" in kwargs:
            ma["ema_period"] = kwargs.pop("ema_period")
        if "bb_period" in kwargs:
            bb["period"] = kwargs.pop("bb_period")
        if "bb_std" in kwargs:
            bb["std_dev"] = kwargs.pop("bb_std")
        if "rsi_period" in kwargs:
            rsi["period"] = kwargs.pop("rsi_period")
        if "rsi_ob" in kwargs:
            rsi["overbought"] = kwargs.pop("rsi_ob")
        if "rsi_os" in kwargs:
            rsi["oversold"] = kwargs.pop("rsi_os")
        if "macd_fast" in kwargs:
            macd["fast"] = kwargs.pop("macd_fast")
        if "macd_slow" in kwargs:
            macd["slow"] = kwargs.pop("macd_slow")
        if "macd_signal" in kwargs:
            macd["signal"] = kwargs.pop("macd_signal")
        if "fib_lookback_bars" in kwargs:
            fib["lookback_bars"] = kwargs.pop("fib_lookback_bars")
        if "fib_intraday_bars" in kwargs:
            fib["intraday_bars"] = kwargs.pop("fib_intraday_bars")

        kwargs["parameters"] = params
        super().__init__(**kwargs)

    @property
    def sma_period(self) -> int:
        return int(self.parameters.get("moving_averages", {}).get("sma_period", 30))

    @sma_period.setter
    def sma_period(self, val: int) -> None:
        self.parameters.setdefault("moving_averages", {})["sma_period"] = int(val)

    @property
    def ema_period(self) -> int:
        return int(self.parameters.get("moving_averages", {}).get("ema_period", 100))

    @ema_period.setter
    def ema_period(self, val: int) -> None:
        self.parameters.setdefault("moving_averages", {})["ema_period"] = int(val)

    @property
    def bb_period(self) -> int:
        return int(self.parameters.get("bollinger_bands", {}).get("period", 30))

    @bb_period.setter
    def bb_period(self, val: int) -> None:
        self.parameters.setdefault("bollinger_bands", {})["period"] = int(val)

    @property
    def bb_std(self) -> float:
        return float(self.parameters.get("bollinger_bands", {}).get("std_dev", 2.0))

    @bb_std.setter
    def bb_std(self, val: float) -> None:
        self.parameters.setdefault("bollinger_bands", {})["std_dev"] = float(val)

    @property
    def rsi_period(self) -> int:
        return int(self.parameters.get("rsi", {}).get("period", 13))

    @rsi_period.setter
    def rsi_period(self, val: int) -> None:
        self.parameters.setdefault("rsi", {})["period"] = int(val)

    @property
    def rsi_ob(self) -> float:
        return float(self.parameters.get("rsi", {}).get("overbought", 70.0))

    @rsi_ob.setter
    def rsi_ob(self, val: float) -> None:
        self.parameters.setdefault("rsi", {})["overbought"] = float(val)

    @property
    def rsi_os(self) -> float:
        return float(self.parameters.get("rsi", {}).get("oversold", 30.0))

    @rsi_os.setter
    def rsi_os(self, val: float) -> None:
        self.parameters.setdefault("rsi", {})["oversold"] = float(val)

    @property
    def macd_fast(self) -> int:
        return int(self.parameters.get("macd", {}).get("fast", 12))

    @macd_fast.setter
    def macd_fast(self, val: int) -> None:
        self.parameters.setdefault("macd", {})["fast"] = int(val)

    @property
    def macd_slow(self) -> int:
        return int(self.parameters.get("macd", {}).get("slow", 26))

    @macd_slow.setter
    def macd_slow(self, val: int) -> None:
        self.parameters.setdefault("macd", {})["slow"] = int(val)

    @property
    def macd_signal(self) -> int:
        return int(self.parameters.get("macd", {}).get("signal", 9))

    @macd_signal.setter
    def macd_signal(self, val: int) -> None:
        self.parameters.setdefault("macd", {})["signal"] = int(val)

    @property
    def fib_lookback_bars(self) -> int:
        return int(self.parameters.get("fibonacci", {}).get("lookback_bars", 252))

    @fib_lookback_bars.setter
    def fib_lookback_bars(self, val: int) -> None:
        self.parameters.setdefault("fibonacci", {})["lookback_bars"] = int(val)

    @property
    def fib_intraday_bars(self) -> int:
        return int(self.parameters.get("fibonacci", {}).get("intraday_bars", 78))

    @fib_intraday_bars.setter
    def fib_intraday_bars(self, val: int) -> None:
        self.parameters.setdefault("fibonacci", {})["intraday_bars"] = int(val)


class AgentCommitteeRun(Base):
    """Stores a single 4-analyst committee invocation and its consolidated Executive Summary."""

    __tablename__ = "agent_committee_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=1, nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), server_default="gemini", nullable=False)
    model: Mapped[str] = mapped_column(String(64), server_default="gemini-4-argon", nullable=False)
    consensus_bias: Mapped[str] = mapped_column(String(16), nullable=False)
    consensus_confidence: Mapped[int] = mapped_column(Integer, server_default="50", nullable=False)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    vote_breakdown: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )


class AgentAnalystOutput(Base):
    """Stores individual analyst outputs (technical, fundamental, macro, risk, executive_summary)."""

    __tablename__ = "agent_analyst_outputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("agent_committee_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=1, nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    analyst_role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    directional_bias: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, server_default="50", nullable=False)
    trend_status: Mapped[str] = mapped_column(String(32), server_default="Initiation", nullable=False)
    summary_headline: Mapped[str] = mapped_column(String(255), nullable=False)
    markdown_output: Mapped[str] = mapped_column(Text, nullable=False)
    structured_metrics: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    referenced_output_ids: Mapped[Optional[list[int]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )


class InvestmentNote(Base):
    """Stores investment notes linked to watchlist symbols and optional executed trades."""

    __tablename__ = "investment_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=1, nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    trade_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("trade.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    thesis_status: Mapped[str] = mapped_column(
        String(32),
        server_default="In-Progress",
        nullable=False,
        index=True,
    )
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )


class InvestmentNoteAnalystLink(Base):
    """Associative table linking an InvestmentNote to 0..N AgentAnalystOutput rows."""

    __tablename__ = "investment_note_analyst_links"
    __table_args__ = (UniqueConstraint("note_id", "analyst_output_id", name="uq_note_analyst_output"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("investment_notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    analyst_output_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("agent_analyst_outputs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
    )


class AgentChatMessageRecord(Base):
    """Stores persistent multi-turn chat messages tied to a Stock Analysis run and symbol."""

    __tablename__ = "agent_chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("agent_committee_runs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), default=1, nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        nullable=False,
        index=True,
    )
