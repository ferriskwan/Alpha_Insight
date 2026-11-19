"""Repository for SiteMap navigation tree operations."""

from __future__ import annotations

from typing import Any, Optional, Union

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import SiteMap
from backend.schemas.sitemap import SiteMapCreate, SiteMapNodeDTO, SiteMapUpdate


def _get_allowed_roles(role: Union[str, list[str]]) -> list[str]:
    """Resolve set of accessible role tiers based on user privilege."""
    roles = [role] if isinstance(role, str) else role
    if "admin" in roles:
        return ["admin", "analyst", "user"]
    if "analyst" in roles:
        return ["analyst", "user"]
    return ["user"]


def get_all_sitemap_nodes(db: Session) -> list[SiteMap]:
    """Retrieve flat list of all sitemap items ordered by hierarchy index."""
    stmt = select(SiteMap).order_by(SiteMap.order_index.asc(), SiteMap.id.asc())
    return list(db.scalars(stmt).all())


def get_user_sitemap(db: Session, role: Union[str, list[str]] = "user") -> list[SiteMapNodeDTO]:
    """Build nested recursive menu tree filtered by active status and user role permissions."""
    allowed_roles = _get_allowed_roles(role)
    stmt = (
        select(SiteMap)
        .where(
            SiteMap.is_active.is_(True),
            SiteMap.role_required.in_(allowed_roles),
        )
        .order_by(SiteMap.order_index.asc(), SiteMap.id.asc())
    )
    nodes = list(db.scalars(stmt).all())

    # Map to DTOs
    node_map: dict[int, SiteMapNodeDTO] = {}
    for node in nodes:
        node_map[node.id] = SiteMapNodeDTO(
            id=node.id,
            parent_id=node.parent_id,
            menu_code=node.menu_code,
            label=node.label,
            route=node.route,
            icon=node.icon,
            role_required=node.role_required,
            order_index=node.order_index,
            is_active=node.is_active,
            children=[],
        )

    tree: list[SiteMapNodeDTO] = []
    for node in nodes:
        dto = node_map[node.id]
        if node.parent_id and node.parent_id in node_map:
            node_map[node.parent_id].children.append(dto)
        else:
            tree.append(dto)

    return tree


def create_node(db: Session, node_data: Union[dict[str, Any], SiteMapCreate]) -> SiteMap:
    """Create a new sitemap item."""
    data = node_data.model_dump() if isinstance(node_data, SiteMapCreate) else dict(node_data)
    node = SiteMap(
        parent_id=data.get("parent_id"),
        menu_code=data["menu_code"],
        label=data["label"],
        route=data["route"],
        icon=data.get("icon"),
        role_required=data.get("role_required", "user") or "user",
        order_index=data.get("order_index", 0) or 0,
        is_active=data.get("is_active", True) if data.get("is_active") is not None else True,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


def update_node(db: Session, node_id: int, update_data: Union[dict[str, Any], SiteMapUpdate]) -> Optional[SiteMap]:
    """Update fields of an existing sitemap item."""
    node = db.scalar(select(SiteMap).where(SiteMap.id == node_id))
    if not node:
        return None

    data = update_data.model_dump(exclude_unset=True) if isinstance(update_data, SiteMapUpdate) else dict(update_data)

    for field, value in data.items():
        if hasattr(node, field) and value is not None:
            setattr(node, field, value)

    db.commit()
    db.refresh(node)
    return node


def delete_node(db: Session, node_id: int) -> bool:
    """Delete a sitemap node and cascaded descendants."""
    node = db.scalar(select(SiteMap).where(SiteMap.id == node_id))
    if not node:
        return False

    db.delete(node)
    db.commit()
    return True
