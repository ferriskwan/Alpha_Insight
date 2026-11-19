"""AI stock analysis API endpoint."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.dependencies import get_current_user_optional
from backend.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from backend.schemas.auth import UserProfileResponse
from backend.services.agent_orchestrator import run_stock_analysis

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_stock(
    raw_request: Request,
    user: UserProfileResponse | None = Depends(get_current_user_optional),
) -> AnalyzeResponse:
    """Execute multi-horizon quantitative stock analysis via Gemini or Kimi."""
    try:
        body: dict[str, Any] = await raw_request.json()
    except Exception as parse_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON request body: {parse_err}",
        )

    # Support legacy input nesting: { "input": { ... } }
    if "input" in body and isinstance(body["input"], dict):
        inner = body["input"]
        # Map legacy keys if needed
        req_data = {
            "symbol": inner.get("symbol") or inner.get("ticker", "AAPL"),
            "provider": inner.get("provider", "gemini"),
            "model": inner.get("model"),
            "prompt": inner.get("prompt"),
            "modules": inner.get("selectedModules") or inner.get("modules"),
            "chartScreenshot": (
                inner.get("chartScreenshot", {}).get("data")
                if isinstance(inner.get("chartScreenshot"), dict)
                else inner.get("chartScreenshot")
            ),
            "eodSummary": inner.get("eodSummary") or inner.get("eodData"),
            "tickSummary": inner.get("tickSummary") or inner.get("tickData"),
        }
    else:
        req_data = body

    try:
        analyze_req = AnalyzeRequest.model_validate(req_data)
    except Exception as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Schema validation error: {val_err}",
        )

    return await run_stock_analysis(analyze_req)
