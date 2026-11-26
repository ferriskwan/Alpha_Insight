"""FastAPI router for the 4-Analyst Committee, historical output lookup, and contextual agent chat."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.db.session import get_db_session as get_db
from backend.dependencies import get_current_user_optional
from backend.repositories import committee_repo
from backend.schemas.auth import UserProfileResponse
from backend.schemas.committee import (
    AgentAnalystOutputResponse,
    AgentContextualChatRequest,
    AgentContextualChatResponse,
    CommitteeRunDetailResponse,
    CommitteeRunRequest,
    CommitteeRunSummaryResponse,
    LiveFxRateItem,
    MacroAnalysisRunRequest,
    MacroWorkbenchResponse,
    ModelOptionItem,
    StoredChatMessageResponse,
    WatchlistIndexSnapshotItem,
)
from backend.services.agent_orchestrator import (
    get_supported_models,
    run_committee_orchestration,
    run_contextual_agent_chat,
    run_macro_workbench_orchestration,
)

router = APIRouter()


@router.get("/models", response_model=list[ModelOptionItem])
def get_committee_models() -> list[ModelOptionItem]:
    """Return available AI models with gemini-4-argon as default."""
    return get_supported_models()


@router.post("/run", response_model=CommitteeRunDetailResponse)
async def execute_committee_run(
    payload: CommitteeRunRequest,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> CommitteeRunDetailResponse:
    """Execute the 4 segregated analysts + Executive Summary, link past history, and persist to DB."""
    user_id = user.id if user else 1
    clean_symbol = payload.symbol.strip().upper()
    if not clean_symbol:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Symbol must not be empty.",
        )

    # 1. Query historical analyst outputs across all 4 roles for trend/reversal evaluation
    past_outputs = committee_repo.get_past_outputs_for_symbol(
        db=db,
        symbol=clean_symbol,
        lookback_runs=payload.lookback_runs,
    )

    # 2. Assemble segregated domain contexts from PostgreSQL
    contexts = committee_repo.build_domain_contexts_for_symbol(
        db=db,
        symbol=clean_symbol,
        user_id=user_id,
    )

    # 3. Run concurrent 4-analyst orchestration + Executive Summary synthesis
    orchestration_result = await run_committee_orchestration(
        symbol=clean_symbol,
        provider=payload.provider,
        model=payload.model,
        technical_context=contexts["technical_context"],
        fundamental_context=contexts["fundamental_context"],
        macro_context=contexts["macro_context"],
        risk_context=contexts["risk_context"],
        past_outputs=past_outputs,
    )

    # 4. Persist committee run and all 5 output rows
    run_row, output_rows = committee_repo.create_committee_run_with_outputs(
        db=db,
        user_id=user_id,
        orchestration_result=orchestration_result,
    )

    serialized_outputs = [
        AgentAnalystOutputResponse.model_validate(committee_repo.serialize_analyst_output(r)) for r in output_rows
    ]
    serialized_past = [AgentAnalystOutputResponse.model_validate(p) for p in past_outputs]

    return CommitteeRunDetailResponse(
        id=run_row.id,
        user_id=run_row.user_id,
        symbol=run_row.symbol,
        provider=run_row.provider,
        model=run_row.model,
        consensus_bias=run_row.consensus_bias,  # type: ignore[arg-type]
        consensus_confidence=run_row.consensus_confidence,
        executive_summary=run_row.executive_summary,
        vote_breakdown=run_row.vote_breakdown or {},
        created_at=run_row.created_at,
        outputs=serialized_outputs,
        chart_candles=contexts["chart_candles"],
        chart_trades=contexts["chart_trades"],
        past_outputs=serialized_past,
        fallback_warning=orchestration_result.get("fallback_warning"),
    )


@router.get("/runs", response_model=list[CommitteeRunSummaryResponse])
def get_committee_runs_list(
    symbol: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[CommitteeRunSummaryResponse]:
    """List historical committee runs filtered optionally by symbol."""
    rows = committee_repo.list_committee_runs(db=db, symbol=symbol, limit=limit)
    return [
        CommitteeRunSummaryResponse(
            id=r.id,
            user_id=r.user_id,
            symbol=r.symbol,
            provider=r.provider,
            model=r.model,
            consensus_bias=r.consensus_bias,  # type: ignore[arg-type]
            consensus_confidence=r.consensus_confidence,
            executive_summary=r.executive_summary,
            vote_breakdown=r.vote_breakdown or {},
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/runs/{run_id}", response_model=CommitteeRunDetailResponse)
def get_committee_run_detail(
    run_id: int,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> CommitteeRunDetailResponse:
    """Return a specific committee run including all 5 analyst outputs and Interactive Canvas chart data."""
    found = committee_repo.get_committee_run_by_id(db=db, run_id=run_id)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Committee run #{run_id} not found.",
        )
    run_row, output_rows = found
    user_id = user.id if user else run_row.user_id

    contexts = committee_repo.build_domain_contexts_for_symbol(
        db=db,
        symbol=run_row.symbol,
        user_id=user_id,
    )
    all_for_sym = committee_repo.list_analyst_outputs(db=db, symbol=run_row.symbol, limit=30)
    past_for_run = [
        AgentAnalystOutputResponse.model_validate(item) for item in all_for_sym if int(item["run_id"]) < run_row.id
    ]

    return CommitteeRunDetailResponse(
        id=run_row.id,
        user_id=run_row.user_id,
        symbol=run_row.symbol,
        provider=run_row.provider,
        model=run_row.model,
        consensus_bias=run_row.consensus_bias,  # type: ignore[arg-type]
        consensus_confidence=run_row.consensus_confidence,
        executive_summary=run_row.executive_summary,
        vote_breakdown=run_row.vote_breakdown or {},
        created_at=run_row.created_at,
        outputs=[
            AgentAnalystOutputResponse.model_validate(committee_repo.serialize_analyst_output(r)) for r in output_rows
        ],
        chart_candles=contexts["chart_candles"],
        chart_trades=contexts["chart_trades"],
        past_outputs=past_for_run,
    )


@router.get("/outputs", response_model=list[AgentAnalystOutputResponse])
def get_stored_analyst_outputs(
    symbol: Optional[str] = Query(default=None),
    analyst_role: Optional[str] = Query(default=None),
    trend_status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[AgentAnalystOutputResponse]:
    """Query individual stored analyst outputs for historical trend inspection and Investment Notes linking."""
    items = committee_repo.list_analyst_outputs(
        db=db,
        symbol=symbol,
        analyst_role=analyst_role,
        trend_status=trend_status,
        limit=limit,
    )
    return [AgentAnalystOutputResponse.model_validate(item) for item in items]


@router.post("/chat", response_model=AgentContextualChatResponse)
async def execute_contextual_chat(
    payload: AgentContextualChatRequest,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> AgentContextualChatResponse:
    """Interactive multi-turn Q&A endpoint for the Chat Session window with DB persistence."""
    response = await run_contextual_agent_chat(payload)
    user_id = user.id if user else 1
    clean_symbol = (payload.symbol or str(payload.displayed_context.get("symbol") or "AAPL")).strip().upper()
    raw_run_id = payload.run_id or payload.displayed_context.get("activeRunId")
    resolved_run_id = int(raw_run_id) if raw_run_id is not None and str(raw_run_id).isdigit() else None
    latest_user_msg = payload.messages[-1].content if payload.messages else ""

    saved_rows = committee_repo.save_chat_turn(
        db=db,
        user_id=user_id,
        symbol=clean_symbol,
        run_id=resolved_run_id,
        user_content=latest_user_msg,
        assistant_reply=response.reply,
        model=response.model,
    )
    persisted_run_id = saved_rows[-1].run_id if saved_rows else resolved_run_id
    return AgentContextualChatResponse(
        reply=response.reply,
        provider=response.provider,
        model=response.model,
        symbol=clean_symbol,
        run_id=persisted_run_id,
        active_route=response.active_route,
    )


@router.get("/chat/history", response_model=list[StoredChatMessageResponse])
def get_persisted_chat_history(
    symbol: str = Query(...),
    run_id: Optional[int] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> list[StoredChatMessageResponse]:
    """Load persisted Chat Session messages tied to a Stock Analysis run and symbol."""
    user_id = user.id if user else 1
    items = committee_repo.get_chat_history(
        db=db,
        symbol=symbol,
        run_id=run_id,
        user_id=user_id,
        limit=limit,
    )
    return [StoredChatMessageResponse.model_validate(item) for item in items]


@router.delete("/chat/history")
def delete_persisted_chat_history(
    symbol: str = Query(...),
    run_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> dict[str, int]:
    """Clear persisted Chat Session messages for a symbol and optional run_id."""
    user_id = user.id if user else 1
    deleted = committee_repo.clear_chat_history(
        db=db,
        symbol=symbol,
        run_id=run_id,
        user_id=user_id,
    )
    return {"deleted": deleted}


@router.get("/macro/latest", response_model=MacroWorkbenchResponse)
def get_latest_macro_workbench(
    benchmark_symbol: str = Query(default="^SPX"),
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> MacroWorkbenchResponse:
    """Return Watchlist-derived Macroeconomics workbench data and latest stored Macro outputs."""
    user_id = user.id if user else 1
    payload = committee_repo.get_latest_macro_workbench_payload(
        db=db,
        benchmark_symbol=benchmark_symbol,
        user_id=user_id,
    )
    run_row = payload["run"]
    run_summary = (
        CommitteeRunSummaryResponse(
            id=run_row.id,
            user_id=run_row.user_id,
            symbol=run_row.symbol,
            provider=run_row.provider,
            model=run_row.model,
            consensus_bias=run_row.consensus_bias,  # type: ignore[arg-type]
            consensus_confidence=run_row.consensus_confidence,
            executive_summary=run_row.executive_summary,
            vote_breakdown=run_row.vote_breakdown or {},
            created_at=run_row.created_at,
        )
        if run_row
        else None
    )
    return MacroWorkbenchResponse(
        run=run_summary,
        outputs=[AgentAnalystOutputResponse.model_validate(item) for item in payload["outputs"]],
        past_outputs=[AgentAnalystOutputResponse.model_validate(item) for item in payload["past_outputs"]],
        benchmark_symbol=payload["benchmark_symbol"],
        watchlist_symbols=payload["watchlist_symbols"],
        watchlist_exposure=payload["watchlist_exposure"],
        benchmark_snapshots=[
            WatchlistIndexSnapshotItem.model_validate(item) for item in payload["benchmark_snapshots"]
        ],
        fx_rates=[LiveFxRateItem.model_validate(item) for item in payload["fx_rates"]],
        chart_candles=payload["chart_candles"],
        intraday_candles=payload["intraday_candles"],
    )


@router.post("/macro/run", response_model=MacroWorkbenchResponse)
async def execute_macro_workbench_run(
    payload: MacroAnalysisRunRequest,
    db: Session = Depends(get_db),
    user: Optional[UserProfileResponse] = Depends(get_current_user_optional),
) -> MacroWorkbenchResponse:
    """Execute the 3 Watchlist-derived Macroeconomics specialists with mandatory search citations and persist."""
    user_id = user.id if user else 1
    clean_bench = (payload.benchmark_symbol or "^SPX").strip().upper()

    past_outputs = committee_repo.get_past_outputs_for_symbol(
        db=db,
        symbol="MACRO",
        lookback_runs=payload.lookback_runs,
    )
    ctx = committee_repo.build_macro_workbench_context(
        db=db,
        benchmark_symbol=clean_bench,
        user_id=user_id,
    )
    orchestration_result = await run_macro_workbench_orchestration(
        benchmark_symbol=clean_bench,
        provider=payload.provider,
        model=payload.model,
        watchlist_exposure=ctx["watchlist_exposure"],
        fx_rates=ctx["fx_rates"],
        benchmark_snapshots=ctx["benchmark_snapshots"],
        past_outputs=past_outputs,
    )
    run_row, output_rows = committee_repo.create_committee_run_with_outputs(
        db=db,
        user_id=user_id,
        orchestration_result=orchestration_result,
    )
    run_summary = CommitteeRunSummaryResponse(
        id=run_row.id,
        user_id=run_row.user_id,
        symbol=run_row.symbol,
        provider=run_row.provider,
        model=run_row.model,
        consensus_bias=run_row.consensus_bias,  # type: ignore[arg-type]
        consensus_confidence=run_row.consensus_confidence,
        executive_summary=run_row.executive_summary,
        vote_breakdown=run_row.vote_breakdown or {},
        created_at=run_row.created_at,
        fallback_warning=orchestration_result.get("fallback_warning"),
    )
    return MacroWorkbenchResponse(
        run=run_summary,
        fallback_warning=orchestration_result.get("fallback_warning"),
        outputs=[
            AgentAnalystOutputResponse.model_validate(committee_repo.serialize_analyst_output(r)) for r in output_rows
        ],
        past_outputs=[AgentAnalystOutputResponse.model_validate(item) for item in past_outputs],
        benchmark_symbol=ctx["benchmark_symbol"],
        watchlist_symbols=ctx["watchlist_symbols"],
        watchlist_exposure=ctx["watchlist_exposure"],
        benchmark_snapshots=[WatchlistIndexSnapshotItem.model_validate(item) for item in ctx["benchmark_snapshots"]],
        fx_rates=[LiveFxRateItem.model_validate(item) for item in ctx["fx_rates"]],
        chart_candles=ctx["chart_candles"],
        intraday_candles=ctx["intraday_candles"],
    )
