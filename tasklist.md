# Tasklist — Epic 0.4: Autonomous Analyst Committee, Historical Agent Output Storage & Investment Notes

**Project**: Alpha_Insight  
**Epic**: 0.4 — Autonomous Analyst Committee, Historical Agent Output Storage & Investment Notes  
**Execution Mode**: **`[1] Single-Engineering Thread Mode (Default)`**  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Implementation Plan**: `Epics/0.4/implementation_plan.md`  

---

## Phase 1: Database Schema & Migration (`backend/db/models.py` & Alembic `0005`)
- [x] Task 1.1: Add SQLAlchemy 2.0 models `AgentCommitteeRun`, `AgentAnalystOutput`, `InvestmentNote`, and `InvestmentNoteAnalystLink` in `backend/db/models.py`.
  - *Completed: Added all 4 models with foreign keys, JSON columns, and indexes.*
- [x] Task 1.2: Author and apply Alembic migration `alembic/versions/0005_agent_outputs_and_investment_notes.py` (including seeding `research.committee` into `public.site_map`).
  - *Completed: Synchronized `site_map_id_seq`, seeded `research.committee` (ID 204), and applied migration `0005` cleanly to `4leafclover_dev` and SQLite test harness.*

## Phase 2: Priority 1 (Workstream 2) — Backend 4-Analyst Committee, `gemini-4-argon` Orchestration & Historical Lookup
- [x] Task 2.1: Update `backend/config.py` to set `gemini_default_model = "gemini-4-argon"` and define `supported_ai_models`.
  - *Completed: Default model set to `gemini-4-argon`.*
- [x] Task 2.2: Author Pydantic v2 schemas in `backend/schemas/committee.py` (`CommitteeRunRequest`, `CommitteeRunResponse`, `AgentAnalystOutputResponse`, `AgentContextualChatRequest`, `AgentContextualChatResponse`, `ModelOptionItem`).
  - *Completed: All request/response models defined.*
- [x] Task 2.3: Expand `backend/services/prompt_builder.py` referencing `C:\Users\ferri\OneDrive\Documents\AlphaInsight\src\lib\promptBuilder.ts` into segregated builders (`build_technical_analyst_prompt`, `build_fundamental_analyst_prompt`, `build_macro_strategist_prompt`, `build_risk_manager_prompt`, `build_executive_summary_prompt`, `build_contextual_chat_prompt`).
  - *Completed: Segregated specialist prompts and historical ledger formatter implemented.*
- [x] Task 2.4: Update `backend/services/agent_orchestrator.py` with `gemini-4-argon` SSL-resilient client, concurrent 4-analyst execution (`asyncio.gather`), Executive Summary consolidation, and contextual Q&A chat handler.
  - *Completed: Concurrent `asyncio.gather` execution and Executive Summary synthesis implemented.*
- [x] Task 2.5: Implement `backend/repositories/committee_repo.py` and `backend/api/v1/committee.py` (`/run`, `/runs`, `/runs/{run_id}`, `/outputs`, `/models`, `/chat`) and mount in `backend/main.py`.
  - *Completed: Mounted under `/api/committee` and `/api/v1/committee`.*

## Phase 3: Priority 2 (Workstream 1) — Backend Investment Notes & `0..N` Relational Entity Linking
- [x] Task 3.1: Author Pydantic v2 schemas in `backend/schemas/notes.py` (`InvestmentNoteCreate`, `InvestmentNoteUpdate`, `InvestmentNoteResponse`, `LinkedAnalystOutputSummary`).
  - *Completed: Schemas authored and validated.*
- [x] Task 3.2: Implement `backend/repositories/notes_repo.py` enforcing Watchlist ticker validation (`public.watchlist`), optional trade linking (`public.trade`), and `0..N` `agent_analyst_outputs` linking via `investment_note_analyst_links`.
  - *Completed: Watchlist validation and `0..N` link reconciliation implemented.*
- [x] Task 3.3: Implement `backend/api/v1/notes.py` (`GET /`, `POST /`, `PUT /{note_id}`, `DELETE /{note_id}`) with audit logging and mount in `backend/main.py`.
  - *Completed: Mounted under `/api/notes` and `/api/v1/notes`.*

## Phase 4: Frontend Design System, Autonomous Analyst Committee (`/research/committee`), Floating Contextual Chat & Investment Notes (`/notes`)
- [x] Task 4.1: Create reusable `FloatingAgentChat.tsx` in `frontend/src/design-system/components/FloatingAgentChat.tsx` and export in `frontend/src/design-system/index.ts` (zero hardcoding).
  - *Completed: Exported from design-system with live screen context pills and multi-turn Q&A.*
- [x] Task 4.2: Update `frontend/src/types/api.ts` and `frontend/src/services/apiClient.ts` with Committee, Contextual Chat, and Investment Notes contracts.
  - *Completed: Added DTOs and REST client methods.*
- [x] Task 4.3: Update `frontend/src/components/analyst/InteractiveCanvasChart.tsx` to use white-paper `DESIGN_TOKENS.chartHighContrast` tokens and implement `frontend/src/components/research/AnalystCommitteeView.tsx` (`/research/committee`).
  - *Completed: Built `AnalystCommitteeView.tsx` with `InteractiveCanvasChart`, Executive Summary, 4 segregated analyst cards, and Historical Output Ledger.*
- [x] Task 4.4: Implement `frontend/src/components/notes/InvestmentNotesView.tsx` (`/notes`) with Watchlist symbol selector, Trade link selector, Markdown/formula viewer, and `0..N` Analyst Output attachment modal.
  - *Completed: Built `InvestmentNotesView.tsx` with `ModalDialog` 0..N output picker and inspector.*
- [x] Task 4.5: Wire `/research/committee`, `/notes`, `"Reference in Note"` deep-linking, and live `displayedContext` into `AppShell.tsx` and `App.tsx`.
  - *Completed: Wired routes, deep-links, and context propagation.*

## Phase 5: Verification, Full CI-Parity Gate & Walkthrough Audit
- [x] Task 5.1: Author and run backend test suite `tests/backend/test_committee_and_notes.py`.
  - *Completed: 5/5 backend tests passed (`test_committee_and_notes.py`).*
- [x] Task 5.2: Author and run frontend test suite `tests/frontend/epic_0_4_committee_and_notes.test.tsx`.
  - *Completed: 3/3 frontend tests passed (`epic_0_4_committee_and_notes.test.tsx`).*
- [x] Task 5.3: Execute Full 3-Tier CI-Parity Gate (`uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy backend`, `npx.cmd tsc --noEmit`, `uv run pytest`, `npx.cmd vitest run`).
  - *Completed: Consecutive exit codes `0` across all 3 tiers (81 backend tests passed, 79 frontend tests passed across 13 suites).*
- [x] Task 5.4: Perform `spec-orchestrator` and `ui-ux-designer` audits and generate `Epics/0.4/WALKTHROUGH.md` and `walkthrough.md`.
  - *Completed: All PRD requirements and UI design specifications verified with 0 missing items.*

## Phase 6: JSONB `ref_chart_settings` Extensible Storage & Timeline Run Navigation (Rollup Enhancements)
- [x] Task 6.1: Author and apply Alembic migration `0008_ref_chart_settings_jsonb.py` on PostgreSQL `4leafclover_dev` and SQLite test harness (convert flat parameters to JSONB, deduplicate duplicate baseline row `id=2`, drop obsolete columns, add 4 partial unique indexes).
  - *Completed: Migration 0008 applied cleanly with exit code 0; single baseline row `id=1` preserved.*
- [x] Task 6.2: Update SQLAlchemy model `RefChartSettings` and Pydantic schemas in `backend/schemas/ref_data.py` with backward-compatible property accessors.
  - *Completed: Property getters/setters ensure 100% backward compatibility for legacy callers.*
- [x] Task 6.3: Implement 4-tier inheritance cascade (`user+symbol` -> `user` -> `symbol` -> `global baseline`) in `backend/repositories/ref_data_repo.py`.
  - *Completed: Cascade resolution with deep merging and safe JSON mutation tracking.*
- [x] Task 6.4: Author `TimelineRunNavigator.tsx` adhering strictly to design system tokens and export from `frontend/src/design-system/index.ts`.
  - *Completed: Features `<` / `>` stepping, formatted timestamp trigger, run index badge (`Run #1 of N`), calendar month grid, and run picker popover.*
- [x] Task 6.5: Integrate `TimelineRunNavigator` into `AnalystOutputPanel.tsx` in the specialist tab row header (area circled red).
  - *Completed: Positioned in `flex items-center justify-between` header row adjacent to specialist tabs.*
- [x] Task 6.6: Wire timeline run navigation state and fetching into `AnalystCommitteeView.tsx`.
  - *Completed: Stores committee runs in state, auto-fetches run detail on step or calendar selection.*
- [x] Task 6.7: Author unit tests in `tests/frontend/epic_0_4_committee_and_notes.test.tsx` and run full CI-Parity verification.
  - *Completed: 5/5 tests in committee suite passed, 10/10 design system audit tests passed, 17/17 backend tests passed, 0 ruff errors, 0 mypy issues, `tsc --noEmit && vite build` built successfully.*
- [x] Task 6.8: Clean up legacy ATR 14 and VWAP artifacts across prompts, fallback generators, and UI subtitles.
  - *Completed: Removed phantom 5m ATR and VWAP instructions from `prompt_builder.py`, cleaned fallback mock analysis in `agent_orchestrator.py`, and updated the Technical tab subtitle in `AnalystCommitteeView.tsx`.*
- [x] Task 6.9: Implement Option A Microstructure Engine & Deploy Guardrailed Technical Analyst Prompt.
  - *Completed: Added deterministic `_calculate_atr` (Wilder smoothing), `_calculate_session_vwap`, and `_synthesize_execution_friction` in `research_repo.py`. Injected `intraday_microstructure` payload in `committee_repo.py`. Deployed approved Technical Analyst prompt with Guardrails 1-4, Timeframe Hierarchy, and Strict Pattern Discipline in `prompt_builder.py`.*



