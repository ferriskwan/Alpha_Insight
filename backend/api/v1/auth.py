"""Authentication and session management API routes."""

from __future__ import annotations

import logging
from typing import Annotated, Optional

import requests
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.config import Settings
from backend.db.session import get_db_session
from backend.dependencies import get_current_settings, get_current_user
from backend.repositories.user_repo import (
    create_or_update_user,
    create_user_session,
    delete_session,
    get_user_roles,
)
from backend.schemas.auth import (
    AuthEnvResponse,
    GoogleLoginRequest,
    UserProfileResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/env", response_model=AuthEnvResponse)
def get_auth_env(settings: Settings = Depends(get_current_settings)) -> AuthEnvResponse:
    """Return runtime environment name and Google OAuth Client ID."""
    return AuthEnvResponse(
        env=settings.env,
        googleClientId=settings.google_client_id,
        dbName=settings.db_name,
    )


@router.get("/config")
def get_auth_config(settings: Settings = Depends(get_current_settings)) -> dict[str, str]:
    """Compatibility alias returning OAuth client configuration."""
    return {"googleClientId": settings.google_client_id}


@router.post("/google-login", response_model=UserProfileResponse)
def google_login(
    payload: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db_session),
    settings: Settings = Depends(get_current_settings),
) -> UserProfileResponse:
    """Authenticate via Google OAuth ID token or developer mock bypass."""
    email: str = ""
    name: str = ""
    picture: Optional[str] = None
    google_id: Optional[str] = None

    # Check for mock login override
    is_dev = settings.env.upper() != "PRD"
    credential = payload.credential

    if is_dev and (payload.mock_email or credential in ("mock-ferris-token", "mock-token", None)):
        email = payload.mock_email or "ferriskwan@gmail.com"
        name = payload.mock_name or ("Ferris Kwan" if email == "ferriskwan@gmail.com" else "Alpha User")
        picture = "https://lh3.googleusercontent.com/a/default-user"
        google_id = f"mock-google-id-{email}"
    elif credential:
        try:
            token_res = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}",
                timeout=10,
            )
            if not token_res.ok:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google ID token",
                )
            token_data = token_res.json()
            email = token_data.get("email", "")
            name = token_data.get("name") or token_data.get("given_name") or email
            picture = token_data.get("picture")
            google_id = token_data.get("sub")
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Error contacting Google tokeninfo endpoint: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Google authentication failed: {exc}",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing credential or mock_email in request payload",
        )

    user = create_or_update_user(
        db=db,
        email=email,
        name=name,
        picture=picture,
        google_id=google_id,
    )

    if user.status == "expired":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is expired/deactivated. Contact administrator.",
        )

    roles = get_user_roles(db, user.id)
    if not roles:
        roles = ["user"]

    sid = create_user_session(db, user.id, ttl_days=settings.session_ttl_days)

    max_age_sec = settings.session_ttl_days * 86400
    is_secure = settings.env.upper() == "PRD"

    response.set_cookie(
        key=settings.session_cookie_name,
        value=sid,
        max_age=max_age_sec,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        path="/",
    )
    # Also set 'sid' for backward compatibility
    if settings.session_cookie_name != "sid":
        response.set_cookie(
            key="sid",
            value=sid,
            max_age=max_age_sec,
            httponly=True,
            samesite="lax",
            secure=is_secure,
            path="/",
        )

    return UserProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name or user.email,
        picture=user.picture,
        status=user.status,
        roles=roles,
    )


@router.get("/me", response_model=UserProfileResponse)
def get_me(user: UserProfileResponse = Depends(get_current_user)) -> UserProfileResponse:
    """Return currently authenticated user profile."""
    return user


@router.post("/logout")
def logout(
    response: Response,
    alpha_sid: Annotated[Optional[str], Cookie(alias="alpha_sid")] = None,
    sid: Annotated[Optional[str], Cookie(alias="sid")] = None,
    authorization: Annotated[Optional[str], Header()] = None,
    db: Session = Depends(get_db_session),
    settings: Settings = Depends(get_current_settings),
) -> dict[str, bool]:
    """Terminate current user session and expire browser authentication cookies."""
    session_id = alpha_sid or sid
    if not session_id and authorization and authorization.startswith("Bearer "):
        session_id = authorization[len("Bearer ") :].strip()

    if session_id:
        delete_session(db, session_id)

    response.delete_cookie(key=settings.session_cookie_name, path="/")
    response.delete_cookie(key="sid", path="/")
    return {"success": True}
