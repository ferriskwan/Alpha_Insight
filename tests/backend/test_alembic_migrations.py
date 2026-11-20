"""UAT-002: Verification tests for Database Models & Alembic Version Control."""

from __future__ import annotations

import gc
import tempfile
from pathlib import Path
from typing import Generator

import pytest
import sqlalchemy as sa
from alembic.config import Config

from alembic import command
from backend.db.models import Base

EXPECTED_19_TABLES = {
    "users",
    "user_roles",
    "sysvalue",
    "watchlist",
    "eoddata",
    "tickdata",
    "exchange_rate",
    "trade",
    "capital",
    "position",
    "margin_interest_rate",
    "daily_margin_interest",
    "daily_portfolio_summary",
    "user_sessions",
    "job_execution_log",
    "site_map",
    "audit_log",
    "trans_cost",
    "ref_chart_settings",
    "agent_committee_runs",
    "agent_analyst_outputs",
    "investment_notes",
    "investment_note_analyst_links",
    "agent_chat_messages",
}

EXPECTED_15_TABLES = EXPECTED_19_TABLES - {
    "site_map",
    "audit_log",
    "trans_cost",
    "ref_chart_settings",
    "agent_committee_runs",
    "agent_analyst_outputs",
    "investment_notes",
    "investment_note_analyst_links",
    "agent_chat_messages",
}

BASELINE_13_TABLES = EXPECTED_15_TABLES - {"user_sessions", "job_execution_log"}


class TestAlembicMigrationsUAT002:
    """UAT-002 Test Suite validating all 19 SQLAlchemy tables and programmatic Alembic migrations."""

    @pytest.fixture
    def isolated_sqlite_alembic_cfg(self) -> Generator[tuple[Config, str], None, None]:
        """Create a temporary isolated SQLite database and return configured Alembic Config."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
            db_path = tf.name

        sqlite_url = f"sqlite:///{Path(db_path).as_posix()}"
        alembic_ini = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
        cfg = Config(str(alembic_ini))
        cfg.set_main_option("script_location", str(alembic_ini.parent / "alembic"))
        cfg.set_main_option("sqlalchemy.url", sqlite_url)

        try:
            yield cfg, sqlite_url
        finally:
            gc.collect()
            try:
                Path(db_path).unlink(missing_ok=True)
            except PermissionError:
                pass

    def test_sqlalchemy_metadata_contains_all_19_tables(self) -> None:
        """Verify that Base.metadata.tables contains all 24 expected tables (including Epic 0.4)."""
        actual_tables = set(Base.metadata.tables.keys())
        missing_tables = EXPECTED_19_TABLES - actual_tables
        assert not missing_tables, f"Missing tables in Base.metadata: {missing_tables}"
        assert len(actual_tables) == 24, f"Expected 24 tables, but got {len(actual_tables)}: {actual_tables}"

    def test_table_primary_keys_and_required_columns(self) -> None:
        """Verify primary keys on core tables."""
        users_table = Base.metadata.tables["users"]
        assert "id" in [c.name for c in users_table.primary_key.columns]
        assert "email" in users_table.columns
        assert users_table.columns["email"].unique is True

        user_sessions_table = Base.metadata.tables["user_sessions"]
        assert "sid" in [c.name for c in user_sessions_table.primary_key.columns]
        assert "user_id" in user_sessions_table.columns
        assert "expires_at" in user_sessions_table.columns

        job_logs_table = Base.metadata.tables["job_execution_log"]
        assert "id" in [c.name for c in job_logs_table.primary_key.columns]
        assert "status" in job_logs_table.columns
        assert "started_at" in job_logs_table.columns

        watchlist_table = Base.metadata.tables["watchlist"]
        wl_pks = {c.name for c in watchlist_table.primary_key.columns}
        assert wl_pks == {"user_id", "watchlistname", "symbol"}

    def test_alembic_programmatic_upgrade_and_downgrade_cycle(
        self, isolated_sqlite_alembic_cfg: tuple[Config, str]
    ) -> None:
        """Execute programmatic upgrade 0001 -> 0002 -> downgrade 0001 -> upgrade head on SQLite."""
        cfg, sqlite_url = isolated_sqlite_alembic_cfg
        engine = sa.create_engine(sqlite_url)

        try:
            # 1. Upgrade to 0001 (Baseline 13 tables)
            command.upgrade(cfg, "0001")
            inspector = sa.inspect(engine)
            tables_0001 = set(inspector.get_table_names())
            for tbl in BASELINE_13_TABLES:
                assert tbl in tables_0001, f"Table '{tbl}' missing after migration 0001"
            assert "user_sessions" not in tables_0001
            assert "job_execution_log" not in tables_0001

            # 2. Upgrade to 0002 (Adds user_sessions and job_execution_log)
            command.upgrade(cfg, "0002")
            inspector = sa.inspect(engine)
            tables_0002 = set(inspector.get_table_names())
            assert "user_sessions" in tables_0002
            assert "job_execution_log" in tables_0002

            # Verify indexes created in 0002
            session_indexes = [idx["name"] for idx in inspector.get_indexes("user_sessions")]
            assert "ix_user_sessions_user_id" in session_indexes
            job_indexes = [idx["name"] for idx in inspector.get_indexes("job_execution_log")]
            assert "ix_job_execution_log_started_at" in job_indexes

            # 3. Downgrade to 0001 (Drops user_sessions and job_execution_log)
            command.downgrade(cfg, "0001")
            inspector = sa.inspect(engine)
            tables_downgraded = set(inspector.get_table_names())
            assert "user_sessions" not in tables_downgraded
            assert "job_execution_log" not in tables_downgraded
            for tbl in BASELINE_13_TABLES:
                assert tbl in tables_downgraded, f"Table '{tbl}' should remain after downgrade to 0001"

            # 4. Re-upgrade to head
            command.upgrade(cfg, "head")
            inspector = sa.inspect(engine)
            tables_head = set(inspector.get_table_names())
            assert "user_sessions" in tables_head
            assert "job_execution_log" in tables_head
            assert "site_map" in tables_head
            assert "audit_log" in tables_head
            assert "trans_cost" in tables_head
            assert "ref_chart_settings" in tables_head
            assert "agent_committee_runs" in tables_head
            assert "agent_analyst_outputs" in tables_head
            assert "investment_notes" in tables_head
            assert "investment_note_analyst_links" in tables_head
        finally:
            engine.dispose()
