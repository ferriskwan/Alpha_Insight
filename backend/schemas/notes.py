"""Pydantic v2 schemas for Investment Notes and 0..N linked AgentAnalystOutput records."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from backend.schemas.committee import AgentAnalystOutputResponse

ThesisStatusType = Literal["In-Progress", "Validated", "Invalidated"]


class InvestmentNoteCreate(BaseModel):
    """Payload for POST /api/v1/notes."""

    symbol: str = Field(..., min_length=1, max_length=32, description="Ticker symbol sourced from public.watchlist")
    trade_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    content_markdown: str = Field(..., min_length=1)
    thesis_status: ThesisStatusType = "In-Progress"
    tags: list[str] = Field(default_factory=list)
    analyst_output_ids: list[int] = Field(
        default_factory=list,
        description="0 to multiple agent_analyst_outputs.id linked to this note",
    )


class InvestmentNoteUpdate(BaseModel):
    """Payload for PUT /api/v1/notes/{note_id}."""

    symbol: Optional[str] = Field(default=None, min_length=1, max_length=32)
    trade_id: Optional[int] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content_markdown: Optional[str] = Field(default=None, min_length=1)
    thesis_status: Optional[ThesisStatusType] = None
    tags: Optional[list[str]] = None
    analyst_output_ids: Optional[list[int]] = Field(
        default=None,
        description="Reconciled list of 0 to multiple agent_analyst_outputs.id linked to this note",
    )


class InvestmentNoteResponse(BaseModel):
    """Response model for an Investment Note with its 0..N linked analyst outputs and trade summary."""

    id: int
    user_id: int
    symbol: str
    trade_id: Optional[int] = None
    trade_summary: Optional[dict[str, Any]] = None
    title: str
    content_markdown: str
    thesis_status: ThesisStatusType
    tags: list[str] = Field(default_factory=list)
    analyst_output_ids: list[int] = Field(default_factory=list)
    linked_analyst_outputs: list[AgentAnalystOutputResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
