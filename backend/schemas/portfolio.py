"""Portfolio dashboard, positions, and balance matrix Pydantic v2 schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PortfolioSummaryMetrics(BaseModel):
    """High-level portfolio KPI summary metrics."""

    totalEquity: float = 0.0
    cashBalance: float = 0.0
    realizedPnL: float = 0.0
    unrealizedPnL: float = 0.0
    marginLoan: float = 0.0
    marginInterest: float = 0.0
    dailyInterest: float = 0.0
    totalPnL: float = 0.0
    pctReturn: float = 0.0


class PortfolioDashboardResponse(BaseModel):
    """Response returned by GET /api/portfolio/dashboard."""

    summary: dict[str, Any] = Field(default_factory=dict)
    balanceMatrix: list[dict[str, Any]] = Field(default_factory=list)
    performanceSeries: list[dict[str, Any]] = Field(default_factory=list)
    dailySummaries: list[dict[str, Any]] = Field(default_factory=list)
    positions: list[dict[str, Any]] = Field(default_factory=list)
    fxRates: dict[str, float] = Field(default_factory=dict)
