"""Portfolio dashboard, positions, and valuation metrics API routes."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models import ExchangeRate, RefChartSettings, SysValue, Watchlist
from backend.db.session import get_db_session
from backend.dependencies import get_current_user_optional
from backend.repositories.portfolio_repo import (
    get_capital,
    get_portfolio_4chart_overview,
    get_portfolio_dashboard,
    get_positions,
    get_trades,
)
from backend.repositories.ref_data_repo import DEFAULT_CHART_PARAMETERS, get_chart_settings
from backend.schemas.auth import UserProfileResponse
from backend.schemas.portfolio import PortfolioDashboardResponse
from backend.schemas.ref_data import ChartSettingsDTO

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/overview")
def get_portfolio_overview(
    currency: str = Query(default="USD"),
    start_date: Optional[str] = Query(default=None, alias="startDate"),
    end_date: Optional[str] = Query(default=None, alias="endDate"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Return synchronized 4-chart analytical overview data
    (Equity vs Benchmark, Cumulative PnL, Allocation, Drawdown).
    """
    uid = user.id if user else 1
    data = get_portfolio_4chart_overview(
        db,
        user_id=uid,
        start_date=start_date,
        end_date=end_date,
        currency=currency,
    )
    if not data.get("chart1_equity_vs_benchmark") and uid != 1:
        data = get_portfolio_4chart_overview(
            db,
            user_id=1,
            start_date=start_date,
            end_date=end_date,
            currency=currency,
        )
    return data


@router.get("/dashboard", response_model=PortfolioDashboardResponse)
def get_dashboard(
    currency: str = Query(default="USD"),
    account: str = Query(default="All"),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> PortfolioDashboardResponse:
    """Return consolidated portfolio KPIs, balance matrix, performance series, and open positions."""
    uid = user.id if user else 1
    dashboard_data = get_portfolio_dashboard(
        db,
        user_id=uid,
        currency=currency,
        account=account,
    )
    # If empty and user wasn't default 1, fallback to 1
    if not dashboard_data.get("positions") and uid != 1:
        dashboard_data = get_portfolio_dashboard(
            db,
            user_id=1,
            currency=currency,
            account=account,
        )

    return PortfolioDashboardResponse(
        summary=dashboard_data["summary"],
        balanceMatrix=dashboard_data["balanceMatrix"],
        performanceSeries=dashboard_data["performanceSeries"],
        dailySummaries=dashboard_data["dailySummaries"],
        positions=dashboard_data["positions"],
        fxRates=dashboard_data["fxRates"],
    )


@router.get("/positions")
def list_positions(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Return current open positions."""
    uid = user.id if user else 1
    positions = get_positions(db, user_id=uid)
    if not positions and uid != 1:
        positions = get_positions(db, user_id=1)

    return [
        {
            "user_id": p.user_id,
            "symbol": p.symbol,
            "tradedate": p.tradedate.isoformat() if p.tradedate else None,
            "investment": p.investment,
            "avgprice": p.avgprice,
            "quantity": p.quantity,
            "eodprice": p.eodprice,
        }
        for p in positions
    ]


@router.get("/trades")
def list_trades(
    symbol: Optional[str] = Query(default=None),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Return trade history enriched with currency and previous-day FX rate."""
    uid = user.id if user else 1
    trades = get_trades(db, user_id=uid, symbol=symbol)
    if not trades and uid != 1:
        trades = get_trades(db, user_id=1, symbol=symbol)

    # Watchlist currency mapping
    wl_rows = db.scalars(select(Watchlist)).all()
    wl_map = {w.symbol.strip().upper(): w.currency.strip().upper() for w in wl_rows if w.symbol and w.currency}

    # Historical exchange rates mapping
    rates_stmt = (
        select(ExchangeRate)
        .where(
            ExchangeRate.base_currency == "USD",
            ExchangeRate.date <= func.current_date(),
        )
        .order_by(ExchangeRate.currency, ExchangeRate.date.asc())
    )
    rates_rows = list(db.scalars(rates_stmt).all())
    fx_map: dict[str, list[tuple[date, float]]] = {}
    for r in rates_rows:
        fx_map.setdefault(r.currency.strip().upper(), []).append((r.date, float(r.rate)))

    results: list[dict[str, Any]] = []
    for t in trades:
        clean_sym = (t.symbol or "").strip().upper()
        sym_ccy = wl_map.get(clean_sym) or ("SGD" if clean_sym.endswith(".SI") else "USD")

        # Derive previous-day exchange rate (max(date) < tradedate)
        fx_rate = 1.0
        if sym_ccy != "USD":
            t_dt = t.tradedate.date() if hasattr(t.tradedate, "date") else t.tradedate
            c_rates = fx_map.get(sym_ccy, [])
            prev_rates = [rate for d, rate in c_rates if d < t_dt]
            if prev_rates:
                fx_rate = prev_rates[-1]
            elif c_rates:
                fx_rate = c_rates[0][1]

        results.append(
            {
                "id": t.id,
                "user_id": t.user_id,
                "symbol": t.symbol,
                "buysell": t.buysell,
                "tradedate": t.tradedate.isoformat(),
                "investment": t.investment,
                "price": t.price,
                "quantity": t.quantity,
                "remarks": t.remarks,
                "currency": sym_ccy,
                "fx_rate": round(fx_rate, 4),
            }
        )
    return results


@router.get("/sys-today")
def get_sys_today(db: Session = Depends(get_db_session)) -> dict[str, str]:
    """Return current valuation GLOBAL_TODAY date."""
    g_today = db.scalar(select(SysValue.datevalue).where(SysValue.name == "GLOBAL_TODAY"))
    date_str = g_today.isoformat() if g_today else date.today().isoformat()
    return {"date": date_str}


@router.get("/summary")
def get_quick_summary(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Compatibility endpoint returning positions, capital, and high-level totals."""
    uid = user.id if user else 1
    positions = get_positions(db, user_id=uid)
    capital = get_capital(db, user_id=uid)
    if not positions and uid != 1:
        positions = get_positions(db, user_id=1)
        capital = get_capital(db, user_id=1)

    total_pos_val = sum(float(p.quantity or 0.0) * float(p.eodprice or p.avgprice or 0.0) for p in positions)
    net_cash = sum(float(c.amount) for c in capital)
    margin_lending = total_pos_val - net_cash

    return {
        "positions": [
            {
                "symbol": p.symbol,
                "quantity": p.quantity,
                "avgprice": p.avgprice,
                "eodprice": p.eodprice,
            }
            for p in positions
        ],
        "capital": [
            {
                "id": c.id,
                "broker": c.broker,
                "amount": c.amount,
                "currency": c.currency,
                "date": c.date.isoformat(),
            }
            for c in capital
        ],
        "summary": {
            "totalPositionValue": total_pos_val,
            "netCash": net_cash,
            "marginLending": margin_lending,
        },
    }


@router.get("/chart-settings", response_model=ChartSettingsDTO)
def get_user_chart_settings(
    symbol: Optional[str] = Query(default=None),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> ChartSettingsDTO:
    """Return effective chart settings for the current user and optional symbol via 4-tier cascade."""
    uid = user.id if user else None
    resolved = get_chart_settings(db, user_id=uid, symbol=symbol)
    if not resolved:
        resolved = RefChartSettings(parameters=DEFAULT_CHART_PARAMETERS)
    return ChartSettingsDTO.model_validate(resolved)
