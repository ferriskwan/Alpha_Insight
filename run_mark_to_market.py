#!/usr/bin/env python3
"""
Python alternative runner for the mark_to_market position valuation process.
Since the agent_account_1 user lacks schema CREATE privileges to deploy stored procedures,
this script executes the exact same PL/pgSQL logic client-side via psycopg2.
"""

import logging
import os
import sys

from dotenv import load_dotenv

# inherit logging configuration from main.py
logger = logging.getLogger(__name__)

# Add workspace directory to path and load env
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import ProcessData as pd  # noqa: E402


def run_mark_to_market():
    logger.info("[run_mark_to_market.py]: Connecting to the database...")
    conn = None
    cursor = None
    try:
        conn = pd.connect_clover()
        cursor = conn.cursor()
    except Exception as e:
        logger.error(f"[run_mark_to_market.py]: Failed to connect to the database: {e}")
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        raise RuntimeError(f"Database connection failed: {e}")

    try:
        # Step 0: Determine the start date for position refresh using smart refresh query
        logger.info("[run_mark_to_market.py]: Determining start date for position refresh...")
        smart_query = """
            SELECT MIN(tradedate)
            FROM public.trade
            WHERE updatetimestamp >= (
                SELECT (datevalue - INTERVAL '5 days')
                FROM public.sysvalue
                WHERE name = 'GLOBAL_TODAY'
            )
            """

        cursor.execute(smart_query)
        min_trade_date = cursor.fetchone()[0]

        if min_trade_date is not None:
            if hasattr(min_trade_date, "date"):
                min_trade_date = min_trade_date.date()
            logger.info(
                f"[run_mark_to_market.py]: Smart refresh enabled: "
                f"deleting position records on or after {min_trade_date}..."
            )
            cursor.execute("DELETE FROM public.position WHERE tradedate >= %s;", (min_trade_date,))
            start_date = min_trade_date
        else:
            logger.warning(
                "[run_mark_to_market.py]: Smart refresh query returned NULL. "
                "Reverting to full refresh (clearing entire position table)..."
            )
            cursor.execute("DELETE FROM public.position;")

            # Fetch GLOBAL_STARTDATE as fallback
            cursor.execute("SELECT datevalue::date FROM public.sysvalue WHERE name = 'GLOBAL_STARTDATE'")
            start_date = cursor.fetchone()[0]
            logger.info(f"[run_mark_to_market.py]: Full refresh: populating positions from start date {start_date}...")

        # Step 1: Execute single batch query to calculate and insert positions
        logger.info(f"[run_mark_to_market.py]: Inserting position records starting from {start_date}...")
        insert_query = """
            INSERT INTO public.position (
                user_id,
                tradedate,
                symbol,
                investment,
                avgprice,
                quantity,
                eodprice,
                updatetimestamp
            )
            SELECT
                t.user_id,
                e.date AS tradedate,
                t.symbol,
                t.investment,
                -- Option B: Average buy price (weighted average of BUY transactions only)
                COALESCE(
                    SUM(CASE WHEN t.buysell = 'B' THEN t.price * t.quantity ELSE 0 END) /
                    NULLIF(SUM(CASE WHEN t.buysell = 'B' THEN t.quantity ELSE 0 END), 0),
                    0
                ) AS avgprice,
                -- Option B: Net Quantity (buys minus sells)
                SUM(CASE WHEN t.buysell = 'B' THEN t.quantity ELSE -t.quantity END) AS quantity,
                e.close AS eodprice,
                CURRENT_TIMESTAMP AS updatetimestamp
            FROM public.eoddata e
            INNER JOIN public.trade t ON t.symbol = e.symbol
            WHERE e.date >= %s
              AND t.tradedate::date <= e.date
              AND e.close IS NOT NULL
              AND e.close::text != 'NaN'
              AND e.close > 0
            GROUP BY t.user_id, e.date, t.symbol, t.investment, e.close;
        """
        cursor.execute(insert_query, (start_date,))
        rows_inserted = cursor.rowcount
        logger.info(f"[run_mark_to_market.py]: Inserted {rows_inserted} position records.")
        conn.commit()
        logger.info("[run_mark_to_market.py]: All transactions committed successfully.")

    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"[run_mark_to_market.py]: Error occurred during execution: {e}", exc_info=True)
        raise RuntimeError(f"mark_to_market execution failed: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    try:
        run_mark_to_market()
    except Exception:
        sys.exit(1)
