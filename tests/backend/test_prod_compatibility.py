"""Epic 1.0 production cutover compatibility and workflow contract tests."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend.schemas.transactions import (
    normalize_capital_accounttype,
    normalize_capital_transtype,
    normalize_trade_buysell,
)
from scripts.verify_prod_cutover import (
    EXPECTED_ALEMBIC_REVISION,
    EXPECTED_NEW_TABLES,
    compare_cutover_snapshots,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class TestProdCapitalNormalization:
    """Verify capital accounttype/transtype normalization satisfies PROD CHECK constraints."""

    @pytest.mark.parametrize(
        ("raw_val", "expected"),
        [
            ("Cash", "C"),
            ("C", "C"),
            ("Investment", "C"),
            ("Margin", "M"),
            ("M", "M"),
            ("Leverage", "M"),
            ("L", "M"),
            ("  leverage  ", "M"),
        ],
    )
    def test_normalize_capital_accounttype_valid(self, raw_val: str, expected: str) -> None:
        assert normalize_capital_accounttype(raw_val) == expected

    def test_normalize_capital_accounttype_invalid(self) -> None:
        with pytest.raises(ValueError, match="accounttype"):
            normalize_capital_accounttype("Options")

    @pytest.mark.parametrize(
        ("raw_val", "expected"),
        [("D", "D"), ("Deposit", "D"), ("W", "W"), ("Withdrawal", "W"), ("F", "F"), ("Fee", "F")],
    )
    def test_normalize_capital_transtype_valid(self, raw_val: str, expected: str) -> None:
        assert normalize_capital_transtype(raw_val) == expected

    def test_normalize_capital_transtype_invalid(self) -> None:
        with pytest.raises(ValueError, match="transtype"):
            normalize_capital_transtype("X")

    def test_normalize_trade_buysell(self) -> None:
        assert normalize_trade_buysell("buy") == "B"
        assert normalize_trade_buysell("S") == "S"
        with pytest.raises(ValueError, match="buysell"):
            normalize_trade_buysell("HOLD")


class TestProdSchemaGuardEndpoints:
    """Verify API endpoints enforce PROD 4leafclover legacy column widths and CHECK rules."""

    def test_capital_leverage_persists_as_m(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        payload = {
            "broker": "Saxo",
            "transtype": "D",
            "accounttype": "Leverage",
            "amount": 5000.0,
            "date": "2026-11-20",
            "currency": "SGD",
            "remarks": "Margin top-up",
        }
        res_create = client.post("/api/transactions/capital", json=payload)
        assert res_create.status_code == 200
        cap_id = res_create.json()["id"]

        res_list = client.get("/api/transactions/capital")
        assert res_list.status_code == 200
        created = next(item for item in res_list.json() if item["id"] == cap_id)
        assert created["accounttype"] == "M"
        assert created["transtype"] == "D"

        client.delete(f"/api/transactions/capital?id={cap_id}")

    def test_capital_invalid_transtype_returns_422(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        payload = {
            "broker": "Saxo",
            "transtype": "INVALID",
            "accounttype": "Cash",
            "amount": 100.0,
            "date": "2026-11-20",
            "currency": "USD",
        }
        resp = client.post("/api/transactions/capital", json=payload)
        assert resp.status_code == 422

    def test_trade_oversized_remarks_returns_422(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        payload = {
            "symbol": "AAPL",
            "buysell": "B",
            "tradedate": "2026-11-20T10:00:00",
            "investment": True,
            "price": 200.0,
            "quantity": 5.0,
            "remarks": "x" * 201,
        }
        resp = client.post("/api/transactions/trade", json=payload)
        assert resp.status_code == 422

    def test_watchlist_oversized_fields_return_422(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        payload = {
            "watchlistname": "Default",
            "symbol": "TOOLONGSYMBOL",
            "name": "Valid Name",
            "timezone": "America/New_York",
            "currency": "USD",
        }
        resp = client.post("/api/transactions/watchlist", json=payload)
        assert resp.status_code == 422

    def test_sysvalue_oversized_name_returns_422(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        payload = {
            "name": "THIS_SYSVALUE_KEY_IS_TOO_LONG",
            "type": "STRING",
            "strvalue": "SGD",
        }
        resp = client.post("/api/transactions/sysvalue", json=payload)
        assert resp.status_code == 422


class TestDeployProdWorkflowContract:
    """Verify deploy-prod.yml targets alpha-insight-web-prod and alpha-insight-daily-job-prod."""

    def test_deploy_prod_workflow_configuration(self) -> None:
        workflow_path = PROJECT_ROOT / ".github" / "workflows" / "deploy-prod.yml"
        content = workflow_path.read_text(encoding="utf-8")

        assert 'PROD_DB_NAME: "4leafclover"' in content
        assert "gcloud run deploy alpha-insight-web-prod" in content
        assert "gcloud run services describe alpha-insight-web-prod" in content
        assert "uv run alembic upgrade head" in content
        assert "alpha-insight-daily-job-prod" in content
        assert "API_URL=${WEB_URL}" in content
        assert "API_KEY=alpha-api-key:latest" in content


class TestVerifyProdCutoverLogic:
    """Verify read-only snapshot comparison catches data loss and validates clean cutover."""

    def test_clean_cutover_passes(self) -> None:
        pre = {
            "alembic_version": None,
            "sysvalue_keys": ["ENV", "GLOBAL_STARTDATE", "GLOBAL_TODAY"],
            "tables": {"capital": 33, "trade": 61, "sysvalue": 3, "users": 2},
        }
        post_tables: dict[str, int] = {"capital": 33, "trade": 61, "sysvalue": 4, "users": 2}
        for table in EXPECTED_NEW_TABLES:
            post_tables[table] = (
                16 if table == "site_map" else (1 if table in ("alembic_version", "ref_chart_settings") else 0)
            )
        post = {
            "alembic_version": [EXPECTED_ALEMBIC_REVISION],
            "sysvalue_keys": ["DEFAULT_CURRENCY", "ENV", "GLOBAL_STARTDATE", "GLOBAL_TODAY"],
            "tables": post_tables,
        }
        assert compare_cutover_snapshots(pre, post) == []

    def test_row_count_decrease_is_flagged_as_data_loss(self) -> None:
        pre = {
            "alembic_version": None,
            "sysvalue_keys": ["ENV"],
            "tables": {"capital": 33, "trade": 61, "sysvalue": 3},
        }
        post_tables: dict[str, int] = {"capital": 32, "trade": 61, "sysvalue": 4}
        for table in EXPECTED_NEW_TABLES:
            post_tables[table] = 1
        post = {
            "alembic_version": [EXPECTED_ALEMBIC_REVISION],
            "sysvalue_keys": ["DEFAULT_CURRENCY", "ENV"],
            "tables": post_tables,
        }
        violations = compare_cutover_snapshots(pre, post)
        assert any("DATA LOSS" in v and "capital" in v for v in violations)
