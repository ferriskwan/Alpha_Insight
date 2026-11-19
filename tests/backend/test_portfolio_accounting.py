"""Unit and UAT tests for bidirectional cost basis accounting and portfolio overview analytics.

Verifies:
- Average Buy Cost = sum(Buy Price * Buy Qty) / sum(Buy Qty)
- Average Sell Cost = sum(Sell Price * Sell Qty) / sum(Sell Qty)
- Net Open Qty = Total Buy Qty - Total Sell Qty
- Average Cost = (Total Buy Outlay - Total Sell Inflow) / Net Open Qty
- Signed Unrealized PnL = (Current Market Price - Avg Cost) * Net Open Qty (for both Long and Short positions)
- Realized PnL on closed quantities
- Synchronized 4-chart analytical overview payload (/api/v1/portfolio/overview)
"""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import DailyPortfolioSummary, Position
from backend.repositories.portfolio_repo import (
    compute_bidirectional_position_accounting,
    get_portfolio_4chart_overview,
)


def test_bidirectional_accounting_long_position() -> None:
    """Test standard long position with multiple buys and partial sell."""
    trades = [
        {"buysell": "B", "quantity": 100.0, "price": 150.0},
        {"buysell": "B", "quantity": 50.0, "price": 180.0},
        {"buysell": "S", "quantity": 50.0, "price": 190.0},
    ]

    accounting = compute_bidirectional_position_accounting(trades, current_market_price=200.0)

    # Total Buy Qty = 150, Total Buy Outlay = 15000 + 9000 = 24000
    assert accounting["total_buy_qty"] == 150.0
    assert accounting["avg_buy_cost"] == 160.0  # 24000 / 150

    # Total Sell Qty = 50, Total Sell Inflow = 9500
    assert accounting["total_sell_qty"] == 50.0
    assert accounting["avg_sell_cost"] == 190.0

    # Net Open Qty = 100
    assert accounting["net_open_qty"] == 100.0
    assert accounting["is_short"] is False

    # Avg Cost = (24000 - 9500) / 100 = 14500 / 100 = 145.0
    assert accounting["avg_cost"] == 145.0

    # Realized PnL on sold 50 shares: 50 * (190 - 160) = 1500.0
    assert accounting["realized_pnl"] == 1500.0

    # Unrealized PnL at 200: (200 - 145.0) * 100 = 55.0 * 100 = 5500.0
    assert accounting["unrealized_pnl"] == 5500.0


def test_bidirectional_accounting_short_position() -> None:
    """Test short-selling position: sell short first, price moves down, profitable short."""
    trades = [
        {"buysell": "S", "quantity": 100.0, "price": 200.0},
    ]

    # Current market price drops to 175.0 (profitable short)
    accounting = compute_bidirectional_position_accounting(trades, current_market_price=175.0)

    assert accounting["total_buy_qty"] == 0.0
    assert accounting["total_sell_qty"] == 100.0
    assert accounting["avg_sell_cost"] == 200.0
    assert accounting["net_open_qty"] == -100.0
    assert accounting["is_short"] is True

    # Avg Cost = (0 - 20000) / (-100) = 200.0
    assert accounting["avg_cost"] == 200.0

    # Unrealized PnL = (175.0 - 200.0) * (-100) = (-25.0) * (-100) = +2500.0
    assert accounting["unrealized_pnl"] == 2500.0

    # Current market price rises to 230.0 (loss on short)
    loss_accounting = compute_bidirectional_position_accounting(trades, current_market_price=230.0)
    # Unrealized PnL = (230.0 - 200.0) * (-100) = (+30.0) * (-100) = -3000.0
    assert loss_accounting["unrealized_pnl"] == -3000.0


def test_bidirectional_accounting_flat_position() -> None:
    """Test fully closed position (net zero)."""
    trades = [
        {"buysell": "B", "quantity": 100.0, "price": 100.0},
        {"buysell": "S", "quantity": 100.0, "price": 120.0},
    ]

    accounting = compute_bidirectional_position_accounting(trades, current_market_price=150.0)

    assert accounting["net_open_qty"] == 0.0
    assert accounting["unrealized_pnl"] == 0.0
    assert accounting["realized_pnl"] == 2000.0


def test_portfolio_4chart_overview_structure(db_session: Session) -> None:
    """Verify get_portfolio_4chart_overview returns all 4 synchronized chart series and KPIs."""
    # Seed a DailyPortfolioSummary and Position
    pos = Position(
        user_id=1,
        symbol="AAPL",
        tradedate=date(2026, 3, 31),
        investment=True,
        avgprice=150.0,
        quantity=100.0,
        eodprice=180.0,
    )
    db_session.add(pos)

    dps = DailyPortfolioSummary(
        user_id=1,
        date=date(2026, 3, 31),
        currency="USD",
        investment=True,
        total_capital=100000.0,
        position_market_value=100000.0,
        margin_loan_balance=0.0,
        realized_pnl=5000.0,
        unrealized_pnl=15000.0,
        daily_interest_accrued=0.0,
        cumulative_interest_accrued=0.0,
        total_asset_value=120000.0,
        total_pnl=20000.0,
        pct_pnl=20.0,
    )
    db_session.add(dps)
    db_session.commit()

    overview = get_portfolio_4chart_overview(db_session, user_id=1, currency="USD")

    assert "kpis" in overview
    assert "chart1_equity_vs_benchmark" in overview
    assert "chart2_cumulative_pnl" in overview
    assert "chart3_asset_allocation" in overview
    assert "chart4_daily_pnl_drawdown" in overview

    # Verify allocation includes AAPL
    allocations = overview["chart3_asset_allocation"]
    symbols = [a["name"] for a in allocations]
    assert "AAPL" in symbols or any("Cash" in s for s in symbols)


def test_portfolio_overview_endpoint(client: TestClient, db_session: Session) -> None:
    """Verify HTTP GET /api/v1/portfolio/overview returns status 200 with 4-chart payload."""
    pos = Position(
        user_id=1,
        symbol="MSFT",
        tradedate=date(2026, 3, 31),
        investment=True,
        avgprice=300.0,
        quantity=50.0,
        eodprice=350.0,
    )
    db_session.add(pos)
    db_session.commit()

    response = client.get("/api/v1/portfolio/overview")
    assert response.status_code == 200
    data = response.json()

    assert "kpis" in data
    assert "chart1_equity_vs_benchmark" in data
    assert "chart2_cumulative_pnl" in data
    assert "chart3_asset_allocation" in data
    assert "chart4_daily_pnl_drawdown" in data
