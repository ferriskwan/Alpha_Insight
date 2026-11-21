# Implementation Plan — 52-Week Fibonacci Retracements & Reference Data Configuration

**Epic**: 0.4 Enhancement  
**Execution Mode**: **`[1] Single-Engineering Thread Mode (Default)`**  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**PRD Reference**: [`prd.md`](file:///C:/Users/ferri/.gemini/antigravity/brain/001e0c39-1623-48b7-8c9f-8e2d2beee5cb/prd.md)  

---

## 1. Technical Scope

### 1.1 Database Objects & Migrations
* **Table Modified**: `public.ref_chart_settings`
  * Add column: `fib_lookback_bars` (`INTEGER`, server_default=`'252'`, nullable=`False`)
  * Add column: `fib_intraday_bars` (`INTEGER`, server_default=`'78'`, nullable=`False`)
* **Alembic Migration**:
  * Create `alembic/versions/0007_ref_chart_settings_fibonacci.py`
  * Apply migration cleanly using `uv run alembic upgrade head` against `4leafclover_dev`.

### 1.2 Backend Files & Functions
* [`backend/db/models.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/db/models.py):
  * Update `RefChartSettings` model with `fib_lookback_bars` and `fib_intraday_bars`.
* [`backend/schemas/ref_data.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/schemas/ref_data.py):
  * Update `ChartSettingsDTO` and `ChartSettingsUpdate` schemas to include `fib_lookback_bars` and `fib_intraday_bars`.
* [`backend/repositories/ref_data_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/ref_data_repo.py):
  * Update `get_chart_settings` and `upsert_chart_settings` to read and persist the new columns.
* [`backend/repositories/research_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/research_repo.py):
  * In `get_stock_analyst_data`:
    * Query `RefChartSettings` for the user/symbol (falling back to global defaults `252` and `78`).
    * Compute canonical 52-week High/Low and Fibonacci retracements over `fib_lookback_bars` (`252` bars).
    * Attach `fibonacci` levels to the returned dictionary for direct client consumption.
* [`backend/repositories/committee_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/committee_repo.py):
  * In `build_domain_contexts_for_symbol`:
    * Use `fib_lookback_bars` (`252` bars = 52 weeks) instead of all-time historical series to calculate `cycle_high`, `cycle_low`, and `fibonacci_levels`.
    * Ensure the Technical Analyst prompt receives the exact 52-week levels matching the chart.

### 1.3 Frontend Files & Components
* [`frontend/src/types/api.ts`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/types/api.ts):
  * Update `RefChartSettingsDTO` with `fib_lookback_bars: number` and `fib_intraday_bars: number`.
* [`frontend/src/components/analyst/InteractiveCanvasChart.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/analyst/InteractiveCanvasChart.tsx):
  * Update `FIFTY_TWO_WEEKS_TRADING_BARS = 252` as the default multi-day window for Fibonacci calculations (and `78` bars for intraday).
* [`frontend/src/components/admin/RefDataEditor.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/admin/RefDataEditor.tsx):
  * Add a dedicated **Fibonacci Retracements** card under the "Chart Technical Settings" tab:
    * `Fibonacci Multi-day Lookback (52-Week Bars)`: input field (`default: 252`).
    * `Fibonacci Intraday Lookback (Session Bars)`: input field (`default: 78`).

---

## 2. Skill Allocation
* **`logic-generator`**: Author database migrations, Pydantic schemas, repository calculation updates, and React form fields.
* **`deterministic-resolver`**: Execute verification gates (`uv run alembic upgrade head`, `uv run ruff check`, `uv run mypy`, `uv run pytest`, `npx.cmd tsc --noEmit`, `npm.cmd test`).

---

## 3. Engineering Standards & Verification Protocol
* **Anti-Fluff Standard**: Pure factual English in all comments and documentation.
* **Dual-Gate Verification**:
  1. Fast Targeted Gate:
     - `uv run ruff check backend/db/models.py backend/schemas/ref_data.py backend/repositories/ref_data_repo.py backend/repositories/research_repo.py backend/repositories/committee_repo.py`
     - `uv run mypy backend`
     - `uv run pytest tests/backend/test_committee_and_notes.py tests/backend/test_alembic_migrations.py -q`
     - `npx.cmd tsc --noEmit`
     - `npm.cmd test -- --run ../tests/frontend/epic_0_4_committee_and_notes.test.tsx ../tests/frontend/design_system_audit.test.tsx`
  2. Full CI-Parity Gate prior to handoff.
