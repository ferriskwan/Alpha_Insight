"""Set default CURRENT_TIMESTAMP on eoddata and tickdata updatetimestamp and backfill NULLs.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Set DEFAULT CURRENT_TIMESTAMP for eoddata/tickdata updatetimestamp and backfill NULLs."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "eoddata" in existing_tables:
        if bind.dialect.name == "postgresql":
            bind.execute(
                sa.text("ALTER TABLE public.eoddata ALTER COLUMN updatetimestamp SET DEFAULT CURRENT_TIMESTAMP;")
            )
            bind.execute(
                sa.text("UPDATE public.eoddata SET updatetimestamp = CURRENT_TIMESTAMP WHERE updatetimestamp IS NULL;")
            )
        else:
            bind.execute(
                sa.text("UPDATE eoddata SET updatetimestamp = CURRENT_TIMESTAMP WHERE updatetimestamp IS NULL;")
            )

    if "tickdata" in existing_tables:
        if bind.dialect.name == "postgresql":
            bind.execute(
                sa.text("ALTER TABLE public.tickdata ALTER COLUMN updatetimestamp SET DEFAULT CURRENT_TIMESTAMP;")
            )
            bind.execute(
                sa.text("UPDATE public.tickdata SET updatetimestamp = CURRENT_TIMESTAMP WHERE updatetimestamp IS NULL;")
            )
        else:
            bind.execute(
                sa.text("UPDATE tickdata SET updatetimestamp = CURRENT_TIMESTAMP WHERE updatetimestamp IS NULL;")
            )


def downgrade() -> None:
    """Drop default constraint on eoddata and tickdata updatetimestamp."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "eoddata" in existing_tables and bind.dialect.name == "postgresql":
        bind.execute(sa.text("ALTER TABLE public.eoddata ALTER COLUMN updatetimestamp DROP DEFAULT;"))

    if "tickdata" in existing_tables and bind.dialect.name == "postgresql":
        bind.execute(sa.text("ALTER TABLE public.tickdata ALTER COLUMN updatetimestamp DROP DEFAULT;"))
