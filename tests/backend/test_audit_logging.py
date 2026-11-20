"""UAT / Unit Tests for Audit Logging Trail and Querying.

Covers:
- audit_repo.log_action records mutations with old_values, new_values, ip_address, user_agent
- Recording system actions (user_id is None)
- Querying audit logs via audit_repo.get_audit_logs with entity and action filters
- Proper timestamp ordering (reverse chronological) and limit enforcement
- Admin API endpoint: GET /api/v1/admin/audit-logs (RBAC authorization and query parameter filters)
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import User
from backend.repositories.audit_repo import get_audit_logs, log_action


class TestAuditLoggingRepository:
    """Test suite for audit_repo recording and filtering functions."""

    def test_log_action_records_entry_with_old_and_new_values(
        self, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify log_action correctly records an entry with old/new JSON payloads."""
        admin_user: User = seed_test_data["admin_user"]

        entry = log_action(
            db=db_session,
            user_id=admin_user.id,
            action="UPDATE_STATUS",
            entity="users",
            entity_id="2",
            old_values={"status": "active"},
            new_values={"status": "suspended"},
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 TestBrowser",
        )

        assert entry.id is not None
        assert entry.user_id == admin_user.id
        assert entry.action == "UPDATE_STATUS"
        assert entry.entity == "users"
        assert entry.entity_id == "2"
        assert entry.old_values == {"status": "active"}
        assert entry.new_values == {"status": "suspended"}
        assert entry.ip_address == "192.168.1.100"
        assert entry.user_agent == "Mozilla/5.0 TestBrowser"
        assert entry.timestamp is not None

    def test_log_action_system_event_without_user(self, db_session: Session) -> None:
        """Verify system-triggered actions record cleanly with user_id=None."""
        entry = log_action(
            db=db_session,
            user_id=None,
            action="BATCH_PIPELINE_COMPLETE",
            entity="job_execution_log",
            entity_id="101",
            old_values=None,
            new_values={"status": "SUCCESS", "records_processed": 500},
        )

        assert entry.id is not None
        assert entry.user_id is None
        assert entry.action == "BATCH_PIPELINE_COMPLETE"
        assert entry.new_values is not None
        assert entry.new_values["records_processed"] == 500

    def test_get_audit_logs_filters_by_entity_and_action(
        self, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify get_audit_logs filters entries accurately by entity and action."""
        admin_user: User = seed_test_data["admin_user"]

        log_action(db_session, admin_user.id, "CREATE", "trade", "10", None, {"symbol": "AAPL"})
        log_action(db_session, admin_user.id, "DELETE", "trade", "11", {"symbol": "MSFT"}, None)
        log_action(db_session, admin_user.id, "UPDATE", "sysvalue", "START_DATE", None, {"val": "2026-01-01"})
        log_action(db_session, admin_user.id, "CREATE", "site_map", "5", None, {"label": "Reports"})

        # Filter by entity
        trade_logs = get_audit_logs(db_session, entity="trade")
        assert len(trade_logs) == 2
        assert all(item.entity == "trade" for item in trade_logs)

        # Filter by action
        create_logs = get_audit_logs(db_session, action="CREATE")
        assert len(create_logs) == 2
        assert all(item.action == "CREATE" for item in create_logs)

        # Filter by entity and action
        trade_create = get_audit_logs(db_session, entity="trade", action="CREATE")
        assert len(trade_create) == 1
        assert trade_create[0].entity_id == "10"
        assert trade_create[0].user_email == admin_user.email

    def test_get_audit_logs_reverse_chronological_order_and_limit(
        self, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify audit entries are returned newest first and limit is honored."""
        for i in range(15):
            log_action(
                db_session,
                user_id=1,
                action="ACTION_STEP",
                entity="sequence",
                entity_id=str(i),
            )

        logs = get_audit_logs(db_session, limit=5, entity="sequence")
        assert len(logs) == 5
        # The latest created should appear first
        assert int(logs[0].entity_id or "0") > int(logs[1].entity_id or "0")


class TestAuditLoggingAPI:
    """Test suite for GET /api/v1/admin/audit-logs."""

    def test_admin_can_retrieve_audit_logs(
        self, client: TestClient, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Admin user with valid session can query audit logs."""
        log_action(
            db_session,
            user_id=1,
            action="API_ADMIN_AUDIT_TEST",
            entity="audit_test",
            entity_id="99",
            new_values={"test": True},
        )

        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/v1/admin/audit-logs?entity=audit_test")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["action"] == "API_ADMIN_AUDIT_TEST"
        assert data[0]["entity"] == "audit_test"
        assert data[0]["new_values"] == {"test": True}

    def test_unauthenticated_request_rejected(self, client: TestClient) -> None:
        """Unauthenticated caller receives 401 on admin audit-logs."""
        resp = client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 401
