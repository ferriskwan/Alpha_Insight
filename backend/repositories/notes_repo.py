"""Repository for Investment Notes CRUD, Watchlist ticker validation, and 0..N analyst output linking."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import delete, desc, or_, select
from sqlalchemy.orm import Session

from backend.db.models import (
    AgentAnalystOutput,
    InvestmentNote,
    InvestmentNoteAnalystLink,
    Trade,
    Watchlist,
)
from backend.repositories import audit_repo, committee_repo
from backend.schemas.notes import InvestmentNoteCreate, InvestmentNoteUpdate


def ensure_symbol_in_watchlist(db: Session, symbol: str, user_id: int = 1) -> str:
    """Validate that the ticker symbol exists in public.watchlist.

    If the symbol is present in any watchlist row, returns the normalized symbol.
    Raises ValueError if the symbol is not in public.watchlist.
    """
    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        raise ValueError("Ticker symbol cannot be empty.")

    row = db.scalar(select(Watchlist).where(Watchlist.symbol == clean_symbol).limit(1))
    if not row:
        raise ValueError(
            f"Ticker symbol '{clean_symbol}' does not exist in [watchlist]. Add the symbol to your Watch List first."
        )
    return clean_symbol


def _reconcile_analyst_links(
    db: Session,
    note_id: int,
    analyst_output_ids: list[int],
) -> None:
    """Synchronize 0..N linked agent_analyst_outputs for an InvestmentNote."""
    db.execute(delete(InvestmentNoteAnalystLink).where(InvestmentNoteAnalystLink.note_id == note_id))
    unique_ids = list(dict.fromkeys(int(x) for x in analyst_output_ids if x is not None and int(x) > 0))
    if not unique_ids:
        return

    valid_rows = list(db.scalars(select(AgentAnalystOutput.id).where(AgentAnalystOutput.id.in_(unique_ids))).all())
    valid_set = set(int(r) for r in valid_rows)
    for out_id in unique_ids:
        if out_id in valid_set:
            db.add(InvestmentNoteAnalystLink(note_id=note_id, analyst_output_id=out_id))


def serialize_investment_note(db: Session, note: InvestmentNote) -> dict[str, Any]:
    """Serialize an InvestmentNote with its 0..N linked AgentAnalystOutput rows and optional Trade summary."""
    link_rows = list(
        db.scalars(
            select(InvestmentNoteAnalystLink)
            .where(InvestmentNoteAnalystLink.note_id == note.id)
            .order_by(InvestmentNoteAnalystLink.id)
        ).all()
    )
    output_ids = [int(lnk.analyst_output_id) for lnk in link_rows]

    linked_outputs: list[dict[str, Any]] = []
    if output_ids:
        out_rows = list(
            db.scalars(
                select(AgentAnalystOutput)
                .where(AgentAnalystOutput.id.in_(output_ids))
                .order_by(desc(AgentAnalystOutput.created_at), desc(AgentAnalystOutput.id))
            ).all()
        )
        linked_outputs = [committee_repo.serialize_analyst_output(r) for r in out_rows]

    trade_summary: Optional[dict[str, Any]] = None
    if note.trade_id:
        t_row = db.scalar(select(Trade).where(Trade.id == note.trade_id))
        if t_row:
            trade_summary = {
                "id": t_row.id,
                "symbol": t_row.symbol,
                "buysell": t_row.buysell,
                "price": float(t_row.price or 0.0),
                "quantity": float(t_row.quantity or 0.0),
                "tradedate": t_row.tradedate.isoformat() if t_row.tradedate else "",
            }

    return {
        "id": note.id,
        "user_id": note.user_id,
        "symbol": note.symbol,
        "trade_id": note.trade_id,
        "trade_summary": trade_summary,
        "title": note.title,
        "content_markdown": note.content_markdown,
        "thesis_status": note.thesis_status,
        "tags": note.tags if isinstance(note.tags, list) else [],
        "analyst_output_ids": [int(o["id"]) for o in linked_outputs],
        "linked_analyst_outputs": linked_outputs,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


def list_investment_notes(
    db: Session,
    user_id: int = 1,
    symbol: Optional[str] = None,
    thesis_status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List investment notes with optional filtering by watchlist symbol, thesis status, and text search."""
    stmt = select(InvestmentNote).order_by(desc(InvestmentNote.updated_at), desc(InvestmentNote.id))
    if symbol and symbol.strip() and symbol.strip().lower() != "all":
        stmt = stmt.where(InvestmentNote.symbol == symbol.strip().upper())
    if thesis_status and thesis_status.strip() and thesis_status.strip().lower() != "all":
        stmt = stmt.where(InvestmentNote.thesis_status == thesis_status.strip())
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                InvestmentNote.title.ilike(q),
                InvestmentNote.content_markdown.ilike(q),
                InvestmentNote.symbol.ilike(q),
            )
        )
    stmt = stmt.limit(max(1, min(limit, 200)))
    notes = list(db.scalars(stmt).all())
    return [serialize_investment_note(db, n) for n in notes]


def create_investment_note(
    db: Session,
    user_id: int,
    payload: InvestmentNoteCreate,
) -> dict[str, Any]:
    """Create a new InvestmentNote validated against public.watchlist with 0..N linked analyst outputs."""
    clean_symbol = ensure_symbol_in_watchlist(db, payload.symbol, user_id=user_id)

    trade_id = payload.trade_id
    if trade_id is not None:
        t_exists = db.scalar(select(Trade.id).where(Trade.id == trade_id))
        if not t_exists:
            trade_id = None

    now_utc = datetime.now(timezone.utc)
    note_row = InvestmentNote(
        user_id=user_id,
        symbol=clean_symbol,
        trade_id=trade_id,
        title=payload.title.strip(),
        content_markdown=payload.content_markdown,
        thesis_status=payload.thesis_status,
        tags=payload.tags or [],
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(note_row)
    db.flush()

    _reconcile_analyst_links(db, note_row.id, payload.analyst_output_ids or [])
    db.commit()
    db.refresh(note_row)

    serialized = serialize_investment_note(db, note_row)
    try:
        audit_repo.log_action(
            db=db,
            user_id=user_id,
            action="INVESTMENT_NOTE_CREATED",
            entity="investment_notes",
            entity_id=str(note_row.id),
            new_values={
                "symbol": note_row.symbol,
                "title": note_row.title,
                "thesis_status": note_row.thesis_status,
                "analyst_output_ids": serialized["analyst_output_ids"],
            },
        )
    except Exception:
        pass

    return serialized


def update_investment_note(
    db: Session,
    user_id: int,
    note_id: int,
    payload: InvestmentNoteUpdate,
) -> Optional[dict[str, Any]]:
    """Update an existing InvestmentNote and reconcile its 0..N linked analyst outputs."""
    note_row = db.scalar(select(InvestmentNote).where(InvestmentNote.id == note_id))
    if not note_row:
        return None

    old_snapshot = serialize_investment_note(db, note_row)

    if payload.symbol is not None:
        note_row.symbol = ensure_symbol_in_watchlist(db, payload.symbol, user_id=user_id)
    if "trade_id" in payload.model_fields_set:
        if payload.trade_id is None:
            note_row.trade_id = None
        else:
            t_exists = db.scalar(select(Trade.id).where(Trade.id == payload.trade_id))
            note_row.trade_id = payload.trade_id if t_exists else None
    if payload.title is not None:
        note_row.title = payload.title.strip()
    if payload.content_markdown is not None:
        note_row.content_markdown = payload.content_markdown
    if payload.thesis_status is not None:
        note_row.thesis_status = payload.thesis_status
    if payload.tags is not None:
        note_row.tags = payload.tags

    note_row.updated_at = datetime.now(timezone.utc)

    if payload.analyst_output_ids is not None:
        _reconcile_analyst_links(db, note_row.id, payload.analyst_output_ids)

    db.commit()
    db.refresh(note_row)
    serialized = serialize_investment_note(db, note_row)

    try:
        audit_repo.log_action(
            db=db,
            user_id=user_id,
            action="INVESTMENT_NOTE_UPDATED",
            entity="investment_notes",
            entity_id=str(note_row.id),
            old_values={
                "symbol": old_snapshot["symbol"],
                "title": old_snapshot["title"],
                "thesis_status": old_snapshot["thesis_status"],
                "analyst_output_ids": old_snapshot["analyst_output_ids"],
            },
            new_values={
                "symbol": serialized["symbol"],
                "title": serialized["title"],
                "thesis_status": serialized["thesis_status"],
                "analyst_output_ids": serialized["analyst_output_ids"],
            },
        )
    except Exception:
        pass

    return serialized


def delete_investment_note(
    db: Session,
    user_id: int,
    note_id: int,
) -> bool:
    """Delete an InvestmentNote and cascade remove its analyst output links."""
    note_row = db.scalar(select(InvestmentNote).where(InvestmentNote.id == note_id))
    if not note_row:
        return False

    old_snapshot = {
        "id": note_row.id,
        "symbol": note_row.symbol,
        "title": note_row.title,
        "thesis_status": note_row.thesis_status,
    }
    db.execute(delete(InvestmentNoteAnalystLink).where(InvestmentNoteAnalystLink.note_id == note_id))
    db.delete(note_row)
    db.commit()

    try:
        audit_repo.log_action(
            db=db,
            user_id=user_id,
            action="INVESTMENT_NOTE_DELETED",
            entity="investment_notes",
            entity_id=str(note_id),
            old_values=old_snapshot,
        )
    except Exception:
        pass

    return True
