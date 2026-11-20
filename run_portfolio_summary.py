#!/usr/bin/env python3
"""Module to calculate and store daily portfolio summary metrics.

Sequentially executed in main.py after run_daily_margin_interest.py.
"""

from __future__ import annotations

import logging
import math
import os
import sys
from datetime import date, timedelta
from typing import Generator, Optional

from dotenv import load_dotenv

from backend.config import get_settings

logger = logging.getLogger(__name__)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import ProcessData as pd  # noqa: E402


def date_range_list(start_d: date, end_d: date) -> Generator[date, None, None]:
    """Generate list of consecutive dates from start_d to end_d inclusive."""
    curr = start_d
    while curr <= end_d:
        yield curr
        curr += timedelta(days=1)


def run_portfolio_summary() -> None:
    """Consolidate daily equity, asset values, realized and unrealized PnL."""
    settings = get_settings()
    logger.info("[run_portfolio_summary.py]: Connecting to database...")
    conn = None
    cursor = None
    try:
        conn = pd.connect_clover()
        cursor = conn.cursor()
    except Exception as e:
        logger.error("[run_portfolio_summary.py]: Failed to connect to database: %s", e)
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        raise RuntimeError(f"Database connection failed: {e}")

    try:
        # Step 1: Synchronized date range determination
        start_date, end_date = pd.get_batch_refresh_date_range(conn)
        if start_date is None or end_date is None:
            logger.warning(
                "[run_portfolio_summary.py]: Could not determine valid start_date or end_date. Skipping calculation."
            )
            return

        if hasattr(start_date, "date"):
            start_date = start_date.date()
        if hasattr(end_date, "date"):
            end_date = end_date.date()

        logger.info(
            "[run_portfolio_summary.py]: Refreshing daily portfolio summary records from %s to %s...",
            start_date,
            end_date,
        )

        # Step 2: Delete stale records on or after start_date
        cursor.execute("DELETE FROM public.daily_portfolio_summary WHERE date >= %s", (start_date,))

        # Step 3: Fetch active users
        cursor.execute("SELECT DISTINCT id FROM public.users")
        user_ids = [r[0] for r in cursor.fetchall()]
        if not user_ids:
            cursor.execute("SELECT DISTINCT user_id FROM public.capital WHERE user_id IS NOT NULL")
            user_ids = [r[0] for r in cursor.fetchall()]

        # Step 4: Loop day by day
        for d in date_range_list(start_date, end_date):
            for uid in user_ids:
                summary_rows: dict[tuple[str, bool], dict[str, float]] = {}

                def get_bucket(c: Optional[str], i: bool) -> dict[str, float]:
                    cur = c or settings.default_currency_code
                    key = (cur, i)
                    if key not in summary_rows:
                        summary_rows[key] = {
                            "total_capital": 0.0,
                            "position_market_value": 0.0,
                            "realized_pnl": 0.0,
                            "unrealized_pnl": 0.0,
                            "margin_loan_balance": 0.0,
                            "daily_interest_accrued": 0.0,
                            "cumulative_interest_accrued": 0.0,
                        }
                    return summary_rows[key]

                # 1. Total Net Capital Injected up to date d
                cursor.execute(
                    """
                    SELECT currency, accounttype, COALESCE(SUM(amount), 0)
                    FROM public.capital
                    WHERE user_id = %s AND date <= %s
                    GROUP BY currency, accounttype
                    """,
                    (uid, d),
                )
                for c_curr, c_acct, c_amt in cursor.fetchall():
                    is_inv = True if c_acct == "C" else False
                    get_bucket(c_curr, is_inv)["total_capital"] += float(c_amt)

                # 2 & 4. Position Market Value and Unrealized PnL on date d
                cursor.execute(
                    """
                    WITH latest_pos AS (
                        SELECT symbol, MAX(tradedate) as max_date
                        FROM public.position
                        WHERE user_id = %s AND tradedate <= %s
                        GROUP BY symbol
                    )
                    SELECT w.currency, p.investment,
                           COALESCE(SUM(CASE WHEN p.eodprice::text != 'NaN'
                                             THEN p.quantity * p.eodprice ELSE 0 END), 0),
                           COALESCE(SUM(CASE WHEN p.eodprice::text != 'NaN' AND p.avgprice::text != 'NaN'
                                             THEN p.quantity * (p.eodprice - p.avgprice) ELSE 0 END), 0)
                    FROM public.position p
                    JOIN latest_pos lp ON p.symbol = lp.symbol AND p.tradedate = lp.max_date
                    LEFT JOIN public.watchlist w ON p.symbol = w.symbol
                    WHERE p.user_id = %s
                    GROUP BY w.currency, p.investment
                    """,
                    (uid, d, uid),
                )
                for p_curr, p_inv, pmv, upnl in cursor.fetchall():
                    b = get_bucket(p_curr, bool(p_inv))
                    pmv_clean = float(pmv) if pmv is not None and str(pmv).lower() != "nan" else 0.0
                    upnl_clean = float(upnl) if upnl is not None and str(upnl).lower() != "nan" else 0.0
                    b["position_market_value"] += pmv_clean
                    b["unrealized_pnl"] += upnl_clean

                # 3. Realized PnL from closed positions up to date d
                cursor.execute(
                    """
                    SELECT t.symbol, t.buysell, t.price, t.quantity, w.currency, t.investment
                    FROM public.trade t
                    LEFT JOIN public.watchlist w ON t.symbol = w.symbol
                    WHERE t.user_id = %s AND t.price IS NOT NULL AND t.quantity IS NOT NULL AND t.tradedate::date <= %s
                    ORDER BY t.symbol, t.tradedate ASC
                    """,
                    (uid, d),
                )

                trade_rows = cursor.fetchall()
                symbol_trades: dict[tuple[str, str, bool], dict[str, float]] = {}
                for sym, buysell, price, qty, t_curr, t_inv in trade_rows:
                    key = (sym, t_curr, bool(t_inv))
                    if key not in symbol_trades:
                        symbol_trades[key] = {
                            "buy_qty": 0.0,
                            "buy_notional": 0.0,
                            "sell_qty": 0.0,
                            "sell_notional": 0.0,
                        }
                    p = float(price or 0.0)
                    q = float(qty or 0.0)
                    if buysell == "B":
                        symbol_trades[key]["buy_qty"] += q
                        symbol_trades[key]["buy_notional"] += p * q
                    elif buysell == "S":
                        symbol_trades[key]["sell_qty"] += q
                        symbol_trades[key]["sell_notional"] += p * q

                for (sym, t_curr, t_inv), data in symbol_trades.items():
                    b_qty = data["buy_qty"]
                    s_qty = data["sell_qty"]
                    if b_qty > 0 and s_qty > 0:
                        b_notional = data["buy_notional"]
                        s_notional = data["sell_notional"]
                        buy_avg_price = b_notional / b_qty
                        sell_avg_price = s_notional / s_qty
                        pnl = s_qty * (sell_avg_price - buy_avg_price)
                        get_bucket(t_curr, t_inv)["realized_pnl"] += pnl

                # 5. Margin Loan Balance & Cumulative Interest Expense on date d
                cursor.execute(
                    """
                    SELECT currency, COALESCE(SUM(loan_balance), 0),
                           COALESCE(SUM(daily_interest), 0),
                           COALESCE(SUM(cumulative_interest), 0)
                    FROM public.daily_margin_interest
                    WHERE user_id = %s AND date = %s
                    GROUP BY currency
                    """,
                    (uid, d),
                )
                for m_curr, m_lb, m_di, m_ci in cursor.fetchall():
                    b = get_bucket(m_curr, False)
                    b["margin_loan_balance"] += float(m_lb)
                    b["daily_interest_accrued"] += float(m_di)
                    b["cumulative_interest_accrued"] += float(m_ci)

                # Insert all daily portfolio summary records for this user and date
                for (curr, inv), b in summary_rows.items():
                    # Clean any NaN in buckets
                    for k in b:
                        if math.isnan(b[k]):
                            b[k] = 0.0

                    total_asset_value = b["total_capital"] + b["position_market_value"] + b["realized_pnl"]
                    total_pnl = b["realized_pnl"] + b["unrealized_pnl"] - b["cumulative_interest_accrued"]
                    pct_pnl = (total_pnl / b["total_capital"] * 100.0) if b["total_capital"] > 0 else 0.0

                    if math.isnan(total_asset_value):
                        total_asset_value = b["total_capital"]
                    if math.isnan(total_pnl):
                        total_pnl = 0.0
                    if math.isnan(pct_pnl):
                        pct_pnl = 0.0

                    cursor.execute(
                        """
                        INSERT INTO public.daily_portfolio_summary (
                            user_id, date, currency, investment, total_capital,
                            position_market_value, realized_pnl, unrealized_pnl,
                            margin_loan_balance, daily_interest_accrued, cumulative_interest_accrued,
                            total_asset_value, total_pnl, pct_pnl, updatetimestamp
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, date, currency, investment) DO UPDATE SET
                            total_capital = EXCLUDED.total_capital,
                            position_market_value = EXCLUDED.position_market_value,
                            realized_pnl = EXCLUDED.realized_pnl,
                            unrealized_pnl = EXCLUDED.unrealized_pnl,
                            margin_loan_balance = EXCLUDED.margin_loan_balance,
                            daily_interest_accrued = EXCLUDED.daily_interest_accrued,
                            cumulative_interest_accrued = EXCLUDED.cumulative_interest_accrued,
                            total_asset_value = EXCLUDED.total_asset_value,
                            total_pnl = EXCLUDED.total_pnl,
                            pct_pnl = EXCLUDED.pct_pnl,
                            updatetimestamp = CURRENT_TIMESTAMP
                        """,
                        (
                            uid,
                            d,
                            curr,
                            inv,
                            b["total_capital"],
                            b["position_market_value"],
                            b["realized_pnl"],
                            b["unrealized_pnl"],
                            b["margin_loan_balance"],
                            b["daily_interest_accrued"],
                            b["cumulative_interest_accrued"],
                            total_asset_value,
                            total_pnl,
                            pct_pnl,
                        ),
                    )

        conn.commit()
        logger.info("[run_portfolio_summary.py]: All portfolio summary records calculated and committed successfully.")

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("[run_portfolio_summary.py]: Error during execution: %s", e, exc_info=True)
        raise RuntimeError(f"run_portfolio_summary execution failed: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    try:
        run_portfolio_summary()
    except Exception:
        sys.exit(1)
