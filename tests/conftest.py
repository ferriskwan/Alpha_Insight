"""Global pytest fixtures and test configurations for Alpha_Insight backend test suites."""

from __future__ import annotations

from collections.abc import Generator
from datetime import date, datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.config import Settings
from backend.db.models import (
    Base,
    Capital,
    DailyMarginInterest,
    DailyPortfolioSummary,
    EodData,
    ExchangeRate,
    MarginInterestRate,
    Position,
    SysValue,
    TickData,
    Trade,
    User,
    UserRole,
    UserSession,
    Watchlist,
)
from backend.db.session import get_db_session

# In-memory SQLite engine using StaticPool for safe shared in-memory concurrency in tests
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    bind=TEST_ENGINE,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Return test settings with DEV environment and mock API keys."""
    return Settings(
        ENV="DEV",
        PORT=8080,
        API_URL="http://testserver",
        API_KEY="test-secret-key-123",
        GOOGLE_CLIENT_ID="test-google-client-id.apps.googleusercontent.com",
        GEMINI_API_KEY="test-gemini-key",
        KIMI_API_KEY="test-kimi-key",
    )


@pytest.fixture(autouse=True)
def override_settings(test_settings: Settings) -> Generator[None, None, None]:
    """Ensure get_settings returns the test settings during test execution."""
    from backend.config import get_settings as actual_get_settings

    actual_get_settings.cache_clear()  # type: ignore[attr-defined]
    yield
    actual_get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Yield a pristine in-memory SQLite session with all tables created and rolled back after test."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def seed_test_data(db_session: Session) -> dict[str, Any]:
    """Seed comprehensive test entities into the in-memory database."""
    # 1. Users & Roles
    admin_user = User(
        id=1,
        email="admin@alphainsight.test",
        name="Admin Tester",
        picture="https://test.local/admin.png",
        status="active",
        google_id="google-sub-admin-1",
    )
    regular_user = User(
        id=2,
        email="user@alphainsight.test",
        name="Regular User",
        picture=None,
        status="active",
        google_id="google-sub-user-2",
    )
    db_session.add_all([admin_user, regular_user])
    db_session.flush()

    admin_role = UserRole(user_id=1, role="admin", status="active")
    user_role = UserRole(user_id=2, role="user", status="active")
    db_session.add_all([admin_role, user_role])

    # 2. System Values
    sys_startdate = SysValue(
        name="GLOBAL_STARTDATE",
        type="DATE",
        datevalue=date(2026, 1, 1),
        description="Global batch start date",
    )
    sys_today = SysValue(
        name="GLOBAL_TODAY",
        type="DATE",
        datevalue=date(2026, 3, 31),
        description="Global batch today date",
    )
    sys_def_ccy = SysValue(
        name="DEFAULT_CURRENCY",
        type="STRING",
        strvalue="SGD",
        description="Default portfolio reporting currency",
    )
    db_session.add_all([sys_startdate, sys_today, sys_def_ccy])

    # 3. Watchlist
    wl_aapl = Watchlist(
        user_id=1,
        watchlistname="Tech",
        symbol="AAPL",
        name="Apple Inc.",
        timezone="America/New_York",
        currency="USD",
    )
    wl_d05 = Watchlist(
        user_id=1,
        watchlistname="Tech",
        symbol="D05.SI",
        name="DBS Group Holdings",
        timezone="Asia/Singapore",
        currency="SGD",
    )
    db_session.add_all([wl_aapl, wl_d05])

    # 4. Exchange Rates
    fx_usd = ExchangeRate(date=date(2026, 3, 31), currency="USD", base_currency="USD", rate=1.0)
    fx_sgd = ExchangeRate(date=date(2026, 3, 31), currency="SGD", base_currency="USD", rate=1.35)
    db_session.add_all([fx_usd, fx_sgd])

    # 5. EOD Market Data for AAPL
    eod1 = EodData(
        symbol="AAPL",
        date=date(2026, 3, 30),
        open=180.0,
        high=185.0,
        low=179.0,
        close=184.5,
        volume=5000000.0,
    )
    eod2 = EodData(
        symbol="AAPL",
        date=date(2026, 3, 31),
        open=184.5,
        high=188.0,
        low=183.0,
        close=187.2,
        volume=6200000.0,
    )
    db_session.add_all([eod1, eod2])

    # 6. Intraday Tick Data
    tick1 = TickData(
        symbol="AAPL",
        interval="5m",
        timestamp=datetime(2026, 3, 31, 14, 30, 0),
        open=184.5,
        high=185.0,
        low=184.2,
        close=184.9,
        volume=120000.0,
    )
    db_session.add(tick1)

    # 7. Trades & Positions
    trade1 = Trade(
        user_id=1,
        symbol="AAPL",
        buysell="B",
        tradedate=datetime(2026, 1, 15, 10, 0, 0),
        investment=True,
        price=175.0,
        quantity=100.0,
        remarks="Core portfolio purchase",
    )
    db_session.add(trade1)

    pos1 = Position(
        user_id=1,
        tradedate=date(2026, 3, 31),
        symbol="AAPL",
        investment=True,
        avgprice=175.0,
        quantity=100.0,
        eodprice=187.2,
    )
    db_session.add(pos1)

    # 8. Capital Transaction
    cap1 = Capital(
        user_id=1,
        broker="Saxo",
        transtype="D",
        accounttype="Cash",
        amount=50000.0,
        date=date(2026, 1, 10),
        currency="USD",
        remarks="Initial capital injection",
    )
    db_session.add(cap1)

    # 9. Margin Interest Rate & Accrual
    mir = MarginInterestRate(
        broker="Saxo",
        currency="USD",
        accounttype="MARGIN",
        annual_rate=0.0565,
        day_count_basis=360,
        effective_date=date(2026, 1, 1),
    )
    dmi = DailyMarginInterest(
        user_id=1,
        date=date(2026, 3, 31),
        broker="Saxo",
        currency="USD",
        loan_balance=10000.0,
        daily_rate=0.0565 / 360,
        daily_interest=(10000.0 * 0.0565) / 360,
        cumulative_interest=45.2,
    )
    db_session.add_all([mir, dmi])

    # 10. Daily Portfolio Summary
    dps = DailyPortfolioSummary(
        user_id=1,
        date=date(2026, 3, 31),
        currency="USD",
        investment=True,
        total_capital=50000.0,
        position_market_value=18720.0,
        realized_pnl=0.0,
        unrealized_pnl=1220.0,
        margin_loan_balance=0.0,
        daily_interest_accrued=0.0,
        cumulative_interest_accrued=0.0,
        total_asset_value=68720.0,
        total_pnl=1220.0,
        pct_pnl=2.44,
    )
    db_session.add(dps)

    # 11. User Session
    session1 = UserSession(
        sid="test-admin-session-token",
        user_id=1,
        expires_at=datetime(2026, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
    )
    db_session.add(session1)

    db_session.commit()

    return {
        "admin_user": admin_user,
        "regular_user": regular_user,
        "session_sid": "test-admin-session-token",
    }


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Yield a FastAPI TestClient bound to the in-memory SQLite database session."""
    import backend.main as b_main

    app_instance = getattr(b_main, "app", None)
    if app_instance is None and hasattr(b_main, "create_app"):
        app_instance = b_main.create_app()

    assert app_instance is not None, "Could not find FastAPI app or create_app in backend.main"

    def _override_get_db_session() -> Generator[Session, None, None]:
        yield db_session

    app_instance.dependency_overrides[get_db_session] = _override_get_db_session

    with TestClient(app_instance) as test_client:
        yield test_client

    app_instance.dependency_overrides.clear()
