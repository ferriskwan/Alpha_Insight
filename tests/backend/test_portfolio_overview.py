"""Unit and integration tests for Epic 0.6: Portfolio Overview Upgrade & AI Commentary."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import DailyPortfolioSummary, Position, SysValue
from backend.repositories.portfolio_repo import get_default_currency, get_portfolio_4chart_overview
from backend.services.agent_orchestrator import generate_portfolio_overview_commentary


class TestPortfolioOverviewEpic06:
    """Test suite validating Epic 0.6 Portfolio Overview repository, services, and endpoints."""

    def test_default_currency_from_sysvalue(self, db_session: Session, seed_test_data: dict[str, Any]) -> None:
        """Verify default currency resolves dynamically to 'SGD' from public.sysvalue."""
        ccy = get_default_currency(db_session)
        assert ccy == "SGD"

        # Update sysvalue to HKD and verify dynamic resolution
        sys_rec = db_session.query(SysValue).filter(SysValue.name == "DEFAULT_CURRENCY").first()
        assert sys_rec is not None
        sys_rec.strvalue = "HKD"
        db_session.flush()

        assert get_default_currency(db_session) == "HKD"

    def test_portfolio_4chart_overview_badges_and_series(
        self,
        db_session: Session,
        seed_test_data: dict[str, Any],
    ) -> None:
        """Verify 6 KPI badges, Chart 1 (PCM), and Chart 2 (Stocks) time-series calculations."""
        # Seed daily portfolio summaries
        s1 = DailyPortfolioSummary(
            user_id=1,
            date=date(2026, 3, 2),
            currency="SGD",
            investment=True,
            total_asset_value=100000.0,
            total_capital=80000.0,
            margin_loan_balance=20000.0,
            position_market_value=90000.0,
            realized_pnl=2000.0,
            unrealized_pnl=5000.0,
            total_pnl=7000.0,
        )
        s2 = DailyPortfolioSummary(
            user_id=1,
            date=date(2026, 3, 31),
            currency="SGD",
            investment=True,
            total_asset_value=120000.0,
            total_capital=80000.0,
            margin_loan_balance=15000.0,
            position_market_value=110000.0,
            realized_pnl=4000.0,
            unrealized_pnl=16000.0,
            total_pnl=20000.0,
        )
        db_session.add_all([s1, s2])

        # Seed Position records for stock breakdown
        pos1 = Position(
            user_id=1,
            tradedate=date(2026, 3, 31),
            symbol="D05.SI",
            quantity=1000.0,
            eodprice=35.0,
            avgprice=30.0,
        )
        db_session.add(pos1)
        db_session.flush()

        res = get_portfolio_4chart_overview(db_session, user_id=1, currency="SGD")

        # 1. Parameter assertions
        assert res["parameters"]["currency"] == "SGD"
        assert res["parameters"]["selectedDate"] == "2026-03-31"

        # 2. KPI Badges assertions (SC-2)
        # Note: seed_test_data injects 50,000 USD capital * 1.35 fx = 67,500 SGD;
        # plus 80,000 SGD = 147,500 SGD total capital
        kpis = res["kpis"]
        assert kpis["currency"] == "SGD"
        assert kpis["realizedPnL"] == 4000.0
        assert kpis["capital"] == 147500.0
        assert kpis["realizedPnLPct"] == 2.71  # 4000 / 147500 * 100
        assert kpis["unrealizedPnL"] == 17647.0
        assert kpis["unrealizedPnLPct"] == 11.96  # 17647 / 147500 * 100
        assert kpis["totalPnL"] == 21647.0
        assert kpis["totalPnLPct"] == 14.68  # 21647 / 147500 * 100
        assert kpis["margin"] == 15000.0
        assert kpis["marginPct"] == 10.17  # 15000 / 147500 * 100
        assert (
            kpis["totalPortfolio"] == 60272.0
        )  # Epic 1.1: Aggregation of active position holdings (25,272 AAPL + 35,000 D05.SI)

        # 3. Chart 1 series (PCM)
        pcm = res["chart1_portfolio_capital_margin"]
        assert len(pcm) >= 2
        assert pcm[0]["portfolioSize"] == 100000.0
        assert pcm[-1]["portfolioSize"] == 212772.0

        # 4. Chart 2 series (Attribution)
        pnl_bd = res["chart2_pnl_breakdown"]
        assert len(pnl_bd["portfolio"]) >= 2
        assert "D05.SI" in pnl_bd["stocks"]
        d05_pts = pnl_bd["stocks"]["D05.SI"]
        assert len(d05_pts) >= 2
        assert d05_pts[-1]["pnl"] == 5000.0  # 1000 * (35 - 30)

    def test_portfolio_overview_commentary_generation_and_caching(
        self,
        db_session: Session,
        seed_test_data: dict[str, Any],
    ) -> None:
        """Verify 4-quadrant AI commentary synthesis and in-memory cache behavior."""
        # Initial call generates commentary
        c1 = generate_portfolio_overview_commentary(
            db=db_session,
            user_id=1,
            currency="SGD",
            as_of_date="2026-03-31",
            force_refresh=True,
        )
        assert c1["cached"] is False
        assert "technical" in c1["commentaries"]
        assert "fundamental" in c1["commentaries"]
        assert "macro" in c1["commentaries"]
        assert "risk" in c1["commentaries"]

        # Quadrant titles and statuses
        assert c1["commentaries"]["technical"]["title"] == "Technical Posture"
        assert c1["commentaries"]["fundamental"]["title"] == "Fundamental Analysis"
        assert c1["commentaries"]["macro"]["title"] == "Macroeconomic Context"
        assert c1["commentaries"]["risk"]["title"] == "Risk Management"

        # Subsequent call retrieves cached commentary
        c2 = generate_portfolio_overview_commentary(
            db=db_session,
            user_id=1,
            currency="SGD",
            as_of_date="2026-03-31",
            force_refresh=False,
        )
        assert c2["cached"] is True
        assert c2["commentaries"] == c1["commentaries"]

    def test_api_endpoints_overview_and_commentary(
        self,
        client: TestClient,
        seed_test_data: dict[str, Any],
    ) -> None:
        """Verify GET /api/v1/portfolio/overview and /overview/commentary HTTP endpoints."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # 1. GET /overview
        resp = client.get("/api/v1/portfolio/overview?currency=SGD&timeframe=12M")
        assert resp.status_code == 200
        data = resp.json()
        assert "kpis" in data
        assert "chart1_portfolio_capital_margin" in data
        assert "chart2_pnl_breakdown" in data
        assert data["parameters"]["currency"] == "SGD"

        # 2. GET /overview/commentary
        c_resp = client.get("/api/v1/portfolio/overview/commentary?currency=SGD")
        assert c_resp.status_code == 200
        c_data = c_resp.json()
        assert "commentaries" in c_data
        assert "technical" in c_data["commentaries"]

        # 3. POST /overview/commentary/refresh
        r_resp = client.post("/api/v1/portfolio/overview/commentary/refresh?currency=SGD")
        assert r_resp.status_code == 200
        r_data = r_resp.json()
        assert r_data["cached"] is False
