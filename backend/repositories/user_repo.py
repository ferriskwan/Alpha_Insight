"""Repository for User, UserRole, and UserSession operations."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.db.models import User, UserRole, UserSession


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Retrieve user entity by primary key ID."""
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve user entity by unique email."""
    return db.scalar(select(User).where(User.email == email))


def create_or_update_user(
    db: Session,
    email: str,
    name: Optional[str] = None,
    picture: Optional[str] = None,
    google_id: Optional[str] = None,
) -> User:
    """Create a new user or update details of an existing user on OAuth login."""
    user = get_user_by_email(db, email)
    if not user:
        user = User(
            email=email,
            name=name or email,
            picture=picture,
            google_id=google_id,
            status="active",
        )
        db.add(user)
        db.flush()
        # Default user role
        default_role = UserRole(user_id=user.id, role="user", status="active")
        db.add(default_role)
        db.commit()
        db.refresh(user)
    else:
        changed = False
        if name and user.name != name:
            user.name = name
            changed = True
        if picture and user.picture != picture:
            user.picture = picture
            changed = True
        if google_id and user.google_id != google_id:
            user.google_id = google_id
            changed = True
        if changed:
            db.commit()
            db.refresh(user)
    return user


SUPERADMIN_EMAIL = "ferriskwan@gmail.com"


def is_superadmin(user_id: Optional[int] = None, email: Optional[str] = None) -> bool:
    """Return True if the user matches root super-admin credentials."""
    if user_id == 1:
        return True
    if email and email.strip().lower() == SUPERADMIN_EMAIL.lower():
        return True
    return False


def get_user_roles(db: Session, user_id: int) -> list[str]:
    """Fetch active roles for the specified user with automatic super-admin enforcement."""
    stmt = select(UserRole.role).where(
        UserRole.user_id == user_id,
        UserRole.status == "active",
    )
    roles = list(db.scalars(stmt).all())

    # Super-Admin Self-Healing Guarantee: Ferris Kwan is programmatically guaranteed to have 'admin'
    user = get_user_by_id(db, user_id)
    if user and is_superadmin(user.id, user.email):
        if "admin" not in roles:
            # Idempotently restore admin role in database
            admin_stmt = select(UserRole).where(UserRole.user_id == user.id, UserRole.role == "admin")
            existing_admin = db.scalar(admin_stmt)
            if existing_admin:
                existing_admin.status = "active"
            else:
                db.add(UserRole(user_id=user.id, role="admin", status="active"))
            db.commit()
            roles.append("admin")

    return roles


def assign_user_role(db: Session, user_id: int, role: str) -> UserRole:
    """Assign or reactivate a role for the specified user."""
    stmt = select(UserRole).where(UserRole.user_id == user_id, UserRole.role == role)
    existing = db.scalar(stmt)
    if existing:
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing

    new_role = UserRole(user_id=user_id, role=role, status="active")
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    return new_role


def remove_user_role(db: Session, user_id: int, role: str) -> bool:
    """Remove a user role record, strictly protecting the root super-admin."""
    user = get_user_by_id(db, user_id)
    if user and is_superadmin(user.id, user.email) and role.lower() == "admin":
        raise ValueError(
            "The 'admin' role is permanently assigned to root super-admin (Ferris Kwan) and cannot be removed."
        )

    stmt = select(UserRole).where(UserRole.user_id == user_id, UserRole.role == role)
    existing = db.scalar(stmt)
    if existing:
        db.delete(existing)
        db.commit()
        return True
    return False


def update_user_status(db: Session, user_id: int, status_val: str) -> Optional[User]:
    """Update user account status ('active' or 'expired'), strictly protecting root super-admin."""
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    if is_superadmin(user.id, user.email) and status_val.lower() != "active":
        raise ValueError("Root super-admin account (Ferris Kwan) cannot be suspended or deactivated.")

    user.status = status_val
    if status_val == "expired":
        delete_user_sessions(db, user_id)
    db.commit()
    db.refresh(user)
    return user


def get_all_users_with_roles(db: Session) -> list[dict[str, Any]]:
    """Retrieve list of all users paired with their respective active roles."""
    users = list(db.scalars(select(User).order_by(User.id)).all())
    output = []
    for u in users:
        roles = get_user_roles(db, u.id)
        output.append(
            {
                "id": u.id,
                "email": u.email,
                "name": u.name or u.email,
                "picture": u.picture,
                "status": u.status,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "roles": roles,
            }
        )
    return output


def create_user_session(db: Session, user_id: int, ttl_days: int = 7) -> str:
    """Generate and persist a cryptographically secure session identifier."""
    sid = "sid_" + secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    new_session = UserSession(sid=sid, user_id=user_id, expires_at=expires_at)
    db.add(new_session)
    db.commit()
    return sid


def delete_session(db: Session, sid: str) -> bool:
    """Delete a single session token."""
    session_obj = db.scalar(select(UserSession).where(UserSession.sid == sid))
    if session_obj:
        db.delete(session_obj)
        db.commit()
        return True
    return False


def delete_user_sessions(db: Session, user_id: int) -> int:
    """Purge all sessions belonging to a specific user upon logout/deactivation."""
    stmt = delete(UserSession).where(UserSession.user_id == user_id)
    result = db.execute(stmt)
    db.commit()
    return int(getattr(result, "rowcount", 0) or 0)
