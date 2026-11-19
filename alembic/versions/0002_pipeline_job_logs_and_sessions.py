"""Add user_sessions and job_execution_log tables.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-03
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_sessions and job_execution_log tables if not present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "user_sessions" not in existing_tables:
        op.create_table(
            "user_sessions",
            sa.Column("sid", sa.String(length=128), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    if "job_execution_log" not in existing_tables:
        op.create_table(
            "job_execution_log",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_name", sa.String(length=64), nullable=False),
            sa.Column("trigger_source", sa.String(length=32), nullable=False),
            sa.Column(
                "started_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=16), nullable=False),
            sa.Column("global_today", sa.Date(), nullable=True),
            sa.Column("details", sa.JSON(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
        )
        op.create_index("ix_job_execution_log_started_at", "job_execution_log", ["started_at"])


def downgrade() -> None:
    """Drop job_execution_log and user_sessions tables."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "job_execution_log" in existing_tables:
        op.drop_index("ix_job_execution_log_started_at", table_name="job_execution_log")
        op.drop_table("job_execution_log")

    if "user_sessions" in existing_tables:
        op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
        op.drop_table("user_sessions")
