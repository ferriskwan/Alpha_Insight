"""FastAPI router for Investment Notes CRUD with Watchlist symbol validation and 0..N analyst output links."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.db.session import get_db_session as get_db
from backend.dependencies import get_current_user_optional
from backend.repositories import notes_repo
from backend.schemas.auth import UserProfileResponse
from backend.schemas.notes import (
    InvestmentNoteCreate,
    InvestmentNoteResponse,
    InvestmentNoteUpdate,
)

router = APIRouter()


@router.get("", response_model=list[InvestmentNoteResponse])
@router.get("/", response_model=list[InvestmentNoteResponse])
def get_notes(
    symbol: Optional[str] = Query(default=None),
    thesis_status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> list[InvestmentNoteResponse]:
    """List Investment Notes with their linked 0..N agent_analyst_outputs records."""
    user_id = user.id if user else 1
    items = notes_repo.list_investment_notes(
        db=db,
        user_id=user_id,
        symbol=symbol,
        thesis_status=thesis_status,
        search=search,
        limit=limit,
    )
    return [InvestmentNoteResponse.model_validate(item) for item in items]


@router.post("", response_model=InvestmentNoteResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=InvestmentNoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: InvestmentNoteCreate,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> InvestmentNoteResponse:
    """Create an Investment Note linked to a Watchlist symbol and 0..N analyst outputs."""
    user_id = user.id if user else 1
    try:
        created = notes_repo.create_investment_note(db=db, user_id=user_id, payload=payload)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        ) from val_err
    return InvestmentNoteResponse.model_validate(created)


@router.put("/{note_id}", response_model=InvestmentNoteResponse)
def update_note(
    note_id: int,
    payload: InvestmentNoteUpdate,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> InvestmentNoteResponse:
    """Update an Investment Note and reconcile its 0..N linked analyst outputs."""
    user_id = user.id if user else 1
    try:
        updated = notes_repo.update_investment_note(
            db=db,
            user_id=user_id,
            note_id=note_id,
            payload=payload,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        ) from val_err

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investment note #{note_id} not found.",
        )
    return InvestmentNoteResponse.model_validate(updated)


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> dict[str, bool]:
    """Delete an Investment Note and its linked analyst output associations."""
    user_id = user.id if user else 1
    deleted = notes_repo.delete_investment_note(db=db, user_id=user_id, note_id=note_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investment note #{note_id} not found.",
        )
    return {"deleted": True}
