"""Market data ingestion functions for Twelve Data and Yahoo Finance."""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests
import yfinance as yf

from backend.config import get_settings

logger = logging.getLogger(__name__)


def pulldata_twelvedata(
    symbol: str,
    interval: str,
    startdate: str,
    enddate: str,
) -> Optional[dict[str, Any]]:
    """Fetch market data from Twelve Data API using centralized settings."""
    settings = get_settings()
    api_key = settings.twelvedata_api_key

    if not api_key:
        logger.error("[marketdata.py].pulldata_twelvedata(): TWELVEDATA_API_KEY not configured")
        return None

    try:
        response = requests.get(
            settings.twelvedata_base_url,
            params={
                "apikey": api_key,
                "symbol": symbol,
                "interval": interval,
                "start_date": startdate,
                "end_date": enddate,
                "format": "JSON",
            },
            timeout=30,
        )
        logger.debug("[marketdata.py].pulldata_twelvedata(): Fetching data for %s", symbol)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error("[marketdata.py].pulldata_twelvedata(): Error fetching data for %s: %s", symbol, e)
        return None


def pulldata_yahoo(
    symbol: str,
    interval: str,
    startdate: str,
    enddate: str,
) -> Optional[dict[str, Any]]:
    """Fetch market data from Yahoo Finance."""
    clean_start = str(startdate).split("T")[0].split(" ")[0].strip()
    clean_end = str(enddate).split("T")[0].split(" ")[0].strip()
    try:
        data = yf.download(
            symbol,
            start=clean_start,
            end=clean_end,
            interval=interval,
            multi_level_index=False,
            progress=False,
        )
        logger.debug("[marketdata.py].pulldata_yahoo(): Fetching data for %s", symbol)

        output: dict[str, Any] = {
            "meta": {
                "symbol": symbol,
                "interval": interval,
                "start_date": clean_start,
                "end_date": clean_end,
            }
        }

        values = []
        for index, row in data.iterrows():
            values.append(
                {
                    "datetime": index.strftime("%Y-%m-%d" if interval.endswith("d") else "%Y-%m-%d %H:%M:%S"),
                    "open": str(row["Open"]),
                    "high": str(row["High"]),
                    "low": str(row["Low"]),
                    "close": str(row["Close"]),
                    "volume": str(row["Volume"]),
                }
            )
        output["values"] = values
        if not values:
            try:
                from datetime import datetime as dt_cls
                from datetime import timezone

                from curl_cffi import requests as cffi_requests

                p1 = int(dt_cls.strptime(clean_start, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
                p2 = int(dt_cls.strptime(clean_end, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
                chart_url = (
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
                    f"?period1={p1}&period2={p2}&interval={interval}"
                )
                resp = cffi_requests.get(chart_url, impersonate="chrome", verify=False, timeout=30)
                if resp.status_code == 200:
                    payload = resp.json().get("chart", {}).get("result", [{}])[0]
                    timestamps = payload.get("timestamp", [])
                    indicators = payload.get("indicators", {}).get("quote", [{}])[0]
                    opens = indicators.get("open", [])
                    highs = indicators.get("high", [])
                    lows = indicators.get("low", [])
                    closes = indicators.get("close", [])
                    volumes = indicators.get("volume", [])
                    fallback_vals = []
                    for i, ts in enumerate(timestamps):
                        c = closes[i] if i < len(closes) else None
                        if c is None:
                            continue
                        dt_str = dt_cls.fromtimestamp(ts, tz=timezone.utc).strftime(
                            "%Y-%m-%d" if interval.endswith("d") else "%Y-%m-%d %H:%M:%S"
                        )
                        fallback_vals.append(
                            {
                                "datetime": dt_str,
                                "open": str(opens[i] if i < len(opens) and opens[i] is not None else c),
                                "high": str(highs[i] if i < len(highs) and highs[i] is not None else c),
                                "low": str(lows[i] if i < len(lows) and lows[i] is not None else c),
                                "close": str(c),
                                "volume": str(volumes[i] if i < len(volumes) and volumes[i] is not None else 0),
                            }
                        )
                    output["values"] = fallback_vals
            except Exception as ex:
                logger.warning("[marketdata.py].pulldata_yahoo(): curl_cffi fallback warning: %s", ex)
        logger.debug(
            "[marketdata.py].pulldata_yahoo(): Successfully fetched data for %s, total records: %d",
            symbol,
            len(values),
        )
        return output
    except Exception as e:
        logger.error("[marketdata.py].pulldata_yahoo(): Error fetching data for %s: %s", symbol, e)
        return None
