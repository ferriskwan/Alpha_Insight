"""Pydantic schemas for SiteMap navigation entities and operations."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SiteMapNodeDTO(BaseModel):
    """Hierarchical navigation tree node schema."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_id: Optional[int] = None
    menu_code: str
    label: str
    route: str
    icon: Optional[str] = None
    role_required: str = "user"
    order_index: int = 0
    is_active: bool = True
    children: List[SiteMapNodeDTO] = []


class SiteMapCreate(BaseModel):
    """Payload for creating a new SiteMap node."""

    parent_id: Optional[int] = None
    menu_code: str
    label: str
    route: str
    icon: Optional[str] = None
    role_required: Optional[str] = "user"
    order_index: Optional[int] = 0
    is_active: Optional[bool] = True


class SiteMapUpdate(BaseModel):
    """Payload for updating an existing SiteMap node."""

    parent_id: Optional[int] = None
    menu_code: Optional[str] = None
    label: Optional[str] = None
    route: Optional[str] = None
    icon: Optional[str] = None
    role_required: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None
