"""UAT / Unit Tests for Transaction Cost Breakdown (TransCost).

Covers:
- Creating transaction cost record linked to a trade or standalone (portfolio_repo.create_trans_cost)
- Querying trans_costs filtered by user_id and trade_id (portfolio_repo.get_trans_costs)
- Validating diverse cost types ('commission', 'sec_fee', 'finra_taf', 'platform_fee', 'borrow_fee', 'other')
- Default currency and ISO date parsing
- FastAPI API endpoints:
  * GET /api/v1/transactions/trans-cost
  * POST /api/v1/transactions/trans-cost (and associated audit log verification)
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.repositories.audit_repo import get_audit_logs
from backend.repositories.portfolio_repo import create_trans_cost, get_trans_costs
from backend.schemas.transactions import TransCostCreate


class TestTransCostRepository:
    """Test suite for public.trans_cost repository operations."""

    def test_create_trans_cost_standalone(self, db_session: Session) -> None:
        """Verify creating a standalone transaction cost not linked to a trade (e.g. monthly platform fee)."""
        cost_payload = TransCostCreate(
            user_id=1,
            trade_id=None,
            cost_type="platform_fee",
            amount=15.00,
            currency="USD",
            date="2026-03-31",
            remarks="Monthly Saxo custody and platform fee",
        )
        created = create_trans_cost(db_session, cost_payload)

        assert created.id is not None
        assert created.user_id == 1
        assert created.trade_id is None
        assert created.cost_type == "platform_fee"
        assert float(created.amount) == 15.00
        assert created.currency == "USD"
        assert created.date == date(2026, 3, 31)
        assert created.remarks == "Monthly Saxo custody and platform fee"
        assert created.created_at is not None

    def test_create_trans_cost_linked_to_trade(self, db_session: Session, seed_test_data: dict[str, Any]) -> None:
        """Verify creating a transaction cost linked to a trade (e.g. commission on AAPL purchase)."""
        # Trade 1 exists in seed_test_data
        cost_data = {
            "user_id": 1,
            "trade_id": 1,
            "cost_type": "commission",
            "amount": 2.50,
            "currency": "USD",
            "date": "2026-01-15",
            "remarks": "Broker execution commission for AAPL buy",
        }
        created = create_trans_cost(db_session, cost_data)

        assert created.id is not None
        assert created.trade_id == 1
        assert created.cost_type == "commission"
        assert float(created.amount) == 2.50

    def test_get_trans_costs_filtering_by_user_and_trade(self, db_session: Session) -> None:
        """Verify querying trans_costs by user_id and trade_id."""
        # Create costs for user 1
        create_trans_cost(
            db_session,
            {"user_id": 1, "trade_id": 10, "cost_type": "commission", "amount": 1.0, "date": "2026-03-01"},
        )
        create_trans_cost(
            db_session,
            {"user_id": 1, "trade_id": 10, "cost_type": "sec_fee", "amount": 0.05, "date": "2026-03-01"},
        )
        create_trans_cost(
            db_session,
            {"user_id": 1, "trade_id": 20, "cost_type": "commission", "amount": 1.5, "date": "2026-03-02"},
        )
        # Create cost for user 2
        create_trans_cost(
            db_session,
            {"user_id": 2, "trade_id": 30, "cost_type": "borrow_fee", "amount": 5.0, "date": "2026-03-03"},
        )

        # 1. Query all for user 1
        u1_costs = get_trans_costs(db_session, user_id=1)
        assert len(u1_costs) == 3

        # 2. Query for user 1 and trade 10 specifically
        trade10_costs = get_trans_costs(db_session, user_id=1, trade_id=10)
        assert len(trade10_costs) == 2
        types = {c.cost_type for c in trade10_costs}
        assert types == {"commission", "sec_fee"}

        # 3. Query for user 2
        u2_costs = get_trans_costs(db_session, user_id=2)
        assert len(u2_costs) == 1
        assert u2_costs[0].cost_type == "borrow_fee"


class TestTransCostAPI:
    """Test suite for /api/v1/transactions/trans-cost endpoints."""

    def test_add_trans_cost_and_audit_trail(
        self, client: TestClient, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify POST /api/v1/transactions/trans-cost creates record and logs audit trail."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        payload = {
            "trade_id": 1,
            "cost_type": "finra_taf",
            "amount": 0.14,
            "currency": "USD",
            "date": "2026-01-15",
            "remarks": "FINRA trading activity fee",
        }
        resp = client.post("/api/v1/transactions/trans-cost", json=payload)
        assert resp.status_code == 200
        cost_json = resp.json()
        assert cost_json["id"] is not None
        assert cost_json["cost_type"] == "finra_taf"
        assert cost_json["amount"] == 0.14

        # Verify audit log was recorded for this mutation
        logs = get_audit_logs(db_session, entity="trans_cost", action="CREATE")
        assert len(logs) >= 1
        matching_log = next((item for item in logs if item.entity_id == str(cost_json["id"])), None)
        assert matching_log is not None
        assert matching_log.user_id == 1

    def test_list_trans_costs_endpoint(
        self, client: TestClient, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify GET /api/v1/transactions/trans-cost returns cost list for active user."""
        create_trans_cost(
            db_session,
            {
                "user_id": 1,
                "cost_type": "other",
                "amount": 10.0,
                "currency": "USD",
                "date": "2026-03-31",
                "remarks": "Wire transfer fee",
            },
        )

        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/v1/transactions/trans-cost")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(item["cost_type"] == "other" and item["amount"] == 10.0 for item in data)
