"""Add foundational admin, sitemap, trans_cost, and ref_chart_settings tables.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-08
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create site_map, audit_log, trans_cost, and ref_chart_settings tables if not present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # 1. site_map table (100% dynamic navigation hierarchy)
    if "site_map" not in existing_tables:
        op.create_table(
            "site_map",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("parent_id", sa.Integer(), sa.ForeignKey("site_map.id", ondelete="CASCADE"), nullable=True),
            sa.Column("menu_code", sa.String(length=64), unique=True, nullable=False),
            sa.Column("label", sa.String(length=128), nullable=False),
            sa.Column("route", sa.String(length=255), nullable=False),
            sa.Column("icon", sa.String(length=64), nullable=True),
            sa.Column("role_required", sa.String(length=64), server_default="user", nullable=False),
            sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_site_map_parent_id", "site_map", ["parent_id"])
        op.create_index("ix_site_map_menu_code", "site_map", ["menu_code"])
        op.create_index("ix_site_map_order_index", "site_map", ["order_index"])

        # Seed initial dynamic sitemap tree
        site_map_table = sa.table(
            "site_map",
            sa.column("id", sa.Integer),
            sa.column("parent_id", sa.Integer),
            sa.column("menu_code", sa.String),
            sa.column("label", sa.String),
            sa.column("route", sa.String),
            sa.column("icon", sa.String),
            sa.column("role_required", sa.String),
            sa.column("order_index", sa.Integer),
            sa.column("is_active", sa.Boolean),
        )

        # Root Categories
        op.bulk_insert(
            site_map_table,
            [
                # Root 1: My Portfolio (ID 1)
                {
                    "id": 1,
                    "parent_id": None,
                    "menu_code": "portfolio",
                    "label": "My Portfolio",
                    "route": "/portfolio",
                    "icon": "Wallet",
                    "role_required": "user",
                    "order_index": 10,
                    "is_active": True,
                },
                # Root 2: Research (ID 2)
                {
                    "id": 2,
                    "parent_id": None,
                    "menu_code": "research",
                    "label": "Research",
                    "route": "/research",
                    "icon": "TrendingUp",
                    "role_required": "user",
                    "order_index": 20,
                    "is_active": True,
                },
                # Root 3: Investment Notes (ID 3)
                {
                    "id": 3,
                    "parent_id": None,
                    "menu_code": "notes",
                    "label": "Investment Notes",
                    "route": "/notes",
                    "icon": "FileText",
                    "role_required": "user",
                    "order_index": 30,
                    "is_active": True,
                },
                # Root 4: Admin (ID 4)
                {
                    "id": 4,
                    "parent_id": None,
                    "menu_code": "admin",
                    "label": "Admin",
                    "route": "/admin",
                    "icon": "Shield",
                    "role_required": "admin",
                    "order_index": 40,
                    "is_active": True,
                },
                # Sub-items for My Portfolio
                {
                    "id": 101,
                    "parent_id": 1,
                    "menu_code": "portfolio.overview",
                    "label": "Overview",
                    "route": "/portfolio/overview",
                    "icon": "BarChart3",
                    "role_required": "user",
                    "order_index": 1,
                    "is_active": True,
                },
                {
                    "id": 102,
                    "parent_id": 1,
                    "menu_code": "portfolio.transactions",
                    "label": "Transactions",
                    "route": "/portfolio/transactions",
                    "icon": "Layers",
                    "role_required": "user",
                    "order_index": 2,
                    "is_active": True,
                },
                {
                    "id": 103,
                    "parent_id": 1,
                    "menu_code": "portfolio.watchlist",
                    "label": "Watch List",
                    "route": "/portfolio/watchlist",
                    "icon": "Eye",
                    "role_required": "user",
                    "order_index": 3,
                    "is_active": True,
                },
                # Transactions 3rd-level children
                {
                    "id": 1021,
                    "parent_id": 102,
                    "menu_code": "portfolio.transactions.investment",
                    "label": "Investment",
                    "route": "/portfolio/transactions/investment",
                    "icon": "Briefcase",
                    "role_required": "user",
                    "order_index": 1,
                    "is_active": True,
                },
                {
                    "id": 1022,
                    "parent_id": 102,
                    "menu_code": "portfolio.transactions.capital",
                    "label": "Capital",
                    "route": "/portfolio/transactions/capital",
                    "icon": "DollarSign",
                    "role_required": "user",
                    "order_index": 2,
                    "is_active": True,
                },
                {
                    "id": 1023,
                    "parent_id": 102,
                    "menu_code": "portfolio.transactions.trans_cost",
                    "label": "Trans Cost",
                    "route": "/portfolio/transactions/trans-cost",
                    "icon": "Receipt",
                    "role_required": "user",
                    "order_index": 3,
                    "is_active": True,
                },
                # Sub-items for Research
                {
                    "id": 201,
                    "parent_id": 2,
                    "menu_code": "research.stock_analyst",
                    "label": "Stock Analyst",
                    "route": "/research/analyst",
                    "icon": "LineChart",
                    "role_required": "user",
                    "order_index": 1,
                    "is_active": True,
                },
                {
                    "id": 202,
                    "parent_id": 2,
                    "menu_code": "research.macro",
                    "label": "Macroeconomics",
                    "route": "/research/macro",
                    "icon": "Globe",
                    "role_required": "analyst",
                    "order_index": 2,
                    "is_active": True,
                },
                {
                    "id": 203,
                    "parent_id": 2,
                    "menu_code": "research.industry",
                    "label": "By Industry/Sector",
                    "route": "/research/industry",
                    "icon": "PieChart",
                    "role_required": "analyst",
                    "order_index": 3,
                    "is_active": True,
                },
                # Sub-items for Admin
                {
                    "id": 401,
                    "parent_id": 4,
                    "menu_code": "admin.users",
                    "label": "User Admin",
                    "route": "/admin/users",
                    "icon": "Users",
                    "role_required": "admin",
                    "order_index": 1,
                    "is_active": True,
                },
                {
                    "id": 402,
                    "parent_id": 4,
                    "menu_code": "admin.sitemap",
                    "label": "Site Map Admin",
                    "route": "/admin/sitemap",
                    "icon": "Network",
                    "role_required": "admin",
                    "order_index": 2,
                    "is_active": True,
                },
                {
                    "id": 403,
                    "parent_id": 4,
                    "menu_code": "admin.ref_data",
                    "label": "Ref Data Editor",
                    "route": "/admin/ref-data",
                    "icon": "Database",
                    "role_required": "admin",
                    "order_index": 3,
                    "is_active": True,
                },
                {
                    "id": 404,
                    "parent_id": 4,
                    "menu_code": "admin.audit_logs",
                    "label": "Audit Logs",
                    "route": "/admin/audit-logs",
                    "icon": "FileCheck",
                    "role_required": "admin",
                    "order_index": 4,
                    "is_active": True,
                },
            ],
        )

    # 2. audit_log table
    if "audit_log" not in existing_tables:
        op.create_table(
            "audit_log",
            sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("action", sa.String(length=64), nullable=False),
            sa.Column("entity", sa.String(length=64), nullable=False),
            sa.Column("entity_id", sa.String(length=64), nullable=True),
            sa.Column("old_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("new_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("ip_address", sa.String(length=45), nullable=True),
            sa.Column("user_agent", sa.String(length=512), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
        op.create_index("ix_audit_log_action", "audit_log", ["action"])
        op.create_index("ix_audit_log_entity", "audit_log", ["entity"])
        op.create_index("ix_audit_log_timestamp", "audit_log", ["timestamp"])

    # 3. trans_cost table
    if "trade" in existing_tables:
        trade_pk = inspector.get_pk_constraint("trade")
        if not trade_pk or not trade_pk.get("constrained_columns"):
            op.create_primary_key("pk_trade", "trade", ["id"])

    if "trans_cost" not in existing_tables:
        op.create_table(
            "trans_cost",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), default=1, nullable=False),
            sa.Column("trade_id", sa.Integer(), sa.ForeignKey("trade.id", ondelete="SET NULL"), nullable=True),
            sa.Column("cost_type", sa.String(length=32), nullable=False),
            sa.Column("amount", sa.Numeric(precision=12, scale=4), nullable=False),
            sa.Column("currency", sa.String(length=8), server_default="USD", nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_trans_cost_user_id", "trans_cost", ["user_id"])
        op.create_index("ix_trans_cost_trade_id", "trans_cost", ["trade_id"])
        op.create_index("ix_trans_cost_date", "trans_cost", ["date"])

    # 4. ref_chart_settings table
    if "ref_chart_settings" not in existing_tables:
        op.create_table(
            "ref_chart_settings",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
            sa.Column("symbol", sa.String(length=16), nullable=True),
            sa.Column("sma_period", sa.Integer(), server_default="30", nullable=False),
            sa.Column("ema_period", sa.Integer(), server_default="100", nullable=False),
            sa.Column("bb_period", sa.Integer(), server_default="30", nullable=False),
            sa.Column("bb_std", sa.Float(), server_default="2.0", nullable=False),
            sa.Column("rsi_period", sa.Integer(), server_default="13", nullable=False),
            sa.Column("rsi_ob", sa.Float(), server_default="70.0", nullable=False),
            sa.Column("rsi_os", sa.Float(), server_default="30.0", nullable=False),
            sa.Column("macd_fast", sa.Integer(), server_default="12", nullable=False),
            sa.Column("macd_slow", sa.Integer(), server_default="26", nullable=False),
            sa.Column("macd_signal", sa.Integer(), server_default="9", nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_ref_chart_settings_user_id", "ref_chart_settings", ["user_id"])
        op.create_index("ix_ref_chart_settings_symbol", "ref_chart_settings", ["symbol"])

        # Seed global default record
        chart_table = sa.table(
            "ref_chart_settings",
            sa.column("user_id", sa.Integer),
            sa.column("symbol", sa.String),
            sa.column("sma_period", sa.Integer),
            sa.column("ema_period", sa.Integer),
            sa.column("bb_period", sa.Integer),
            sa.column("bb_std", sa.Float),
            sa.column("rsi_period", sa.Integer),
            sa.column("rsi_ob", sa.Float),
            sa.column("rsi_os", sa.Float),
            sa.column("macd_fast", sa.Integer),
            sa.column("macd_slow", sa.Integer),
            sa.column("macd_signal", sa.Integer),
        )
        op.bulk_insert(
            chart_table,
            [
                {
                    "user_id": None,  # Global default
                    "symbol": None,
                    "sma_period": 30,
                    "ema_period": 100,
                    "bb_period": 30,
                    "bb_std": 2.0,
                    "rsi_period": 13,
                    "rsi_ob": 70.0,
                    "rsi_os": 30.0,
                    "macd_fast": 12,
                    "macd_slow": 26,
                    "macd_signal": 9,
                }
            ],
        )


def downgrade() -> None:
    """Drop ref_chart_settings, trans_cost, audit_log, and site_map tables."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "ref_chart_settings" in existing_tables:
        op.drop_table("ref_chart_settings")

    if "trans_cost" in existing_tables:
        op.drop_table("trans_cost")

    if "audit_log" in existing_tables:
        op.drop_table("audit_log")

    if "site_map" in existing_tables:
        op.drop_table("site_map")
