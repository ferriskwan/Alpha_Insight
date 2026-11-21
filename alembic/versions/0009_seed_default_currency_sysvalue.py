"""Seed DEFAULT_CURRENCY in sysvalue table.

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-20
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Seed or update DEFAULT_CURRENCY = 'SGD' in sysvalue."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "sysvalue" not in existing_tables:
        return

    # Delete existing entry if present, then insert (idempotent without requiring UNIQUE constraint)
    target_table = "public.sysvalue" if bind.dialect.name == "postgresql" else "sysvalue"
    bind.execute(sa.text(f"DELETE FROM {target_table} WHERE name = 'DEFAULT_CURRENCY';"))
    bind.execute(
        sa.text(
            f"INSERT INTO {target_table} (name, type, strvalue, updatetimestamp) "
            "VALUES ('DEFAULT_CURRENCY', 'STRING', 'SGD', CURRENT_TIMESTAMP);"
        )
    )


def downgrade() -> None:
    """Remove DEFAULT_CURRENCY from sysvalue."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "sysvalue" in existing_tables:
        target_table = "public.sysvalue" if bind.dialect.name == "postgresql" else "sysvalue"
        bind.execute(sa.text(f"DELETE FROM {target_table} WHERE name = 'DEFAULT_CURRENCY';"))
