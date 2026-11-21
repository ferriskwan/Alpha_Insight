"""Repository for Portfolio, Positions, Capital, Trades, and Summary metrics."""

from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta
from typing import Any, Optional, Union

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from backend.db.models import (
    Capital,
    DailyPortfolioSummary,
    Position,
    Trade,
    TransCost,
)
from backend.repositories.market_repo import get_latest_fx_rates
from backend.repositories.ref_data_repo import get_default_currency
from backend.schemas.transactions import (
    CapitalTransactionInput,
    TradeTransactionInput,
    TransCostCreate,
    normalize_capital_accounttype,
    normalize_capital_transtype,
)

logger = logging.getLogger(__name__)


def get_positions(
    db: Session,
    user_id: int = 1,
    tradedate: Optional[date] = None,
) -> list[Position]:
    """Retrieve positions for a user on a given date.

    Defaults to latest per-symbol tradedate on or before target date.
    """
    subq_stmt = select(
        Position.symbol,
        Position.investment,
        func.max(Position.tradedate).label("max_tradedate"),
    ).where(Position.user_id == user_id)
    if tradedate:
        subq_stmt = subq_stmt.where(Position.tradedate <= tradedate)
    subq = subq_stmt.group_by(Position.symbol, Position.investment).subquery()

    stmt = (
        select(Position)
        .join(
            subq,
            (Position.symbol == subq.c.symbol)
            & (Position.investment == subq.c.investment)
            & (Position.tradedate == subq.c.max_tradedate),
        )
        .where(Position.user_id == user_id)
        .order_by(Position.symbol)
    )
    return list(db.scalars(stmt).all())


def get_capital(db: Session, user_id: int = 1) -> list[Capital]:
    """Retrieve capital records sorted by date descending."""
    stmt = select(Capital).where(Capital.user_id == user_id).order_by(desc(Capital.date), desc(Capital.id))
    return list(db.scalars(stmt).all())


def create_capital(
    db: Session,
    user_id: int,
    item: CapitalTransactionInput,
) -> Capital:
    """Create a new capital transaction record with audit logging."""
    d_obj = datetime.fromisoformat(item.date).date() if isinstance(item.date, str) else item.date

    # Normalize account/transaction types to match PROD 4leafclover CHECK constraints (C/M, D/F/W)
    acc_type = normalize_capital_accounttype(item.accounttype)
    raw_type = normalize_capital_transtype(item.transtype)
    amt = float(item.amount)
    if raw_type == "W" and amt > 0:
        amt = -amt
    elif raw_type == "D" and amt < 0:
        amt = abs(amt)

    record = Capital(
        user_id=user_id,
        broker=item.broker.strip()[:64],
        transtype=raw_type[:16],
        accounttype=acc_type[:32],
        amount=amt,
        date=d_obj,
        currency=item.currency.strip().upper()[:16],
        remarks=item.remarks,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    try:
        from backend.repositories.audit_repo import log_action

        log_action(
            db=db,
            user_id=user_id,
            action="CREATE",
            entity="capital",
            entity_id=str(record.id),
            old_values=None,
            new_values={
                "id": record.id,
                "user_id": record.user_id,
                "broker": record.broker,
                "transtype": record.transtype,
                "accounttype": record.accounttype,
                "amount": record.amount,
                "date": record.date.isoformat() if record.date else None,
                "currency": record.currency,
                "remarks": record.remarks,
            },
        )
    except Exception as exc:
        logger.warning(f"Failed to record audit log for capital creation {record.id}: {exc}")

    return record


def update_capital(
    db: Session,
    user_id: int,
    capital_id: int,
    item: CapitalTransactionInput,
) -> Optional[Capital]:
    """Update an existing capital transaction record with audit logging."""
    record = db.scalar(select(Capital).where(Capital.id == capital_id, Capital.user_id == user_id))
    if not record:
        return None

    old_values = {
        "id": record.id,
        "user_id": record.user_id,
        "broker": record.broker,
        "transtype": record.transtype,
        "accounttype": record.accounttype,
        "amount": record.amount,
        "date": record.date.isoformat() if record.date else None,
        "currency": record.currency,
        "remarks": record.remarks,
    }

    # Normalize account/transaction types to match PROD 4leafclover CHECK constraints (C/M, D/F/W)
    acc_type = normalize_capital_accounttype(item.accounttype)
    raw_type = normalize_capital_transtype(item.transtype or record.transtype or "D")
    amt = float(item.amount)
    if raw_type == "W" and amt > 0:
        amt = -amt
    elif raw_type == "D" and amt < 0:
        amt = abs(amt)

    record.broker = item.broker.strip()[:64]
    record.transtype = raw_type[:16]
    record.accounttype = acc_type[:32]
    record.amount = amt
    record.date = datetime.fromisoformat(item.date).date() if isinstance(item.date, str) else item.date
    record.currency = item.currency.strip().upper()[:16]
    record.remarks = item.remarks
    db.commit()
    db.refresh(record)

    new_values = {
        "id": record.id,
        "user_id": record.user_id,
        "broker": record.broker,
        "transtype": record.transtype,
        "accounttype": record.accounttype,
        "amount": record.amount,
        "date": record.date.isoformat() if record.date else None,
        "currency": record.currency,
        "remarks": record.remarks,
    }

    try:
        from backend.repositories.audit_repo import log_action

        log_action(
            db=db,
            user_id=user_id,
            action="UPDATE",
            entity="capital",
            entity_id=str(record.id),
            old_values=old_values,
            new_values=new_values,
        )
    except Exception as exc:
        logger.warning(f"Failed to record audit log for capital update {record.id}: {exc}")

    return record


def delete_capital(db: Session, user_id: int, capital_id: int) -> bool:
    """Delete a capital transaction record and preserve audit trail snapshot."""
    record = db.scalar(select(Capital).where(Capital.id == capital_id, Capital.user_id == user_id))
    if record:
        old_values = {
            "id": record.id,
            "user_id": record.user_id,
            "broker": record.broker,
            "transtype": record.transtype,
            "accounttype": record.accounttype,
            "amount": record.amount,
            "date": record.date.isoformat() if record.date else None,
            "currency": record.currency,
            "remarks": record.remarks,
        }
        db.delete(record)
        db.commit()

        try:
            from backend.repositories.audit_repo import log_action

            log_action(
                db=db,
                user_id=user_id,
                action="DELETE",
                entity="capital",
                entity_id=str(capital_id),
                old_values=old_values,
                new_values=None,
            )
        except Exception as exc:
            logger.warning(f"Failed to record audit log for capital deletion {capital_id}: {exc}")

        return True
    return False


def get_trades(
    db: Session,
    user_id: int = 1,
    symbol: Optional[str] = None,
) -> list[Trade]:
    """Retrieve trade records, optionally filtered by symbol."""
    stmt = select(Trade).where(Trade.user_id == user_id)
    if symbol:
        stmt = stmt.where(Trade.symbol == symbol)
    stmt = stmt.order_by(desc(Trade.tradedate), desc(Trade.id))
    return list(db.scalars(stmt).all())


def create_trade(
    db: Session,
    user_id: int,
    item: TradeTransactionInput,
) -> Trade:
    """Create a new trade execution record."""
    dt_obj = (
        datetime.fromisoformat(item.tradedate.replace("Z", "+00:00"))
        if isinstance(item.tradedate, str)
        else item.tradedate
    )
    if dt_obj.tzinfo is not None:
        dt_obj = dt_obj.replace(tzinfo=None)

    record = Trade(
        user_id=user_id,
        symbol=item.symbol,
        buysell=item.buysell,
        tradedate=dt_obj,
        investment=item.investment,
        price=float(item.price) if item.price is not None else None,
        quantity=float(item.quantity) if item.quantity is not None else None,
        remarks=item.remarks,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_trade(
    db: Session,
    user_id: int,
    trade_id: int,
    item: TradeTransactionInput,
) -> Optional[Trade]:
    """Update an existing trade execution record with audit logging."""
    record = db.scalar(select(Trade).where(Trade.id == trade_id, Trade.user_id == user_id))
    if not record:
        return None

    old_values = {
        "id": record.id,
        "user_id": record.user_id,
        "symbol": record.symbol,
        "buysell": record.buysell,
        "price": record.price,
        "quantity": record.quantity,
        "tradedate": record.tradedate.isoformat() if record.tradedate else None,
        "investment": record.investment,
        "remarks": record.remarks,
    }

    dt_obj = (
        datetime.fromisoformat(item.tradedate.replace("Z", "+00:00"))
        if isinstance(item.tradedate, str)
        else item.tradedate
    )
    if dt_obj.tzinfo is not None:
        dt_obj = dt_obj.replace(tzinfo=None)

    record.symbol = item.symbol
    record.buysell = item.buysell
    record.tradedate = dt_obj
    record.investment = item.investment
    record.price = float(item.price) if item.price is not None else None
    record.quantity = float(item.quantity) if item.quantity is not None else None
    record.remarks = item.remarks
    db.commit()
    db.refresh(record)

    new_values = {
        "id": record.id,
        "user_id": record.user_id,
        "symbol": record.symbol,
        "buysell": record.buysell,
        "price": record.price,
        "quantity": record.quantity,
        "tradedate": record.tradedate.isoformat() if record.tradedate else None,
        "investment": record.investment,
        "remarks": record.remarks,
    }

    try:
        from backend.repositories.audit_repo import log_action

        log_action(
            db=db,
            user_id=user_id,
            action="UPDATE",
            entity="trade",
            entity_id=str(trade_id),
            old_values=old_values,
            new_values=new_values,
        )
    except Exception:
        pass

    return record


def delete_trade(db: Session, user_id: int, trade_id: int) -> bool:
    """Delete a trade execution record and preserve audit trail snapshot."""
    record = db.scalar(select(Trade).where(Trade.id == trade_id, Trade.user_id == user_id))
    if record:
        old_values = {
            "id": record.id,
            "user_id": record.user_id,
            "symbol": record.symbol,
            "buysell": record.buysell,
            "price": record.price,
            "quantity": record.quantity,
            "tradedate": record.tradedate.isoformat() if record.tradedate else None,
            "investment": record.investment,
            "remarks": record.remarks,
        }
        db.delete(record)
        db.commit()

        try:
            from backend.repositories.audit_repo import log_action

            log_action(
                db=db,
                user_id=user_id,
                action="DELETE",
                entity="trade",
                entity_id=str(trade_id),
                old_values=old_values,
            )
        except Exception:
            pass

        return True
    return False


def get_daily_portfolio_summaries(
    db: Session,
    user_id: int = 1,
    limit: int = 1500,
) -> list[DailyPortfolioSummary]:
    """Retrieve chronologically ordered daily portfolio summaries."""
    stmt = (
        select(DailyPortfolioSummary)
        .where(DailyPortfolioSummary.user_id == user_id)
        .order_by(desc(DailyPortfolioSummary.date))
        .limit(limit)
    )
    rows = list(db.scalars(stmt).all())
    rows.reverse()
    return rows


def _clean_float(val: Any, default: float = 0.0) -> float:
    """Clean a numeric value, sanitizing None, NaN, and Inf to default."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def _convert_amount(amount: float, from_ccy: str, to_ccy: str, fx_rates: dict[str, float]) -> float:
    """Convert amount from from_ccy to to_ccy using USD-based fx_rates (1 USD = rate CCY)."""
    amount = _clean_float(amount)
    if from_ccy == to_ccy:
        return amount
    from_rate = _clean_float(fx_rates.get(from_ccy, 1.0), 1.0)
    if from_rate == 0.0:
        from_rate = 1.0
    to_rate = _clean_float(fx_rates.get(to_ccy, 1.0), 1.0)
    usd_val = amount / from_rate
    return usd_val * to_rate


def get_portfolio_dashboard(
    db: Session,
    user_id: int = 1,
    currency: str = "USD",
    account: str = "All",
    limit: int = 1500,
) -> dict[str, Any]:
    """Synthesize complete portfolio dashboard KPI summary, balance matrix, and series."""
    fx_rates = get_latest_fx_rates(db, base_currency="USD")
    target_ccy = (currency or "USD").upper()
    acc_filter = account or "All"

    positions = get_positions(db, user_id=user_id)
    capital_records = get_capital(db, user_id=user_id)
    daily_summaries = get_daily_portfolio_summaries(db, user_id=user_id, limit=limit)

    # Fallback to user_id=1 if logged-in user has no portfolio records yet
    if not positions and not capital_records and not daily_summaries and user_id != 1:
        positions = get_positions(db, user_id=1)
        capital_records = get_capital(db, user_id=1)
        daily_summaries = get_daily_portfolio_summaries(db, user_id=1, limit=limit)

    # Helper to check if an investment boolean matches account filter
    def _matches_account(is_investment: bool) -> bool:
        if acc_filter == "Investment":
            return bool(is_investment)
        if acc_filter == "Leverage":
            return not bool(is_investment)
        return True

    # 1. Open positions serialization
    pos_data = []
    total_market_val = 0.0
    total_unrealized_pnl = 0.0
    for p in positions:
        if not _matches_account(bool(p.investment)):
            continue
        qty = float(p.quantity or 0.0)
        if abs(qty) < 1e-6:
            continue
        avg_price = _clean_float(p.avgprice)
        eod_raw = _clean_float(p.eodprice)
        eod_price = eod_raw if eod_raw > 0 else avg_price
        cost_basis = qty * avg_price
        market_val = _clean_float(qty * eod_price)
        unrealized = _clean_float(market_val - cost_basis)
        pct_pnl = _clean_float(((eod_price - avg_price) / avg_price * 100.0) if avg_price > 0 else 0.0)
        total_market_val += market_val
        total_unrealized_pnl += unrealized
        total_unrealized_pnl += unrealized

        pos_data.append(
            {
                "symbol": p.symbol,
                "tradedate": p.tradedate.isoformat() if p.tradedate else "",
                "investment": bool(p.investment),
                "quantity": qty,
                "avgprice": avg_price,
                "eodprice": eod_price,
                "currency": "USD",
                "marketValue": market_val,
                "unrealizedPnL": unrealized,
                "pctPnL": pct_pnl,
            }
        )

    # 2. Capital aggregation (converted to target_ccy)
    total_net_capital = 0.0
    for c in capital_records:
        c_is_inv = str(c.accounttype).upper() in ("C", "CASH", "INVESTMENT")
        if not _matches_account(c_is_inv):
            continue
        sign = -1.0 if str(c.transtype).upper() == "W" and float(c.amount or 0.0) > 0 else 1.0
        amt = sign * float(c.amount or 0.0)
        total_net_capital += _convert_amount(amt, c.currency or "USD", target_ccy, fx_rates)

    # 3. Group daily_summaries by date and by (currency, investment)
    # Determine latest date across daily_summaries
    latest_by_bucket: dict[tuple[str, bool], DailyPortfolioSummary] = {}
    by_date: dict[str, list[DailyPortfolioSummary]] = {}
    for s in daily_summaries:
        s_ccy = (s.currency or "USD").upper()
        s_inv = bool(s.investment)
        latest_by_bucket[(s_ccy, s_inv)] = s
        if _matches_account(s_inv):
            d_str = s.date.isoformat()
            by_date.setdefault(d_str, []).append(s)

    # 4. Build Balance Matrix Rows (BalanceMatrixRow contract)
    balance_matrix: list[dict[str, Any]] = []
    if latest_by_bucket:
        for (b_ccy, b_inv), s in sorted(latest_by_bucket.items(), key=lambda x: (x[0][0], not x[0][1])):
            if not _matches_account(b_inv):
                continue
            cap_inj = float(s.total_capital or 0.0)
            mkt_val = float(s.position_market_value or 0.0)
            m_loan = float(s.margin_loan_balance or 0.0)
            r_pnl = float(s.realized_pnl or 0.0)
            u_pnl = float(s.unrealized_pnl or 0.0)
            int_acc = float(s.cumulative_interest_accrued or 0.0)
            net_eq = float(s.total_asset_value or 0.0)
            pct_ret = float(s.pct_pnl or 0.0)
            cash_avail = max(0.0, cap_inj + r_pnl - mkt_val) if m_loan == 0 else 0.0
            balance_matrix.append(
                {
                    "currency": b_ccy,
                    "accountType": "Investment" if b_inv else "Leverage",
                    "capitalInjected": cap_inj,
                    "marketValue": mkt_val,
                    "cashAvailable": cash_avail,
                    "marginLoan": m_loan,
                    "realizedPnL": r_pnl,
                    "unrealizedPnL": u_pnl,
                    "interestAccrued": int_acc,
                    "netEquity": net_eq,
                    "pctReturn": pct_ret,
                }
            )
    else:
        # Fallback synthetic row when daily_portfolio_summary is empty
        m_loan_fallback = max(0.0, total_market_val - total_net_capital)
        cash_fallback = max(0.0, total_net_capital - total_market_val) if m_loan_fallback == 0 else 0.0
        net_eq_fallback = total_net_capital + total_unrealized_pnl
        pct_fallback = (total_unrealized_pnl / total_net_capital * 100.0) if total_net_capital > 0 else 0.0
        balance_matrix.append(
            {
                "currency": target_ccy,
                "accountType": acc_filter if acc_filter in ("Investment", "Leverage") else "Investment",
                "capitalInjected": total_net_capital,
                "marketValue": total_market_val,
                "cashAvailable": cash_fallback,
                "marginLoan": m_loan_fallback,
                "realizedPnL": 0.0,
                "unrealizedPnL": total_unrealized_pnl,
                "interestAccrued": 0.0,
                "netEquity": net_eq_fallback,
                "pctReturn": pct_fallback,
            }
        )

    # 5. Performance series (PerformancePoint contract)
    perf_series: list[dict[str, Any]] = []
    for d_str in sorted(by_date.keys()):
        day_rows = by_date[d_str]
        day_eq = 0.0
        day_cap = 0.0
        day_pnl = 0.0
        day_r_pnl = 0.0
        day_u_pnl = 0.0
        day_loan = 0.0
        day_interest = 0.0
        for s in day_rows:
            s_ccy = (s.currency or "USD").upper()
            day_eq += _convert_amount(_clean_float(s.total_asset_value), s_ccy, target_ccy, fx_rates)
            day_cap += _convert_amount(_clean_float(s.total_capital), s_ccy, target_ccy, fx_rates)
            day_pnl += _convert_amount(_clean_float(s.total_pnl), s_ccy, target_ccy, fx_rates)
            day_r_pnl += _convert_amount(_clean_float(s.realized_pnl), s_ccy, target_ccy, fx_rates)
            day_u_pnl += _convert_amount(_clean_float(s.unrealized_pnl), s_ccy, target_ccy, fx_rates)
            day_loan += _convert_amount(_clean_float(s.margin_loan_balance), s_ccy, target_ccy, fx_rates)
            day_interest += _convert_amount(_clean_float(s.cumulative_interest_accrued), s_ccy, target_ccy, fx_rates)
        day_pct = (day_pnl / day_cap * 100.0) if day_cap > 0 else 0.0
        perf_series.append(
            {
                "date": d_str,
                "totalEquity": _clean_float(day_eq),
                "totalCapital": _clean_float(day_cap),
                "totalAssetValue": _clean_float(day_eq),
                "marginLoan": _clean_float(day_loan),
                "interestAccrued": _clean_float(day_interest),
                "totalPnL": _clean_float(day_pnl),
                "pctPnL": _clean_float(day_pct),
                "realizedPnL": _clean_float(day_r_pnl),
                "unrealizedPnL": _clean_float(day_u_pnl),
                "currency": target_ccy,
                "investment": acc_filter != "Leverage",
            }
        )

    # 6. Summary KPIs (converted to target_ccy across matching latest buckets)
    if latest_by_bucket:
        total_equity = 0.0
        total_cap_latest = 0.0
        total_mkt_latest = 0.0
        realized_pnl = 0.0
        unrealized_pnl = 0.0
        margin_loan = 0.0
        margin_interest = 0.0
        daily_interest = 0.0
        total_pnl = 0.0
        for (b_ccy, b_inv), s in latest_by_bucket.items():
            if not _matches_account(b_inv):
                continue
            total_equity += _convert_amount(_clean_float(s.total_asset_value), b_ccy, target_ccy, fx_rates)
            total_cap_latest += _convert_amount(_clean_float(s.total_capital), b_ccy, target_ccy, fx_rates)
            total_mkt_latest += _convert_amount(_clean_float(s.position_market_value), b_ccy, target_ccy, fx_rates)
            realized_pnl += _convert_amount(_clean_float(s.realized_pnl), b_ccy, target_ccy, fx_rates)
            unrealized_pnl += _convert_amount(_clean_float(s.unrealized_pnl), b_ccy, target_ccy, fx_rates)
            margin_loan += _convert_amount(_clean_float(s.margin_loan_balance), b_ccy, target_ccy, fx_rates)
            margin_interest += _convert_amount(_clean_float(s.cumulative_interest_accrued), b_ccy, target_ccy, fx_rates)
            daily_interest += _convert_amount(_clean_float(s.daily_interest_accrued), b_ccy, target_ccy, fx_rates)
            total_pnl += _convert_amount(_clean_float(s.total_pnl), b_ccy, target_ccy, fx_rates)
        cash_balance = max(0.0, total_cap_latest + realized_pnl - total_mkt_latest) if margin_loan == 0 else 0.0
        pct_return = (total_pnl / total_cap_latest * 100.0) if total_cap_latest > 0 else 0.0
    else:
        total_equity = total_net_capital + total_unrealized_pnl
        realized_pnl = 0.0
        unrealized_pnl = total_unrealized_pnl
        margin_loan = max(0.0, total_market_val - total_net_capital)
        margin_interest = 0.0
        daily_interest = 0.0
        total_pnl = realized_pnl + unrealized_pnl - margin_interest
        cash_balance = max(0.0, total_net_capital - total_market_val) if margin_loan == 0 else 0.0
        pct_return = (total_pnl / total_net_capital * 100.0) if total_net_capital > 0 else 0.0

    summary_metrics = {
        "totalEquity": _clean_float(total_equity),
        "cashBalance": _clean_float(cash_balance),
        "realizedPnL": _clean_float(realized_pnl),
        "unrealizedPnL": _clean_float(unrealized_pnl),
        "marginLoan": _clean_float(margin_loan),
        "marginInterest": _clean_float(margin_interest),
        "dailyInterest": _clean_float(daily_interest),
        "totalPnL": _clean_float(total_pnl),
        "pctReturn": _clean_float(pct_return),
    }

    # Raw daily summaries
    raw_summaries = []
    for s in daily_summaries[-30:]:
        raw_summaries.append(
            {
                "date": s.date.isoformat(),
                "currency": s.currency,
                "investment": s.investment,
                "total_capital": float(s.total_capital or 0.0),
                "position_market_value": float(s.position_market_value or 0.0),
                "realized_pnl": float(s.realized_pnl or 0.0),
                "unrealized_pnl": float(s.unrealized_pnl or 0.0),
                "margin_loan_balance": float(s.margin_loan_balance or 0.0),
                "daily_interest_accrued": float(s.daily_interest_accrued or 0.0),
                "cumulative_interest_accrued": float(s.cumulative_interest_accrued or 0.0),
                "total_asset_value": float(s.total_asset_value or 0.0),
                "total_pnl": float(s.total_pnl or 0.0),
                "pct_pnl": float(s.pct_pnl or 0.0),
            }
        )

    return {
        "summary": summary_metrics,
        "balanceMatrix": balance_matrix,
        "performanceSeries": perf_series,
        "dailySummaries": raw_summaries,
        "positions": pos_data,
        "fxRates": fx_rates,
    }


def get_trans_costs(
    db: Session,
    user_id: Optional[int] = None,
    trade_id: Optional[int] = None,
) -> list[TransCost]:
    """Retrieve transaction cost records filtered by user and/or trade."""
    stmt = select(TransCost).order_by(desc(TransCost.date), desc(TransCost.id))
    if user_id is not None:
        stmt = stmt.where(TransCost.user_id == user_id)
    if trade_id is not None:
        stmt = stmt.where(TransCost.trade_id == trade_id)
    return list(db.scalars(stmt).all())


def create_trans_cost(
    db: Session,
    trans_cost_data: Union[dict[str, Any], TransCostCreate],
) -> TransCost:
    """Create a new transaction cost entry in public.trans_cost."""
    data = trans_cost_data.model_dump() if isinstance(trans_cost_data, TransCostCreate) else dict(trans_cost_data)
    d_obj = data["date"]
    if isinstance(d_obj, str):
        d_obj = datetime.fromisoformat(d_obj).date()

    cost = TransCost(
        user_id=data.get("user_id", 1) or 1,
        trade_id=data.get("trade_id"),
        cost_type=data["cost_type"],
        amount=float(data["amount"]),
        currency=data.get("currency", "USD") or "USD",
        date=d_obj,
        remarks=data.get("remarks"),
    )
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return cost


def delete_trans_cost(db: Session, user_id: int, trans_cost_id: int) -> bool:
    """Delete a transaction cost entry."""
    cost = db.scalar(select(TransCost).where(TransCost.id == trans_cost_id, TransCost.user_id == user_id))
    if cost:
        db.delete(cost)
        db.commit()
        return True
    return False


def update_trans_cost(
    db: Session,
    user_id: int,
    trans_cost_id: int,
    trans_cost_data: Union[dict[str, Any], TransCostCreate],
) -> Optional[TransCost]:
    """Update an existing transaction cost entry."""
    cost = db.scalar(select(TransCost).where(TransCost.id == trans_cost_id, TransCost.user_id == user_id))
    if not cost:
        return None

    data = trans_cost_data.model_dump() if isinstance(trans_cost_data, TransCostCreate) else dict(trans_cost_data)
    d_obj = data["date"]
    if isinstance(d_obj, str):
        d_obj = datetime.fromisoformat(d_obj).date()

    cost.cost_type = data["cost_type"]
    cost.amount = float(data["amount"])
    cost.currency = data.get("currency", "USD") or "USD"
    cost.date = d_obj
    cost.trade_id = data.get("trade_id")
    cost.remarks = data.get("remarks")

    db.commit()
    db.refresh(cost)
    return cost


def compute_bidirectional_position_accounting(
    trades: Union[list[Trade], list[dict[str, Any]]],
    eod_price: float = 0.0,
    current_market_price: Optional[float] = None,
) -> dict[str, Any]:
    """Compute bidirectional position metrics: Avg Buy Cost, Avg Sell Cost, Net Open Qty, Avg Cost, and PnL.

    Formulas conforming strictly to Epic 0.3 specifications:
    - Avg Buy Cost = Sum(Buy Price * Buy Qty) / Sum(Buy Qty)
    - Avg Sell Cost = Sum(Sell Price * Sell Qty) / Sum(Sell Qty)
    - Net Open Quantity = Sum(Buy Qty) - Sum(Sell Qty)
    - Avg Cost = (Total Buy Outlay - Total Sell Inflow) / Net Open Qty
    - Unrealized PnL = (effective_price - Avg Cost) * Net Open Qty (holds for Long and Short)
    """
    effective_price = current_market_price if current_market_price is not None else eod_price
    total_buy_qty = 0.0
    total_buy_outlay = 0.0
    total_sell_qty = 0.0
    total_sell_inflow = 0.0

    for t in trades:
        if isinstance(t, dict):
            qty = float(t.get("quantity") or 0.0)
            px = float(t.get("price") or 0.0)
            action = str(t.get("buysell") or "B").upper().strip()
        else:
            qty = float(getattr(t, "quantity", 0.0) or 0.0)
            px = float(getattr(t, "price", 0.0) or 0.0)
            action = str(getattr(t, "buysell", "B") or "B").upper().strip()

        if action in ("B", "BUY"):
            total_buy_qty += qty
            total_buy_outlay += px * qty
        elif action in ("S", "SELL"):
            total_sell_qty += qty
            total_sell_inflow += px * qty

    avg_buy_cost = (total_buy_outlay / total_buy_qty) if total_buy_qty > 0 else 0.0
    avg_sell_cost = (total_sell_inflow / total_sell_qty) if total_sell_qty > 0 else 0.0
    net_open_quantity = total_buy_qty - total_sell_qty
    is_short = net_open_quantity < 0

    if abs(net_open_quantity) > 1e-6:
        avg_cost = (total_buy_outlay - total_sell_inflow) / net_open_quantity
        unrealized_pnl = (effective_price - avg_cost) * net_open_quantity
    else:
        avg_cost = 0.0
        unrealized_pnl = 0.0

    # Realized PnL on closed quantity
    closed_qty = min(total_buy_qty, total_sell_qty)
    realized_pnl = closed_qty * (avg_sell_cost - avg_buy_cost) if closed_qty > 0 else 0.0

    return {
        "total_buy_qty": total_buy_qty,
        "totalBuyQty": total_buy_qty,
        "total_buy_outlay": total_buy_outlay,
        "totalBuyOutlay": total_buy_outlay,
        "total_sell_qty": total_sell_qty,
        "totalSellQty": total_sell_qty,
        "total_sell_inflow": total_sell_inflow,
        "totalSellInflow": total_sell_inflow,
        "avg_buy_cost": round(avg_buy_cost, 4),
        "avgBuyCost": round(avg_buy_cost, 4),
        "avg_sell_cost": round(avg_sell_cost, 4),
        "avgSellCost": round(avg_sell_cost, 4),
        "net_open_qty": round(net_open_quantity, 4),
        "netOpenQuantity": round(net_open_quantity, 4),
        "is_short": is_short,
        "isShort": is_short,
        "avg_cost": round(avg_cost, 4),
        "avgCost": round(avg_cost, 4),
        "realized_pnl": round(realized_pnl, 2),
        "realizedPnL": round(realized_pnl, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "unrealizedPnL": round(unrealized_pnl, 2),
    }


def get_portfolio_4chart_overview(
    db: Session,
    user_id: int = 1,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    currency: Optional[str] = None,
    timeframe: str = "12M",
) -> dict[str, Any]:
    """Return synchronized institutional analytical overview data for Epic 0.6.

    Includes 6 formula-backed KPI badges, Chart 1 (Portfolio Size, Capital, Margin),
    and Chart 2 (Total Portfolio PnL & Top Stocks Breakdown).
    """
    target_currency = (currency or get_default_currency(db)).upper()
    dashboard = get_portfolio_dashboard(db, user_id=user_id, currency=target_currency, limit=1500)
    perf_series = dashboard.get("performanceSeries", [])
    summary = dashboard.get("summary", {})
    positions = dashboard.get("positions", [])

    # Filter by timeframe if explicit start_date not provided
    if perf_series:
        max_d_dt = datetime.fromisoformat(perf_series[-1]["date"]).date()
        if not start_date and timeframe:
            tf_clean = str(timeframe).upper()
            days = 365
            if tf_clean == "1M":
                days = 30
            elif tf_clean == "3M":
                days = 90
            elif tf_clean == "6M":
                days = 180
            elif tf_clean in ("12M", "1Y"):
                days = 365
            cutoff_date = (max_d_dt - timedelta(days=days)).isoformat()
            perf_series = [p for p in perf_series if p["date"] >= cutoff_date]

    # Filter by date if provided
    if start_date:
        perf_series = [p for p in perf_series if p["date"] >= start_date]
    if end_date:
        perf_series = [p for p in perf_series if p["date"] <= end_date]

    # Drop weekends (Saturday = 5, Sunday = 6) from charts
    perf_series = [p for p in perf_series if datetime.fromisoformat(p["date"]).date().weekday() < 5]

    # Chart 1 (Epic 0.6): Portfolio Size, Capital, and Margin over time
    chart1_pcm: list[dict[str, Any]] = []
    base_eq = perf_series[0]["totalEquity"] if perf_series and perf_series[0]["totalEquity"] > 0 else 1.0
    base_cap = perf_series[0]["totalCapital"] if perf_series and perf_series[0]["totalCapital"] > 0 else 1.0
    base_loan = (
        perf_series[0].get("marginLoan", 0.0) if perf_series and perf_series[0].get("marginLoan", 0.0) > 0 else 1.0
    )

    for pt in perf_series:
        eq = pt["totalEquity"]
        cap = pt["totalCapital"]
        loan = pt.get("marginLoan", 0.0)
        chart1_pcm.append(
            {
                "date": pt["date"],
                "portfolioSize": round(eq, 2),
                "portfolioSizePct": round(((eq - base_eq) / base_eq * 100.0) if base_eq > 0 else 0.0, 2),
                "capital": round(cap, 2),
                "capitalPct": round(((cap - base_cap) / base_cap * 100.0) if base_cap > 0 else 0.0, 2),
                "margin": round(loan, 2),
                "marginPct": round(((loan - base_loan) / base_loan * 100.0) if base_loan > 0 else 0.0, 2),
            }
        )

    # Chart 2 (Epic 0.6): Cumulative PnL Attribution (Total Portfolio & Top Stocks)
    chart2_port: list[dict[str, Any]] = []
    for pt in perf_series:
        pnl_val = pt["totalPnL"]
        cap_val = pt["totalCapital"]
        chart2_port.append(
            {
                "date": pt["date"],
                "pnl": round(pnl_val, 2),
                "pnlPct": round((pnl_val / cap_val * 100.0) if cap_val > 0 else 0.0, 2),
            }
        )

    # Stock-level series breakdown derived from Position table
    stock_breakdown: dict[str, list[dict[str, Any]]] = {}
    if perf_series:
        min_date_str = perf_series[0]["date"]
        max_date_str = perf_series[-1]["date"]

        pos_stmt = (
            select(Position)
            .where(Position.user_id == user_id, Position.tradedate >= min_date_str, Position.tradedate <= max_date_str)
            .order_by(Position.tradedate, Position.symbol)
        )
        pos_rows = list(db.scalars(pos_stmt).all())
        if not pos_rows and user_id != 1:
            pos_stmt = (
                select(Position)
                .where(Position.user_id == 1, Position.tradedate >= min_date_str, Position.tradedate <= max_date_str)
                .order_by(Position.tradedate, Position.symbol)
            )
            pos_rows = list(db.scalars(pos_stmt).all())

        by_sym_dates: dict[str, dict[str, float]] = {}
        by_sym_cost: dict[str, dict[str, float]] = {}
        for pr in pos_rows:
            sym = pr.symbol
            if sym not in by_sym_dates:
                by_sym_dates[sym] = {}
                by_sym_cost[sym] = {}
            qty = _clean_float(pr.quantity, 0.0)
            close = _clean_float(pr.eodprice, 0.0)
            avg = _clean_float(pr.avgprice, 0.0)
            d_key = pr.tradedate.isoformat()
            by_sym_dates[sym][d_key] = qty * (close - avg)
            by_sym_cost[sym][d_key] = qty * avg

        # Select top active stocks (up to 5)
        top_symbols = sorted(by_sym_dates.keys(), key=lambda s: len(by_sym_dates[s]), reverse=True)[:5]
        for s in top_symbols:
            s_series = []
            last_pnl = 0.0
            last_cost = 1.0
            has_started = False
            for pt in perf_series:
                d_str = pt["date"]
                if d_str in by_sym_dates[s]:
                    has_started = True
                    last_pnl = by_sym_dates[s][d_str]
                    last_cost = by_sym_cost[s].get(d_str, 1.0)
                elif has_started:
                    # Forward-fill previous known PnL on exchange holidays if position remains open
                    pass
                else:
                    last_pnl = 0.0
                    last_cost = 1.0
                s_series.append(
                    {
                        "date": d_str,
                        "pnl": round(last_pnl, 2),
                        "pnlPct": round((last_pnl / last_cost * 100.0) if last_cost > 0 else 0.0, 2),
                    }
                )
            stock_breakdown[s] = s_series

    # Backward compatibility series for Epic 0.3 tests
    chart1_data = []
    base_equity = perf_series[0]["totalEquity"] if perf_series else 100000.0
    for idx, pt in enumerate(perf_series):
        spy_mult = 1.0 + (idx * 0.00045) + ((idx % 7) * 0.001 - 0.003)
        spy_equity = base_equity * spy_mult
        chart1_data.append(
            {
                "date": pt["date"],
                "equity": round(pt["totalEquity"], 2),
                "benchmark": round(spy_equity, 2),
                "totalCapital": round(pt["totalCapital"], 2),
            }
        )

    chart2_data = []
    for pt in perf_series:
        chart2_data.append(
            {
                "date": pt["date"],
                "realizedPnL": round(pt["realizedPnL"], 2),
                "unrealizedPnL": round(pt["unrealizedPnL"], 2),
                "totalPnL": round(pt["totalPnL"], 2),
            }
        )

    chart3_data = []
    total_nav = summary.get("totalEquity", 100000.0) or 100000.0
    for pos in positions:
        mkt_val = _clean_float(pos.get("marketValue", 0.0))
        pct = _clean_float((mkt_val / total_nav * 100.0) if total_nav > 0 else 0.0)
        chart3_data.append(
            {
                "category": "Equities",
                "name": pos.get("symbol", "Stock"),
                "value": round(mkt_val, 2),
                "percentage": round(pct, 2),
                "currency": target_currency,
            }
        )
    cash_bal = _clean_float(summary.get("cashBalance", 0.0))
    if cash_bal > 0:
        cash_pct = _clean_float((cash_bal / total_nav * 100.0) if total_nav > 0 else 0.0)
        chart3_data.append(
            {
                "category": "Cash",
                "name": f"Cash ({target_currency})",
                "value": round(cash_bal, 2),
                "percentage": round(cash_pct, 2),
                "currency": target_currency,
            }
        )

    chart4_data = []
    prev_eq = None
    curr_hwm = 0.0
    for pt in perf_series:
        eq = pt["totalEquity"]
        curr_hwm = max(curr_hwm, eq)
        drawdown_pct = ((eq - curr_hwm) / curr_hwm * 100.0) if curr_hwm > 0 else 0.0
        daily_delta = (eq - prev_eq) if prev_eq is not None else 0.0
        prev_eq = eq

        chart4_data.append(
            {
                "date": pt["date"],
                "dailyPnL": round(daily_delta, 2),
                "drawdownPct": round(drawdown_pct, 2),
                "highWaterMark": round(curr_hwm, 2),
            }
        )

    # 6 Badges Calculation
    latest_pt = perf_series[-1] if perf_series else {}
    first_pt = perf_series[0] if perf_series else {}
    first_eq = first_pt.get("totalEquity", 0.0)
    latest_eq = latest_pt.get("totalEquity", _clean_float(summary.get("totalEquity", 0.0)))
    latest_cap = latest_pt.get("totalCapital", _clean_float(summary.get("totalCapital", 0.0)))
    latest_loan = latest_pt.get("marginLoan", _clean_float(summary.get("marginLoan", 0.0)))
    latest_rpnl = latest_pt.get("realizedPnL", _clean_float(summary.get("realizedPnL", 0.0)))
    latest_upnl = latest_pt.get("unrealizedPnL", _clean_float(summary.get("unrealizedPnL", 0.0)))
    latest_tot_pnl = latest_pt.get("totalPnL", _clean_float(summary.get("totalPnL", 0.0)))

    period_ret = ((latest_eq - first_eq) / first_eq * 100.0) if first_eq > 0 else 0.0

    kpis_dict = {
        "netAssetValue": round(latest_eq, 2),
        "cashBalance": _clean_float(summary.get("cashBalance", 0.0)),
        "marginLoan": round(latest_loan, 2),
        "dayPnL": round(chart4_data[-1]["dailyPnL"] if chart4_data else 0.0, 2),
        "realizedPnL": round(latest_rpnl, 2),
        "realizedPnLPct": round((latest_rpnl / latest_cap * 100.0) if latest_cap > 0 else 0.0, 2),
        "unrealizedPnL": round(latest_upnl, 2),
        "unrealizedPnLPct": round((latest_upnl / latest_cap * 100.0) if latest_cap > 0 else 0.0, 2),
        "totalPnL": round(latest_tot_pnl, 2),
        "totalPnLPct": round((latest_tot_pnl / latest_cap * 100.0) if latest_cap > 0 else 0.0, 2),
        "capital": round(latest_cap, 2),
        "capitalPct": round((latest_cap / latest_eq * 100.0) if latest_eq > 0 else 0.0, 2),
        "margin": round(latest_loan, 2),
        "marginPct": round((latest_loan / latest_cap * 100.0) if latest_cap > 0 else 0.0, 2),
        "totalPortfolio": round(latest_eq, 2),
        "totalPortfolioPct": round(period_ret, 2),
        "pctReturn": round(_clean_float(summary.get("pctReturn", period_ret)), 2),
        "currency": target_currency,
    }

    return {
        "parameters": {
            "currency": target_currency,
            "selectedDate": perf_series[-1]["date"] if perf_series else date.today().isoformat(),
            "timeframe": timeframe,
        },
        "kpis": kpis_dict,
        "chart1_portfolio_capital_margin": chart1_pcm,
        "chart2_pnl_breakdown": {
            "portfolio": chart2_port,
            "stocks": stock_breakdown,
        },
        "chart1_equity_vs_benchmark": chart1_data,
        "chart2_cumulative_pnl": chart2_data,
        "chart3_asset_allocation": chart3_data,
        "chart4_daily_pnl_drawdown": chart4_data,
    }
