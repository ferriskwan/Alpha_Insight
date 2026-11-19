"""Baseline 4leafclover database schema (13 existing tables).

Revision ID: 0001
Revises: None
Create Date: 2026-11-03
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the 13 baseline 4leafclover tables idempotently if not already present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "users" not in existing_tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("email", sa.String(length=255), nullable=False, unique=True),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("picture", sa.Text(), nullable=True),
            sa.Column("google_id", sa.String(length=255), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "user_roles" not in existing_tables:
        op.create_table(
            "user_roles",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("role", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
            sa.Column("assigned_at", sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
        )

    if "sysvalue" not in existing_tables:
        op.create_table(
            "sysvalue",
            sa.Column("name", sa.String(length=128), primary_key=True),
            sa.Column("type", sa.String(length=16), nullable=False),
            sa.Column("strvalue", sa.Text(), nullable=True),
            sa.Column("numvalue", sa.Numeric(), nullable=True),
            sa.Column("datevalue", sa.Date(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "watchlist" not in existing_tables:
        op.create_table(
            "watchlist",
            sa.Column("user_id", sa.Integer(), primary_key=True, server_default="1"),
            sa.Column("watchlistname", sa.String(length=128), primary_key=True),
            sa.Column("symbol", sa.String(length=32), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("timezone", sa.String(length=64), nullable=True),
            sa.Column("currency", sa.String(length=16), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "eoddata" not in existing_tables:
        op.create_table(
            "eoddata",
            sa.Column("symbol", sa.String(length=32), primary_key=True),
            sa.Column("date", sa.Date(), primary_key=True),
            sa.Column("open", sa.Float(), nullable=True),
            sa.Column("high", sa.Float(), nullable=True),
            sa.Column("low", sa.Float(), nullable=True),
            sa.Column("close", sa.Float(), nullable=True),
            sa.Column("volume", sa.Float(), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "tickdata" not in existing_tables:
        op.create_table(
            "tickdata",
            sa.Column("symbol", sa.String(length=32), primary_key=True),
            sa.Column("interval", sa.String(length=16), primary_key=True),
            sa.Column("timestamp", sa.DateTime(), primary_key=True),
            sa.Column("open", sa.Float(), nullable=True),
            sa.Column("high", sa.Float(), nullable=True),
            sa.Column("low", sa.Float(), nullable=True),
            sa.Column("close", sa.Float(), nullable=True),
            sa.Column("volume", sa.Float(), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "exchange_rate" not in existing_tables:
        op.create_table(
            "exchange_rate",
            sa.Column("date", sa.Date(), primary_key=True),
            sa.Column("currency", sa.String(length=16), primary_key=True),
            sa.Column("base_currency", sa.String(length=16), primary_key=True, server_default="USD"),
            sa.Column("rate", sa.Float(), nullable=False),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "trade" not in existing_tables:
        op.create_table(
            "trade",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("symbol", sa.String(length=32), nullable=False),
            sa.Column("buysell", sa.String(length=8), nullable=False),
            sa.Column("tradedate", sa.DateTime(), nullable=False),
            sa.Column("investment", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
            sa.Column("price", sa.Float(), nullable=True),
            sa.Column("quantity", sa.Float(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "capital" not in existing_tables:
        op.create_table(
            "capital",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("broker", sa.String(length=64), nullable=False),
            sa.Column("transtype", sa.String(length=16), nullable=False),
            sa.Column("accounttype", sa.String(length=32), nullable=False, server_default="Cash"),
            sa.Column("amount", sa.Float(), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("currency", sa.String(length=16), nullable=False, server_default="USD"),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "position" not in existing_tables:
        op.create_table(
            "position",
            sa.Column("user_id", sa.Integer(), primary_key=True, server_default="1"),
            sa.Column("tradedate", sa.Date(), primary_key=True),
            sa.Column("symbol", sa.String(length=32), primary_key=True),
            sa.Column("investment", sa.Boolean(), primary_key=True, server_default=sa.text("TRUE")),
            sa.Column("avgprice", sa.Float(), nullable=True),
            sa.Column("quantity", sa.Float(), nullable=True),
            sa.Column("eodprice", sa.Float(), nullable=True),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "margin_interest_rate" not in existing_tables:
        op.create_table(
            "margin_interest_rate",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("broker", sa.String(length=64), nullable=False),
            sa.Column("currency", sa.String(length=16), nullable=False),
            sa.Column("accounttype", sa.String(length=32), nullable=False, server_default="MARGIN"),
            sa.Column("annual_rate", sa.Float(), nullable=False),
            sa.Column("day_count_basis", sa.Integer(), nullable=False, server_default="360"),
            sa.Column("effective_date", sa.Date(), nullable=False),
        )

    if "daily_margin_interest" not in existing_tables:
        op.create_table(
            "daily_margin_interest",
            sa.Column("user_id", sa.Integer(), primary_key=True, server_default="1"),
            sa.Column("date", sa.Date(), primary_key=True),
            sa.Column("broker", sa.String(length=64), primary_key=True),
            sa.Column("currency", sa.String(length=16), primary_key=True),
            sa.Column("loan_balance", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("daily_rate", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("daily_interest", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("cumulative_interest", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )

    if "daily_portfolio_summary" not in existing_tables:
        op.create_table(
            "daily_portfolio_summary",
            sa.Column("user_id", sa.Integer(), primary_key=True, server_default="1"),
            sa.Column("date", sa.Date(), primary_key=True),
            sa.Column("currency", sa.String(length=16), primary_key=True),
            sa.Column("investment", sa.Boolean(), primary_key=True),
            sa.Column("total_capital", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("position_market_value", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("realized_pnl", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("unrealized_pnl", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("margin_loan_balance", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("daily_interest_accrued", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("cumulative_interest_accrued", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("total_asset_value", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("total_pnl", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("pct_pnl", sa.Float(), nullable=False, server_default="0.0"),
            sa.Column("updatetimestamp", sa.DateTime(), server_default=sa.func.current_timestamp()),
        )


def downgrade() -> None:
    """No-op downgrade on baseline schema to protect existing 4leafclover data."""
    pass
