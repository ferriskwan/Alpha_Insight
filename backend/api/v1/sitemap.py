"""Sitemap navigation endpoint for user menu hierarchy."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.db.session import get_db_session
from backend.dependencies import get_current_user_optional
from backend.repositories.sitemap_repo import get_user_sitemap
from backend.schemas.auth import UserProfileResponse
from backend.schemas.sitemap import SiteMapNodeDTO

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=list[SiteMapNodeDTO])
@router.get("/", response_model=list[SiteMapNodeDTO])
@router.get("/sitemap", response_model=list[SiteMapNodeDTO])
def get_sitemap(
    role: Optional[str] = Query(None, description="Optional role override for filtering navigation"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[SiteMapNodeDTO]:
    """Retrieve hierarchical menu tree filtered by caller's role or role override."""
    if role:
        roles = [role]
    elif user and user.roles:
        roles = user.roles
    else:
        roles = ["user"]
    return get_user_sitemap(db, role=roles)
