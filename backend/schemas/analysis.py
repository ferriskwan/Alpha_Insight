"""AI stock analysis and prompt builder Pydantic v2 schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class AnalysisModulesConfig(BaseModel):
    """Selected analysis modules in Stock Analyst."""

    chartPatternRecognition: bool = True
    shortTermTechnical: bool = True
    longTermTechnical: bool = True
    fundamental: bool = True
    valuation: bool = True


class AnalyzeRequest(BaseModel):
    """Payload for POST /api/analyze."""

    symbol: str
    provider: str = Field(default="gemini", description="AI provider: 'gemini' or 'kimi'")
    model: Optional[str] = None
    prompt: Optional[str] = None
    modules: Optional[AnalysisModulesConfig] = None
    chartScreenshot: Optional[str] = None
    eodSummary: Optional[dict[str, Any]] = None
    tickSummary: Optional[dict[str, Any]] = None


class GroundingChunkItem(BaseModel):
    """Web search grounding source link."""

    title: str
    uri: str


class AnalyzeResponse(BaseModel):
    """Response returned by POST /api/analyze."""

    symbol: str
    provider: str
    model: str
    markdown: str
    groundingLinks: list[GroundingChunkItem] = Field(default_factory=list)
