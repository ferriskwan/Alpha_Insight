"""Execution runner for charting.py generating candlestick PNG screenshots."""

from __future__ import annotations

import base64
import json
import logging
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


def generate_candlestick_png(
    eod_data: dict[str, Any],
    trades: list[dict[str, Any]],
    zoom_start: Optional[str] = None,
    zoom_end: Optional[str] = None,
) -> Optional[str]:
    """Execute untouched charting.py in a dedicated subprocess to render candlestick PNG."""
    if not eod_data or not eod_data.get("values"):
        logger.warning("No EOD values provided for chart generation")
        return None

    # Locate untouched charting.py
    project_root = Path(__file__).resolve().parent.parent.parent
    charting_py = project_root / "charting.py"
    if not charting_py.exists():
        logger.error("charting.py not found at path: %s", charting_py)
        return None

    # Normalize values for charting.py expectations
    normalized_values = []
    for v in eod_data.get("values", []):
        ts = v.get("timestamp") or v.get("datetime") or v.get("date")
        close_val = v.get("close")
        if not ts or close_val is None:
            continue
        c_num = float(close_val)
        o_num = float(v["open"]) if v.get("open") is not None else c_num
        h_num = float(v["high"]) if v.get("high") is not None else max(o_num, c_num)
        l_num = float(v["low"]) if v.get("low") is not None else min(o_num, c_num)
        v_num = float(v["volume"]) if v.get("volume") is not None else 0.0
        normalized_values.append(
            {
                "timestamp": str(ts),
                "open": o_num,
                "high": h_num,
                "low": l_num,
                "close": c_num,
                "volume": v_num,
            }
        )

    if not normalized_values:
        logger.warning("No valid OHLCV records normalized for charting")
        return None

    sanitized_trades = []
    for t in trades or []:
        if not t.get("tradedate"):
            continue
        sanitized_trades.append(
            {
                **t,
                "price": float(t["price"]) if t.get("price") is not None else None,
                "quantity": float(t["quantity"]) if t.get("quantity") is not None else 0.0,
            }
        )

    meta = dict(eod_data.get("meta", {}))
    meta.setdefault("interval", "1d")
    meta.setdefault("symbol", "UNKNOWN")

    chart_payload = {
        "meta": meta,
        "values": normalized_values,
        "trades": sanitized_trades,
    }

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            json_file = tmp_path / "input.json"
            png_file = tmp_path / "output.png"

            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(chart_payload, f)

            cmd = [
                sys.executable,
                str(charting_py),
                "candlestick",
                str(json_file),
                str(png_file),
            ]
            if zoom_start:
                cmd.extend(["--zoom-start", zoom_start])
            if zoom_end:
                cmd.extend(["--zoom-end", zoom_end])

            sub_env = os.environ.copy()
            sub_env["MPLBACKEND"] = "Agg"
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=45,
                env=sub_env,
            )

            if result.returncode != 0 or not png_file.exists():
                logger.error(
                    "charting.py execution failed (exit code %d): stderr=%s, stdout=%s",
                    result.returncode,
                    result.stderr,
                    result.stdout,
                )
                return None

            png_bytes = png_file.read_bytes()
            b64_str = base64.b64encode(png_bytes).decode("ascii")
            return f"data:image/png;base64,{b64_str}"

    except Exception as exc:
        logger.error("Exception occurred while generating candlestick chart: %s", exc, exc_info=True)
        return None
