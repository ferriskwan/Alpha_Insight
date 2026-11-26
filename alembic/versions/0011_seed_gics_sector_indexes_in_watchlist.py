"""Seed 11 GICS sector ETFs and SPY into watchlist, and seed research.sectors into site_map.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-26
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GICS_SECTOR_INDEXES = [
    ("XLK", "Technology Select Sector SPDR Fund"),
    ("XLF", "Financial Select Sector SPDR Fund"),
    ("XLV", "Health Care Select Sector SPDR Fund"),
    ("XLE", "Energy Select Sector SPDR Fund"),
    ("XLI", "Industrial Select Sector SPDR Fund"),
    ("XLC", "Communication Services Select Sector SPDR Fund"),
    ("XLY", "Consumer Discretionary Select Sector SPDR Fund"),
    ("XLP", "Consumer Staples Select Sector SPDR Fund"),
    ("XLB", "Materials Select Sector SPDR Fund"),
    ("XLU", "Utilities Select Sector SPDR Fund"),
    ("XLRE", "Real Estate Select Sector SPDR Fund"),
    ("SPY", "SPDR S&P 500 ETF Trust"),
]


def upgrade() -> None:
    """Seed GICS sector ETFs and benchmark into watchlist and add site_map entry."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    watchlist_table = "public.watchlist" if bind.dialect.name == "postgresql" else "watchlist"
    sitemap_table = "public.site_map" if bind.dialect.name == "postgresql" else "site_map"

    # 1. Seed GICS sector ETFs into watchlist as Index
    if "watchlist" in existing_tables:
        for symbol, name in GICS_SECTOR_INDEXES:
            # Check if already exists for user_id = 1
            existing = bind.execute(
                sa.text(f"SELECT 1 FROM {watchlist_table} WHERE user_id = 1 AND symbol = :sym LIMIT 1"),
                {"sym": symbol},
            ).scalar()
            if not existing:
                bind.execute(
                    sa.text(
                        f"""
                        INSERT INTO {watchlist_table}
                            (user_id, watchlistname, symbol, name, timezone, currency, updatetimestamp)
                        VALUES
                            (1, 'Index', :sym, :name, 'America/New_York', 'USD', CURRENT_TIMESTAMP)
                        """
                    ),
                    {"sym": symbol, "name": name},
                )

    # 2. Seed By Industry / Sector node into site_map under research
    if "site_map" in existing_tables:
        # Find research parent node
        research_node = bind.execute(
            sa.text(f"SELECT id FROM {sitemap_table} WHERE menu_code = 'research' LIMIT 1")
        ).fetchone()

        parent_id = research_node[0] if research_node else None

        existing_node = bind.execute(
            sa.text(f"SELECT 1 FROM {sitemap_table} WHERE menu_code = 'research.sectors' LIMIT 1")
        ).scalar()

        if not existing_node:
            bind.execute(
                sa.text(
                    f"""
                    INSERT INTO {sitemap_table}
                        (parent_id, menu_code, label, route, icon, role_required, order_index, is_active, created_at)
                    VALUES
                        (
                            :parent_id, 'research.sectors', 'By Industry / Sector',
                            '/research/sectors', 'Layers', 'user', 3, true, CURRENT_TIMESTAMP
                        )
                    """
                ),
                {"parent_id": parent_id},
            )


def downgrade() -> None:
    """Remove GICS sector ETFs from watchlist and remove research.sectors from site_map."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    watchlist_table = "public.watchlist" if bind.dialect.name == "postgresql" else "watchlist"
    sitemap_table = "public.site_map" if bind.dialect.name == "postgresql" else "site_map"

    if "site_map" in existing_tables:
        bind.execute(sa.text(f"DELETE FROM {sitemap_table} WHERE menu_code = 'research.sectors'"))

    if "watchlist" in existing_tables:
        symbols = tuple(s[0] for s in GICS_SECTOR_INDEXES)
        bind.execute(
            sa.text(f"DELETE FROM {watchlist_table} WHERE user_id = 1 AND watchlistname = 'Index' AND symbol IN :syms"),
            {"syms": symbols},
        )
