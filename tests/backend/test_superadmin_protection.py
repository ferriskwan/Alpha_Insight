"""Targeted unit and integration tests for Super-Admin unremovable role and account protection."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import User, UserRole
from backend.repositories.user_repo import (
    get_user_by_id,
    get_user_roles,
    remove_user_role,
    update_user_status,
)


@pytest.fixture(autouse=True)
def superadmin_user(db_session: Session) -> User:
    """Ensure Ferris Kwan exists in the test session for all tests."""
    user = User(
        id=1,
        email="ferriskwan@gmail.com",
        name="Ferris Kwan",
        status="active",
        google_id="google-ferris-1",
    )
    db_session.add(user)
    admin_role = UserRole(user_id=1, role="admin", status="active")
    db_session.add(admin_role)
    db_session.commit()
    return user


def test_repository_superadmin_admin_role_cannot_be_removed(db_session: Session) -> None:
    """Ferris Kwan (user 1) cannot have the 'admin' role removed via repository."""
    user = get_user_by_id(db_session, 1)
    assert user is not None
    assert user.email == "ferriskwan@gmail.com"

    # Attempting to remove admin must raise ValueError
    with pytest.raises(ValueError, match="cannot be removed"):
        remove_user_role(db_session, user_id=1, role="admin")


def test_repository_superadmin_cannot_be_suspended(db_session: Session) -> None:
    """Ferris Kwan (user 1) cannot be suspended or deactivated via repository."""
    with pytest.raises(ValueError, match="cannot be suspended"):
        update_user_status(db_session, user_id=1, status_val="suspended")

    with pytest.raises(ValueError, match="cannot be suspended"):
        update_user_status(db_session, user_id=1, status_val="expired")


def test_repository_superadmin_self_healing_admin_role(db_session: Session) -> None:
    """Even if an external DB script deletes the admin role, get_user_roles auto-restores it."""
    # Delete the role directly to simulate out-of-band deletion
    user = get_user_by_id(db_session, 1)
    assert user is not None
    db_session.query(UserRole).filter(UserRole.user_id == 1).delete()
    db_session.commit()

    # Querying get_user_roles must self-heal and restore the admin role
    roles = get_user_roles(db_session, user_id=1)
    assert "admin" in roles


def test_api_superadmin_remove_admin_rejected_403(client: TestClient) -> None:
    """API rejects any attempt to remove the Admin role from Ferris Kwan with HTTP 403."""
    resp = client.post(
        "/api/v1/admin/users/roles",
        json={"user_id": 1, "role": "admin", "action": "remove"},
    )
    assert resp.status_code == 403
    assert "cannot be removed" in resp.json()["detail"]


def test_api_superadmin_suspend_rejected_403(client: TestClient) -> None:
    """API rejects any attempt to suspend Ferris Kwan with HTTP 403."""
    resp = client.post(
        "/api/v1/admin/users/status",
        json={"user_id": 1, "status": "suspended"},
    )
    assert resp.status_code == 403
    assert "cannot be suspended" in resp.json()["detail"]
