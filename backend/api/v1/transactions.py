"""Transaction editor CRUD endpoints for Watchlist, Trade, Capital, and SysValue."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.db.models import ExchangeRate, Watchlist
from backend.db.session import get_db_session
from backend.dependencies import get_current_user_optional
from backend.repositories.audit_repo import log_action
from backend.repositories.market_repo import (
    delete_watchlist_item,
    get_watchlist,
    upsert_watchlist_item,
)
from backend.repositories.portfolio_repo import (
    create_capital,
    create_trade,
    create_trans_cost,
    delete_capital,
    delete_trade,
    delete_trans_cost,
    get_capital,
    get_trades,
    get_trans_costs,
    update_capital,
    update_trade,
    update_trans_cost,
)
from backend.repositories.sys_repo import (
    delete_sysvalue,
    get_sysvalues,
    upsert_sysvalue,
)
from backend.schemas.auth import UserProfileResponse
from backend.schemas.transactions import (
    CapitalTransactionInput,
    SysValueTransactionInput,
    TradeTransactionInput,
    TransCostCreate,
    TransCostDTO,
    WatchlistTransactionInput,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# 1. Watchlist CRUD
# ---------------------------------------------------------------------------
@router.get("/watchlist")
def list_watchlist_records(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve full watchlist transaction table records."""
    uid = user.id if user else 1
    items = get_watchlist(db, user_id=uid)
    if not items and uid != 1:
        items = get_watchlist(db, user_id=1)
    return [
        {
            "user_id": w.user_id,
            "watchlistname": w.watchlistname,
            "symbol": w.symbol,
            "name": w.name,
            "timezone": w.timezone,
            "currency": w.currency,
        }
        for w in items
    ]


@router.post("/watchlist")
def add_watchlist_record(
    payload: WatchlistTransactionInput,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Create or update a watchlist record."""
    uid = user.id if user else 1
    item = upsert_watchlist_item(db, payload, user_id=uid)
    return {
        "status": "success",
        "symbol": item.symbol,
        "name": item.name,
    }


@router.put("/watchlist")
def update_watchlist_record(
    payload: WatchlistTransactionInput,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Update an existing watchlist record."""
    uid = user.id if user else 1
    item = upsert_watchlist_item(db, payload, user_id=uid)
    return {
        "status": "success",
        "symbol": item.symbol,
        "name": item.name,
    }


@router.delete("/watchlist")
def remove_watchlist_record(
    symbol: Optional[str] = Query(default=None),
    watchlistname: Optional[str] = Query(default=None),
    payload: Optional[dict[str, Any]] = Body(default=None),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a watchlist record."""
    uid = user.id if user else 1
    target_symbol = symbol or (str(payload["symbol"]) if payload and payload.get("symbol") else None)
    target_wl = watchlistname or (
        str(payload["watchlistname"]) if payload and payload.get("watchlistname") else "Default"
    )
    if not target_symbol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Watchlist symbol must be specified",
        )
    deleted = delete_watchlist_item(db, target_symbol, user_id=uid, watchlistname=target_wl)
    if not deleted and uid != 1:
        deleted = delete_watchlist_item(db, target_symbol, user_id=1, watchlistname=target_wl)
    return {"status": "success", "ok": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# 2. Trade CRUD
# ---------------------------------------------------------------------------
@router.get("/trade")
def list_trade_records(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve executed trade records enriched with currency and historical previous-day FX rate."""
    uid = user.id if user else 1
    trades = get_trades(db, user_id=uid)
    if not trades and uid != 1:
        trades = get_trades(db, user_id=1)

    # 1. Build Watchlist currency lookup map
    wl_rows = db.scalars(select(Watchlist)).all()
    wl_map = {w.symbol.strip().upper(): w.currency.strip().upper() for w in wl_rows if w.symbol and w.currency}

    # 2. Build sorted historical exchange rate map (currency -> [(date, rate)])
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


@router.get("/exchange-rates")
def list_exchange_rates(
    base_currency: str = Query(default="USD"),
    currency: Optional[str] = Query(default=None),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve daily historical exchange rates."""
    stmt = select(ExchangeRate).where(
        ExchangeRate.base_currency == base_currency,
        ExchangeRate.date <= func.current_date(),
    )
    if currency:
        stmt = stmt.where(ExchangeRate.currency == currency)
    stmt = stmt.order_by(ExchangeRate.currency, ExchangeRate.date.desc())
    rows = list(db.scalars(stmt).all())
    return [
        {
            "date": r.date.isoformat(),
            "currency": r.currency,
            "base_currency": r.base_currency,
            "rate": float(r.rate),
        }
        for r in rows
    ]


@router.post("/trade")
def add_trade_record(
    payload: TradeTransactionInput,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Insert a new executed trade record."""
    uid = user.id if user else 1
    trade = create_trade(db, user_id=uid, item=payload)
    return {
        "status": "success",
        "id": trade.id,
        "symbol": trade.symbol,
    }


@router.put("/trade")
@router.put("/trade/{trade_id}")
def edit_trade_record(
    payload: TradeTransactionInput,
    trade_id: Optional[int] = None,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Update an existing trade record."""
    uid = user.id if user else 1
    target_id = trade_id or payload.id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trade ID must be specified in path or payload",
        )
    trade = update_trade(db, user_id=uid, trade_id=target_id, item=payload)
    if not trade and uid != 1:
        trade = update_trade(db, user_id=1, trade_id=target_id, item=payload)
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trade {target_id} not found",
        )
    return {"status": "success", "id": trade.id}


@router.delete("/trade")
@router.delete("/trade/{trade_id}")
def remove_trade_record(
    trade_id: Optional[int] = None,
    id: Optional[int] = Query(default=None),
    payload: Optional[dict[str, Any]] = Body(default=None),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete an executed trade record."""
    uid = user.id if user else 1
    body_id = int(payload["id"]) if payload and payload.get("id") is not None else None
    target_id = trade_id or id or body_id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trade ID must be specified",
        )
    deleted = delete_trade(db, user_id=uid, trade_id=target_id)
    if not deleted and uid != 1:
        deleted = delete_trade(db, user_id=1, trade_id=target_id)
    return {"status": "success", "ok": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# 3. Capital CRUD
# ---------------------------------------------------------------------------
@router.get("/capital")
def list_capital_records(
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[dict[str, Any]]:
    """Retrieve capital deposit/withdrawal event records."""
    uid = user.id if user else 1
    capital = get_capital(db, user_id=uid)
    if not capital and uid != 1:
        capital = get_capital(db, user_id=1)
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "broker": c.broker,
            "transtype": c.transtype,
            "accounttype": c.accounttype,
            "amount": c.amount,
            "date": c.date.isoformat(),
            "currency": c.currency,
            "remarks": c.remarks,
        }
        for c in capital
    ]


@router.post("/capital")
def add_capital_record(
    payload: CapitalTransactionInput,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Insert a new capital deposit or withdrawal event."""
    uid = user.id if user else 1
    cap = create_capital(db, user_id=uid, item=payload)
    return {
        "status": "success",
        "id": cap.id,
        "amount": cap.amount,
    }


@router.put("/capital")
@router.put("/capital/{capital_id}")
def edit_capital_record(
    payload: CapitalTransactionInput,
    capital_id: Optional[int] = None,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Update an existing capital transaction record."""
    uid = user.id if user else 1
    target_id = capital_id or payload.id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capital ID must be specified in path or payload",
        )
    cap = update_capital(db, user_id=uid, capital_id=target_id, item=payload)
    if not cap and uid != 1:
        cap = update_capital(db, user_id=1, capital_id=target_id, item=payload)
    if not cap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Capital record {target_id} not found",
        )
    return {"status": "success", "id": cap.id}


@router.delete("/capital")
@router.delete("/capital/{capital_id}")
def remove_capital_record(
    capital_id: Optional[int] = None,
    id: Optional[int] = Query(default=None),
    payload: Optional[dict[str, Any]] = Body(default=None),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a capital transaction record."""
    uid = user.id if user else 1
    body_id = int(payload["id"]) if payload and payload.get("id") is not None else None
    target_id = capital_id or id or body_id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capital ID must be specified",
        )
    deleted = delete_capital(db, user_id=uid, capital_id=target_id)
    if not deleted and uid != 1:
        deleted = delete_capital(db, user_id=1, capital_id=target_id)
    return {"status": "success", "ok": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# 4. SysValue CRUD
# ---------------------------------------------------------------------------
@router.get("/sysvalue")
def list_sysvalue_records(db: Session = Depends(get_db_session)) -> list[dict[str, Any]]:
    """Retrieve all configuration parameters stored in sysvalue."""
    rows = get_sysvalues(db)
    return [
        {
            "name": s.name,
            "type": s.type,
            "strvalue": s.strvalue,
            "numvalue": float(s.numvalue) if s.numvalue is not None else None,
            "datevalue": s.datevalue.isoformat() if s.datevalue else None,
            "description": s.description,
        }
        for s in rows
    ]


@router.post("/sysvalue")
def add_sysvalue_record(
    payload: SysValueTransactionInput,
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Insert or update a sysvalue configuration parameter."""
    item = upsert_sysvalue(db, payload)
    return {"status": "success", "name": item.name}


@router.put("/sysvalue")
@router.put("/sysvalue/{name}")
def edit_sysvalue_record(
    payload: SysValueTransactionInput,
    name: Optional[str] = None,
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Update a sysvalue configuration parameter."""
    if name:
        payload.name = name
    item = upsert_sysvalue(db, payload)
    return {"status": "success", "name": item.name}


@router.delete("/sysvalue")
@router.delete("/sysvalue/{name}")
def remove_sysvalue_record(
    name: Optional[str] = None,
    name_query: Optional[str] = Query(default=None, alias="name"),
    payload: Optional[dict[str, Any]] = Body(default=None),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a sysvalue configuration parameter."""
    body_name = str(payload["name"]) if payload and payload.get("name") else None
    target_name = name or name_query or body_name
    if not target_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SysValue name must be specified",
        )
    deleted = delete_sysvalue(db, target_name)
    return {"status": "success", "ok": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# 5. TransCost CRUD
# ---------------------------------------------------------------------------
@router.get("/trans-cost", response_model=list[TransCostDTO])
def list_trans_costs(
    user_id: Optional[int] = Query(default=None),
    trade_id: Optional[int] = Query(default=None),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> list[TransCostDTO]:
    """Retrieve transaction cost breakdown records."""
    target_uid = user_id or (user.id if user else 1)
    rows = get_trans_costs(db, user_id=target_uid, trade_id=trade_id)
    return [
        TransCostDTO(
            id=r.id,
            user_id=r.user_id,
            trade_id=r.trade_id,
            cost_type=r.cost_type,
            amount=float(r.amount),
            currency=r.currency,
            date=r.date.isoformat(),
            remarks=r.remarks,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("/trans-cost", response_model=TransCostDTO)
def add_trans_cost(
    request: Request,
    payload: TransCostCreate,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> TransCostDTO:
    """Create a new transaction cost entry and record audit trail."""
    target_uid = payload.user_id or (user.id if user else 1)
    payload_dict = payload.model_dump()
    payload_dict["user_id"] = target_uid
    cost = create_trans_cost(db, payload_dict)

    ip = request.client.host if request.client else None
    agent = request.headers.get("user-agent")
    log_action(
        db=db,
        user_id=target_uid,
        action="CREATE",
        entity="trans_cost",
        entity_id=str(cost.id),
        old_values=None,
        new_values=payload.model_dump(),
        ip_address=ip,
        user_agent=agent,
    )

    return TransCostDTO(
        id=cost.id,
        user_id=cost.user_id,
        trade_id=cost.trade_id,
        cost_type=cost.cost_type,
        amount=float(cost.amount),
        currency=cost.currency,
        date=cost.date.isoformat(),
        remarks=cost.remarks,
        created_at=cost.created_at.isoformat() if cost.created_at else None,
    )


@router.put("/trans-cost/{cost_id}", response_model=TransCostDTO)
def edit_trans_cost(
    cost_id: int,
    request: Request,
    payload: TransCostCreate,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> TransCostDTO:
    """Update an existing transaction cost entry and record audit trail."""
    target_uid = payload.user_id or (user.id if user else 1)
    updated = update_trans_cost(db, user_id=target_uid, trans_cost_id=cost_id, trans_cost_data=payload.model_dump())
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction cost {cost_id} not found or not owned by user",
        )

    ip = request.client.host if request.client else None
    agent = request.headers.get("user-agent")
    log_action(
        db=db,
        user_id=target_uid,
        action="UPDATE",
        entity="trans_cost",
        entity_id=str(cost_id),
        old_values=None,
        new_values=payload.model_dump(),
        ip_address=ip,
        user_agent=agent,
    )

    return TransCostDTO(
        id=updated.id,
        user_id=updated.user_id,
        trade_id=updated.trade_id,
        cost_type=updated.cost_type,
        amount=float(updated.amount),
        currency=updated.currency,
        date=updated.date.isoformat(),
        remarks=updated.remarks,
        created_at=updated.created_at.isoformat() if updated.created_at else None,
    )


@router.delete("/trans-cost/{cost_id}")
def remove_trans_cost(
    cost_id: int,
    request: Request,
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
    db: Session = Depends(get_db_session),
) -> dict[str, Any]:
    """Delete a transaction cost entry."""
    target_uid = user.id if user else 1
    deleted = delete_trans_cost(db, user_id=target_uid, trans_cost_id=cost_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction cost {cost_id} not found or not owned by user",
        )

    ip = request.client.host if request.client else None
    agent = request.headers.get("user-agent")
    log_action(
        db=db,
        user_id=target_uid,
        action="DELETE",
        entity="trans_cost",
        entity_id=str(cost_id),
        old_values=None,
        new_values=None,
        ip_address=ip,
        user_agent=agent,
    )
    return {"status": "success", "ok": True, "deleted_id": cost_id}
