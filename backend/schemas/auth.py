"""Authentication and user session Pydantic v2 schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class GoogleLoginRequest(BaseModel):
    """Payload for POST /api/auth/google-login."""

    credential: Optional[str] = Field(default=None, description="Google ID token JWT string")
    mock_email: Optional[str] = Field(default=None, description="Dev-mode email override when ENV != PRD")
    mock_name: Optional[str] = Field(default=None, description="Dev-mode display name override")


class UserProfileResponse(BaseModel):
    """Authenticated user profile returned by /api/auth/me and /api/auth/google-login."""

    id: int
    email: str
    name: str
    picture: Optional[str] = None
    status: str = "active"
    roles: list[str] = Field(default_factory=list)


class AuthEnvResponse(BaseModel):
    """Environment & OAuth configuration returned by GET /api/auth/env."""

    env: str
    googleClientId: str
    dbName: Optional[str] = Field(default=None, description="Active database name")


class AdminUserStatusUpdateRequest(BaseModel):
    """Payload for POST /api/admin/users/status."""

    user_id: Optional[int] = None
    status: str


class AdminUserRoleUpdateRequest(BaseModel):
    """Payload for POST /api/admin/users/roles."""

    user_id: Optional[int] = None
    role: str
    status: Optional[str] = "active"
    action: Optional[str] = "add"
