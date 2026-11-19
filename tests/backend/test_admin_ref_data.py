"""UAT / Unit Tests for Reference Data (SysValue) and Chart Settings (RefChartSettings).

Covers:
- Reading sysvalues (get_sysvalues, get_sysvalue_by_name)
- Updating sysvalues (update_sysvalue)
- Reading chart settings with fallback cascade (get_chart_settings, get_all_chart_settings)
- Updating / upserting chart settings (update_chart_settings)
- Admin REST API endpoints:
  * GET /api/v1/admin/ref-data/sysvalues
  * PUT /api/v1/admin/ref-data/sysvalues/{name}
  * GET /api/v1/admin/ref-data/chart-settings
  * PUT /api/v1/admin/ref-data/chart-settings
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.db.models import RefChartSettings, SysValue
from backend.repositories.ref_data_repo import (
    get_chart_settings,
    get_sysvalue_by_name,
    get_sysvalues,
    update_chart_settings,
    update_sysvalue,
)
from backend.schemas.ref_data import ChartSettingsUpdate, SysValueUpdate


class TestSysValueRepository:
    """Test suite for public.sysvalue reference data repository functions."""

    def test_get_sysvalues_and_by_name(self, db_session: Session, seed_test_data: dict[str, Any]) -> None:
        """Verify reading all sysvalues and retrieving a specific key by name."""
        all_vals = get_sysvalues(db_session)
        assert len(all_vals) >= 2  # GLOBAL_STARTDATE, GLOBAL_TODAY seeded in conftest
        names = [v.name for v in all_vals]
        assert "GLOBAL_STARTDATE" in names
        assert "GLOBAL_TODAY" in names

        start_val = get_sysvalue_by_name(db_session, "GLOBAL_STARTDATE")
        assert start_val is not None
        assert start_val.type == "DATE"
        assert start_val.datevalue == date(2026, 1, 1)

    def test_update_sysvalue_fields(self, db_session: Session) -> None:
        """Verify updating strvalue, numvalue, datevalue, and description on a SysValue."""
        # Create a test SysValue
        test_val = SysValue(
            name="TEST_CONFIG_PARAM",
            type="STR",
            strvalue="Initial",
            numvalue=10.5,
            description="Initial description",
        )
        db_session.add(test_val)
        db_session.commit()

        # Update via update_sysvalue
        updated = update_sysvalue(
            db_session,
            name="TEST_CONFIG_PARAM",
            update_data=SysValueUpdate(
                strvalue="ModifiedValue",
                numvalue=25.0,
                description="Updated description",
            ),
        )
        assert updated is not None
        assert updated.strvalue == "ModifiedValue"
        assert updated.numvalue == 25.0
        assert updated.description == "Updated description"

        # Updating nonexistent returns None
        assert update_sysvalue(db_session, "NON_EXISTENT", SysValueUpdate(strvalue="X")) is None


class TestRefChartSettingsRepository:
    """Test suite for public.ref_chart_settings indicator defaults and hierarchy cascade."""

    def test_chart_settings_fallback_cascade(self, db_session: Session) -> None:
        """Verify resolution cascade: user+symbol -> user default -> symbol default -> global default."""
        # 1. Global default (user_id=None, symbol=None)
        global_def = RefChartSettings(
            user_id=None,
            symbol=None,
            sma_period=30,
            ema_period=100,
            bb_period=30,
            bb_std=2.0,
            rsi_period=14,
            rsi_ob=70.0,
            rsi_os=30.0,
            macd_fast=12,
            macd_slow=26,
            macd_signal=9,
        )
        # 2. Symbol default (user_id=None, symbol='AAPL')
        aapl_def = RefChartSettings(
            user_id=None,
            symbol="AAPL",
            sma_period=20,
            ema_period=50,
            bb_period=20,
            bb_std=2.0,
            rsi_period=14,
            rsi_ob=70.0,
            rsi_os=30.0,
            macd_fast=12,
            macd_slow=26,
            macd_signal=9,
        )
        # 3. User default (user_id=1, symbol=None)
        user1_def = RefChartSettings(
            user_id=1,
            symbol=None,
            sma_period=45,
            ema_period=120,
            bb_period=45,
            bb_std=2.5,
            rsi_period=10,
            rsi_ob=75.0,
            rsi_os=25.0,
            macd_fast=10,
            macd_slow=20,
            macd_signal=7,
        )
        # 4. User + Symbol (user_id=1, symbol='MSFT')
        user1_msft = RefChartSettings(
            user_id=1,
            symbol="MSFT",
            sma_period=15,
            ema_period=30,
            bb_period=15,
            bb_std=1.5,
            rsi_period=9,
            rsi_ob=80.0,
            rsi_os=20.0,
            macd_fast=8,
            macd_slow=17,
            macd_signal=5,
        )
        db_session.add_all([global_def, aapl_def, user1_def, user1_msft])
        db_session.commit()

        # Case 1: Exact match user=1, symbol='MSFT' -> returns user1_msft (sma 15)
        res1 = get_chart_settings(db_session, user_id=1, symbol="MSFT")
        assert res1 is not None
        assert res1.sma_period == 15

        # Case 2: user=1, symbol='TSLA' -> falls back to user default user1_def (sma 45)
        res2 = get_chart_settings(db_session, user_id=1, symbol="TSLA")
        assert res2 is not None
        assert res2.sma_period == 45

        # Case 3: user=2, symbol='AAPL' -> falls back to symbol default aapl_def (sma 20)
        res3 = get_chart_settings(db_session, user_id=2, symbol="AAPL")
        assert res3 is not None
        assert res3.sma_period == 20

        # Case 4: user=2, symbol='TSLA' -> falls back to global default (sma 30)
        res4 = get_chart_settings(db_session, user_id=2, symbol="TSLA")
        assert res4 is not None
        assert res4.sma_period == 30

    def test_update_and_upsert_chart_settings(self, db_session: Session) -> None:
        """Verify updating existing chart settings and creating new settings via update_chart_settings."""
        # Upsert new settings for symbol GOOG
        new_settings = update_chart_settings(
            db_session,
            update_data=ChartSettingsUpdate(
                symbol="GOOG",
                sma_period=25,
                ema_period=75,
                rsi_period=12,
            ),
        )
        assert new_settings.id is not None
        assert new_settings.symbol == "GOOG"
        assert new_settings.sma_period == 25
        assert new_settings.ema_period == 75

        # Now update existing settings by settings_id
        updated = update_chart_settings(
            db_session,
            settings_id=new_settings.id,
            update_data=ChartSettingsUpdate(sma_period=28, bb_std=2.2),
        )
        assert updated.id == new_settings.id
        assert updated.sma_period == 28
        assert updated.bb_std == 2.2


class TestAdminRefDataAPI:
    """Test suite for Admin Reference Data endpoints."""

    def test_admin_can_read_and_update_sysvalues(
        self, client: TestClient, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify GET and PUT /api/v1/admin/ref-data/sysvalues."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # GET all
        resp = client.get("/api/v1/admin/ref-data/sysvalues")
        assert resp.status_code == 200
        vals = resp.json()
        assert len(vals) >= 2

        # PUT update GLOBAL_TODAY
        put_resp = client.put(
            "/api/v1/admin/ref-data/sysvalues/GLOBAL_TODAY",
            json={"datevalue": "2026-04-15", "description": "Updated April today"},
        )
        assert put_resp.status_code == 200
        data = put_resp.json()
        assert data["datevalue"] == "2026-04-15"
        assert data["description"] == "Updated April today"

    def test_admin_can_read_and_update_chart_settings(
        self, client: TestClient, db_session: Session, seed_test_data: dict[str, Any]
    ) -> None:
        """Verify GET and PUT /api/v1/admin/ref-data/chart-settings."""
        client.cookies.set("alpha_sid", seed_test_data["session_sid"])

        # GET chart settings
        resp = client.get("/api/v1/admin/ref-data/chart-settings")
        assert resp.status_code == 200

        # PUT chart settings upsert
        put_resp = client.put(
            "/api/v1/admin/ref-data/chart-settings",
            json={
                "symbol": "NVDA",
                "sma_period": 21,
                "ema_period": 55,
                "rsi_period": 14,
            },
        )
        assert put_resp.status_code == 200
        saved = put_resp.json()
        assert saved["symbol"] == "NVDA"
        assert saved["sma_period"] == 21
