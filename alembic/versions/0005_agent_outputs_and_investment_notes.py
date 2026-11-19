"""Add agent_committee_runs, agent_analyst_outputs, investment_notes, and investment_note_analyst_links tables.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-18
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create Epic 0.4 agent output storage and investment notes tables and seed sitemap route."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # 1. agent_committee_runs table
    if "agent_committee_runs" not in existing_tables:
        op.create_table(
            "agent_committee_runs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), default=1, nullable=False),
            sa.Column("symbol", sa.String(length=32), nullable=False),
            sa.Column("provider", sa.String(length=32), server_default="gemini", nullable=False),
            sa.Column("model", sa.String(length=64), server_default="gemini-4-argon", nullable=False),
            sa.Column("consensus_bias", sa.String(length=16), nullable=False),
            sa.Column("consensus_confidence", sa.Integer(), server_default="50", nullable=False),
            sa.Column("executive_summary", sa.Text(), nullable=False),
            sa.Column("vote_breakdown", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_agent_committee_runs_user_id", "agent_committee_runs", ["user_id"])
        op.create_index("ix_agent_committee_runs_symbol", "agent_committee_runs", ["symbol"])
        op.create_index("ix_agent_committee_runs_created_at", "agent_committee_runs", ["created_at"])

    # 2. agent_analyst_outputs table
    if "agent_analyst_outputs" not in existing_tables:
        op.create_table(
            "agent_analyst_outputs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "run_id",
                sa.Integer(),
                sa.ForeignKey("agent_committee_runs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), default=1, nullable=False),
            sa.Column("symbol", sa.String(length=32), nullable=False),
            sa.Column("analyst_role", sa.String(length=32), nullable=False),
            sa.Column("directional_bias", sa.String(length=16), nullable=False),
            sa.Column("confidence_score", sa.Integer(), server_default="50", nullable=False),
            sa.Column("trend_status", sa.String(length=32), server_default="Initiation", nullable=False),
            sa.Column("summary_headline", sa.String(length=255), nullable=False),
            sa.Column("markdown_output", sa.Text(), nullable=False),
            sa.Column("structured_metrics", sa.JSON(), nullable=True),
            sa.Column("referenced_output_ids", sa.JSON(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
        )
        op.create_index("ix_agent_analyst_outputs_run_id", "agent_analyst_outputs", ["run_id"])
        op.create_index("ix_agent_analyst_outputs_user_id", "agent_analyst_outputs", ["user_id"])
        op.create_index("ix_agent_analyst_outputs_symbol", "agent_analyst_outputs", ["symbol"])
        op.create_index("ix_agent_analyst_outputs_analyst_role", "agent_analyst_outputs", ["analyst_role"])
        op.create_index("ix_agent_analyst_outputs_created_at", "agent_analyst_outputs", ["created_at"])

    # 3. investment_notes table
    if "investment_notes" not in existing_tables:
        op.create_table(
            "investment_notes",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), default=1, nullable=False),
            sa.Column("symbol", sa.String(length=32), nullable=False),
            sa.Column(
                "trade_id",
                sa.Integer(),
                sa.ForeignKey("trade.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("content_markdown", sa.Text(), nullable=False),
            sa.Column("thesis_status", sa.String(length=32), server_default="In-Progress", nullable=False),
            sa.Column("tags", sa.JSON(), nullable=True),
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
        op.create_index("ix_investment_notes_user_id", "investment_notes", ["user_id"])
        op.create_index("ix_investment_notes_symbol", "investment_notes", ["symbol"])
        op.create_index("ix_investment_notes_trade_id", "investment_notes", ["trade_id"])
        op.create_index("ix_investment_notes_thesis_status", "investment_notes", ["thesis_status"])
        op.create_index("ix_investment_notes_created_at", "investment_notes", ["created_at"])

    # 4. investment_note_analyst_links table
    if "investment_note_analyst_links" not in existing_tables:
        op.create_table(
            "investment_note_analyst_links",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "note_id",
                sa.Integer(),
                sa.ForeignKey("investment_notes.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "analyst_output_id",
                sa.Integer(),
                sa.ForeignKey("agent_analyst_outputs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.current_timestamp(),
                nullable=False,
            ),
            sa.UniqueConstraint("note_id", "analyst_output_id", name="uq_note_analyst_output"),
        )
        op.create_index("ix_investment_note_analyst_links_note_id", "investment_note_analyst_links", ["note_id"])
        op.create_index(
            "ix_investment_note_analyst_links_analyst_output_id",
            "investment_note_analyst_links",
            ["analyst_output_id"],
        )

    # 5. Replace research.stock_analyst with research.committee ('Stock Analysis') in site_map
    if "site_map" in existing_tables:
        if bind.dialect.name == "postgresql":
            bind.execute(
                sa.text(
                    "SELECT setval(pg_get_serial_sequence('site_map', 'id'), "
                    "COALESCE((SELECT MAX(id) FROM site_map), 1))"
                )
            )
        bind.execute(
            sa.text("DELETE FROM site_map WHERE menu_code = :code"),
            {"code": "research.stock_analyst"},
        )
        res = bind.execute(
            sa.text("SELECT id FROM site_map WHERE menu_code = :code"),
            {"code": "research.committee"},
        ).fetchone()
        if not res:
            parent_row = bind.execute(
                sa.text("SELECT id FROM site_map WHERE menu_code = :code"),
                {"code": "research"},
            ).fetchone()
            parent_id = parent_row[0] if parent_row else 2
            bind.execute(
                sa.text(
                    "INSERT INTO site_map "
                    "(id, parent_id, menu_code, label, route, icon, role_required, order_index, is_active) "
                    "VALUES (204, :parent_id, :menu_code, :label, :route, :icon, "
                    ":role_required, :order_index, :is_active)"
                ),
                {
                    "parent_id": parent_id,
                    "menu_code": "research.committee",
                    "label": "Stock Analysis",
                    "route": "/research/committee",
                    "icon": "Sparkles",
                    "role_required": "user",
                    "order_index": 1,
                    "is_active": True,
                },
            )


def downgrade() -> None:
    """Drop Epic 0.4 tables and remove seeded sitemap node."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "site_map" in existing_tables:
        bind.execute(
            sa.text("DELETE FROM site_map WHERE menu_code = :code"),
            {"code": "research.committee"},
        )
    if "investment_note_analyst_links" in existing_tables:
        op.drop_table("investment_note_analyst_links")
    if "investment_notes" in existing_tables:
        op.drop_table("investment_notes")
    if "agent_analyst_outputs" in existing_tables:
        op.drop_table("agent_analyst_outputs")
    if "agent_committee_runs" in existing_tables:
        op.drop_table("agent_committee_runs")
