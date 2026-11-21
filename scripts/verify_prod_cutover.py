"""Read-only PostgreSQL verification script for Epic 1.0 production cutover (4leafclover).

Captures a pre-migration baseline snapshot (--mode pre) and verifies post-migration
zero-data-loss parity (--mode post --baseline <file>).

All database connections enforce PostgreSQL `readonly=True` session mode.
Connection parameters are resolved strictly from environment variables (DATABASE_URL
or DB_HOST/DB_PUBLIC_IP, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSLMODE).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import psycopg2
from dotenv import load_dotenv

EXPECTED_ALEMBIC_REVISION = "0009"
EXPECTED_NEW_TABLES: tuple[str, ...] = (
    "alembic_version",
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
)


def _resolve_connection_kwargs() -> dict[str, Any]:
    """Build psycopg2 connection parameters strictly from environment variables."""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        parsed = urlparse(database_url)
        return {
            "host": parsed.hostname or "127.0.0.1",
            "port": parsed.port or 5432,
            "dbname": parsed.path.lstrip("/"),
            "user": unquote(parsed.username or ""),
            "password": unquote(parsed.password or ""),
            "sslmode": os.getenv("DB_SSLMODE", "prefer"),
            "connect_timeout": 10,
        }

    db_host = os.getenv("DB_HOST") or os.getenv("DB_PUBLIC_IP") or "127.0.0.1"
    if ":" in db_host and not db_host.startswith("/cloudsql/"):
        db_host = os.getenv("DB_PUBLIC_IP") or "127.0.0.1"

    return {
        "host": db_host,
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME", "4leafclover"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", ""),
        "sslmode": os.getenv("DB_SSLMODE", "prefer"),
        "connect_timeout": 10,
    }


def collect_db_snapshot(conn_kwargs: dict[str, Any]) -> dict[str, Any]:
    """Inspect public schema tables, row counts, alembic_version, and sysvalue keys read-only."""
    conn = psycopg2.connect(**conn_kwargs)
    try:
        conn.set_session(readonly=True, autocommit=True)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            table_names = [str(r[0]) for r in cur.fetchall()]

            table_counts: dict[str, int] = {}
            for table in table_names:
                cur.execute(f'SELECT COUNT(*) FROM public."{table}"')
                row = cur.fetchone()
                table_counts[table] = int(row[0]) if row else 0

            alembic_version: list[str] | None = None
            if "alembic_version" in table_names:
                cur.execute("SELECT version_num FROM public.alembic_version ORDER BY version_num")
                alembic_version = [str(r[0]) for r in cur.fetchall()]

            sysvalue_keys: list[str] = []
            if "sysvalue" in table_names:
                cur.execute("SELECT name FROM public.sysvalue ORDER BY name")
                sysvalue_keys = [str(r[0]) for r in cur.fetchall()]

            return {
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "dbname": conn_kwargs.get("dbname"),
                "table_count": len(table_names),
                "alembic_version": alembic_version,
                "sysvalue_keys": sysvalue_keys,
                "tables": table_counts,
            }
    finally:
        conn.close()


def compare_cutover_snapshots(
    pre: dict[str, Any],
    post: dict[str, Any],
    expected_revision: str = EXPECTED_ALEMBIC_REVISION,
) -> list[str]:
    """Compare pre-cutover and post-cutover snapshots; return list of violations (empty = PASS)."""
    violations: list[str] = []

    post_rev = post.get("alembic_version")
    if post_rev != [expected_revision]:
        violations.append(f"Expected alembic_version == ['{expected_revision}'], got {post_rev!r}")

    pre_tables: dict[str, int] = dict(pre.get("tables") or {})
    post_tables: dict[str, int] = dict(post.get("tables") or {})

    for new_table in EXPECTED_NEW_TABLES:
        if new_table not in post_tables:
            violations.append(f"Missing expected post-cutover table: {new_table}")

    for legacy_table, pre_count in sorted(pre_tables.items()):
        if legacy_table not in post_tables:
            violations.append(f"DATA LOSS: legacy table dropped or missing: {legacy_table}")
            continue
        post_count = post_tables[legacy_table]
        if post_count < pre_count:
            violations.append(f"DATA LOSS: table '{legacy_table}' row count decreased from {pre_count} to {post_count}")

    post_syskeys = set(post.get("sysvalue_keys") or [])
    if "DEFAULT_CURRENCY" not in post_syskeys:
        violations.append("Missing seeded sysvalue key: DEFAULT_CURRENCY")

    if "site_map" in post_tables and post_tables["site_map"] < 1:
        violations.append("Expected seeded rows in site_map, found 0")

    if "ref_chart_settings" in post_tables and post_tables["ref_chart_settings"] < 1:
        violations.append("Expected global default row in ref_chart_settings, found 0")

    return violations


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint for pre-cutover snapshot capture and post-cutover verification."""
    load_dotenv()
    parser = argparse.ArgumentParser(description="Read-only production cutover verification tool.")
    parser.add_argument("--mode", choices=("pre", "post"), required=True)
    parser.add_argument("--output", type=Path, default=None, help="Optional JSON file path to write snapshot.")
    parser.add_argument("--baseline", type=Path, default=None, help="Pre-cutover snapshot JSON (required for post).")
    parser.add_argument("--expected-revision", default=EXPECTED_ALEMBIC_REVISION)
    args = parser.parse_args(argv)

    conn_kwargs = _resolve_connection_kwargs()
    snapshot = collect_db_snapshot(conn_kwargs)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        print(f"Wrote {args.mode} snapshot to {args.output}")

    if args.mode == "pre":
        print(
            f"PRE-CUTOVER SNAPSHOT ({snapshot['dbname']}): "
            f"{snapshot['table_count']} tables, alembic_version={snapshot['alembic_version']}"
        )
        return 0

    if not args.baseline or not args.baseline.exists():
        print("ERROR: --baseline <pre_snapshot.json> is required for --mode post.", file=sys.stderr)
        return 2

    baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
    violations = compare_cutover_snapshots(baseline, snapshot, expected_revision=args.expected_revision)

    if violations:
        print("POST-CUTOVER VERIFICATION FAILED:")
        for item in violations:
            print(f"  - {item}")
        return 1

    print(
        f"POST-CUTOVER VERIFICATION PASSED ({snapshot['dbname']}): "
        f"{snapshot['table_count']} tables, alembic_version={snapshot['alembic_version']}, zero data loss."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
