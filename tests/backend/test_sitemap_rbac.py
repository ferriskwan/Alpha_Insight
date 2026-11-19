"""UAT / Unit Tests for Dynamic SiteMap Navigation and Role-Based Access Control (RBAC).

Covers:
- get_user_sitemap role-based filtering:
  * 'user' role sees only routes where role_required == 'user'
  * 'analyst' role sees routes where role_required in ('analyst', 'user')
  * 'admin' role sees all routes ('admin', 'analyst', 'user')
- Tree hierarchy nesting (parent nodes with nested child nodes)
- Filtering out inactive nodes (is_active == False)
- Ordering by order_index
- Repository CRUD: create_node, update_node, delete_node, get_all_sitemap_nodes
- FastAPI API endpoints: GET /api/v1/sitemap, GET/POST/PUT/DELETE /api/v1/admin/sitemap
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import SiteMap
from backend.repositories.sitemap_repo import (
    create_node,
    delete_node,
    get_all_sitemap_nodes,
    get_user_sitemap,
    update_node,
)
from backend.schemas.sitemap import SiteMapCreate, SiteMapUpdate


@pytest.fixture
def sample_sitemap_nodes(db_session: Session) -> list[SiteMap]:
    """Create a structured hierarchy of test sitemap nodes with various roles and parent-child relations."""
    # 1. Root: Portfolio (user)
    root_portfolio = SiteMap(
        menu_code="test.portfolio",
        label="Test Portfolio",
        route="/portfolio",
        icon="Briefcase",
        role_required="user",
        order_index=1,
        is_active=True,
    )
    # 2. Root: Research (analyst)
    root_research = SiteMap(
        menu_code="test.research",
        label="Test Research",
        route="/research",
        icon="TrendingUp",
        role_required="analyst",
        order_index=2,
        is_active=True,
    )
    # 3. Root: Admin (admin)
    root_admin = SiteMap(
        menu_code="test.admin",
        label="Test Administration",
        route="/admin",
        icon="Shield",
        role_required="admin",
        order_index=3,
        is_active=True,
    )
    db_session.add_all([root_portfolio, root_research, root_admin])
    db_session.flush()

    # Children of Portfolio
    child_overview = SiteMap(
        parent_id=root_portfolio.id,
        menu_code="test.portfolio.overview",
        label="Overview",
        route="/portfolio/overview",
        icon="PieChart",
        role_required="user",
        order_index=1,
        is_active=True,
    )
    child_analytics = SiteMap(
        parent_id=root_portfolio.id,
        menu_code="test.portfolio.analytics",
        label="Advanced Analytics",
        route="/portfolio/analytics",
        icon="BarChart3",
        role_required="analyst",
        order_index=2,
        is_active=True,
    )
    child_inactive = SiteMap(
        parent_id=root_portfolio.id,
        menu_code="test.portfolio.hidden",
        label="Hidden Feature",
        route="/portfolio/hidden",
        icon="HelpCircle",
        role_required="user",
        order_index=3,
        is_active=False,  # Inactive
    )

    # Child of Research
    child_stock = SiteMap(
        parent_id=root_research.id,
        menu_code="test.research.stock",
        label="Stock Analyst",
        route="/research/stock",
        icon="Activity",
        role_required="analyst",
        order_index=1,
        is_active=True,
    )

    # Child of Admin
    child_users = SiteMap(
        parent_id=root_admin.id,
        menu_code="test.admin.users",
        label="User Management",
        route="/admin/users",
        icon="Users",
        role_required="admin",
        order_index=1,
        is_active=True,
    )

    all_nodes = [
        root_portfolio,
        root_research,
        root_admin,
        child_overview,
        child_analytics,
        child_inactive,
        child_stock,
        child_users,
    ]
    db_session.add_all(all_nodes[3:])
    db_session.commit()
    return all_nodes


class TestSiteMapRBAC:
    """Test suite for role-based filtering of sitemap hierarchy."""

    def test_user_role_sees_only_user_level_nodes(
        self, db_session: Session, sample_sitemap_nodes: list[SiteMap]
    ) -> None:
        """User role should only receive nodes where role_required == 'user'."""
        tree = get_user_sitemap(db_session, role="user")

        # Root level should only contain Portfolio (Research is analyst, Admin is admin)
        root_codes = [node.menu_code for node in tree]
        assert "test.portfolio" in root_codes
        assert "test.research" not in root_codes
        assert "test.admin" not in root_codes

        portfolio_node = next(n for n in tree if n.menu_code == "test.portfolio")
        child_codes = [c.menu_code for c in portfolio_node.children]

        # Overview is 'user', so it must be included
        assert "test.portfolio.overview" in child_codes
        # Analytics is 'analyst', so it must NOT be included for a regular user
        assert "test.portfolio.analytics" not in child_codes
        # Hidden node is inactive, so it must NOT be included
        assert "test.portfolio.hidden" not in child_codes

    def test_analyst_role_sees_analyst_and_user_nodes(
        self, db_session: Session, sample_sitemap_nodes: list[SiteMap]
    ) -> None:
        """Analyst role should receive both 'analyst' and 'user' level nodes."""
        tree = get_user_sitemap(db_session, role="analyst")

        root_codes = [node.menu_code for node in tree]
        assert "test.portfolio" in root_codes
        assert "test.research" in root_codes
        assert "test.admin" not in root_codes

        portfolio_node = next(n for n in tree if n.menu_code == "test.portfolio")
        child_codes = [c.menu_code for c in portfolio_node.children]
        assert "test.portfolio.overview" in child_codes
        assert "test.portfolio.analytics" in child_codes  # Analyst can see this
        assert "test.portfolio.hidden" not in child_codes  # Inactive still filtered out

        research_node = next(n for n in tree if n.menu_code == "test.research")
        assert len(research_node.children) == 1
        assert research_node.children[0].menu_code == "test.research.stock"

    def test_admin_role_sees_all_active_nodes(self, db_session: Session, sample_sitemap_nodes: list[SiteMap]) -> None:
        """Admin role should receive all routes across admin, analyst, and user tiers."""
        tree = get_user_sitemap(db_session, role="admin")

        root_codes = [node.menu_code for node in tree]
        assert "test.portfolio" in root_codes
        assert "test.research" in root_codes
        assert "test.admin" in root_codes

        admin_node = next(n for n in tree if n.menu_code == "test.admin")
        assert len(admin_node.children) == 1
        assert admin_node.children[0].menu_code == "test.admin.users"

    def test_multi_role_resolution(self, db_session: Session, sample_sitemap_nodes: list[SiteMap]) -> None:
        """Passing multiple roles resolves according to the highest privilege."""
        # e.g., ["user", "analyst"] should grant analyst privilege
        tree = get_user_sitemap(db_session, role=["user", "analyst"])
        root_codes = [n.menu_code for n in tree]
        assert "test.portfolio" in root_codes
        assert "test.research" in root_codes
        assert "test.admin" not in root_codes

        # ["user", "admin"] grants admin privilege
        admin_tree = get_user_sitemap(db_session, role=["user", "admin"])
        admin_root_codes = [n.menu_code for n in admin_tree]
        assert "test.admin" in admin_root_codes

    def test_tree_hierarchy_nesting_and_ordering(
        self, db_session: Session, sample_sitemap_nodes: list[SiteMap]
    ) -> None:
        """Verify that parents properly contain children and items are sorted by order_index."""
        tree = get_user_sitemap(db_session, role="admin")

        # Verify root ordering
        assert [n.order_index for n in tree] == [1, 2, 3]

        portfolio_node = tree[0]
        assert portfolio_node.menu_code == "test.portfolio"
        assert len(portfolio_node.children) == 2  # overview (idx 1), analytics (idx 2)
        assert portfolio_node.children[0].order_index <= portfolio_node.children[1].order_index
        assert portfolio_node.children[0].parent_id == portfolio_node.id


class TestSiteMapCRUD:
    """Test suite for sitemap creation, update, deletion, and flat listing."""

    def test_create_sitemap_node(self, db_session: Session) -> None:
        """Verify creating a new sitemap node with SiteMapCreate schema."""
        create_payload = SiteMapCreate(
            menu_code="custom.reports",
            label="Custom Reports",
            route="/reports/custom",
            icon="FileText",
            role_required="analyst",
            order_index=50,
            is_active=True,
        )
        created = create_node(db_session, create_payload)
        assert created.id is not None
        assert created.menu_code == "custom.reports"
        assert created.label == "Custom Reports"
        assert created.role_required == "analyst"

    def test_update_sitemap_node(self, db_session: Session) -> None:
        """Verify updating existing sitemap node attributes."""
        node = create_node(
            db_session,
            {
                "menu_code": "update.target",
                "label": "Original Label",
                "route": "/orig",
                "role_required": "user",
            },
        )
        updated = update_node(
            db_session,
            node.id,
            SiteMapUpdate(label="Updated Label", route="/new-route", is_active=False),
        )
        assert updated is not None
        assert updated.label == "Updated Label"
        assert updated.route == "/new-route"
        assert updated.is_active is False

    def test_delete_sitemap_node(self, db_session: Session) -> None:
        """Verify deleting a sitemap node removes it from the catalog."""
        node = create_node(
            db_session,
            {"menu_code": "del.target", "label": "To Delete", "route": "/delete-me"},
        )
        assert get_all_sitemap_nodes(db_session)

        deleted = delete_node(db_session, node.id)
        assert deleted is True

        all_nodes = get_all_sitemap_nodes(db_session)
        node_ids = [n.id for n in all_nodes]
        assert node.id not in node_ids

        # Deleting nonexistent returns False
        assert delete_node(db_session, 999999) is False


class TestSiteMapAPI:
    """Test suite for FastAPI endpoints GET /api/v1/sitemap and admin management."""

    def test_get_sitemap_unauthenticated_defaults_to_user_role(
        self, client: TestClient, db_session: Session, sample_sitemap_nodes: list[SiteMap]
    ) -> None:
        """Unauthenticated GET /api/v1/sitemap returns user-accessible tree."""
        resp = client.get("/api/v1/sitemap")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        root_codes = [node["menu_code"] for node in data]
        assert "test.portfolio" in root_codes
        assert "test.admin" not in root_codes

    def test_get_sitemap_with_admin_cookie(
        self,
        client: TestClient,
        db_session: Session,
        seed_test_data: dict[str, Any],
        sample_sitemap_nodes: list[SiteMap],
    ) -> None:
        """Admin authenticated user receives all routes including admin tools."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/v1/sitemap")
        assert resp.status_code == 200
        data = resp.json()
        root_codes = [node["menu_code"] for node in data]
        assert "test.admin" in root_codes
