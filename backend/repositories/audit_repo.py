"""Repository for recording and querying system and administrative audit logs."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.db.models import AuditLog, User
from backend.schemas.audit import AuditLogEntryDTO


def log_action(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    old_values: Optional[dict[str, Any]] = None,
    new_values: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Record a mutation action into public.audit_log."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_audit_logs(
    db: Session,
    limit: int = 100,
    entity: Optional[str] = None,
    action: Optional[str] = None,
) -> list[AuditLogEntryDTO]:
    """Retrieve audit trail logs with associated user emails ordered by most recent."""
    stmt = (
        select(AuditLog, User.email)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(desc(AuditLog.timestamp), desc(AuditLog.id))
    )

    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    stmt = stmt.limit(limit)
    rows = db.execute(stmt).all()

    entries: list[AuditLogEntryDTO] = []
    for log_item, user_email in rows:
        entries.append(
            AuditLogEntryDTO(
                id=log_item.id,
                user_id=log_item.user_id,
                user_email=user_email,
                action=log_item.action,
                entity=log_item.entity,
                entity_id=log_item.entity_id,
                old_values=log_item.old_values,
                new_values=log_item.new_values,
                ip_address=log_item.ip_address,
                user_agent=log_item.user_agent,
                timestamp=log_item.timestamp,
            )
        )
    return entries
