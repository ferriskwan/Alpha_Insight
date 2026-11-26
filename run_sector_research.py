"""Daily batch step to pre-compute 4-analyst Sector Committee research for all 11 GICS sectors.

Executed sequentially in main.py after run_portfolio_summary.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import date
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

GICS_SECTORS = [
    "XLK",  # Technology
    "XLF",  # Financials
    "XLV",  # Health Care
    "XLE",  # Energy
    "XLI",  # Industrials
    "XLC",  # Communication Services
    "XLY",  # Consumer Discretionary
    "XLP",  # Consumer Staples
    "XLB",  # Materials
    "XLU",  # Utilities
    "XLRE",  # Real Estate
]


async def _process_sector(db: Session | Any, symbol: str, user_id: int = 1) -> None:
    from backend.repositories.committee_repo import (
        build_sector_committee_context,
        create_committee_run_with_outputs,
    )
    from backend.services.agent_orchestrator import run_sector_committee_orchestration

    logger.info("[run_sector_research]: Building context for %s", symbol)
    ctx = build_sector_committee_context(db=db, symbol=symbol, user_id=user_id)
    logger.info("[run_sector_research]: Running sector committee orchestration for %s", symbol)
    orch_res = await run_sector_committee_orchestration(
        symbol=symbol,
        provider="gemini",
        model=None,
        sector_metrics=ctx["sector_metrics"],
        news_items=ctx["news_items"],
        past_outputs=ctx["past_outputs"],
    )
    run_row, outputs = create_committee_run_with_outputs(
        db=db,
        user_id=user_id,
        orchestration_result=orch_res,
    )
    logger.info(
        "[run_sector_research]: Successfully persisted committee run %s for %s (%s, confidence %s%%)",
        run_row.id,
        symbol,
        run_row.consensus_bias,
        run_row.consensus_confidence,
    )


def run_sector_research(user_id: int = 1, force: bool = False) -> None:
    """Pre-compute AI sector committee runs for all 11 GICS sector ETFs."""
    from backend.db.models import AgentCommitteeRun
    from backend.db.session import get_session_factory

    logger.info("[run_sector_research]: Starting daily sector committee pre-computation...")
    factory = get_session_factory()
    db = factory()
    today_date = date.today()

    try:
        for symbol in GICS_SECTORS:
            try:
                # Check if a run already exists for today unless forced
                if not force:
                    existing = (
                        db.query(AgentCommitteeRun)
                        .filter(
                            AgentCommitteeRun.symbol == symbol,
                            AgentCommitteeRun.user_id == user_id,
                        )
                        .order_by(AgentCommitteeRun.id.desc())
                        .first()
                    )
                    if existing and existing.created_at and existing.created_at.date() == today_date:
                        logger.info(
                            "[run_sector_research]: Sector %s already has run %s for %s. Skipping.",
                            symbol,
                            existing.id,
                            today_date,
                        )
                        continue

                asyncio.run(_process_sector(db=db, symbol=symbol, user_id=user_id))
            except Exception as e:
                logger.error(
                    "[run_sector_research]: Error pre-computing sector research for %s: %s",
                    symbol,
                    e,
                    exc_info=True,
                )
                # Continue with next sector
                continue
    finally:
        db.close()
    logger.info("[run_sector_research]: Completed daily sector committee pre-computation.")


if __name__ == "__main__":
    run_sector_research()
