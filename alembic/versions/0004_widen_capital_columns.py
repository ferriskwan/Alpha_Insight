"""Widen capital table column types for broker, transtype, accounttype, currency.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-18
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Widen capital columns to match modern model definitions."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "capital" in existing_tables:
        with op.batch_alter_table("capital") as batch_op:
            batch_op.alter_column("accounttype", type_=sa.String(length=32), existing_nullable=False)
            batch_op.alter_column("transtype", type_=sa.String(length=16), existing_nullable=False)
            batch_op.alter_column("broker", type_=sa.String(length=64), existing_nullable=False)
            batch_op.alter_column("currency", type_=sa.String(length=16), existing_nullable=False)


def downgrade() -> None:
    """Revert column widening."""
    pass
