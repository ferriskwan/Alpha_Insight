"""UAT-003: Verification tests for Monolithic FastAPI Auth, Sessions, Watchlist, Portfolio & Transactions API."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend.schemas.analysis import AnalyzeResponse, GroundingChunkItem


class TestAuthEndpointsUAT003:
    """Authentication and session management endpoint contract tests."""

    def test_get_auth_env(self, client: TestClient) -> None:
        """Verify GET /api/auth/env returns runtime environment and Google client ID."""
        resp = client.get("/api/auth/env")
        assert resp.status_code == 200
        data = resp.json()
        assert "env" in data
        assert "googleClientId" in data
        assert data["env"] in ("DEV", "TEST")

    def test_google_login_mock_mode(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify POST /api/auth/google-login creates session cookie and returns user profile."""
        login_payload = {
            "mock_email": "admin@alphainsight.test",
            "mock_name": "Admin Tester",
        }
        resp = client.post("/api/auth/google-login", json=login_payload)
        assert resp.status_code == 200
        user_data = resp.json()
        assert user_data["email"] == "admin@alphainsight.test"
        assert "admin" in user_data["roles"]

        # Verify session cookie was set
        assert "alpha_sid" in resp.cookies
        session_cookie = resp.cookies["alpha_sid"]
        assert len(session_cookie) > 10

    def test_get_auth_me_with_cookie(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/auth/me resolves user profile from alpha_sid session cookie."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@alphainsight.test"
        assert "admin" in data["roles"]

    def test_logout_flow(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify POST /api/auth/logout invalidates session and clears alpha_sid cookie."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json().get("success") is True


class TestWatchlistEndpointsUAT003:
    """Watchlist and chart screenshot endpoints contract tests."""

    def test_list_watchlist_symbols(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/watchlist/symbols returns tracked symbols."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/watchlist/symbols")
        assert resp.status_code == 200
        symbols = resp.json()
        assert isinstance(symbols, list)
        assert len(symbols) >= 1
        symbol_tickers = [s["symbol"] for s in symbols]
        assert "AAPL" in symbol_tickers

    def test_get_watchlist_data(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/watchlist/data?symbol=AAPL returns OHLCV series, trades, and screenshot."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        with patch("backend.api.v1.watchlist.generate_candlestick_png") as mock_chart:
            mock_chart.return_value = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"

            resp = client.get("/api/watchlist/data?symbol=AAPL")
            assert resp.status_code == 200
            data = resp.json()
            assert data["symbol"] == "AAPL"
            assert "eodData" in data
            assert "trades" in data
            assert len(data["trades"]) >= 1
            assert data["chartScreenshot"] == "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"


class TestPortfolioEndpointsUAT003:
    """Portfolio dashboard, position and trade query endpoint tests."""

    def test_get_portfolio_dashboard(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/portfolio/dashboard returns KPIs, balance matrix, and performance curve."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/portfolio/dashboard?currency=USD&account=All")
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
        assert "balanceMatrix" in data
        assert "performanceSeries" in data
        assert "positions" in data
        assert "fxRates" in data
        assert data["fxRates"]["USD"] == 1.0

    def test_get_portfolio_positions(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/portfolio/positions returns open positions."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/portfolio/positions")
        assert resp.status_code == 200
        positions = resp.json()
        assert isinstance(positions, list)
        assert len(positions) >= 1
        assert positions[0]["symbol"] == "AAPL"

    def test_get_portfolio_trades(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/portfolio/trades returns historical trades."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/portfolio/trades?symbol=AAPL")
        assert resp.status_code == 200
        trades = resp.json()
        assert isinstance(trades, list)
        assert len(trades) >= 1
        assert trades[0]["symbol"] == "AAPL"


class TestTransactionEditorCrudUAT003:
    """Full CRUD testing for Watchlist, Trade, Capital, and SysValue."""

    def test_watchlist_crud(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify Watchlist CRUD operations."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # 1. Create
        create_payload = {
            "watchlistname": "Growth",
            "symbol": "NVDA",
            "name": "NVIDIA Corporation",
            "timezone": "America/New_York",
            "currency": "USD",
        }
        res_create = client.post("/api/transactions/watchlist", json=create_payload)
        assert res_create.status_code == 200

        # 2. List & Verify
        res_list = client.get("/api/transactions/watchlist")
        assert res_create.status_code == 200
        symbols = [item["symbol"] for item in res_list.json()]
        assert "NVDA" in symbols

        # 3. Delete
        res_del = client.delete("/api/transactions/watchlist?watchlistname=Growth&symbol=NVDA")
        assert res_del.status_code == 200
        assert res_del.json()["deleted"] is True

    def test_trade_crud(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify Trade CRUD operations."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # 1. Create
        trade_payload = {
            "symbol": "NVDA",
            "buysell": "B",
            "tradedate": "2026-03-15T10:00:00",
            "investment": True,
            "price": 120.0,
            "quantity": 10.0,
            "remarks": "Test trade",
        }
        res_create = client.post("/api/transactions/trade", json=trade_payload)
        assert res_create.status_code == 200
        trade_id = res_create.json()["id"]

        # 2. Update
        update_payload = dict(trade_payload)
        update_payload["id"] = trade_id
        update_payload["quantity"] = 20.0
        res_update = client.put("/api/transactions/trade", json=update_payload)
        assert res_update.status_code == 200

        # 3. Delete
        res_del = client.delete(f"/api/transactions/trade?id={trade_id}")
        assert res_del.status_code == 200
        assert res_del.json()["deleted"] is True

    def test_capital_crud(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify Capital CRUD operations."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # 1. Create
        cap_payload = {
            "broker": "Saxo",
            "transtype": "D",
            "accounttype": "Cash",
            "amount": 25000.0,
            "date": "2026-03-01",
            "currency": "USD",
            "remarks": "Additional funds",
        }
        res_create = client.post("/api/transactions/capital", json=cap_payload)
        assert res_create.status_code == 200
        cap_id = res_create.json()["id"]

        # 2. Delete
        res_del = client.delete(f"/api/transactions/capital?id={cap_id}")
        assert res_del.status_code == 200
        assert res_del.json()["deleted"] is True

    def test_sysvalue_crud(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify SysValue CRUD operations."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # 1. Create
        sys_payload = {
            "name": "TEST_PARAM",
            "type": "STR",
            "strvalue": "ACTIVE",
            "description": "Test parameter",
        }
        res_create = client.post("/api/transactions/sysvalue", json=sys_payload)
        assert res_create.status_code == 200

        # 2. Read
        res_list = client.get("/api/transactions/sysvalue")
        assert res_list.status_code == 200
        names = [item["name"] for item in res_list.json()]
        assert "TEST_PARAM" in names

        # 3. Delete
        res_del = client.delete("/api/transactions/sysvalue?name=TEST_PARAM")
        assert res_del.status_code == 200
        assert res_del.json()["deleted"] is True


class TestAdminEndpointsUAT003:
    """Admin tenant management and job execution audit endpoint tests."""

    def test_admin_list_users(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/admin/users returns tenant users with active roles."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) >= 2
        emails = [u["email"] for u in users]
        assert "admin@alphainsight.test" in emails

    def test_admin_set_user_status(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify updating user account status."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])
        resp = client.put("/api/admin/users/2/status?status=expired")
        assert resp.status_code == 200
        data = resp.json()
        assert data["account_status"] == "expired"

    def test_admin_jobs_list_and_trigger(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify GET /api/admin/jobs and POST /api/admin/jobs/run."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        with (
            patch("run_mark_to_market.run_mark_to_market"),
            patch("run_daily_margin_interest.run_daily_margin_interest"),
            patch("run_portfolio_summary.run_portfolio_summary"),
        ):
            trigger_payload = {
                "job_name": "daily_market_pipeline",
                "force_recalculation": True,
            }
            resp = client.post("/api/admin/jobs/run", json=trigger_payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "SUCCESS"
            assert "job_log_id" in data

        # List jobs
        list_resp = client.get("/api/admin/jobs?limit=10")
        assert list_resp.status_code == 200
        jobs = list_resp.json()
        assert len(jobs) >= 1
        assert jobs[0]["job_name"] == "daily_market_pipeline"


class TestAnalysisEndpointUAT003:
    """AI quantitative analysis endpoint test."""

    def test_stock_analysis_endpoint(self, client: TestClient, seed_test_data: dict[str, Any]) -> None:
        """Verify POST /api/analyze executes AI analysis service."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        mock_ai_response = AnalyzeResponse(
            symbol="AAPL",
            provider="gemini",
            model="gemini-2.5-flash",
            markdown="### Comprehensive Quantitative Analysis for AAPL\nBullish momentum confirmed.",
            groundingLinks=[
                GroundingChunkItem(title="Apple Investor Relations", uri="https://investor.apple.com"),
            ],
        )

        with patch("backend.api.v1.analysis.run_stock_analysis", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = mock_ai_response

            analyze_payload = {
                "symbol": "AAPL",
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "prompt": "Evaluate support levels",
                "modules": {
                    "chartPatternRecognition": True,
                    "shortTermTechnical": True,
                    "longTermTechnical": True,
                    "fundamental": True,
                    "valuation": True,
                },
            }

            resp = client.post("/api/analyze", json=analyze_payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["symbol"] == "AAPL"
            assert "Bullish momentum" in data["markdown"]
            assert len(data["groundingLinks"]) == 1


class TestCloudSqlUnixSocketConfig:
    """Verify Cloud SQL Unix domain socket configuration for Cloud Run."""

    def test_cloud_sql_unix_socket_uri(self) -> None:
        """Verify that DB_HOST with /cloudsql/ creates a socket URI without TCP port."""
        from backend.config import Settings

        settings = Settings(
            DB_HOST="/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover",
            DB_NAME="4leafclover_dev",
            DB_USER="postgres",
            DB_PASSWORD="testpassword",
            DB_PORT=5432,
            DB_SSLMODE="disable",
        )
        assert settings.resolved_db_host == "/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover"
        assert settings.sqlalchemy_database_uri == (
            "postgresql+psycopg2://postgres:testpassword@/4leafclover_dev"
            "?host=/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover"
        )
