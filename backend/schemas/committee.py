"""Pydantic v2 schemas for the 4-Analyst Committee, Historical Agent Outputs, and Contextual Chat."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

AnalystRoleType = Literal[
    "technical",
    "fundamental",
    "macro",
    "risk",
    "executive_summary",
    "macro_us",
    "macro_apac",
    "macro_secular",
]
DirectionalBiasType = Literal["Bullish", "Bearish", "Neutral"]
TrendStatusType = Literal["Continuation", "Reversal", "Initiation", "Gap"]


class ModelOptionItem(BaseModel):
    """Selectable LLM model option."""

    id: str
    label: str
    provider: Literal["gemini", "kimi"]
    is_default: bool = False


class CommitteeRunRequest(BaseModel):
    """Request payload for POST /api/v1/committee/run."""

    symbol: str = Field(..., min_length=1, max_length=32)
    provider: Literal["gemini", "kimi"] = "gemini"
    model: Optional[str] = None
    lookback_runs: int = Field(default=3, ge=0, le=20)


class AgentAnalystOutputResponse(BaseModel):
    """Single stored analyst output or Executive Summary record."""

    id: int
    run_id: int
    user_id: int
    symbol: str
    analyst_role: AnalystRoleType
    directional_bias: DirectionalBiasType
    confidence_score: int
    trend_status: TrendStatusType
    summary_headline: str
    markdown_output: str
    structured_metrics: dict[str, Any] = Field(default_factory=dict)
    referenced_output_ids: list[int] = Field(default_factory=list)
    created_at: datetime


class CommitteeRunSummaryResponse(BaseModel):
    """Summary metadata for a committee run."""

    id: int
    user_id: int
    symbol: str
    provider: str
    model: str
    consensus_bias: DirectionalBiasType
    consensus_confidence: int
    executive_summary: str
    vote_breakdown: dict[str, str] = Field(default_factory=dict)
    created_at: datetime


class CommitteeRunDetailResponse(CommitteeRunSummaryResponse):
    """Complete committee run response including all 5 outputs and OHLCV chart data."""

    outputs: list[AgentAnalystOutputResponse] = Field(default_factory=list)
    chart_candles: list[dict[str, Any]] = Field(default_factory=list)
    chart_trades: list[dict[str, Any]] = Field(default_factory=list)
    past_outputs: list[AgentAnalystOutputResponse] = Field(default_factory=list)


class AgentChatMessage(BaseModel):
    """Single turn in the Floating Contextual Agent Chat."""

    role: Literal["user", "assistant"]
    content: str


class AgentContextualChatRequest(BaseModel):
    """Request payload for POST /api/v1/committee/chat."""

    messages: list[AgentChatMessage] = Field(..., min_length=1)
    symbol: Optional[str] = None
    run_id: Optional[int] = None
    active_route: Optional[str] = None
    displayed_context: dict[str, Any] = Field(default_factory=dict)
    provider: Literal["gemini", "kimi"] = "gemini"
    model: Optional[str] = None


class AgentContextualChatResponse(BaseModel):
    """Response returned by POST /api/v1/committee/chat."""

    reply: str
    provider: str
    model: str
    symbol: Optional[str] = None
    run_id: Optional[int] = None
    active_route: Optional[str] = None


class StoredChatMessageResponse(BaseModel):
    """Persisted chat turn tied to a Stock Analysis run and symbol."""

    id: int
    run_id: Optional[int] = None
    user_id: int
    symbol: str
    role: Literal["user", "assistant"]
    content: str
    model: Optional[str] = None
    created_at: datetime


class MacroAnalysisRunRequest(BaseModel):
    """Request payload for POST /api/v1/committee/macro/run."""

    benchmark_symbol: str = Field(default="^SPX", min_length=1, max_length=32)
    provider: Literal["gemini", "kimi"] = "gemini"
    model: Optional[str] = None
    lookback_runs: int = Field(default=3, ge=0, le=20)


class WatchlistIndexSnapshotItem(BaseModel):
    """Live EOD snapshot for a benchmark index or macro proxy in public.watchlist."""

    symbol: str
    name: str
    last_price: float
    change: float
    change_pct: float
    currency: str = "USD"


class LiveFxRateItem(BaseModel):
    """Live foreign exchange rate from public.exchange_rate."""

    pair: str
    rate: float
    date: str


class MacroWorkbenchResponse(BaseModel):
    """Complete payload for GET /api/v1/committee/macro/latest and POST /api/v1/committee/macro/run."""

    run: Optional[CommitteeRunSummaryResponse] = None
    outputs: list[AgentAnalystOutputResponse] = Field(default_factory=list)
    past_outputs: list[AgentAnalystOutputResponse] = Field(default_factory=list)
    benchmark_symbol: str
    watchlist_symbols: list[str] = Field(default_factory=list)
    watchlist_exposure: dict[str, list[str]] = Field(default_factory=dict)
    benchmark_snapshots: list[WatchlistIndexSnapshotItem] = Field(default_factory=list)
    fx_rates: list[LiveFxRateItem] = Field(default_factory=list)
    chart_candles: list[dict[str, Any]] = Field(default_factory=list)
    intraday_candles: list[dict[str, Any]] = Field(default_factory=list)
