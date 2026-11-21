# Implementation Plan — Epic 0.4: Autonomous Analyst Committee, Historical Agent Output Storage & Investment Notes

**Project**: Alpha_Insight  
**Epic**: 0.4 — Autonomous Analyst Committee, Historical Agent Output Storage & Investment Notes  
**Document Path**: `C:\Users\ferri\devt\Alpha_Insight\Epics\0.4\implementation_plan.md`  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  

---

## 0. Pre-Work Execution Mode Selection Gate

Before implementation begins, select the desired execution mode:
- **`[1] Single-Engineering Thread Mode (Default)`**: Linear, single-agent execution using the `logic-generator` pipeline, executing Priority 1 (Workstream 2: Autonomous Analyst Committee & DB Storage) followed by Priority 2 (Workstream 1: Investment Notes & Relational Linking) and tracking progress in `tasklist.md`.
- **`[2] Swarm Mode`**: 2-Phase Synchronization Barrier using `swarm-dispatcher`, where Phase 1 baselines Alembic migration `0005` and shared contracts (`.agents/contracts/`), and Phase 2 concurrently dispatches `[STREAM: BE]`, `[STREAM: FE]`, and `[STREAM: QA]` followed by `swarm-integrator`.
- *Default Fallback Rule*: Replying with `"proceed"` without specifying a number selects **`[1] Single-Engineering Thread Mode`** by default.

---

## 1. Technical Scope & Execution Sequence

Implementation executes **(2) Autonomous Analyst Committee & Historical Output Facility** first, followed by **(1) Investment Notes & Relational Entity Linking**:

### 1.1 Database Objects (`backend/db/models.py` & Alembic Revision `0005`)
- **Modify**:
  - `backend/db/models.py`: Add SQLAlchemy 2.0 declarative models `AgentCommitteeRun`, `AgentAnalystOutput`, `InvestmentNote`, and `InvestmentNoteAnalystLink`.
- **Create**:
  - `alembic/versions/0005_agent_outputs_and_investment_notes.py`:
    1. Create `public.agent_committee_runs` (`id`, `user_id`, `symbol`, `provider`, `model`, `consensus_bias`, `consensus_confidence`, `executive_summary`, `vote_breakdown`, `created_at`).
    2. Create `public.agent_analyst_outputs` (`id`, `run_id`, `user_id`, `symbol`, `analyst_role`, `directional_bias`, `confidence_score`, `trend_status`, `summary_headline`, `markdown_output`, `structured_metrics`, `referenced_output_ids`, `created_at`).
    3. Create `public.investment_notes` (`id`, `user_id`, `symbol`, `trade_id`, `title`, `content_markdown`, `thesis_status`, `tags`, `created_at`, `updated_at`).
    4. Create `public.investment_note_analyst_links` (`id`, `note_id`, `analyst_output_id`, `created_at`, unique constraint `uq_note_analyst_output`).
    5. Seed `site_map` node `research.committee` (`label: "Analyst Committee"`, `route: "/research/committee"`, `parent_id: 2`, `role_required: "user"`, `order_index: 4`).

### 1.2 Backend Services, Prompts, Repositories & Routers (`backend/`)
- **Modify**:
  - `backend/config.py`: Change `gemini_default_model` default from `"gemini-2.5-flash"` to `"gemini-4-argon"`. Add `supported_ai_models` list constant (`gemini-4-argon`, `gemini-4-carbon`, `gemini-4-hydrogen`, `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`, `kimi-k2-0711-preview`).
  - `backend/services/prompt_builder.py`: Reference and expand `C:\Users\ferri\OneDrive\Documents\AlphaInsight\src\lib\promptBuilder.ts` into 5 specialized prompt builders:
    - `build_technical_analyst_prompt(symbol, market_context, past_outputs)`: Expands Group 1 (5m ATR vs friction, liquidity consistency, volatility regime, VWAP anchoring, math candle breakouts/pin bars) and Group 2 (geometric chart patterns, Bollinger Bands 20/2 & RSI 14 mean reversion, MACD & EMA 20/50/200 alignment, Fibonacci retracement levels `23.6%`–`78.6%`) plus historical cross-role trend/reversal evaluation.
    - `build_fundamental_analyst_prompt(symbol, fundamental_context, past_outputs)`: Expands Group 3 (`newsScan` 7-day catalyst scan with Google Search grounding) with earnings quality, valuation multiples, balance sheet solvency, and historical comparison.
    - `build_macro_strategist_prompt(symbol, macro_context, past_outputs)`: Expands Group 3 (`secularIndustry`) with US Treasury yield curve (`1M`–`30Y`, `10Y-2Y` spread), central bank cycle, FX cross rates, 11 GICS sector relative rotation, and historical comparison.
    - `build_risk_manager_prompt(symbol, portfolio_risk_context, past_outputs)`: Evaluates bidirectional position exposure (`Long`/`Short` net open quantity, average cost basis, unrealized PnL), portfolio concentration weight, margin loan utilization & daily interest accrual, drawdown limits, transaction cost friction, and ATR stop-loss sizing.
    - `build_executive_summary_prompt(symbol, four_analyst_outputs, past_outputs)`: Consolidates the 4 segregated outputs into a succinct Executive Summary, consensus directional bias, vote tally, and cross-role divergence/gap summary.
    - `build_contextual_chat_prompt(messages, symbol, active_route, displayed_context)`: Grounds the floating `[Agentic Analyst]` interactive chat in the live screen context.
  - `backend/services/agent_orchestrator.py`:
    - Configure `google.genai.Client` with `HttpOptions` SSL fallback handling so live `gemini-4-argon` calls succeed on Windows Python 3.14.
    - Implement `run_committee_orchestration()` using `asyncio.gather` to execute the 4 specialist prompts concurrently without sharing current-run outputs, followed by the Executive Summary step.
    - Implement `run_contextual_agent_chat()` for multi-turn Q&A grounded in `displayed_context`.
- **Create**:
  - `backend/schemas/committee.py`: Pydantic v2 schemas (`AnalystRoleType`, `DirectionalBiasType`, `TrendStatusType`, `AgentAnalystOutputResponse`, `CommitteeRunRequest`, `CommitteeRunResponse`, `AgentContextualChatRequest`, `AgentContextualChatResponse`, `ModelOptionItem`).
  - `backend/schemas/notes.py`: Pydantic v2 schemas (`ThesisStatusType`, `InvestmentNoteCreate`, `InvestmentNoteUpdate`, `InvestmentNoteResponse`, `LinkedAnalystOutputSummary`).
  - `backend/repositories/committee_repo.py`: Database CRUD and historical lookup functions (`get_past_outputs_for_symbol`, `create_committee_run_with_outputs`, `list_committee_runs`, `get_committee_run_by_id`, `list_analyst_outputs`).
  - `backend/repositories/notes_repo.py`: Database CRUD for `investment_notes` and `investment_note_analyst_links`, enforcing `symbol` validation against `public.watchlist` and reconciling `0..N` linked `analyst_output_ids`.
  - `backend/api/v1/committee.py`: FastAPI router mounted at `/api/v1/committee` (`/run`, `/runs`, `/runs/{run_id}`, `/outputs`, `/models`, `/chat`).
  - `backend/api/v1/notes.py`: FastAPI router mounted at `/api/v1/notes` (`GET /`, `POST /`, `PUT /{note_id}`, `DELETE /{note_id}`).
  - Register both routers in `backend/main.py`.

### 1.3 Frontend Design System & Sub-Applications (`frontend/src/`)
- **Design System Centralization (`frontend/src/design-system/`) — Zero Hardcoding**:
  - **Create** `frontend/src/design-system/components/FloatingAgentChat.tsx`: Reusable resizable floating contextual chat window triggered by `[Chat Session]` in `AppShell.tsx`, persisted in `public.agent_chat_messages`.
  - **Create** `frontend/src/design-system/components/AnalystOutputPanel.tsx`: Reusable componentized panel for rendering any set of agentic analyst output tabs (`Exec Summary`, `Technical`, `Fundamental`, `Macro`, `Risk Mgt` in Stock Analysis, and `Global & US Macro`, `SG & Asia-Pacific Macro`, `Secular & Geopolitics` in Macroeconomics), complete with bias/trend badges, `RichMarkdown` formatting, clickable **Verified Grounding Sources & Citations** pills, and `"Reference in Note"` action.
  - **Modify** `frontend/src/design-system/index.ts`: Export `FloatingAgentChat`, `RichMarkdown`, and `AnalystOutputPanel`.
- **Macroeconomics Workbench Overhaul (`/research/macro`)**:
  - **Modify** `backend/services/prompt_builder.py` and `backend/services/agent_orchestrator.py`:
    - Add `build_macro_dimension_prompt(dimension, watchlist_symbols, fx_rates, benchmark_context, past_outputs)` for the 3 tabs (`macro_us`, `macro_apac`, `macro_secular`) plus consolidated `macro` overview, enforcing strict inline citations and extracting Google Search `grounding_chunks` (`title`, `uri`) into `structured_metrics.grounding_links`.
    - Automatically inject the latest stored Macro outputs from `public.agent_analyst_outputs` into `[Stock Analysis]` runs so `Macro` and `Exec Summary` reflect the latest macro regime.
  - **Modify** `backend/repositories/committee_repo.py` and `backend/api/v1/committee.py`:
    - Add `POST /api/v1/committee/macro/run` and `GET /api/v1/committee/macro/latest` returning the 3-tab Macro outputs, verified citations, live `exchange_rate` rows, and Watchlist benchmark index snapshots.
  - **Modify** `frontend/src/components/research/MacroeconomicsView.tsx`:
    - Replace all hardcoded SVG/tables with the live Watchlist-derived Macroeconomics workbench featuring `InteractiveCanvasChart` (`Multi-day` 6M default / `Intraday` 5m toggle), Live FX & Watchlist Index Snapshot, and the reusable `AnalystOutputPanel` with the 3 Macro tabs and verified citation links.
- **Contracts & API Client**:
  - **Modify** `frontend/src/types/api.ts`: Add TypeScript interfaces for Committee Runs, Segregated Analyst Outputs, Contextual Chat, and Investment Notes with `0..N` linked analyst outputs.
  - **Modify** `frontend/src/services/apiClient.ts`: Add `runCommitteeAnalysis`, `getCommitteeRuns`, `getCommitteeRunDetail`, `getAnalystOutputs`, `getAvailableModels`, `sendAgentContextualChat`, `getInvestmentNotes`, `createInvestmentNote`, `updateInvestmentNote`, and `deleteInvestmentNote`.
- **Priority 1 — Workstream (2) Frontend**:
  - **Modify** `frontend/src/components/analyst/InteractiveCanvasChart.tsx`: Switch chart layout palette from dark `DESIGN_TOKENS.chart` to white-paper `DESIGN_TOKENS.chartHighContrast` (`#FFFFFF` background, `#E2E8F0` grid, `#047857` up candles, `#B91C1C` down candles, `#1D4ED8` SMA 30, `#7C3AED` EMA 100) for 100% white-paper consistency.
  - **Create** `frontend/src/components/research/AnalystCommitteeView.tsx`: Implements `/research/committee` featuring Watchlist Symbol selector, Model selector (`gemini-4-argon` default), Lookback selector, 55/45 split with `InteractiveCanvasChart` and `Executive Summary` card, 4 segregated analyst cards (`Technical`, `Fundamental`, `Macro`, `Risk`) with Trend Status pills and `"Reference in Note"` deep-link buttons, and the Historical Output Timeline table.
- **Priority 2 — Workstream (1) Frontend**:
  - **Create** `frontend/src/components/notes/InvestmentNotesView.tsx`: Implements `/notes` featuring Watchlist Symbol filter & selector (populated from `public.watchlist`), Trade link selector (`public.trade`), Thesis Status pills (`In-Progress`, `Validated`, `Invalidated`), Markdown & formula editor/viewer, and the `0..N` Referenced Agent Analyst Outputs section with `ModalDialog` multi-select picker.
- **Workstation Shell & Context Wiring**:
  - **Modify** `frontend/src/components/layout/AppShell.tsx` and `frontend/src/App.tsx`: Mount `/research/committee` and `/notes`, pass live `displayedContext` from the active view(s) into `FloatingAgentChat`, and support `"Reference in Note"` navigation from `/research/committee` into `/notes`.

---

## 2. Skill Allocation

| Skill | Responsibility |
| :--- | :--- |
| **`spec-orchestrator`** | Validates schema migrations, API contracts, prompt isolation rules, and final PRD traceability audit. |
| **`ui-ux-designer`** | Validates `FloatingAgentChat`, `AnalystCommitteeView`, and `InvestmentNotesView` against `ui_design.md` and `APPROVED_PALETTE`. |
| **`logic-generator`** (or Swarm Workers in Mode `[2]`) | Implements Alembic migration `0005`, backend services/repositories/routers, design-system `FloatingAgentChat`, and frontend views. |
| **`deterministic-resolver`** | Runs Fast Targeted Gate during development and Full 3-Tier CI-Parity Gate (`ruff`, `mypy`, `tsc`, `pytest`, `vitest`) prior to completion. |

---

## 3. Engineering Standards & Verification Plan

1. **Zero Hardcoding & Design System Audit**:
   - All UI colors must belong to `APPROVED_PALETTE` in `tests/frontend/design_system_audit.test.tsx`.
   - Zero hardcoded `http://localhost` or `http://127.0.0.1` URLs in frontend components.
   - `FloatingAgentChat` exported from `frontend/src/design-system/index.ts`.
2. **Automated Test Coverage**:
   - `tests/backend/test_committee_and_notes.py`:
     - Verifies `gemini-4-argon` default model and `/api/v1/committee/models`.
     - Verifies concurrent 4-analyst prompt segregation (no live output leakage between the 4 specialists) and cross-role historical output injection across consecutive runs.
     - Verifies Executive Summary synthesis and persistence in `agent_committee_runs` & `agent_analyst_outputs`.
     - Verifies `/api/v1/committee/chat` contextual Q&A with `displayed_context`.
     - Verifies `/api/v1/notes` CRUD, Watchlist symbol validation against `public.watchlist`, and `0`, `1`, and multiple (`N`) `analyst_output_ids` linking in `investment_note_analyst_links`.
   - `tests/frontend/epic_0_4_committee_and_notes.test.tsx`:
     - Verifies `AnalystCommitteeView` rendering `InteractiveCanvasChart`, Executive Summary, 4 segregated analyst cards, and Historical Output Timeline.
     - Verifies `InvestmentNotesView` Watchlist symbol dropdown, note CRUD, and attaching `0..N` analyst outputs via modal.
     - Verifies `FloatingAgentChat` toggling from `[Agentic Analyst]` button, displaying live screen context pills, and sending/receiving contextual chat messages.
3. **Full 3-Tier CI-Parity Gate**:
   - **Tier 1**: `uv run ruff check .` and `uv run ruff format --check .` (Exit Code `0`).
   - **Tier 2**: `uv run mypy backend` and `npx.cmd tsc --noEmit` (Exit Code `0`).
   - **Tier 3**: `uv run pytest` and `npx.cmd vitest run` across the entire workspace (Exit Code `0`).
