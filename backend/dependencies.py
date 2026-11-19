"""FastAPI authentication, security, and database dependency providers."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import Cookie, Depends, Header, HTTPException, Query, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.db.models import User, UserRole, UserSession
from backend.db.session import get_db_session
from backend.schemas.auth import UserProfileResponse

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)


def get_current_settings() -> Settings:
    """Dependency injecting cached Settings instance."""
    return get_settings()


def verify_api_key(
    x_api_key: Optional[str] = Depends(api_key_header),
    settings: Settings = Depends(get_current_settings),
) -> str:
    """Validate X-API-KEY header for internal service & batch pipeline requests."""
    if not settings.api_key:
        logger.error("API_KEY is not configured on server")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API Security is not configured on the server",
        )
    if not x_api_key or x_api_key != settings.api_key:
        logger.warning("Invalid or missing X-API-KEY")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    return x_api_key


def get_current_user_optional(
    alpha_sid: Annotated[Optional[str], Cookie(alias="alpha_sid")] = None,
    sid: Annotated[Optional[str], Cookie(alias="sid")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
    user_id_param: Annotated[Optional[int], Query(alias="user_id")] = None,
    db: Session = Depends(get_db_session),
    settings: Settings = Depends(get_current_settings),
) -> Optional[UserProfileResponse]:
    """Resolve authenticated user profile from session cookie, bearer header, or dev query."""
    # 1. Resolve session token
    session_id = alpha_sid or sid
    if not session_id and authorization and authorization.startswith("Bearer "):
        session_id = authorization[len("Bearer ") :].strip()

    now_utc = datetime.now(timezone.utc)

    # 2. Try session lookup in database
    if session_id:
        stmt = select(UserSession, User).join(User, UserSession.user_id == User.id).where(UserSession.sid == session_id)
        result = db.execute(stmt).first()
        if result:
            user_session, user = result
            # Verify expiration
            expires_at = user_session.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at > now_utc:
                if user.status == "expired":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Account is expired/deactivated",
                    )
                roles_stmt = select(UserRole.role).where(
                    UserRole.user_id == user.id,
                    UserRole.status == "active",
                )
                roles = list(db.scalars(roles_stmt).all())
                return UserProfileResponse(
                    id=user.id,
                    email=user.email,
                    name=user.name or user.email,
                    picture=user.picture,
                    status=user.status,
                    roles=roles,
                )
            else:
                # Expired session cleanup
                db.delete(user_session)
                db.commit()

    # 3. Development / Local test fallback (when ENV != 'PRD')
    if settings.env.upper() != "PRD":
        target_uid = user_id_param or 1
        dev_user = db.scalar(select(User).where(User.id == target_uid))
        if dev_user:
            roles_stmt = select(UserRole.role).where(
                UserRole.user_id == dev_user.id,
                UserRole.status == "active",
            )
            roles = list(db.scalars(roles_stmt).all())
            return UserProfileResponse(
                id=dev_user.id,
                email=dev_user.email,
                name=dev_user.name or dev_user.email,
                picture=dev_user.picture,
                status=dev_user.status,
                roles=roles if roles else ["user"],
            )

    return None


def get_current_user(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> UserProfileResponse:
    """Ensure user is authenticated and active, raising 401 Unauthorized otherwise."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Please login.",
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated or expired",
        )
    return user


def require_admin(
    user: UserProfileResponse = Depends(get_current_user),
) -> UserProfileResponse:
    """Enforce administrator role for protected operational endpoints."""
    if "admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Administrator role required.",
        )
    return user


def require_roles(*allowed_roles: str):
    """Factory creating dependency requiring at least one of the specified roles (or admin)."""

    def dependency(user: UserProfileResponse = Depends(get_current_user)) -> UserProfileResponse:
        user_roles = set(user.roles or [])
        if "admin" in user_roles or any(r in user_roles for r in allowed_roles):
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
        )

    return dependency
