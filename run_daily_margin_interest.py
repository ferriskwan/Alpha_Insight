#!/usr/bin/env python3
"""Module to calculate and store daily margin borrowing interest charges.

Sequentially executed in main.py after run_mark_to_market.py.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import date, timedelta
from typing import Generator

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


def run_daily_margin_interest() -> None:
    """Calculate daily margin loan balance and accrue interest."""
    settings = get_settings()
    logger.info("[run_daily_margin_interest.py]: Connecting to database...")
    conn = None
    cursor = None
    try:
        conn = pd.connect_clover()
        cursor = conn.cursor()
    except Exception as e:
        logger.error("[run_daily_margin_interest.py]: Failed to connect to database: %s", e)
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
                "[run_daily_margin_interest.py]: "
                "Could not determine valid start_date or end_date. Skipping calculation."
            )
            return

        if hasattr(start_date, "date"):
            start_date = start_date.date()
        if hasattr(end_date, "date"):
            end_date = end_date.date()

        logger.info(
            "[run_daily_margin_interest.py]: Refreshing margin interest records from %s to %s...",
            start_date,
            end_date,
        )

        # Step 2: Delete stale records on or after start_date
        cursor.execute("DELETE FROM public.daily_margin_interest WHERE date >= %s", (start_date,))

        # Step 3: Fetch active users
        cursor.execute("SELECT DISTINCT id FROM public.users")
        user_ids = [r[0] for r in cursor.fetchall()]
        if not user_ids:
            cursor.execute("SELECT DISTINCT user_id FROM public.capital WHERE user_id IS NOT NULL")
            user_ids = [r[0] for r in cursor.fetchall()]

        # Step 4: Fetch rate rules
        rate_rules = pd.get_margin_interest_rates(conn)

        # Helper to match interest rate rule
        def get_rate(broker: str, currency: str, current_d: date) -> tuple[float, int]:
            for r in reversed(rate_rules):
                if r["broker"].upper() == broker.upper() and r["currency"].upper() == currency.upper():
                    eff = r["effective_date"]
                    if hasattr(eff, "date"):
                        eff = eff.date()
                    if eff <= current_d:
                        return float(r["annual_rate"]), int(r["day_count_basis"])
            # Defaults loaded from centralized application settings (No magic numbers)
            curr_upper = currency.upper()
            if curr_upper == "USD":
                return settings.default_margin_rate_usd, settings.default_margin_basis_usd
            elif curr_upper == "SGD":
                return settings.default_margin_rate_sgd, settings.default_margin_basis_sgd
            return settings.default_margin_rate_other, settings.default_margin_basis_other

        # Distinct broker/currency pairs from capital and watchlist
        cursor.execute(
            """
            SELECT DISTINCT COALESCE(broker, %s), COALESCE(currency, %s)
            FROM public.capital
            UNION
            SELECT %s, COALESCE(currency, %s)
            FROM public.watchlist
            """,
            (
                settings.default_broker_name,
                settings.default_currency_code,
                settings.default_broker_name,
                settings.default_currency_code,
            ),
        )
        pairs = cursor.fetchall()
        if not pairs:
            pairs = [
                (settings.default_broker_name, settings.default_currency_code),
                (settings.default_broker_name, "SGD"),
            ]

        # Running tracker for cumulative interest per (user_id, broker, currency)
        cumulative_tracker: dict[tuple[int, str, str], float] = {}

        # Pre-seed cumulative_tracker with the value on (start_date - 1 day)
        for uid in user_ids:
            for brk, curr in pairs:
                cursor.execute(
                    """
                    SELECT cumulative_interest
                    FROM public.daily_margin_interest
                    WHERE user_id = %s AND UPPER(broker) = UPPER(%s) AND UPPER(currency) = UPPER(%s)
                      AND date = %s - INTERVAL '1 day'
                    """,
                    (uid, brk, curr, start_date),
                )
                res = cursor.fetchone()
                key = (uid, brk.upper(), curr.upper())
                cumulative_tracker[key] = float(res[0]) if res and res[0] is not None else 0.0

        # Step 5: Loop day by day
        for d in date_range_list(start_date, end_date):
            for uid in user_ids:
                for brk, curr in pairs:
                    brk_u = brk.upper()
                    curr_u = curr.upper()
                    key = (uid, brk_u, curr_u)

                    # 1. Net Capital Injected into Margin Account up to date d
                    cursor.execute(
                        """
                        SELECT COALESCE(SUM(amount), 0)
                        FROM public.capital
                        WHERE user_id = %s AND UPPER(broker) = %s AND UPPER(currency) = %s
                          AND UPPER(accounttype) = 'MARGIN' AND date <= %s
                        """,
                        (uid, brk_u, curr_u, d),
                    )
                    net_margin_capital = float(cursor.fetchone()[0] or 0.0)

                    # 2. Total Margin Buy Notional up to date d (investment = False)
                    cursor.execute(
                        """
                        SELECT COALESCE(SUM(t.price * t.quantity), 0)
                        FROM public.trade t
                        JOIN public.watchlist w ON t.symbol = w.symbol AND t.user_id = w.user_id
                        WHERE t.user_id = %s AND UPPER(w.currency) = %s AND t.investment = FALSE
                          AND t.buysell = 'B' AND t.tradedate::date <= %s
                        """,
                        (uid, curr_u, d),
                    )
                    margin_buys_notional = float(cursor.fetchone()[0] or 0.0)

                    # 3. Total Margin Sell Proceeds up to date d (investment = False)
                    cursor.execute(
                        """
                        SELECT COALESCE(SUM(t.price * t.quantity), 0)
                        FROM public.trade t
                        JOIN public.watchlist w ON t.symbol = w.symbol AND t.user_id = w.user_id
                        WHERE t.user_id = %s AND UPPER(w.currency) = %s AND t.investment = FALSE
                          AND t.buysell = 'S' AND t.tradedate::date <= %s
                        """,
                        (uid, curr_u, d),
                    )
                    margin_sells_proceeds = float(cursor.fetchone()[0] or 0.0)

                    # 4. Cash Available = Net Margin Capital - Buy Notional + Sell Proceeds
                    cash_available = net_margin_capital - margin_buys_notional + margin_sells_proceeds

                    # 5. Loan Balance = abs(Cash Available) if Cash Available < 0 else 0
                    if cash_available < 0:
                        margin_loan = abs(cash_available)
                    else:
                        margin_loan = 0.0

                    # 6. Interest Rate Calculation
                    annual_rate, basis = get_rate(brk, curr, d)
                    daily_rate = annual_rate / float(basis)
                    daily_interest = margin_loan * daily_rate

                    # 7. Cumulative Interest
                    prev_cum = cumulative_tracker.get(key, 0.0)
                    cumulative_interest = prev_cum + daily_interest
                    cumulative_tracker[key] = cumulative_interest

                    # 8. Insert daily_margin_interest record
                    cursor.execute(
                        """
                        INSERT INTO public.daily_margin_interest (
                            user_id, date, broker, currency, loan_balance, daily_rate,
                            daily_interest, cumulative_interest, updatetimestamp
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, date, broker, currency) DO UPDATE SET
                            loan_balance = EXCLUDED.loan_balance,
                            daily_rate = EXCLUDED.daily_rate,
                            daily_interest = EXCLUDED.daily_interest,
                            cumulative_interest = EXCLUDED.cumulative_interest,
                            updatetimestamp = CURRENT_TIMESTAMP
                        """,
                        (uid, d, brk, curr, margin_loan, daily_rate, daily_interest, cumulative_interest),
                    )

        conn.commit()
        logger.info("[run_daily_margin_interest.py]: All margin interest records committed successfully.")

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("[run_daily_margin_interest.py]: Error during execution: %s", e, exc_info=True)
        raise RuntimeError(f"run_daily_margin_interest execution failed: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    try:
        run_daily_margin_interest()
    except Exception:
        sys.exit(1)
