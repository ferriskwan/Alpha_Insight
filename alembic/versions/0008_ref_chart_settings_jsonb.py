"""Transition ref_chart_settings to PostgreSQL JSONB parameter store with partial unique indexes.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate ref_chart_settings from flat columns to JSONB parameter store."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    is_postgres = bind.dialect.name == "postgresql"

    if "ref_chart_settings" not in existing_tables:
        return

    # 1. Deduplicate any existing global default duplicate records (retain id=1)
    bind.execute(sa.text("DELETE FROM ref_chart_settings WHERE id != 1 AND user_id IS NULL AND symbol IS NULL"))

    existing_cols = {col["name"] for col in inspector.get_columns("ref_chart_settings")}

    # 2. Add 'parameters' JSON column if not present
    json_col_type = JSONB if is_postgres else sa.JSON()
    if "parameters" not in existing_cols:
        op.add_column(
            "ref_chart_settings",
            sa.Column("parameters", json_col_type, nullable=False, server_default=sa.text("'{}'")),
        )

    # 3. Migrate flat data into parameters JSON if flat columns are present
    flat_cols = [
        "sma_period",
        "ema_period",
        "bb_period",
        "bb_std",
        "rsi_period",
        "rsi_ob",
        "rsi_os",
        "macd_fast",
        "macd_slow",
        "macd_signal",
        "fib_lookback_bars",
        "fib_intraday_bars",
    ]
    has_flat = any(col in existing_cols for col in flat_cols)

    if has_flat:
        if is_postgres:
            bind.execute(
                sa.text("""
                    UPDATE ref_chart_settings SET parameters = jsonb_build_object(
                        'moving_averages', jsonb_build_object(
                            'sma_period', COALESCE(sma_period, 30),
                            'ema_period', COALESCE(ema_period, 100)
                        ),
                        'bollinger_bands', jsonb_build_object(
                            'period', COALESCE(bb_period, 30),
                            'std_dev', COALESCE(bb_std, 2.0)
                        ),
                        'rsi', jsonb_build_object(
                            'period', COALESCE(rsi_period, 13),
                            'overbought', COALESCE(rsi_ob, 70.0),
                            'oversold', COALESCE(rsi_os, 30.0)
                        ),
                        'macd', jsonb_build_object(
                            'fast', COALESCE(macd_fast, 12),
                            'slow', COALESCE(macd_slow, 26),
                            'signal', COALESCE(macd_signal, 9)
                        ),
                        'fibonacci', jsonb_build_object(
                            'lookback_bars', COALESCE(fib_lookback_bars, 252),
                            'intraday_bars', COALESCE(fib_intraday_bars, 78)
                        )
                    ) WHERE parameters = '{}'::jsonb OR parameters IS NULL;
                """)
            )
        else:
            default_json = (
                '{"moving_averages": {"sma_period": 30, "ema_period": 100}, '
                '"bollinger_bands": {"period": 30, "std_dev": 2.0}, '
                '"rsi": {"period": 13, "overbought": 70.0, "oversold": 30.0}, '
                '"macd": {"fast": 12, "slow": 26, "signal": 9}, '
                '"fibonacci": {"lookback_bars": 252, "intraday_bars": 78}}'
            )
            bind.execute(
                sa.text(
                    f"UPDATE ref_chart_settings SET parameters = '{default_json}' "
                    "WHERE parameters = '{}' OR parameters IS NULL"
                )
            )

        # 4. Drop obsolete flat columns using batch_alter_table for SQLite compatibility
        with op.batch_alter_table("ref_chart_settings") as batch_op:
            for col in flat_cols:
                if col in existing_cols:
                    batch_op.drop_column(col)

    # 5. Create partial unique indexes
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("ref_chart_settings")}

    if "uq_ref_chart_settings_user_symbol" not in existing_indexes:
        op.create_index(
            "uq_ref_chart_settings_user_symbol",
            "ref_chart_settings",
            ["user_id", "symbol"],
            unique=True,
            postgresql_where=sa.text("user_id IS NOT NULL AND symbol IS NOT NULL"),
        )

    if "uq_ref_chart_settings_user_default" not in existing_indexes:
        op.create_index(
            "uq_ref_chart_settings_user_default",
            "ref_chart_settings",
            ["user_id"],
            unique=True,
            postgresql_where=sa.text("user_id IS NOT NULL AND symbol IS NULL"),
        )

    if "uq_ref_chart_settings_symbol_preset" not in existing_indexes:
        op.create_index(
            "uq_ref_chart_settings_symbol_preset",
            "ref_chart_settings",
            ["symbol"],
            unique=True,
            postgresql_where=sa.text("user_id IS NULL AND symbol IS NOT NULL"),
        )

    if is_postgres and "uq_ref_chart_settings_global_default" not in existing_indexes:
        bind.execute(
            sa.text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_chart_settings_global_default
                ON ref_chart_settings ((1))
                WHERE user_id IS NULL AND symbol IS NULL;
            """)
        )


def downgrade() -> None:
    """Revert ref_chart_settings from JSONB back to flat columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    is_postgres = bind.dialect.name == "postgresql"

    if "ref_chart_settings" not in existing_tables:
        return

    # Drop partial unique indexes
    if is_postgres:
        bind.execute(sa.text("DROP INDEX IF EXISTS uq_ref_chart_settings_global_default"))
    op.drop_index("uq_ref_chart_settings_symbol_preset", table_name="ref_chart_settings")
    op.drop_index("uq_ref_chart_settings_user_default", table_name="ref_chart_settings")
    op.drop_index("uq_ref_chart_settings_user_symbol", table_name="ref_chart_settings")

    # Add back flat columns using batch_alter_table
    with op.batch_alter_table("ref_chart_settings") as batch_op:
        batch_op.add_column(sa.Column("sma_period", sa.Integer(), server_default="30"))
        batch_op.add_column(sa.Column("ema_period", sa.Integer(), server_default="100"))
        batch_op.add_column(sa.Column("bb_period", sa.Integer(), server_default="30"))
        batch_op.add_column(sa.Column("bb_std", sa.Float(), server_default="2.0"))
        batch_op.add_column(sa.Column("rsi_period", sa.Integer(), server_default="13"))
        batch_op.add_column(sa.Column("rsi_ob", sa.Float(), server_default="70.0"))
        batch_op.add_column(sa.Column("rsi_os", sa.Float(), server_default="30.0"))
        batch_op.add_column(sa.Column("macd_fast", sa.Integer(), server_default="12"))
        batch_op.add_column(sa.Column("macd_slow", sa.Integer(), server_default="26"))
        batch_op.add_column(sa.Column("macd_signal", sa.Integer(), server_default="9"))
        batch_op.add_column(sa.Column("fib_lookback_bars", sa.Integer(), server_default="252"))
        batch_op.add_column(sa.Column("fib_intraday_bars", sa.Integer(), server_default="78"))

    if is_postgres:
        bind.execute(
            sa.text("""
                UPDATE ref_chart_settings SET
                    sma_period = COALESCE((parameters->'moving_averages'->>'sma_period')::integer, 30),
                    ema_period = COALESCE((parameters->'moving_averages'->>'ema_period')::integer, 100),
                    bb_period = COALESCE((parameters->'bollinger_bands'->>'period')::integer, 30),
                    bb_std = COALESCE((parameters->'bollinger_bands'->>'std_dev')::float, 2.0),
                    rsi_period = COALESCE((parameters->'rsi'->>'period')::integer, 13),
                    rsi_ob = COALESCE((parameters->'rsi'->>'overbought')::float, 70.0),
                    rsi_os = COALESCE((parameters->'rsi'->>'oversold')::float, 30.0),
                    macd_fast = COALESCE((parameters->'macd'->>'fast')::integer, 12),
                    macd_slow = COALESCE((parameters->'macd'->>'slow')::integer, 26),
                    macd_signal = COALESCE((parameters->'macd'->>'signal')::integer, 9),
                    fib_lookback_bars = COALESCE((parameters->'fibonacci'->>'lookback_bars')::integer, 252),
                    fib_intraday_bars = COALESCE((parameters->'fibonacci'->>'intraday_bars')::integer, 78);
            """)
        )

    with op.batch_alter_table("ref_chart_settings") as batch_op:
        batch_op.drop_column("parameters")
