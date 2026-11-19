"""UAT-004: Verification tests for Untouched charting.py Execution Service."""

from __future__ import annotations

import base64
import hashlib
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest

from backend.services.chart_runner import generate_candlestick_png

PNG_MAGIC_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _compute_sha256(file_path: Path) -> str:
    """Compute the SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


@pytest.fixture
def synthetic_40day_ohlcv() -> dict[str, Any]:
    """Generate 40 consecutive days of synthetic OHLCV data."""
    start_date = date(2026, 1, 1)
    values = []
    base_price = 150.0

    for i in range(40):
        current_date = start_date + timedelta(days=i)
        values.append(
            {
                "datetime": current_date.isoformat(),
                "open": base_price + (i * 0.2),
                "high": base_price + (i * 0.2) + 2.5,
                "low": base_price + (i * 0.2) - 1.5,
                "close": base_price + (i * 0.2) + 1.0,
                "volume": 1_000_000.0 + (i * 10_000),
            }
        )

    return {
        "meta": {
            "symbol": "AAPL",
            "interval": "1d",
            "timezone": "America/New_York",
            "currency": "USD",
        },
        "values": values,
    }


@pytest.fixture
def sample_trades() -> list[dict[str, Any]]:
    """Sample buy and sell trades."""
    return [
        {
            "symbol": "AAPL",
            "buysell": "B",
            "tradedate": "2026-01-10T10:00:00",
            "investment": True,
            "price": 152.0,
            "quantity": 50,
            "remarks": "Initial buy",
        },
        {
            "symbol": "AAPL",
            "buysell": "S",
            "tradedate": "2026-01-25T14:30:00",
            "investment": True,
            "price": 158.0,
            "quantity": 25,
            "remarks": "Partial profit",
        },
    ]


class TestChartRunnerUAT004:
    """UAT-004 Test Suite validating chart_runner subprocess invocation and base64 PNG rendering."""

    CHARTING_PY_PATH = Path("C:/Users/ferri/devt/Alpha_Insight/charting.py")

    def test_generate_candlestick_png_valid_output(
        self,
        synthetic_40day_ohlcv: dict[str, Any],
        sample_trades: list[dict[str, Any]],
    ) -> None:
        """Verify generate_candlestick_png outputs a valid base64 data URI with PNG signature."""
        initial_hash = _compute_sha256(self.CHARTING_PY_PATH)

        data_uri = generate_candlestick_png(synthetic_40day_ohlcv, sample_trades)

        assert data_uri is not None, "Chart generator should return data URI string"
        assert data_uri.startswith("data:image/png;base64,"), (
            f"Expected data:image/png;base64, prefix, got {data_uri[:30]}"
        )

        b64_payload = data_uri.removeprefix("data:image/png;base64,")
        png_bytes = base64.b64decode(b64_payload)

        # Verify standard 8-byte PNG signature
        assert png_bytes[:8] == PNG_MAGIC_SIGNATURE, (
            f"Decoded bytes do not match PNG magic signature: {png_bytes[:8]!r}"
        )
        assert len(png_bytes) > 10_000, f"Rendered PNG image too small ({len(png_bytes)} bytes)"

        # Verify charting.py remains completely untouched on disk
        post_run_hash = _compute_sha256(self.CHARTING_PY_PATH)
        assert initial_hash == post_run_hash, "charting.py was mutated during execution!"

    def test_generate_candlestick_png_with_zoom_window(
        self,
        synthetic_40day_ohlcv: dict[str, Any],
        sample_trades: list[dict[str, Any]],
    ) -> None:
        """Verify generate_candlestick_png accepts optional zoom_start and zoom_end arguments."""
        data_uri = generate_candlestick_png(
            eod_data=synthetic_40day_ohlcv,
            trades=sample_trades,
            zoom_start="2026-01-05",
            zoom_end="2026-01-25",
        )

        assert data_uri is not None
        assert data_uri.startswith("data:image/png;base64,")
        png_bytes = base64.b64decode(data_uri.removeprefix("data:image/png;base64,"))
        assert png_bytes[:8] == PNG_MAGIC_SIGNATURE

    def test_generate_candlestick_png_empty_inputs(self) -> None:
        """Verify graceful None handling when empty or invalid inputs are supplied."""
        assert generate_candlestick_png({}, []) is None
        assert generate_candlestick_png({"meta": {}, "values": []}, []) is None
        assert generate_candlestick_png({"meta": {}}, []) is None

    def test_generate_candlestick_png_no_trades(self, synthetic_40day_ohlcv: dict[str, Any]) -> None:
        """Verify chart renders cleanly when trade list is empty."""
        data_uri = generate_candlestick_png(synthetic_40day_ohlcv, [])
        assert data_uri is not None
        assert data_uri.startswith("data:image/png;base64,")
