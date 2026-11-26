"""Portfolio dashboard, positions, and balance matrix Pydantic v2 schemas."""

from __future__ import annotations

from typing import Any, Optional

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


class PortfolioOverviewKPIs(BaseModel):
    """KPI metrics for the 6 badges."""

    realizedPnL: float = 0.0
    realizedPnLPct: float = 0.0
    unrealizedPnL: float = 0.0
    unrealizedPnLPct: float = 0.0
    totalPnL: float = 0.0
    totalPnLPct: float = 0.0
    capital: float = 0.0
    capitalPct: float = 0.0
    margin: float = 0.0
    marginPct: float = 0.0
    totalPortfolio: float = 0.0
    totalPortfolioPct: float = 0.0
    currency: str = "SGD"


class PortfolioCapitalMarginPoint(BaseModel):
    """Data point for Chart 1: Portfolio Size, Capital, Margin."""

    date: str
    portfolioSize: float = 0.0
    portfolioSizePct: float = 0.0
    capital: float = 0.0
    capitalPct: float = 0.0
    margin: float = 0.0
    marginPct: float = 0.0


class PortfolioStockPnLPoint(BaseModel):
    """Data point for Chart 2 series."""

    date: str
    pnl: float = 0.0
    pnlPct: float = 0.0


class PortfolioChart2Data(BaseModel):
    """Chart 2 data structure with portfolio and stock breakdowns."""

    portfolio: list[PortfolioStockPnLPoint] = Field(default_factory=list)
    stocks: dict[str, list[PortfolioStockPnLPoint]] = Field(default_factory=dict)


class PortfolioTradeAnnotation(BaseModel):
    """Executed trade marker annotation for Portfolio Overview charts."""

    date: str
    symbol: str
    buysell: str
    quantity: float = 0.0
    price: float = 0.0
    currency: str = "USD"
    remarks: str = ""


class PortfolioCapitalAnnotation(BaseModel):
    """Capital adjustment marker annotation for Portfolio Overview Chart 1."""

    date: str
    transtype: str
    amount: float = 0.0
    currency: str = "USD"
    broker: str = ""
    remarks: str = ""


class PortfolioOverviewResponse(BaseModel):
    """Full response for GET /api/v1/portfolio/overview."""

    parameters: dict[str, Any] = Field(default_factory=dict)
    kpis: PortfolioOverviewKPIs = Field(default_factory=PortfolioOverviewKPIs)
    chart1_portfolio_capital_margin: list[PortfolioCapitalMarginPoint] = Field(default_factory=list)
    chart2_pnl_breakdown: PortfolioChart2Data = Field(default_factory=PortfolioChart2Data)
    # Backward compatibility with Epic 0.3 tests/consumers
    chart1_equity_vs_benchmark: list[dict[str, Any]] = Field(default_factory=list)
    chart2_cumulative_pnl: list[dict[str, Any]] = Field(default_factory=list)
    chart3_asset_allocation: list[dict[str, Any]] = Field(default_factory=list)
    chart3_holdings_pie: list[dict[str, Any]] = Field(default_factory=list)
    chart4_daily_pnl_drawdown: list[dict[str, Any]] = Field(default_factory=list)
    trade_annotations: list[PortfolioTradeAnnotation] = Field(default_factory=list)
    capital_annotations: list[PortfolioCapitalAnnotation] = Field(default_factory=list)
    fallback_warning: Optional[str] = None


class PortfolioCommentaryItem(BaseModel):
    """Single quadrant commentary item."""

    title: str
    status: str
    content: str


class PortfolioCommentaryResponse(BaseModel):
    """Response for GET/POST /api/v1/portfolio/overview/commentary."""

    cached: bool = True
    lastUpdated: str = ""
    commentaries: dict[str, PortfolioCommentaryItem] = Field(default_factory=dict)
    fallback_warning: Optional[str] = None
