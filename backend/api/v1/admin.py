"""Admin panel user management, navigation hierarchy, system reference data, and audit logging."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import SiteMap
from backend.db.session import get_db_session
from backend.dependencies import get_current_user_optional, require_admin
from backend.repositories.audit_repo import get_audit_logs, log_action
from backend.repositories.ref_data_repo import (
    get_all_chart_settings,
    get_sysvalue_by_name,
    get_sysvalues,
    update_chart_settings,
    update_sysvalue,
)
from backend.repositories.sitemap_repo import (
    create_node,
    delete_node,
    get_all_sitemap_nodes,
    update_node,
)
from backend.repositories.sys_repo import (
    create_job_execution_log,
    get_job_execution_logs,
    update_job_execution_log,
)
from backend.repositories.user_repo import (
    assign_user_role,
    get_all_users_with_roles,
    get_user_by_id,
    remove_user_role,
    update_user_status,
)
from backend.schemas.audit import AuditLogEntryDTO
from backend.schemas.auth import (
    AdminUserRoleUpdateRequest,
    AdminUserStatusUpdateRequest,
    UserProfileResponse,
)
from backend.schemas.jobs import (
    JobExecutionLogItem,
    JobTriggerRequest,
    JobTriggerResponse,
)
from backend.schemas.ref_data import (
    ChartSettingsDTO,
    ChartSettingsUpdate,
    SysValueDTO,
    SysValueUpdate,
)
from backend.schemas.sitemap import SiteMapCreate, SiteMapNodeDTO, SiteMapUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


def _client_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract client IP address and user-agent string."""
    ip = request.client.host if request.client else None
    agent = request.headers.get("user-agent")
    return ip, agent


# ---------------------------------------------------------------------------
# 1. User and Role Administration
# ---------------------------------------------------------------------------
@router.get("/users")
def list_admin_users(
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve all users with status, registration timestamp, and assigned roles."""
    return get_all_users_with_roles(db)


@router.post("/users/status")
@router.put("/users/{user_id}/status")
def set_user_status(
    request: Request,
    payload: Optional[AdminUserStatusUpdateRequest] = None,
    user_id: Optional[int] = None,
    status_val: Optional[str] = Query(default=None, alias="status"),
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Activate or deactivate user account and invalidate active sessions."""
    target_uid = (payload.user_id if payload else None) or user_id
    target_status = (payload.status if payload else None) or status_val

    if not target_uid or not target_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and status must be provided",
        )

    user_before = get_user_by_id(db, target_uid)
    old_status = user_before.status if user_before else None

    try:
        updated = update_user_status(db, target_uid, target_status)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_uid} not found",
        )

    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="UPDATE_STATUS",
        entity="users",
        entity_id=str(target_uid),
        old_values={"status": old_status},
        new_values={"status": target_status},
        ip_address=ip,
        user_agent=agent,
    )

    return {
        "status": "success",
        "user_id": updated.id,
        "account_status": updated.status,
    }


@router.post("/users/roles")
@router.post("/users/{user_id}/roles")
@router.put("/users/{user_id}/role")
@router.put("/users/{user_id}/roles")
def set_user_role(
    request: Request,
    payload: Optional[AdminUserRoleUpdateRequest] = None,
    user_id: Optional[int] = None,
    role_val: Optional[str] = Query(default=None, alias="role"),
    action_val: Optional[str] = Query(default=None, alias="action"),
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Assign or update a user's role."""
    target_uid = (payload.user_id if payload else None) or user_id
    target_role = (payload.role if payload else None) or role_val
    action = (payload.action if payload else None) or action_val or "add"

    if not target_uid or not target_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and role must be provided",
        )

    ip, agent = _client_info(request)

    if action == "remove" or (payload and payload.status == "expired"):
        try:
            deleted = remove_user_role(db, target_uid, target_role)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(exc),
            )
        log_action(
            db=db,
            user_id=admin.id,
            action="REMOVE_ROLE",
            entity="user_roles",
            entity_id=str(target_uid),
            old_values={"role": target_role},
            new_values=None,
            ip_address=ip,
            user_agent=agent,
        )
        return {
            "ok": True,
            "status": "success",
            "user_id": target_uid,
            "role": target_role,
            "deleted": deleted,
        }

    role_record = assign_user_role(db, target_uid, target_role)
    log_action(
        db=db,
        user_id=admin.id,
        action="ASSIGN_ROLE",
        entity="user_roles",
        entity_id=str(target_uid),
        old_values=None,
        new_values={"role": target_role},
        ip_address=ip,
        user_agent=agent,
    )
    return {
        "ok": True,
        "status": "success",
        "user_id": role_record.user_id,
        "role": role_record.role,
    }


@router.delete("/users/{user_id}/roles/{role}")
def delete_user_role(
    request: Request,
    user_id: int,
    role: str,
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Revoke a specific user role."""
    deleted = remove_user_role(db, user_id, role)
    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="REVOKE_ROLE",
        entity="user_roles",
        entity_id=str(user_id),
        old_values={"role": role},
        new_values=None,
        ip_address=ip,
        user_agent=agent,
    )
    return {"status": "success", "deleted": deleted}


# ---------------------------------------------------------------------------
# 2. SiteMap Administration
# ---------------------------------------------------------------------------
@router.get("/sitemap", response_model=list[SiteMapNodeDTO])
def list_admin_sitemap(
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> list[SiteMapNodeDTO]:
    """Retrieve all sitemap nodes for administration."""
    nodes = get_all_sitemap_nodes(db)
    return [SiteMapNodeDTO.model_validate(n) for n in nodes]


@router.post("/sitemap", response_model=SiteMapNodeDTO)
def create_sitemap_item(
    request: Request,
    payload: SiteMapCreate,
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> SiteMapNodeDTO:
    """Create a new sitemap node and log the audit entry."""
    node = create_node(db, payload)
    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="CREATE",
        entity="site_map",
        entity_id=str(node.id),
        old_values=None,
        new_values=payload.model_dump(),
        ip_address=ip,
        user_agent=agent,
    )
    return SiteMapNodeDTO.model_validate(node)


@router.put("/sitemap/{node_id}", response_model=SiteMapNodeDTO)
def update_sitemap_item(
    request: Request,
    node_id: int,
    payload: SiteMapUpdate,
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> SiteMapNodeDTO:
    """Update an existing sitemap node and log the audit entry."""
    current = db.scalar(select(SiteMap).where(SiteMap.id == node_id))
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SiteMap node {node_id} not found")

    old_dict = {
        "parent_id": current.parent_id,
        "menu_code": current.menu_code,
        "label": current.label,
        "route": current.route,
        "icon": current.icon,
        "role_required": current.role_required,
        "order_index": current.order_index,
        "is_active": current.is_active,
    }

    updated = update_node(db, node_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SiteMap node {node_id} not found")

    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="UPDATE",
        entity="site_map",
        entity_id=str(node_id),
        old_values=old_dict,
        new_values=payload.model_dump(exclude_unset=True),
        ip_address=ip,
        user_agent=agent,
    )
    return SiteMapNodeDTO.model_validate(updated)


@router.delete("/sitemap/{node_id}")
def delete_sitemap_item(
    request: Request,
    node_id: int,
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a sitemap node and log the audit entry."""
    current = db.scalar(select(SiteMap).where(SiteMap.id == node_id))
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SiteMap node {node_id} not found")

    old_dict = {
        "id": current.id,
        "menu_code": current.menu_code,
        "label": current.label,
    }

    deleted = delete_node(db, node_id)
    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="DELETE",
        entity="site_map",
        entity_id=str(node_id),
        old_values=old_dict,
        new_values=None,
        ip_address=ip,
        user_agent=agent,
    )
    return {"status": "success", "node_id": node_id, "deleted": deleted}


# ---------------------------------------------------------------------------
# 3. Reference Data Administration
# ---------------------------------------------------------------------------
@router.get("/ref-data/sysvalues", response_model=list[SysValueDTO])
def list_admin_sysvalues(
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> list[SysValueDTO]:
    """Retrieve all configuration parameters from sysvalue."""
    rows = get_sysvalues(db)
    return [
        SysValueDTO(
            name=r.name,
            type=r.type,
            strvalue=r.strvalue,
            numvalue=float(r.numvalue) if r.numvalue is not None else None,
            datevalue=r.datevalue.isoformat() if r.datevalue else None,
            description=r.description,
            updatetimestamp=r.updatetimestamp.isoformat() if r.updatetimestamp else None,
        )
        for r in rows
    ]


@router.put("/ref-data/sysvalues/{name}", response_model=SysValueDTO)
def update_admin_sysvalue(
    request: Request,
    name: str,
    payload: SysValueUpdate,
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> SysValueDTO:
    """Update a sysvalue parameter and log the audit entry."""
    current = get_sysvalue_by_name(db, name)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SysValue '{name}' not found")

    old_dict = {
        "type": current.type,
        "strvalue": current.strvalue,
        "numvalue": float(current.numvalue) if current.numvalue is not None else None,
        "datevalue": current.datevalue.isoformat() if current.datevalue else None,
        "description": current.description,
    }

    updated = update_sysvalue(db, name, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"SysValue '{name}' not found")

    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="UPDATE",
        entity="sysvalue",
        entity_id=name,
        old_values=old_dict,
        new_values=payload.model_dump(exclude_unset=True),
        ip_address=ip,
        user_agent=agent,
    )

    return SysValueDTO(
        name=updated.name,
        type=updated.type,
        strvalue=updated.strvalue,
        numvalue=float(updated.numvalue) if updated.numvalue is not None else None,
        datevalue=updated.datevalue.isoformat() if updated.datevalue else None,
        description=updated.description,
        updatetimestamp=updated.updatetimestamp.isoformat() if updated.updatetimestamp else None,
    )


@router.get("/ref-data/chart-settings", response_model=list[ChartSettingsDTO])
@router.get("/ref-data/ref_chart_settings", response_model=list[ChartSettingsDTO])
def list_admin_chart_settings(
    user_id: Optional[int] = Query(default=None),
    symbol: Optional[str] = Query(default=None),
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> list[ChartSettingsDTO]:
    """Retrieve chart technical indicator settings."""
    settings_list = get_all_chart_settings(db, user_id=user_id, symbol=symbol)
    return [ChartSettingsDTO.model_validate(s) for s in settings_list]


@router.put("/ref-data/chart-settings", response_model=ChartSettingsDTO)
@router.put("/ref-data/ref_chart_settings", response_model=ChartSettingsDTO)
def update_admin_chart_settings(
    request: Request,
    payload: ChartSettingsUpdate,
    settings_id: Optional[int] = Query(default=None),
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> ChartSettingsDTO:
    """Update or upsert chart indicator parameters and log audit trail."""
    updated = update_chart_settings(db, settings_id=settings_id, update_data=payload)
    ip, agent = _client_info(request)
    log_action(
        db=db,
        user_id=admin.id,
        action="UPDATE",
        entity="ref_chart_settings",
        entity_id=str(updated.id),
        old_values={"settings_id": settings_id},
        new_values=payload.model_dump(exclude_unset=True),
        ip_address=ip,
        user_agent=agent,
    )
    return ChartSettingsDTO.model_validate(updated)


# ---------------------------------------------------------------------------
# 4. Audit Log Inquiries
# ---------------------------------------------------------------------------
@router.get("/audit-logs", response_model=list[AuditLogEntryDTO])
def list_admin_audit_logs(
    limit: int = Query(default=100, ge=1, le=1000),
    entity: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    admin: UserProfileResponse = Depends(require_admin),
    db: Session = Depends(get_db_session),
) -> list[AuditLogEntryDTO]:
    """Retrieve system audit logs for administrative inspection."""
    return get_audit_logs(db, limit=limit, entity=entity, action=action)


# ---------------------------------------------------------------------------
# 5. Cloud Run Job Execution Log and Trigger
# ---------------------------------------------------------------------------
@router.get("/jobs", response_model=list[JobExecutionLogItem])
def list_job_logs(
    limit: int = Query(default=50),
    admin: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[JobExecutionLogItem]:
    """Retrieve audit history of daily Cloud Run Job executions."""
    logs = get_job_execution_logs(db, limit=limit)
    return [
        JobExecutionLogItem(
            id=log_item.id,
            job_name=log_item.job_name,
            trigger_source=log_item.trigger_source,
            started_at=log_item.started_at.isoformat(),
            completed_at=log_item.completed_at.isoformat() if log_item.completed_at else None,
            status=log_item.status,
            global_today=log_item.global_today.isoformat() if log_item.global_today else None,
            details=log_item.details,
            error_message=log_item.error_message,
        )
        for log_item in logs
    ]


@router.post("/jobs/run", response_model=JobTriggerResponse)
def trigger_daily_job(
    payload: JobTriggerRequest,
    admin: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> JobTriggerResponse:
    """Trigger pipeline calculations or Cloud Run Job execution on demand."""
    trigger_user = admin.email if admin else "system"
    log_entry = create_job_execution_log(
        db,
        job_name=payload.job_name,
        trigger_source=f"MANUAL_API:{trigger_user}",
        status_val="RUNNING",
        global_today=date.today(),
        details={"skip_market_download": payload.skip_market_download},
    )

    try:
        # Import batch pipeline runners
        import run_daily_margin_interest
        import run_mark_to_market
        import run_portfolio_summary

        logger.info("Executing mark_to_market position valuation...")
        run_mark_to_market.run_mark_to_market()

        logger.info("Executing run_daily_margin_interest calculation...")
        run_daily_margin_interest.run_daily_margin_interest()

        logger.info("Executing run_portfolio_summary snapshot...")
        run_portfolio_summary.run_portfolio_summary()

        update_job_execution_log(
            db,
            log_id=log_entry.id,
            status_val="SUCCESS",
            completed_at=datetime.now(timezone.utc),
            details={"result": "Pipeline run completed with zero exit code"},
        )

        return JobTriggerResponse(
            ok=True,
            status="SUCCESS",
            job_id=log_entry.id,
            job_log_id=log_entry.id,
            message=f"Pipeline job '{payload.job_name}' completed successfully",
            details={"duration": "completed"},
        )

    except Exception as exc:
        logger.error("Job execution failed: %s", exc, exc_info=True)
        update_job_execution_log(
            db,
            log_id=log_entry.id,
            status_val="FAILED",
            completed_at=datetime.now(timezone.utc),
            error_message=str(exc),
        )
        return JobTriggerResponse(
            ok=False,
            status="FAILED",
            job_id=log_entry.id,
            job_log_id=log_entry.id,
            message=f"Job execution failed: {exc}",
            details={"error": str(exc)},
        )
