"""Repository for SysValue and JobExecutionLog tracking operations."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.db.models import JobExecutionLog, SysValue
from backend.schemas.transactions import SysValueTransactionInput


def get_sysvalues(db: Session) -> list[SysValue]:
    """Retrieve all configuration parameters in public.sysvalue."""
    stmt = select(SysValue).order_by(SysValue.name)
    return list(db.scalars(stmt).all())


def get_sysvalue(db: Session, name: str) -> Optional[SysValue]:
    """Retrieve single configuration parameter by key name."""
    return db.scalar(select(SysValue).where(SysValue.name == name))


def upsert_sysvalue(db: Session, item: SysValueTransactionInput) -> SysValue:
    """Create or update a sysvalue record."""
    record = get_sysvalue(db, item.name)
    d_obj = datetime.fromisoformat(item.datevalue).date() if item.datevalue else None

    if record:
        record.type = item.type
        record.strvalue = item.strvalue
        record.numvalue = item.numvalue
        record.datevalue = d_obj
        record.description = item.description or record.description
        db.commit()
        db.refresh(record)
        return record

    new_record = SysValue(
        name=item.name,
        type=item.type,
        strvalue=item.strvalue,
        numvalue=item.numvalue,
        datevalue=d_obj,
        description=item.description,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record


def delete_sysvalue(db: Session, name: str) -> bool:
    """Delete a configuration parameter."""
    record = get_sysvalue(db, name)
    if record:
        db.delete(record)
        db.commit()
        return True
    return False


def get_job_execution_logs(db: Session, limit: int = 50) -> list[JobExecutionLog]:
    """Retrieve recent Cloud Run Job and pipeline execution logs."""
    stmt = select(JobExecutionLog).order_by(desc(JobExecutionLog.started_at), desc(JobExecutionLog.id)).limit(limit)
    return list(db.scalars(stmt).all())


def create_job_execution_log(
    db: Session,
    job_name: str,
    trigger_source: str,
    status_val: str = "RUNNING",
    global_today: Optional[date] = None,
    details: Optional[dict[str, Any]] = None,
) -> JobExecutionLog:
    """Record initiation of a daily batch or pipeline job."""
    log_entry = JobExecutionLog(
        job_name=job_name,
        trigger_source=trigger_source,
        started_at=datetime.now(timezone.utc),
        status=status_val,
        global_today=global_today,
        details=details or {},
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def update_job_execution_log(
    db: Session,
    log_id: int,
    status_val: str,
    completed_at: Optional[datetime] = None,
    details: Optional[dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> Optional[JobExecutionLog]:
    """Record completion or failure of a job execution log."""
    log_entry = db.scalar(select(JobExecutionLog).where(JobExecutionLog.id == log_id))
    if not log_entry:
        return None

    log_entry.status = status_val
    log_entry.completed_at = completed_at or datetime.now(timezone.utc)
    if details:
        current_details = dict(log_entry.details or {})
        current_details.update(details)
        log_entry.details = current_details
    if error_message:
        log_entry.error_message = error_message

    db.commit()
    db.refresh(log_entry)
    return log_entry
