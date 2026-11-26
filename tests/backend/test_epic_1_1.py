"""Unit and integration tests for Epic 1.1: By Industry / Sector Research & Portfolio Overview Refinements."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select
from starlette.testclient import TestClient

from backend.db.models import DailyPortfolioSummary, SiteMap, Watchlist
from backend.db.session import get_session_factory
from backend.main import app
from backend.repositories.committee_repo import (
    build_sector_committee_context,
)
from backend.repositories.portfolio_repo import get_portfolio_4chart_overview
from backend.repositories.research_repo import get_sector_performance
from backend.services.agent_orchestrator import run_sector_committee_orchestration
from backend.services.rss_service import fetch_sector_rss_news


@pytest.fixture
def db_session():
    factory = get_session_factory()
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


class TestEpic11DatabaseAndSeed:
    """Verify Success Criteria 1 & 2: GICS sector seeds and site_map."""

    def test_gics_sector_indexes_seeded_in_watchlist(self, db_session):
        expected_tickers = ["XLK", "XLF", "XLV", "XLE", "XLI", "XLC", "XLY", "XLP", "XLB", "XLU", "XLRE", "SPY"]
        rows = list(db_session.scalars(select(Watchlist).where(Watchlist.symbol.in_(expected_tickers))).all())
        found_symbols = {r.symbol.strip().upper() for r in rows}
        for ticker in expected_tickers:
            assert ticker in found_symbols, f"Expected {ticker} to be seeded in watchlist"
            row = next(r for r in rows if r.symbol.strip().upper() == ticker)
            assert row.watchlistname == "Index"
            assert row.currency == "USD"

    def test_site_map_contains_by_industry_sector(self, db_session):
        node = db_session.scalar(select(SiteMap).where(SiteMap.route == "/research/sectors"))
        assert node is not None
        assert node.label == "By Industry / Sector"
        assert node.parent_id is not None


class TestEpic11RssService:
    """Verify Success Criteria 4: Yahoo Finance RSS Ingestion."""

    def test_fetch_sector_rss_news_live_or_fallback(self):
        # Fetching for XLK should return list of articles or empty list on timeout
        news = fetch_sector_rss_news("XLK", limit=3, timeout_seconds=5.0)
        assert isinstance(news, list)
        for item in news:
            assert "title" in item
            assert "url" in item
            assert item["url"].startswith("http")
            assert "publisher" in item
            assert "published_at" in item

    def test_fetch_sector_rss_news_defensive_on_error(self):
        # Invalid ticker should gracefully return empty list without throwing
        news = fetch_sector_rss_news("INVALID_TICKER_99999", limit=3, timeout_seconds=2.0)
        assert isinstance(news, list)


class TestEpic11SectorPerformanceAndRotation:
    """Verify Success Criteria 3: Dynamic Sector Performance & RRG Quadrants."""

    def test_get_sector_performance_horizons_and_quadrants(self, db_session):
        resp = get_sector_performance(db_session, horizon="1M")
        assert resp["horizon"] == "1M"
        assert resp["benchmark"] == "SPY"
        assert "benchmarkReturn" in resp
        assert "sectors" in resp
        assert len(resp["sectors"]) == 11

        quadrants_seen = set()
        for s in resp["sectors"]:
            assert s["ticker"] in ["XLK", "XLF", "XLV", "XLE", "XLI", "XLC", "XLY", "XLP", "XLB", "XLU", "XLRE"]
            assert s["relativeRotation"] in ["Leading", "Improving", "Weakening", "Lagging"]
            assert "rsScore" in s
            assert "rsMomentum" in s
            quadrants_seen.add(s["relativeRotation"])

        assert len(quadrants_seen) > 0
        assert "quadrantDefinitions" in resp
        assert "Leading" in resp["quadrantDefinitions"]
        assert "Lagging" in resp["quadrantDefinitions"]


class TestEpic11SectorCommitteeAndFallback:
    """Verify Success Criteria 5, 6, 12, 13: 4-Analyst Committee & Fallback Warning."""

    def test_build_sector_committee_context(self, db_session):
        ctx = build_sector_committee_context(db_session, symbol="XLK", user_id=1)
        assert "sector_metrics" in ctx
        assert ctx["sector_metrics"]["symbol"] == "XLK"
        assert "news_items" in ctx
        assert isinstance(ctx["news_items"], list)
        assert "past_outputs" in ctx

    @pytest.mark.asyncio
    async def test_run_sector_committee_orchestration_fallback_detection(self):
        # When Gemini raises credit depletion error, deterministic fallback report is generated with fallback_warning
        metrics = {
            "symbol": "XLK",
            "name": "Technology",
            "return_1d": 1.25,
            "return_1w": 2.50,
            "return_1m": 4.10,
            "weight": 29.5,
            "relative_rotation": "Leading",
            "rs_score": 1.035,
            "rs_momentum": 0.012,
        }
        res = await run_sector_committee_orchestration(
            symbol="XLK",
            provider="gemini",
            sector_metrics=metrics,
            news_items=[],
            past_outputs=[],
        )
        assert res["symbol"] == "XLK"
        assert res["consensus_bias"] in ["Bullish", "Bearish", "Neutral"]
        assert res["consensus_confidence"] >= 50
        assert len(res["outputs"]) >= 4
        # If API credits are depleted in test environment, fallback_warning is present
        if res.get("fallback_warning"):
            assert (
                "credits depleted" in res["fallback_warning"].lower()
                or "402" in res["fallback_warning"]
                or "fallback mode" in res["fallback_warning"].lower()
            )

    def test_api_sector_committee_endpoints(self, client):
        # 1. GET /api/v1/research/sectors
        resp = client.get("/api/v1/research/sectors?horizon=1M")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["sectors"]) == 11

        # 2. GET /api/v1/research/sectors/XLK/committee
        comm_resp = client.get("/api/v1/research/sectors/XLK/committee")
        assert comm_resp.status_code == 200
        comm_data = comm_resp.json()
        assert comm_data["symbol"] == "XLK"
        assert "consensus_bias" in comm_data
        assert "outputs" in comm_data
        assert "news_sources" in comm_data


class TestEpic11PortfolioOverviewRefinements:
    """Verify Success Criteria 7-11: Portfolio Overview Default Date, Timeframe, Holdings Pie, Total Portfolio."""

    def test_portfolio_overview_default_date_and_timeframe(self, db_session, client):
        resp = client.get("/api/v1/portfolio/overview")
        assert resp.status_code == 200
        data = resp.json()

        # Default timeframe is 6M
        assert data["parameters"]["timeframe"] == "6M"

        # Default date matches max(date) of daily_portfolio_summary
        max_d = db_session.scalar(
            select(func.max(DailyPortfolioSummary.date)).where(DailyPortfolioSummary.user_id == 1)
        )
        if max_d:
            assert data["parameters"]["selectedDate"] == max_d.isoformat()

    def test_total_portfolio_is_holdings_aggregation(self, db_session):
        overview = get_portfolio_4chart_overview(db_session, user_id=1, currency="SGD", timeframe="6M")
        kpis = overview["kpis"]
        total_port = kpis["totalPortfolio"]

        # Chart 3 holdings pie slices
        pie_slices = overview["chart3_holdings_pie"]
        assert isinstance(pie_slices, list)
        if pie_slices and pie_slices[0]["category"] == "Equities":
            sum_val = sum(s["value"] for s in pie_slices)
            assert abs(total_port - sum_val) < 0.05
            assert pie_slices[0]["percentage"] > 0
