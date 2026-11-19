"""Unit and integration tests for Research sub-applications and Watchlist CRUD.

Covers:
- GET /api/v1/research/stock-analyst/{symbol} (candlesticks, technical indicators, trade markers)
- GET /api/v1/research/macroeconomics (Treasury yield curve, CPI, GDP, FX crosses)
- GET /api/v1/research/sectors (11 GICS sector performance, weighting, relative rotation)
- GET /api/v1/watchlist/items, POST /api/v1/watchlist/items, DELETE /api/v1/watchlist/items/{id}
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import EodData, Trade, Watchlist


def test_stock_analyst_endpoint(client: TestClient, db_session: Session) -> None:
    """Verify stock analyst endpoint calculates SMA, EMA, Bollinger Bands, and fetches trades."""
    # Seed EOD candles for AAPL with distinct dates
    base_date = date(2026, 1, 1)
    for i in range(35):
        day_date = base_date + timedelta(days=i)
        candle = EodData(
            symbol="AAPL",
            date=day_date,
            open=150.0 + i,
            high=155.0 + i,
            low=149.0 + i,
            close=152.0 + i,
            volume=1000000.0,
        )
        db_session.add(candle)

    # Seed trade marker
    trade = Trade(
        user_id=1,
        symbol="AAPL",
        buysell="B",
        tradedate=date(2026, 1, 15),
        investment=True,
        price=165.0,
        quantity=50.0,
        remarks="UAT buy",
    )
    db_session.add(trade)
    db_session.commit()

    resp = client.get("/api/v1/research/stock-analyst/AAPL?timeframe=1M&sma=10&ema=20")
    assert resp.status_code == 200
    data = resp.json()

    assert data["symbol"] == "AAPL"
    assert "series" in data
    assert len(data["series"]) > 0
    assert "trades" in data
    assert len(data["trades"]) >= 1
    assert data["trades"][0]["action"] == "B"

    # Verify indicators present in series items
    latest_pt = data["series"][-1]
    assert "sma" in latest_pt
    assert "ema" in latest_pt
    assert "bbUpper" in latest_pt
    assert "rsi" in latest_pt
    assert "macd" in latest_pt


def test_macroeconomics_endpoint(client: TestClient) -> None:
    """Verify macroeconomics endpoint returns Treasury yield curve and key macro data."""
    resp = client.get("/api/v1/research/macroeconomics")
    assert resp.status_code == 200
    data = resp.json()

    assert "yieldCurve" in data
    assert len(data["yieldCurve"]) >= 10
    maturities = [pt["maturity"] for pt in data["yieldCurve"]]
    assert "10Y" in maturities
    assert "2Y" in maturities

    assert "macroIndicators" in data
    assert "fxCrosses" in data


def test_sectors_endpoint(client: TestClient) -> None:
    """Verify 11 GICS sector performance returns correct sectors and weighting."""
    resp = client.get("/api/v1/research/sectors?horizon=1M")
    assert resp.status_code == 200
    data = resp.json()

    assert data["horizon"] == "1M"
    assert "sectors" in data
    assert len(data["sectors"]) == 11

    # Check top sectors like Information Technology (XLK)
    tickers = [s["ticker"] for s in data["sectors"]]
    assert "XLK" in tickers
    assert "XLF" in tickers
    assert "XLE" in tickers


def test_watchlist_items_crud(client: TestClient, db_session: Session) -> None:
    """Verify Watchlist enriched items listing, adding, and deletion."""
    # Seed Watchlist ticker
    wl = Watchlist(
        user_id=1,
        watchlistname="Default",
        symbol="NVDA",
        name="NVIDIA Corporation",
        currency="USD",
        timezone="America/New_York",
    )
    db_session.add(wl)
    db_session.commit()

    # GET /items
    resp = client.get("/api/v1/watchlist/items?watchlistName=Default")
    assert resp.status_code == 200
    items = resp.json()
    assert any(i["symbol"] == "NVDA" for i in items)

    # POST /items
    add_resp = client.post(
        "/api/v1/watchlist/items",
        json={"symbol": "TSLA", "name": "Tesla Inc", "watchlistname": "Default"},
    )
    assert add_resp.status_code == 200
    created = add_resp.json()
    assert created["status"] == "success"
    assert created["item"]["symbol"] == "TSLA"

    # DELETE /items/{symbol}
    del_resp = client.delete("/api/v1/watchlist/items/TSLA?watchlistName=Default")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"
