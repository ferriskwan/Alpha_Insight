"""UAT-005: Verification tests for Standalone Cloud Run Daily Job Pipeline (main.py)."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

from sqlalchemy.orm import Session

import main
from backend.repositories.sys_repo import (
    create_job_execution_log,
    get_job_execution_logs,
    update_job_execution_log,
)


class TestDailyJobPipelineUAT005:
    """UAT-005 Test Suite validating main.py pipeline execution, telemetry recording, and error handling."""

    def test_init_system_dates_success(self) -> None:
        """Verify init_system_dates correctly queries API and parses startdate and today."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "global_startdate": "2026-01-01",
            "global_today": "2026-03-31",
        }
        mock_response.raise_for_status.return_value = None

        with patch("requests.post", return_value=mock_response) as mock_post:
            start_date, today = main.init_system_dates(
                api_url="http://test-server:8080",
                headers={"X-API-KEY": "test-key"},
            )

            assert start_date == "2026-01-01"
            assert today == "2026-03-31"
            assert mock_post.call_count == 1
            call_args, call_kwargs = mock_post.call_args
            assert call_args[0] == "http://test-server:8080/api/v1/sys/init"
            assert call_kwargs["headers"] == {"X-API-KEY": "test-key"}

    def test_fetch_and_store_eod_flow(self) -> None:
        """Verify fetch_and_store_eod processes symbol queue and uploads to API."""
        mock_get_resp = MagicMock()
        mock_get_resp.json.return_value = [{"symbol": "AAPL", "start_date": "2026-03-01"}]
        mock_get_resp.raise_for_status.return_value = None

        mock_post_resp = MagicMock()
        mock_post_resp.json.return_value = {"status": "ok"}
        mock_post_resp.raise_for_status.return_value = None

        sample_market_data = {
            "meta": {"symbol": "AAPL"},
            "values": [
                {
                    "datetime": "2026-03-30",
                    "open": 180,
                    "high": 185,
                    "low": 179,
                    "close": 184,
                    "volume": 1000,
                }
            ],
        }

        with (
            patch("requests.get", return_value=mock_get_resp) as mock_get_fn,
            patch("requests.post", return_value=mock_post_resp) as mock_post_fn,
            patch("marketdata.pulldata_yahoo", return_value=sample_market_data) as mock_pull,
        ):
            main.fetch_and_store_eod(
                api_url="http://test-server:8080",
                headers={"X-API-KEY": "test-key"},
                global_startdate="2026-01-01",
                global_today="2026-03-31",
            )

            mock_get_fn.assert_called_once()
            mock_pull.assert_called_once_with("AAPL", "1d", "2026-03-01", "2026-03-31")
            mock_post_fn.assert_called_once()

    def test_fetch_and_store_fx_flow(self) -> None:
        """Verify fetch_and_store_fx transforms and uploads exchange rates."""
        mock_get_resp = MagicMock()
        mock_get_resp.json.return_value = [{"symbol": "USDSGD=X", "currency": "SGD", "start_date": "2026-03-01"}]
        mock_get_resp.raise_for_status.return_value = None

        mock_post_resp = MagicMock()
        mock_post_resp.json.return_value = {"status": "ok"}
        mock_post_resp.raise_for_status.return_value = None

        sample_fx_data = {
            "meta": {"symbol": "USDSGD=X"},
            "values": [{"datetime": "2026-03-30", "close": 1.35}],
        }

        with (
            patch("requests.get", return_value=mock_get_resp) as mock_get_fn,
            patch("requests.post", return_value=mock_post_resp) as mock_post_fn,
            patch("marketdata.pulldata_yahoo", return_value=sample_fx_data),
        ):
            main.fetch_and_store_fx(
                api_url="http://test-server:8080",
                headers={"X-API-KEY": "test-key"},
                global_startdate="2026-01-01",
                global_today="2026-03-31",
            )

            mock_get_fn.assert_called_once()
            mock_post_fn.assert_called_once()
            call_kwargs = mock_post_fn.call_args[1]
            payload = call_kwargs["json"]
            assert len(payload) == 1
            assert payload[0]["currency"] == "SGD"
            assert payload[0]["rate"] == 1.35

    def test_pipeline_orchestration_executes_all_stages(self) -> None:
        """Verify main() orchestrates all pipeline stages sequentially without failure."""
        with (
            patch.object(main, "init_system_dates", return_value=("2026-01-01", "2026-03-31")) as mock_init,
            patch.object(main, "setup_file_logging") as mock_log,
            patch.object(main, "fetch_and_store_eod") as mock_eod,
            patch.object(main, "fetch_and_store_fx") as mock_fx,
            patch.object(main, "fetch_and_store_tick") as mock_tick,
            patch("run_mark_to_market.run_mark_to_market") as mock_m2m,
            patch("run_daily_margin_interest.run_daily_margin_interest") as mock_margin,
            patch("run_portfolio_summary.run_portfolio_summary") as mock_port,
            patch("run_sector_research.run_sector_research") as mock_sector,
        ):
            main.main()

            mock_init.assert_called_once()
            mock_log.assert_called_once()
            mock_eod.assert_called_once()
            mock_fx.assert_called_once()
            mock_tick.assert_called_once()
            mock_m2m.assert_called_once()
            mock_margin.assert_called_once()
            mock_port.assert_called_once()
            mock_sector.assert_called_once()

    def test_job_execution_log_repository_recording(self, db_session: Session) -> None:
        """Verify job_execution_log recording via sys_repo in database."""
        # 1. Start job
        job_log = create_job_execution_log(
            db=db_session,
            job_name="daily_market_pipeline",
            trigger_source="cloud_scheduler",
            global_today=date(2026, 3, 31),
        )
        assert job_log.id is not None
        assert job_log.status == "RUNNING"
        assert job_log.started_at is not None

        # 2. Complete job with metrics
        details = {
            "eod_symbols_processed": 5,
            "fx_rates_updated": 2,
            "positions_marked": 3,
        }
        completed_log = update_job_execution_log(
            db=db_session,
            log_id=job_log.id,
            status_val="SUCCESS",
            details=details,
        )
        assert completed_log is not None
        assert completed_log.status == "SUCCESS"
        assert completed_log.completed_at is not None
        assert completed_log.details == details
        assert completed_log.error_message is None

        # 3. Retrieve logs
        logs = get_job_execution_logs(db=db_session, limit=10)
        assert len(logs) >= 1
        assert logs[0].id == job_log.id

    def test_job_execution_log_failure_recording(self, db_session: Session) -> None:
        """Verify error state recording in job_execution_log upon failure."""
        job_log = create_job_execution_log(
            db=db_session,
            job_name="daily_market_pipeline",
            trigger_source="manual_admin",
            global_today=date(2026, 3, 31),
        )

        completed_log = update_job_execution_log(
            db=db_session,
            log_id=job_log.id,
            status_val="FAILED",
            error_message="Yahoo finance rate limit exceeded 429",
        )
        assert completed_log is not None
        assert completed_log.status == "FAILED"
        assert "429" in (completed_log.error_message or "")

    def test_pulldata_yahoo_sanitizes_timestamp_dates(self) -> None:
        """Verify pulldata_yahoo strips time components from start and end dates."""
        import pandas as pd

        import marketdata as md

        mock_df = pd.DataFrame(
            [{"Open": 100.0, "High": 105.0, "Low": 99.0, "Close": 104.0, "Volume": 5000}],
            index=pd.to_datetime(["2025-01-02"]),
        )

        with patch("yfinance.download", return_value=mock_df) as mock_yf:
            res = md.pulldata_yahoo("XLB", "1d", "2025-01-01T00:00:00", "2026-11-26T00:00:00")
            assert res is not None
            assert res["meta"]["start_date"] == "2025-01-01"
            assert res["meta"]["end_date"] == "2026-11-26"
            mock_yf.assert_called_once_with(
                "XLB",
                start="2025-01-01",
                end="2026-11-26",
                interval="1d",
                multi_level_index=False,
                progress=False,
            )

    def test_fetch_and_store_eod_sanitizes_iso_timestamps(self) -> None:
        """Verify fetch_and_store_eod strips ISO timestamp strings from start and today parameters."""
        mock_get_resp = MagicMock()
        mock_get_resp.json.return_value = [{"symbol": "XLB", "start_date": "2025-01-01T00:00:00"}]
        mock_get_resp.raise_for_status.return_value = None

        mock_post_resp = MagicMock()
        mock_post_resp.json.return_value = {"status": "ok"}
        mock_post_resp.raise_for_status.return_value = None

        with (
            patch("requests.get", return_value=mock_get_resp) as mock_get_fn,
            patch("requests.post", return_value=mock_post_resp),
            patch("marketdata.pulldata_yahoo", return_value={"meta": {"symbol": "XLB"}, "values": []}) as mock_pull,
        ):
            main.fetch_and_store_eod(
                api_url="http://test-server:8080",
                headers={"X-API-KEY": "test-key"},
                global_startdate="2025-01-01T00:00:00",
                global_today="2026-11-26T00:00:00",
            )

            mock_get_fn.assert_called_once_with(
                "http://test-server:8080/api/v1/eod/symbols",
                params={"global_startdate": "2025-01-01"},
                headers={"X-API-KEY": "test-key"},
                timeout=30,
            )
            mock_pull.assert_called_once_with("XLB", "1d", "2025-01-01", "2026-11-26")

    def test_dataops_format_date_helper(self) -> None:
        """Verify _format_date correctly normalizes all date types and strings."""
        from datetime import datetime

        from backend.api.v1.dataops import _format_date

        assert _format_date("2025-01-01T00:00:00") == "2025-01-01"
        assert _format_date("2025-01-01 12:30:45") == "2025-01-01"
        assert _format_date("2025-01-01") == "2025-01-01"
        assert _format_date(date(2025, 1, 1)) == "2025-01-01"
        assert _format_date(datetime(2025, 1, 1, 12, 0, 0)) == "2025-01-01"
