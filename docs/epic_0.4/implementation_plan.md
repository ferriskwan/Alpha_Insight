# Implementation Plan — Epic 0.4: Extensible Chart Settings (`JSONB`) & Historical Analysis Timeline Navigation

**Epic**: 0.4 (Consolidated Deliverable Review Implementation)  
**PRD Reference**: [`docs/epic_0.4/prd.md`](file:///c:/Users/ferri/devt/Alpha_Insight/docs/epic_0.4/prd.md)  
**UI Design Reference**: [`docs/epic_0.4/ui_design.md`](file:///c:/Users/ferri/devt/Alpha_Insight/docs/epic_0.4/ui_design.md)  
**Technical Spec Reference**: [`docs/epic_0.4/technical_specification.md`](file:///c:/Users/ferri/devt/Alpha_Insight/docs/epic_0.4/technical_specification.md)  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Proposed Execution Mode**: `[1] Single-Engineering Thread Mode (Default)` using `logic-generator` and `deterministic-resolver`.

---

## 1. Technical Scope & Architecture Overview

This plan unifies the final two deliverable enhancements of Epic 0.4:
1. **Workstream 7: Parameter Store JSONB Redesign**: Transition `public.ref_chart_settings` from flat columns to a PostgreSQL `JSONB` parameter store, enforce uniqueness with partial unique indexes, provide a 4-tier inheritance cascade (`user+symbol` $\to$ `user` $\to$ `symbol` $\to$ `global`), and fix the admin API route in `apiClient.ts`.
2. **Workstream 8: Historical Analysis Timeline Navigation**: Implement `<` / `>` step navigation and a calendar dropdown popover in the top right of the specialist tab header (`AnalystOutputPanel.tsx`), strictly adhering to `DESIGN_TOKENS` and dynamic data from `apiClient.getCommitteeRuns` (zero local hardcoding).

---

## 2. File Modification & Creation Inventory

| File Path | Action | Description |
| :--- | :--- | :--- |
| `alembic/versions/0008_ref_chart_settings_jsonb.py` | **Create** | Migration: deduplicates rows (deletes `id=2`), creates `parameters` JSONB, migrates flat column values from `id=1` into `parameters`, drops obsolete flat columns, adds 4 partial unique indexes. |
| `backend/db/models.py` | **Modify** | Updates `RefChartSettings` model: replaces flat columns with `parameters = Column(JSONB, nullable=False)`. |
| `backend/schemas/ref_data.py` | **Modify** | Defines `ChartParametersSchema`, `MovingAveragesParams`, `BollingerBandsParams`, `RSIParams`, `MACDParams`, `FibonacciParams`, and updates `ChartSettingsDTO` / `ChartSettingsUpdate`. |
| `backend/repositories/ref_data_repo.py` | **Modify** | Replaces flat queries with 4-tier resolution cascade, deep JSON merge, and safe upsert targeting the single global default. |
| `backend/repositories/research_repo.py` | **Modify** | Updates `get_stock_analyst_data` to read Fibonacci and indicator settings from resolved `parameters` JSONB. |
| `backend/repositories/committee_repo.py` | **Modify** | Verifies Technical Analyst context consumes resolved parameters seamlessly. |
| `backend/api/v1/admin.py` | **Modify** | Validates incoming payloads using `ChartParametersSchema` and logs audit trail. |
| `frontend/src/services/apiClient.ts` | **Modify** | Fixes URL path to `/api/v1/admin/ref-data/chart-settings`. |
| `frontend/src/components/admin/RefDataEditor.tsx` | **Modify** | Binds form state to load and save structured JSON parameters cleanly. |
| `frontend/src/design-system/components/AnalystOutputPanel.tsx` | **Modify** | Adds Timeline Navigation (`<`, `(date)` trigger, `>`) and Calendar & Past Runs Popover in the specialist tab row. |
| `frontend/src/components/research/AnalystCommitteeView.tsx` | **Modify** | Tracks `runs` history, passes current run index, total runs, available runs, and `onSelectRun` callback to `AnalystOutputPanel`. |
| `tests/backend/test_admin_ref_data.py` | **Modify** | Updates unit tests to validate JSONB parameter storage, 4-tier cascade, deep merge, and partial unique constraint protection. |
| `tests/frontend/epic_0_4_committee_and_notes.test.tsx` | **Modify** | Adds tests for timeline navigation, backward/forward stepping, and calendar popover run selection. |

---

## 3. Detailed Step-by-Step Implementation Sequence

### Phase 1: Database Migration & Schema Overhaul (Workstream 7)
1. **Author Migration `0008_ref_chart_settings_jsonb.py`**:
   - Deduplicate rows: remove duplicate row `id=2` where `created_at > ...`, retain `id=1`.
   - Add column `parameters JSONB NOT NULL DEFAULT '{}'::jsonb`.
   - Migrate flat column values from `id=1` into structured JSON (`moving_averages`, `bollinger_bands`, `rsi`, `macd`, `fibonacci`).
   - Drop obsolete flat columns (`sma_period`, `ema_period`, `bb_period`, `bb_std`, `rsi_period`, `rsi_ob`, `rsi_os`, `macd_fast`, `macd_slow`, `macd_signal`, `fib_lookback_bars`, `fib_intraday_bars`).
   - Add 4 partial unique indexes (`(user_id, symbol)`, `(user_id)`, `(symbol)`, and global default).
2. **Apply Migration**:
   - Execute `uv run alembic upgrade head` against `4leafclover_dev`.

### Phase 2: Backend Models, Schemas & Repository (Workstream 7)
1. Update `backend/db/models.py` with `parameters = Column(JSONB, nullable=False)`.
2. Author typed Pydantic models in `backend/schemas/ref_data.py`: `ChartParametersSchema`, `ChartSettingsDTO`, and `ChartSettingsUpdate`.
3. Implement 4-tier cascade with deep merge in `backend/repositories/ref_data_repo.py`:
   - `Global Baseline` $\to$ `Symbol Preset` $\to$ `User Default` $\to$ `User + Symbol Override`.
   - Safe upsert targeting the single global default when keys are omitted.
4. Update `research_repo.py` and `committee_repo.py` to extract parameters from `settings.parameters`.

### Phase 3: Frontend Admin Editor & API Client (Workstream 7)
1. In `apiClient.ts`: fix path to `/api/v1/admin/ref-data/chart-settings`.
2. In `RefDataEditor.tsx`: load and save structured JSON parameters cleanly with zero 404s.

### Phase 4: Historical Analysis Timeline Navigation & Calendar (Workstream 8)
1. **Design System & Zero-Hardcoding Mandate**:
   - Utilize `DESIGN_TOKENS.paper` colors (`#FFFFFF` surface, `#E2E8F0` border, `#1D4ED8` accentBlue, `#0F172A` textPrimary).
   - Use `Aptos` and `font-mono` for timestamps.
   - Sourced 100% dynamically from `apiClient.getCommitteeRuns(sym, 30)` — zero mock dates or hardcoded counts.
2. **In `AnalystOutputPanel.tsx`**:
   - Add right-aligned timeline navigation container in the specialist tab row.
   - Add `<` button (disabled on oldest run), `(date)` trigger button with run badge (`Run #1 of 5`), and `>` button (disabled on latest run).
   - Build calendar & run picker popover:
     - Monthly calendar grid highlighting dates with runs.
     - Scrollable run list displaying timestamp, model (`gemini-4-argon`), consensus bias badge, and headline excerpt.
     - Outside-click dismissal via `useRef`.
3. **In `AnalystCommitteeView.tsx`**:
   - Maintain `runs` list (`CommitteeRunDetailDTO[]` or `CommitteeRunSummary[]`).
   - Wire `handleStepPreviousRun`, `handleStepNextRun`, and `handleSelectRun(runId)`.
   - On selection, fetch run detail via `apiClient.getCommitteeRunDetail(runId)` and update `activeRun`.

### Phase 5: Verification & Dual-Gate Protocol
1. **Tier 1 (Linter)**: `uv run ruff check backend`
2. **Tier 2 (Typing)**: `uv run mypy backend`
3. **Tier 3 (Pytest)**: `uv run pytest tests/backend/test_admin_ref_data.py tests/backend/test_committee_and_notes.py tests/backend/test_alembic_migrations.py -q`
4. **Frontend Verification**:
   - `npm.cmd test -- --run tests/frontend/epic_0_4_committee_and_notes.test.tsx`
   - `npm.cmd test -- --run tests/frontend/design_system_audit.test.tsx` (Ensuring zero hardcoding and 100% token adherence)
   - `npm run build`

---

## 4. Pre-Work Execution Mode Selection Gate

Per Section 0 of the Agent Behavior Rules, please select your desired execution mode before implementation begins:

- **[1] Single-Engineering Thread Mode (Default)**: Linear execution using the unified `logic-generator` and `deterministic-resolver` pipeline.
- **[2] Swarm Mode**: Concurrently dispatched parallel work streams (`[STREAM: BE]`, `[STREAM: FE]`, `[STREAM: QA]`).

Reply with **"1"** (or **"proceed"**) to begin execution.
