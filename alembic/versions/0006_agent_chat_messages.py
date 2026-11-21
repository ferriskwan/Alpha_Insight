"""Add agent_chat_messages table for persistent Chat Session history tied to Stock Analysis runs.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-18
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create agent_chat_messages table if not present."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "agent_chat_messages" not in existing_tables:
        op.create_table(
            "agent_chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "run_id",
                sa.Integer(),
                sa.ForeignKey("agent_committee_runs.id", ondelete="CASCADE"),
                nullable=True,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), default=1, nullable=False),
            sa.Column("symbol", sa.String(length=32), nullable=False),
            sa.Column("role", sa.String(length=16), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("model", sa.String(length=64), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_agent_chat_messages_run_id", "agent_chat_messages", ["run_id"])
        op.create_index("ix_agent_chat_messages_user_id", "agent_chat_messages", ["user_id"])
        op.create_index("ix_agent_chat_messages_symbol", "agent_chat_messages", ["symbol"])
        op.create_index("ix_agent_chat_messages_created_at", "agent_chat_messages", ["created_at"])


def downgrade() -> None:
    """Drop agent_chat_messages table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "agent_chat_messages" in existing_tables:
        op.drop_table("agent_chat_messages")
