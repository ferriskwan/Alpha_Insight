"""Schemas for research services, sector performance, and rotation engine."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class SectorItem(BaseModel):
    """Sector performance and rotation metrics."""

    id: str
    label: str
    ticker: str
    value: float
    weight: float
    subtext: str = ""
    relativeRotation: str = "Leading"
    rsScore: float = 1.0
    rsMomentum: float = 0.0


class SectorPerformanceResponse(BaseModel):
    """Response payload for GET /api/v1/research/sectors."""

    horizon: str
    asOfDate: str
    benchmark: str = "SPY"
    benchmarkReturn: float = 0.0
    sectors: list[SectorItem] = Field(default_factory=list)
    quadrantDefinitions: dict[str, str] = Field(default_factory=dict)


class SectorNewsItem(BaseModel):
    """News publication cited in sector research."""

    title: str
    url: str
    publisher: str = "Yahoo Finance"
    published_at: str = ""


class SectorCommitteeResponse(BaseModel):
    """Response payload for GET/POST /api/v1/research/sectors/{symbol}/committee."""

    run_id: int
    symbol: str
    sector_name: str
    provider: str
    model: str
    consensus_bias: str
    consensus_confidence: int
    executive_summary: str
    vote_breakdown: dict[str, Any] = Field(default_factory=dict)
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    news_sources: list[SectorNewsItem] = Field(default_factory=list)
    fallback_warning: Optional[str] = None
    created_at: str = ""
