"""Add fib_lookback_bars and fib_intraday_bars to ref_chart_settings.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add fibonacci lookback columns to ref_chart_settings if not present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "ref_chart_settings" in existing_tables:
        existing_cols = {col["name"] for col in inspector.get_columns("ref_chart_settings")}

        if "fib_lookback_bars" not in existing_cols:
            op.add_column(
                "ref_chart_settings",
                sa.Column("fib_lookback_bars", sa.Integer(), server_default="252", nullable=False),
            )
        if "fib_intraday_bars" not in existing_cols:
            op.add_column(
                "ref_chart_settings",
                sa.Column("fib_intraday_bars", sa.Integer(), server_default="78", nullable=False),
            )


def downgrade() -> None:
    """Remove fibonacci lookback columns from ref_chart_settings."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "ref_chart_settings" in existing_tables:
        existing_cols = {col["name"] for col in inspector.get_columns("ref_chart_settings")}

        if "fib_intraday_bars" in existing_cols:
            op.drop_column("ref_chart_settings", "fib_intraday_bars")
        if "fib_lookback_bars" in existing_cols:
            op.drop_column("ref_chart_settings", "fib_lookback_bars")
