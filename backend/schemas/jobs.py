"""Daily Cloud Run Job execution log and trigger Pydantic v2 schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class JobExecutionLogItem(BaseModel):
    """Single job_execution_log record."""

    id: int
    job_name: str
    trigger_source: str
    started_at: str
    completed_at: Optional[str] = None
    status: str
    global_today: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None


class JobTriggerRequest(BaseModel):
    """Payload for POST /api/admin/jobs/run."""

    job_name: str = "alpha-insight-daily-job"
    skip_market_download: bool = False


class JobTriggerResponse(BaseModel):
    """Response returned by POST /api/admin/jobs/run."""

    ok: bool = True
    status: str
    job_id: Optional[int] = None
    job_log_id: Optional[int] = None
    message: str
    details: Optional[dict[str, Any]] = None
