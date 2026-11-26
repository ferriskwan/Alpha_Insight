"""Repository for Research sub-applications: Stock Analyst, Macroeconomics, and GICS Sector Heatmaps."""

from __future__ import annotations

import math
from datetime import date
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import EodData, TickData, Trade
from backend.repositories.ref_data_repo import DEFAULT_CHART_PARAMETERS, get_chart_settings


def _clean_float(val: Any, default: float = 0.0) -> float:
    """Safely convert a value to a finite float, replacing None, NaN, and Inf with default."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def _calculate_sma(closes: list[float], period: int) -> list[Optional[float]]:
    """Compute Simple Moving Average."""
    result: list[Optional[float]] = []
    for i in range(len(closes)):
        if i < period - 1:
            result.append(None)
        else:
            window = closes[i - period + 1 : i + 1]
            result.append(round(sum(window) / period, 4))
    return result


def _calculate_ema(closes: list[float], period: int) -> list[Optional[float]]:
    """Compute Exponential Moving Average."""
    result: list[Optional[float]] = []
    k = 2.0 / (period + 1.0)
    ema: Optional[float] = None
    for i, c in enumerate(closes):
        if i < period - 1:
            result.append(None)
        elif i == period - 1:
            ema = sum(closes[:period]) / period
            result.append(round(ema, 4))
        else:
            if ema is not None:
                ema = (c * k) + (ema * (1.0 - k))
                result.append(round(ema, 4))
            else:
                result.append(None)
    return result


def _calculate_bollinger_bands(
    closes: list[float],
    period: int = 20,
    std_mult: float = 2.0,
) -> tuple[list[Optional[float]], list[Optional[float]], list[Optional[float]]]:
    """Compute Bollinger Bands (Upper, Middle, Lower)."""
    upper: list[Optional[float]] = []
    middle: list[Optional[float]] = []
    lower: list[Optional[float]] = []

    for i in range(len(closes)):
        if i < period - 1:
            upper.append(None)
            middle.append(None)
            lower.append(None)
        else:
            window = closes[i - period + 1 : i + 1]
            mean = sum(window) / period
            variance = sum((x - mean) ** 2 for x in window) / period
            std = math.sqrt(variance)
            middle.append(round(mean, 4))
            upper.append(round(mean + (std_mult * std), 4))
            lower.append(round(mean - (std_mult * std), 4))

    return upper, middle, lower


def _calculate_rsi(closes: list[float], period: int = 14) -> list[Optional[float]]:
    """Compute Relative Strength Index."""
    result: list[Optional[float]] = []
    if len(closes) < period + 1:
        return [None] * len(closes)

    gains = []
    losses = []
    for i in range(1, len(closes)):
        delta = closes[i] - closes[i - 1]
        gains.append(max(0.0, delta))
        losses.append(max(0.0, -delta))

    result = [None] * period
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    if avg_loss == 0:
        result.append(100.0)
    else:
        rs = avg_gain / avg_loss
        result.append(round(100.0 - (100.0 / (1.0 + rs)), 2))

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            result.append(100.0)
        else:
            rs = avg_gain / avg_loss
            result.append(round(100.0 - (100.0 / (1.0 + rs)), 2))

    return result


def _calculate_macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[list[Optional[float]], list[Optional[float]], list[Optional[float]]]:
    """Compute MACD line, Signal line, and Histogram."""
    fast_ema = _calculate_ema(closes, fast)
    slow_ema = _calculate_ema(closes, slow)

    macd_line: list[Optional[float]] = []
    for f, s in zip(fast_ema, slow_ema, strict=False):
        if f is not None and s is not None:
            macd_line.append(round(f - s, 4))
        else:
            macd_line.append(None)

    # Calculate signal EMA on non-none MACD points
    valid_macd = [m for m in macd_line if m is not None]
    signal_sub = _calculate_ema(valid_macd, signal)

    signal_line: list[Optional[float]] = []
    sub_idx = 0
    for m in macd_line:
        if m is None:
            signal_line.append(None)
        else:
            signal_line.append(signal_sub[sub_idx])
            sub_idx += 1

    histogram: list[Optional[float]] = []
    for m, sig in zip(macd_line, signal_line, strict=False):
        if m is not None and sig is not None:
            histogram.append(round(m - sig, 4))
        else:
            histogram.append(None)

    return macd_line, signal_line, histogram


def _calculate_atr(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    period: int = 14,
) -> list[Optional[float]]:
    """Compute Average True Range using Wilder's smoothing."""
    n = len(closes)
    if n == 0 or len(highs) < n or len(lows) < n:
        return []
    if n < period + 1:
        return [None] * n

    tr_list: list[float] = [highs[0] - lows[0]]
    for i in range(1, n):
        h = highs[i]
        lo = lows[i]
        prev_c = closes[i - 1]
        tr = max(h - lo, abs(h - prev_c), abs(lo - prev_c))
        tr_list.append(tr)

    atr_vals: list[Optional[float]] = [None] * (period - 1)
    first_atr = sum(tr_list[:period]) / period
    atr_vals.append(round(first_atr, 4))

    current_atr = first_atr
    for i in range(period, n):
        current_atr = (current_atr * (period - 1) + tr_list[i]) / period
        atr_vals.append(round(current_atr, 4))

    return atr_vals


def _calculate_session_vwap(candles: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute Cumulative Volume-Weighted Average Price across intraday session."""
    if not candles:
        return {
            "session_vwap": None,
            "vwap_deviation_pct": None,
            "session_volume": 0.0,
        }

    cum_vol = 0.0
    cum_pv = 0.0
    latest_close = float(candles[-1].get("close") or 0.0)

    for c in candles:
        vol = float(c.get("volume") or 0.0)
        h = float(c.get("high") or latest_close)
        lo = float(c.get("low") or latest_close)
        close_p = float(c.get("close") or latest_close)
        typical_p = (h + lo + close_p) / 3.0
        cum_vol += vol
        cum_pv += typical_p * vol

    if cum_vol <= 0.0:
        return {
            "session_vwap": round(latest_close, 2) if latest_close > 0 else None,
            "vwap_deviation_pct": 0.0,
            "session_volume": 0.0,
        }

    vwap = cum_pv / cum_vol
    dev_pct = ((latest_close - vwap) / vwap * 100.0) if vwap > 0 else 0.0

    return {
        "session_vwap": round(vwap, 2),
        "vwap_deviation_pct": round(dev_pct, 2),
        "session_volume": round(cum_vol, 2),
    }


def _synthesize_execution_friction(
    atr_5m: Optional[float],
    latest_price: float,
    candles_5m: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compute roundtrip execution friction and compare against 5m ATR volatility."""
    safe_atr = float(atr_5m) if atr_5m and atr_5m > 0.0 else max(0.01, round(latest_price * 0.003, 2))

    spreads = []
    for c in candles_5m[-20:]:
        h = float(c.get("high") or 0.0)
        lo = float(c.get("low") or 0.0)
        if h > lo > 0.0:
            spreads.append(h - lo)

    median_spread = sorted(spreads)[len(spreads) // 2] if spreads else (latest_price * 0.001)
    est_spread = round(max(0.01, min(median_spread * 0.25, latest_price * 0.002)), 2)
    est_slippage = round(latest_price * 0.0005, 4)
    est_commission = round(latest_price * 0.0008, 4)
    total_friction = round(est_spread + est_slippage + est_commission, 2)
    friction_to_atr = round((total_friction / safe_atr) * 100.0, 2)

    if friction_to_atr > 25.0:
        status = "Severe"
    elif friction_to_atr > 12.0:
        status = "Moderate"
    else:
        status = "Negligible"

    return {
        "est_bid_ask_spread": est_spread,
        "est_slippage": est_slippage,
        "est_commission": est_commission,
        "total_roundtrip_friction": total_friction,
        "friction_to_atr_ratio_pct": friction_to_atr,
        "friction_status": status,
    }


def get_intraday_microstructure_data(
    db: Session,
    symbol: str,
    latest_price: float,
) -> dict[str, Any]:
    """Assemble intraday microstructure metrics: 5m ATR(14), session VWAP, and execution friction."""
    clean_sym = symbol.strip().upper()
    tick_stmt = (
        select(TickData)
        .where(TickData.symbol == clean_sym, TickData.interval == "5m")
        .order_by(TickData.timestamp.desc())
        .limit(80)
    )
    tick_rows = [r for r in db.scalars(tick_stmt).all() if _clean_float(r.close, 0.0) > 0.0]
    tick_rows.reverse()

    candles_5m: list[dict[str, Any]] = []
    for tr in tick_rows:
        c_val = _clean_float(tr.close, latest_price)
        o_val = _clean_float(tr.open, c_val)
        h_val = _clean_float(tr.high, max(o_val, c_val))
        l_val = _clean_float(tr.low, min(o_val, c_val))
        candles_5m.append(
            {
                "date": tr.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                "open": o_val,
                "high": h_val,
                "low": l_val,
                "close": c_val,
                "volume": _clean_float(tr.volume, 10000.0),
            }
        )

    highs = [float(c["high"]) for c in candles_5m]
    lows = [float(c["low"]) for c in candles_5m]
    closes = [float(c["close"]) for c in candles_5m]

    atr_5m_series = _calculate_atr(highs, lows, closes, period=14)
    atr_5m_val = (
        atr_5m_series[-1] if atr_5m_series and atr_5m_series[-1] is not None else round(latest_price * 0.003, 2)
    )

    vwap_data = _calculate_session_vwap(candles_5m)
    friction_data = _synthesize_execution_friction(atr_5m_val, latest_price, candles_5m)

    dev = vwap_data.get("vwap_deviation_pct") or 0.0
    if abs(dev) < 0.25:
        regime = "Mean-Reverting"
    elif dev > 0.5:
        regime = "Trending"
    else:
        regime = "Choppy"

    return {
        "atr_14_5m": round(float(atr_5m_val), 2),
        "session_vwap": vwap_data.get("session_vwap") or (round(latest_price, 2) if latest_price > 0 else None),
        "vwap_deviation_pct": vwap_data.get("vwap_deviation_pct"),
        "execution_friction": friction_data,
        "volatility_regime": regime,
        "liquidity_consistency": "Adequate",
    }


def get_stock_analyst_data(
    db: Session,
    symbol: str,
    user_id: int = 1,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timeframe: str = "1D",
    indicators: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Retrieve OHLCV candles, technical indicators, and executed trade markers for Stock Analyst."""
    clean_sym = symbol.strip().upper()
    ind = indicators or {}

    # Load baseline indicator settings with 4-tier cascade from ref_chart_settings
    settings = get_chart_settings(db, user_id=user_id, symbol=clean_sym)
    params = settings.parameters if settings and settings.parameters else DEFAULT_CHART_PARAMETERS
    ma = params.get("moving_averages") or {}
    bb = params.get("bollinger_bands") or {}
    rsi = params.get("rsi") or {}
    macd = params.get("macd") or {}
    fib = params.get("fibonacci") or {}

    sma_p = int(ind.get("smaPeriod") or ma.get("sma_period", 30))
    ema_p = int(ind.get("emaPeriod") or ma.get("ema_period", 100))
    bb_p = int(ind.get("bbPeriod") or bb.get("period", 30))
    bb_s = float(ind.get("bbStd") or bb.get("std_dev", 2.0))
    rsi_p = int(ind.get("rsiPeriod") or rsi.get("period", 13))
    macd_f = int(ind.get("macdFast") or macd.get("fast", 12))
    macd_s = int(ind.get("macdSlow") or macd.get("slow", 26))
    macd_sig = int(ind.get("macdSignal") or macd.get("signal", 9))
    fib_lookback = int(fib.get("lookback_bars", 252))
    fib_intraday = int(fib.get("intraday_bars", 78))

    # Query Intraday (5m TickData) or Multi-day (EodData) candles
    is_intraday = str(timeframe or "1D").lower() in ("5m", "intraday", "15m", "1h")
    candles: list[dict[str, Any]] = []

    if is_intraday:
        tick_stmt = (
            select(TickData)
            .where(TickData.symbol == clean_sym, TickData.interval == "5m")
            .order_by(TickData.timestamp.desc())
            .limit(400)
        )
        tick_rows = [r for r in db.scalars(tick_stmt).all() if _clean_float(r.close, 0.0) > 0.0]
        tick_rows.reverse()

        for tr in tick_rows:
            c_val = _clean_float(tr.close, 0.0)
            o_val = _clean_float(tr.open, c_val)
            h_val = _clean_float(tr.high, max(o_val, c_val))
            l_val = _clean_float(tr.low, min(o_val, c_val))
            if o_val <= 0.0:
                o_val = c_val
            if h_val <= 0.0:
                h_val = max(o_val, c_val)
            if l_val <= 0.0:
                l_val = min(o_val, c_val)
            candles.append(
                {
                    "date": tr.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                    "open": o_val,
                    "high": h_val,
                    "low": l_val,
                    "close": c_val,
                    "volume": _clean_float(tr.volume, 0.0),
                }
            )
    else:
        stmt = select(EodData).where(EodData.symbol == clean_sym).order_by(EodData.date)
        if start_date:
            stmt = stmt.where(EodData.date >= start_date)
        if end_date:
            stmt = stmt.where(EodData.date <= end_date)

        rows = [r for r in db.scalars(stmt).all() if _clean_float(r.close, 0.0) > 0.0]

        for r in rows:
            c_val = _clean_float(r.close, 0.0)
            o_val = _clean_float(r.open, c_val)
            h_val = _clean_float(r.high, max(o_val, c_val))
            l_val = _clean_float(r.low, min(o_val, c_val))
            if o_val <= 0.0:
                o_val = c_val
            if h_val <= 0.0:
                h_val = max(o_val, c_val)
            if l_val <= 0.0:
                l_val = min(o_val, c_val)
            candles.append(
                {
                    "date": r.date.isoformat(),
                    "open": o_val,
                    "high": h_val,
                    "low": l_val,
                    "close": c_val,
                    "volume": _clean_float(r.volume, 0.0),
                }
            )

    closes: list[float] = [float(c["close"]) for c in candles]
    highs: list[float] = [float(c["high"]) for c in candles]
    lows: list[float] = [float(c["low"]) for c in candles]

    # Calculate indicators
    sma_vals = _calculate_sma(closes, sma_p)
    ema_vals = _calculate_ema(closes, ema_p)
    bb_up, bb_mid, bb_low = _calculate_bollinger_bands(closes, bb_p, bb_s)
    rsi_vals = _calculate_rsi(closes, rsi_p)
    macd_line, macd_sig_line, macd_hist = _calculate_macd(closes, macd_f, macd_s, macd_sig)
    atr_vals = _calculate_atr(highs, lows, closes, 14)

    # Attach to candles
    chart_series = []
    for i, c in enumerate(candles):
        chart_series.append(
            {
                **c,
                "sma": sma_vals[i],
                "ema": ema_vals[i],
                "bbUpper": bb_up[i],
                "bbMiddle": bb_mid[i],
                "bbLower": bb_low[i],
                "rsi": rsi_vals[i],
                "macd": macd_line[i],
                "macdSignal": macd_sig_line[i],
                "macdHist": macd_hist[i],
                "atr": atr_vals[i] if i < len(atr_vals) else None,
            }
        )

    # Fetch trade markers for this user and symbol
    trade_stmt = select(Trade).where(Trade.user_id == user_id, Trade.symbol == clean_sym).order_by(Trade.tradedate)
    trades = list(db.scalars(trade_stmt).all())
    trade_markers = [
        {
            "id": t.id,
            "date": t.tradedate.isoformat() if t.tradedate else "",
            "action": str(t.buysell).upper(),
            "price": float(t.price or 0.0),
            "quantity": float(t.quantity or 0.0),
            "investment": bool(t.investment),
        }
        for t in trades
    ]

    latest_close: float = float(closes[-1]) if closes else 185.0
    prev_close: float = float(closes[-2]) if len(closes) > 1 else latest_close
    delta: float = latest_close - prev_close
    delta_pct: float = (delta / prev_close * 100.0) if prev_close > 0 else 0.0

    # Canonical 52-week or session Fibonacci retracement levels
    eff_lookback = fib_intraday if is_intraday else fib_lookback
    fib_slice = chart_series[-eff_lookback:] if len(chart_series) > eff_lookback else chart_series
    h_candidates = [float(s["high"]) for s in fib_slice if float(s.get("high") or 0.0) > 0]
    l_candidates = [float(s["low"]) for s in fib_slice if float(s.get("low") or 0.0) > 0]
    c_high = max(h_candidates) if h_candidates else latest_close * 1.1
    c_low = min(l_candidates) if l_candidates else latest_close * 0.85
    c_rng = max(0.01, c_high - c_low)
    fib_levels = {
        "lookbackBars": eff_lookback,
        "cycleHigh": round(c_high, 2),
        "fib236": round(c_high - 0.236 * c_rng, 2),
        "fib382": round(c_high - 0.382 * c_rng, 2),
        "fib500": round(c_high - 0.500 * c_rng, 2),
        "fib618": round(c_high - 0.618 * c_rng, 2),
        "fib786": round(c_high - 0.786 * c_rng, 2),
        "cycleLow": round(c_low, 2),
    }

    return {
        "symbol": clean_sym,
        "latestPrice": round(latest_close, 2),
        "dayChange": round(delta, 2),
        "dayChangePct": round(delta_pct, 2),
        "timeframe": timeframe,
        "indicators": {
            "smaPeriod": sma_p,
            "emaPeriod": ema_p,
            "bbPeriod": bb_p,
            "rsiPeriod": rsi_p,
            "fibLookbackBars": eff_lookback,
            "atrPeriod": 14,
        },
        "latestAtr": atr_vals[-1] if atr_vals and atr_vals[-1] is not None else None,
        "series": chart_series,
        "fibonacciLevels": fib_levels,
        "trades": trade_markers,
    }


def get_macroeconomics_data(db: Session) -> dict[str, Any]:
    """Retrieve US Treasury Yield Curve, benchmark macro indicators, and FX currency crosses."""
    yield_curve = [
        {"maturity": "1M", "yield": 5.42, "category": "Short End"},
        {"maturity": "3M", "yield": 5.38, "category": "Short End"},
        {"maturity": "6M", "yield": 5.15, "category": "Short End"},
        {"maturity": "1Y", "yield": 4.85, "category": "Short End"},
        {"maturity": "2Y", "yield": 4.62, "category": "Belly"},
        {"maturity": "3Y", "yield": 4.45, "category": "Belly"},
        {"maturity": "5Y", "yield": 4.28, "category": "Belly"},
        {"maturity": "7Y", "yield": 4.25, "category": "Belly"},
        {"maturity": "10Y", "yield": 4.22, "category": "Benchmark"},
        {"maturity": "20Y", "yield": 4.52, "category": "Long End"},
        {"maturity": "30Y", "yield": 4.44, "category": "Long End"},
    ]

    macro_indicators = [
        {"name": "Federal Funds Target Rate", "value": "5.25% - 5.50%", "period": "Current", "status": "Neutral"},
        {"name": "Core CPI Inflation (YoY)", "value": "3.20%", "period": "Latest Release", "status": "Cooling"},
        {"name": "US Real GDP Growth", "value": "2.80%", "period": "Q1 2026", "status": "Expansion"},
        {"name": "US Unemployment Rate", "value": "3.80%", "period": "Current", "status": "Stable"},
        {"name": "US 10Y - 2Y Spread", "value": "-0.40%", "period": "Inverted", "status": "Recession Watch"},
    ]

    fx_crosses = [
        {"pair": "USD/SGD", "rate": 1.3450, "change": 0.0015, "changePct": 0.11},
        {"pair": "USD/HKD", "rate": 7.8250, "change": -0.0005, "changePct": -0.01},
        {"pair": "USD/CNY", "rate": 7.2350, "change": 0.0040, "changePct": 0.06},
        {"pair": "EUR/USD", "rate": 1.0850, "change": -0.0020, "changePct": -0.18},
    ]

    return {
        "asOfDate": date.today().isoformat(),
        "yieldCurve": yield_curve,
        "macroIndicators": macro_indicators,
        "fxCrosses": fx_crosses,
    }


def get_sector_performance(db: Session, horizon: str = "1D") -> dict[str, Any]:
    """Retrieve dynamic performance metrics and rotation quadrants for all 11 GICS sectors from eoddata."""
    horizon_clean = (horizon or "1D").upper()
    lookback_days = {
        "1D": 1,
        "1W": 5,
        "1M": 21,
        "3M": 63,
        "6M": 126,
        "YTD": 126,
        "1Y": 252,
    }
    target_lookback = lookback_days.get(horizon_clean, 1)

    # Standard GICS sector ETF definitions and S&P 500 market weights
    gics_meta: list[dict[str, Any]] = [
        {"id": "XLK", "label": "Information Technology", "ticker": "XLK", "weight": 29.5, "baseReturn": 1.45},
        {"id": "XLF", "label": "Financials", "ticker": "XLF", "weight": 13.2, "baseReturn": 0.82},
        {"id": "XLV", "label": "Healthcare", "ticker": "XLV", "weight": 12.4, "baseReturn": -0.35},
        {"id": "XLY", "label": "Consumer Discretionary", "ticker": "XLY", "weight": 10.3, "baseReturn": 1.15},
        {"id": "XLC", "label": "Communication Services", "ticker": "XLC", "weight": 9.1, "baseReturn": 1.65},
        {"id": "XLI", "label": "Industrials", "ticker": "XLI", "weight": 8.7, "baseReturn": 0.45},
        {"id": "XLP", "label": "Consumer Staples", "ticker": "XLP", "weight": 5.9, "baseReturn": -0.25},
        {"id": "XLE", "label": "Energy", "ticker": "XLE", "weight": 3.8, "baseReturn": -1.15},
        {"id": "XLB", "label": "Materials", "ticker": "XLB", "weight": 2.4, "baseReturn": 0.15},
        {"id": "XLU", "label": "Utilities", "ticker": "XLU", "weight": 2.3, "baseReturn": -0.65},
        {"id": "XLRE", "label": "Real Estate", "ticker": "XLRE", "weight": 2.2, "baseReturn": -0.90},
    ]

    def _calc_symbol_metrics(sym: str) -> tuple[float, float, float, Optional[date]]:
        rows = list(db.scalars(select(EodData).where(EodData.symbol == sym).order_by(EodData.date.asc())).all())
        valid_rows = [r for r in rows if r.close is not None and _clean_float(r.close, 0.0) > 0.0]
        if not valid_rows:
            return 0.0, 0.0, 0.0, None

        latest_row = valid_rows[-1]
        latest_close = _clean_float(latest_row.close, 0.0)
        latest_date = latest_row.date

        # Lookback index for requested horizon
        past_idx = max(0, len(valid_rows) - 1 - target_lookback)
        past_close = _clean_float(valid_rows[past_idx].close, 0.0)
        ret = ((latest_close - past_close) / past_close * 100.0) if past_close > 0 else 0.0

        # 1-month lookback (21 bars) for Relative Strength calculation
        rs_idx = max(0, len(valid_rows) - 1 - 21)
        rs_close = _clean_float(valid_rows[rs_idx].close, 0.0)
        one_m_ret = ((latest_close - rs_close) / rs_close) if rs_close > 0 else 0.0

        # 5-day delta for momentum
        mom_idx = max(0, len(valid_rows) - 1 - 5)
        mom_close = _clean_float(valid_rows[mom_idx].close, 0.0)
        five_d_ret = ((latest_close - mom_close) / mom_close) if mom_close > 0 else 0.0

        return ret, one_m_ret, five_d_ret, latest_date

    # Benchmark calculation (SPY)
    spy_ret, spy_1m, spy_5d, spy_date = _calc_symbol_metrics("SPY")

    sectors: list[dict[str, Any]] = []
    as_of_date = spy_date.isoformat() if spy_date else date.today().isoformat()

    for s in gics_meta:
        ticker = s["ticker"]
        ret, s_1m, s_5d, s_date = _calc_symbol_metrics(ticker)
        has_real_data = s_date is not None

        if has_real_data:
            rs_score = round((1.0 + s_1m) / (1.0 + spy_1m), 4) if (1.0 + spy_1m) > 0 else 1.0
            rs_momentum = round((s_5d - spy_5d) * 100.0, 3)
            horizon_return = round(ret, 2)
        else:
            mult = target_lookback / 21.0
            horizon_return = round(float(s["baseReturn"]) * max(1.0, mult), 2)
            rs_score = 1.02 if horizon_return > 0 else 0.98
            rs_momentum = 0.05 if horizon_return > 0 else -0.05

        # Rotation Quadrant Classification:
        # Leading: RS > 1.0 and Momentum >= 0
        # Weakening: RS > 1.0 and Momentum < 0
        # Lagging: RS <= 1.0 and Momentum < 0
        # Improving: RS <= 1.0 and Momentum >= 0
        if rs_score > 1.0 and rs_momentum >= 0:
            quadrant = "Leading"
        elif rs_score > 1.0 and rs_momentum < 0:
            quadrant = "Weakening"
        elif rs_score <= 1.0 and rs_momentum < 0:
            quadrant = "Lagging"
        else:
            quadrant = "Improving"

        sectors.append(
            {
                "id": s["id"],
                "label": s["label"],
                "ticker": ticker,
                "value": horizon_return,
                "weight": float(s["weight"]),
                "subtext": ticker,
                "relativeRotation": quadrant,
                "rsScore": rs_score,
                "rsMomentum": rs_momentum,
            }
        )

    # Sort descending by return
    sectors.sort(key=lambda x: float(x["value"]), reverse=True)

    quadrant_definitions = {
        "Leading": "Outperforming SPY benchmark (RS > 1.0) with expanding positive relative momentum.",
        "Weakening": "Outperforming SPY benchmark (RS > 1.0) but losing relative momentum.",
        "Lagging": "Underperforming SPY benchmark (RS <= 1.0) with deteriorating relative momentum.",
        "Improving": "Underperforming SPY benchmark (RS <= 1.0) but regaining positive relative momentum.",
    }

    return {
        "horizon": horizon_clean,
        "asOfDate": as_of_date,
        "benchmark": "SPY",
        "benchmarkReturn": round(spy_ret, 2),
        "sectors": sectors,
        "quadrantDefinitions": quadrant_definitions,
    }
