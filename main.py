"""Main program for Alpha_Insight daily market data ingestion and calculation pipeline."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

if __name__ == "__main__":
    # Auto-re-execute using the virtual environment if running outside it
    _venv_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv")
    if os.path.isdir(_venv_dir):
        _venv_python = (
            os.path.join(_venv_dir, "Scripts", "python.exe")
            if os.name == "nt"
            else os.path.join(_venv_dir, "bin", "python")
        )
        if (
            os.path.exists(_venv_python)
            and os.path.abspath(sys.executable).lower() != os.path.abspath(_venv_python).lower()
        ):
            result = subprocess.run([_venv_python] + sys.argv)
            sys.exit(result.returncode)

import requests
from dotenv import load_dotenv

import marketdata as md
import run_daily_margin_interest
import run_mark_to_market
import run_portfolio_summary
from backend.config import get_settings

# Configure console logging
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

logging.basicConfig(
    level=logging.DEBUG,
    handlers=[console_handler],
)
logger = logging.getLogger(__name__)


def setup_file_logging(parent_dir: str, global_today: str) -> None:
    """Setup FileHandler for logging into the Logs/ directory."""
    try:
        log_dir = os.path.join(str(parent_dir), "Logs")
        os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(os.path.join(log_dir, f"{global_today}.log"))
        file_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
        logging.getLogger().addHandler(file_handler)
        logger.info("[main.py]: Logging initialized. Log file is %s", os.path.join(log_dir, global_today + ".log"))
    except IOError as e:
        logger.error("[main.py]: Error setting up log file: %s", e, exc_info=True)


def init_system_dates(api_url: str, headers: dict[str, str]) -> Tuple[str, str]:
    """Call the API system initialization endpoint to update and retrieve dates."""
    logger.info("[main.py]: Initializing system dates via API")
    response = requests.post(f"{api_url}/api/v1/sys/init", headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data["global_startdate"], data["global_today"]


def fetch_and_store_eod(api_url: str, headers: dict[str, str], global_startdate: str, global_today: str) -> None:
    """Fetch End-Of-Day market data and upload it to the Cloud API server."""
    logger.info("[main.py]: Fetching EOD symbols queue from API")
    response = requests.get(
        f"{api_url}/api/v1/eod/symbols",
        params={"global_startdate": global_startdate},
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    symbols_queue = response.json()

    for item in symbols_queue:
        symbol = item["symbol"]
        symbol_start_date = item["start_date"]
        logger.debug("[main.py].EODData: Processing symbol: %s with start date: %s", symbol, symbol_start_date)

        try:
            pulldata = md.pulldata_yahoo(symbol, "1d", symbol_start_date, global_today)
            if pulldata is None:
                logger.warning("[main.py].EODData: No data retrieved for symbol: %s", symbol)
                continue

            logger.debug("[main.py].EODData: Sending data for symbol: %s", symbol)
            upload_response = requests.post(
                f"{api_url}/api/v1/eod",
                json=pulldata,
                headers=headers,
                timeout=60,
            )
            upload_response.raise_for_status()
            logger.info(
                "[main.py].EODData: Successfully processed symbol: %s. Response: %s",
                symbol,
                upload_response.json(),
            )
        except Exception as e:
            logger.error("[main.py].EODData: Error processing symbol %s: %s", symbol, e, exc_info=True)
            continue


def fetch_and_store_fx(api_url: str, headers: dict[str, str], global_startdate: str, global_today: str) -> None:
    """Fetch End-Of-Day FX data and upload it to the Cloud API server."""
    logger.info("[main.py]: Fetching FX symbols queue from API")
    response = requests.get(
        f"{api_url}/api/v1/fx/symbols",
        params={"global_startdate": global_startdate},
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    symbols_queue = response.json()

    for item in symbols_queue:
        symbol = item["symbol"]
        currency = item["currency"]
        symbol_start_date = item["start_date"]
        logger.debug(
            "[main.py].FXData: Processing currency: %s (symbol %s) with start date: %s",
            currency,
            symbol,
            symbol_start_date,
        )

        try:
            pulldata = md.pulldata_yahoo(symbol, "1d", symbol_start_date, global_today)
            if not pulldata:
                logger.warning("[main.py].FXData: No data retrieved for symbol: %s", symbol)
                continue

            fx_payload = []
            for d in pulldata.get("values", []):
                fx_payload.append(
                    {
                        "date": d["datetime"],
                        "currency": currency,
                        "base_currency": "USD",
                        "rate": d["close"],
                    }
                )

            logger.debug("[main.py].FXData: Sending data for currency: %s", currency)
            upload_response = requests.post(
                f"{api_url}/api/v1/fx",
                json=fx_payload,
                headers=headers,
                timeout=60,
            )
            upload_response.raise_for_status()
            logger.info(
                "[main.py].FXData: Successfully processed currency: %s. Response: %s",
                currency,
                upload_response.json(),
            )
        except Exception as e:
            logger.error("[main.py].FXData: Error processing currency %s: %s", currency, e, exc_info=True)
            continue


def fetch_and_store_tick(api_url: str, headers: dict[str, str], global_today: str) -> None:
    """Fetch Tick market data and upload it to the Cloud API server."""
    logger.info("[main.py]: Fetching Tick symbols queue from API")
    response = requests.get(
        f"{api_url}/api/v1/tick/symbols",
        params={"global_today": global_today},
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
    symbols_queue = response.json()

    for item in symbols_queue:
        symbol = item["symbol"]
        symbol_start_date = item["start_date"]
        logger.debug("[main.py].TickData: Processing symbol: %s with start date: %s", symbol, symbol_start_date)

        try:
            pulldata = md.pulldata_yahoo(symbol, "5m", symbol_start_date, global_today)
            if pulldata is None:
                logger.warning("[main.py].TickData: No data retrieved for symbol: %s", symbol)
                continue

            logger.debug("[main.py].TickData: Sending data for symbol: %s", symbol)
            upload_response = requests.post(
                f"{api_url}/api/v1/tick",
                json=pulldata,
                headers=headers,
                timeout=60,
            )
            upload_response.raise_for_status()
            logger.info(
                "[main.py].TickData: Successfully processed symbol: %s. Response: %s",
                symbol,
                upload_response.json(),
            )
        except Exception as e:
            logger.error("[main.py].TickData: Error processing symbol %s: %s", symbol, e, exc_info=True)
            continue


def main() -> None:
    """Execute complete daily batch pipeline with job execution logging."""
    load_dotenv()
    settings = get_settings()

    api_url = settings.api_url
    api_key = settings.api_key
    headers = {"X-API-KEY": api_key}

    logger.info("[main.py]: Start of program client (Target: %s)", api_url)
    parent_dir = os.getcwd()
    logger.info("[main.py]: Parent directory is %s", parent_dir)

    # Initialize job audit logging
    db_session: Optional[Any] = None
    log_id: Optional[int] = None

    try:
        from backend.db.session import get_session_factory
        from backend.repositories.sys_repo import (
            create_job_execution_log,
            update_job_execution_log,
        )

        session_factory = get_session_factory()
        db_session = session_factory()
        log_entry = create_job_execution_log(
            db=db_session,
            job_name="alpha-insight-daily-pipeline",
            trigger_source="BATCH_PIPELINE",
            status_val="RUNNING",
        )
        log_id = log_entry.id
    except Exception as audit_init_err:
        logger.warning(
            "[main.py]: Could not initialize job_execution_log record: %s",
            audit_init_err,
        )

    try:
        # Initialize dates and update GLOBAL_TODAY via API
        global_startdate, global_today = init_system_dates(api_url, headers)

        # Setup file logging
        setup_file_logging(parent_dir, global_today)

        # Ingest EOD, FX, and Tick market data
        fetch_and_store_eod(api_url, headers, global_startdate, global_today)
        fetch_and_store_fx(api_url, headers, global_startdate, global_today)
        fetch_and_store_tick(api_url, headers, global_today)

        # Calculate EOD valuations and update positions (mark to market)
        logger.info("[main.py]: Triggering mark_to_market position valuation process...")
        run_mark_to_market.run_mark_to_market()

        # Calculate daily margin interest accruals
        logger.info("[main.py]: Triggering run_daily_margin_interest process...")
        run_daily_margin_interest.run_daily_margin_interest()

        # Consolidate daily portfolio metrics & PnL snapshots
        logger.info("[main.py]: Triggering run_portfolio_summary process...")
        run_portfolio_summary.run_portfolio_summary()

        if db_session and log_id:
            from backend.repositories.sys_repo import update_job_execution_log

            update_job_execution_log(
                db=db_session,
                log_id=log_id,
                status_val="SUCCESS",
                completed_at=datetime.now(timezone.utc),
                details={"status": "All pipeline steps completed successfully"},
            )

    except Exception as e:
        logger.error("[main.py]: Unexpected error during main execution: %s", e, exc_info=True)
        if db_session and log_id:
            from backend.repositories.sys_repo import update_job_execution_log

            update_job_execution_log(
                db=db_session,
                log_id=log_id,
                status_val="FAILED",
                completed_at=datetime.now(timezone.utc),
                error_message=str(e),
            )
        raise
    finally:
        if db_session:
            try:
                db_session.close()
            except Exception:
                pass
        logger.info("[main.py]: Program execution completed")


if __name__ == "__main__":
    main()
