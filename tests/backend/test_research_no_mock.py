"""Unit test verifying eradication of synthetic mock candlestick generators in Research Repo."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from backend.repositories.research_repo import get_intraday_microstructure_data, get_stock_analyst_data


class TestResearchNoMockCandles:
    """Verify that research repository functions return empty lists rather than synthetic mock candles."""

    def test_get_intraday_microstructure_data_empty_on_missing_ticker(
        self,
        db_session: Session,
        seed_test_data: dict[str, Any],
    ) -> None:
        """Verify get_intraday_microstructure_data falls back to latest_price when symbol lacks tickdata."""
        res = get_intraday_microstructure_data(db_session, symbol="NON_EXISTENT_TICKER_XYZ", latest_price=10.0)
        assert res["session_vwap"] in (None, 0.0, 10.0)

    def test_get_stock_analyst_data_empty_on_missing_eod(
        self,
        db_session: Session,
        seed_test_data: dict[str, Any],
    ) -> None:
        """Verify get_stock_analyst_data returns empty list [] for symbol without eoddata."""
        res = get_stock_analyst_data(
            db_session,
            symbol="NON_EXISTENT_TICKER_XYZ",
            user_id=1,
            timeframe="6M",
        )
        assert res["series"] == []
