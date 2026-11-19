# Implementation Plan — Epic 0.1: Alpha_Insight Monolithic Reboot & Cloud Automation

**Document Path:** `Epics/0.1/IMPLEMENTATION_PLAN.md`  
**Repository:** `https://github.com/ferriskwan/Alpha_Insight`  
**Local Workspace:** `C:\Users\ferri\devt\Alpha_Insight`  
**References:**
* [PRD.md](file:///C:/Users/ferri/devt/Alpha_Insight/Epics/0.1/PRD.md)
* [SYSTEM_ARCHITECTURE.md](file:///C:/Users/ferri/devt/Alpha_Insight/Epics/0.1/SYSTEM_ARCHITECTURE.md)
* [UI_DESIGN.md](file:///C:/Users/ferri/devt/Alpha_Insight/Epics/0.1/UI_DESIGN.md)

---

## 0. Pre-Work Execution Mode Selection Gate

Before implementation begins, choose the execution mode:
* **`[1] Single-Engineering Thread Mode (Default)`**: Linear, single-agent execution using the unified `logic-generator` pipeline and `tasklist.md` with continuous indented progress remarks.
* **`[2] Swarm Mode`**: Concurrently dispatched work streams (`backend-worker`, `frontend-worker`, `test-worker`) coordinated by `swarm-dispatcher` via a 2-Phase Synchronization Barrier and unified by `swarm-integrator`.

*(Per Section 0 of Agent Behavior Rules, if no mode is explicitly specified alongside "proceed", **Single-Engineering Thread Mode** is adopted automatically.)*

---

## 1. Non-Destructive Source Isolation & Copy-Over Protocol

### 1.1 Read-Only Legacy Workspaces
The following directories are read-only reference sources and must **never** be modified, deleted, or formatted:
* `c:\Users\ferri\OneDrive\Documents\AlphaInsight`
* `c:\Users\ferri\OneDrive\Documents\4leafclover`

### 1.2 Exact File Copy Mapping into `C:\Users\ferri\devt\Alpha_Insight`
All reusable files are copied into `C:\Users\ferri\devt\Alpha_Insight` during Phase 1 before any refactoring occurs:

| Legacy Source Path (Read-Only) | Target Path in `Alpha_Insight` | Post-Copy Policy |
| :--- | :--- | :--- |
| `c:\Users\ferri\OneDrive\Documents\AlphaInsight\charting.py` | `C:\Users\ferri\devt\Alpha_Insight\charting.py` | **Strictly Untouched:** Must retain identical SHA-256 checksum to source. Excluded from `ruff` in `pyproject.toml`. |
| `c:\Users\ferri\OneDrive\Documents\4leafclover\ProcessData.py` | `C:\Users\ferri\devt\Alpha_Insight\ProcessData.py` | Preserved at root for compatibility with batch scripts (`run_*.py`) and wrapped by `backend/repositories/*`. |
| `c:\Users\ferri\OneDrive\Documents\4leafclover\marketdata.py` | `C:\Users\ferri\devt\Alpha_Insight\marketdata.py` | Updated in `Alpha_Insight` to read configuration via `backend/config.py`. |
| `c:\Users\ferri\OneDrive\Documents\4leafclover\main.py` | `C:\Users\ferri\devt\Alpha_Insight\main.py` | Updated in `Alpha_Insight` to record run telemetry in `job_execution_log` and support direct DB execution inside `Dockerfile.job`. |
| `c:\Users\ferri\OneDrive\Documents\4leafclover\run_mark_to_market.py` | `C:\Users\ferri\devt\Alpha_Insight\run_mark_to_market.py` | Updated in `Alpha_Insight` to import shared DB config and return structured execution metrics. |
| `c:\Users\ferri\OneDrive\Documents\4leafclover\run_daily_margin_interest.py` | `C:\Users\ferri\devt\Alpha_Insight\run_daily_margin_interest.py` | Updated in `Alpha_Insight` to replace hardcoded fallback interest rates (`0.0565`, `0.0291`) with configuration constants from `backend/config.py`. |
| `c:\Users\ferri\OneDrive\Documents\4leafclover\run_portfolio_summary.py` | `C:\Users\ferri\devt\Alpha_Insight\run_portfolio_summary.py` | Updated in `Alpha_Insight` to import shared DB config and return structured execution metrics. |
| `c:\Users\ferri\OneDrive\Documents\AlphaInsight\src\lib\promptBuilder.ts` | `C:\Users\ferri\devt\Alpha_Insight\frontend\src\lib\promptBuilder.ts` | Copied to frontend utilities and mirrored in Python `backend/services/prompt_builder.py`. |
| `c:\Users\ferri\OneDrive\Documents\AlphaInsight\src\components\*` | `C:\Users\ferri\devt\Alpha_Insight\frontend\src\components\*` | Copied and refactored into modular views consuming `frontend/src/design-system/` primitives with zero hardcoded hex values. |

---

## 2. Technical Scope: Database, Backend, Frontend & DevOps

### 2.1 Database & Alembic Version Control (`alembic/` & `backend/db/`)

1. **`backend/db/models.py` (SQLAlchemy 2.0 Declarative Models):**
   * Map all **13 existing tables** in `public` schema:
     1. `User` (`users`: `id`, `email`, `name`, `picture`, `google_id`, `status`, `created_at`, `updatetimestamp`)
     2. `UserRole` (`user_roles`: `id`, `user_id`, `role`, `status`, `assigned_at`, `updatetimestamp`)
     3. `SysValue` (`sysvalue`: `name`, `type`, `strvalue`, `numvalue`, `datevalue`, `description`, `updatetimestamp`)
     4. `Watchlist` (`watchlist`: `user_id`, `watchlistname`, `symbol`, `name`, `timezone`, `currency`, `updatetimestamp`)
     5. `EodData` (`eoddata`: `symbol`, `date`, `open`, `high`, `low`, `close`, `volume`, `updatetimestamp`)
     6. `TickData` (`tickdata`: `symbol`, `interval`, `timestamp`, `open`, `high`, `low`, `close`, `volume`, `updatetimestamp`)
     7. `ExchangeRate` (`exchange_rate`: `date`, `currency`, `base_currency`, `rate`, `updatetimestamp`)
     8. `Trade` (`trade`: `id`, `user_id`, `symbol`, `buysell`, `tradedate`, `investment`, `price`, `quantity`, `remarks`, `updatetimestamp`)
     9. `Capital` (`capital`: `id`, `user_id`, `broker`, `transtype`, `accounttype`, `amount`, `date`, `currency`, `remarks`, `updatetimestamp`)
     10. `Position` (`position`: `user_id`, `tradedate`, `symbol`, `investment`, `avgprice`, `quantity`, `eodprice`, `updatetimestamp`)
     11. `MarginInterestRate` (`margin_interest_rate`: `id`, `broker`, `currency`, `accounttype`, `annual_rate`, `day_count_basis`, `effective_date`)
     12. `DailyMarginInterest` (`daily_margin_interest`: `user_id`, `date`, `broker`, `currency`, `loan_balance`, `daily_rate`, `daily_interest`, `cumulative_interest`, `updatetimestamp`)
     13. `DailyPortfolioSummary` (`daily_portfolio_summary`: `user_id`, `date`, `currency`, `investment`, `total_capital`, `position_market_value`, `realized_pnl`, `unrealized_pnl`, `margin_loan_balance`, `daily_interest_accrued`, `cumulative_interest_accrued`, `total_asset_value`, `total_pnl`, `pct_pnl`, `updatetimestamp`)
   * Define **2 new tables**:
     14. `UserSession` (`user_sessions`: `sid VARCHAR(128) PK`, `user_id INT FK -> users.id`, `expires_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`)
     15. `JobExecutionLog` (`job_execution_log`: `id SERIAL PK`, `job_name VARCHAR(64)`, `trigger_source VARCHAR(32)`, `started_at TIMESTAMPTZ`, `completed_at TIMESTAMPTZ`, `status VARCHAR(16)`, `global_today DATE`, `details JSONB`, `error_message TEXT`)
2. **`alembic.ini` & `alembic/env.py`:**
   * Dynamically build the SQLAlchemy PostgreSQL connection URL from `backend/config.py` (`DB_HOST` / `DB_PUBLIC_IP`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`).
3. **Migration Scripts (`alembic/versions/`):**
   * `0001_baseline_4leafclover_schema.py`: Idempotent `CREATE TABLE IF NOT EXISTS` statements for all 13 existing tables. On the existing `4leafclover` database, `uv run alembic stamp 0001` records the baseline without modifying existing data.
   * `0002_pipeline_job_logs_and_sessions.py`: Creates `public.user_sessions` and `public.job_execution_log` with indexes on `(user_id)` and `(started_at DESC)`.

### 2.2 Unified FastAPI Backend (`backend/`)

| File Path | Key Functions / Classes | Responsibility |
| :--- | :--- | :--- |
| `backend/config.py` | `Settings(BaseSettings)`, `get_settings()` | Centralizes all environment variables, DB connection settings, OAuth client ID, Gemini/Kimi API keys and model names, default fallback margin rates (`DEFAULT_MARGIN_RATE_USD = 0.0565`, `DEFAULT_MARGIN_RATE_HKD = 0.0291`), and session cookie settings. Zero hardcoded secrets. |
| `backend/db/session.py` | `init_db_pool()`, `close_db_pool()`, `get_db_session()`, `get_process_data()` | Manages SQLAlchemy engine/sessionmaker and the `psycopg2` `ThreadedConnectionPool` passed to `ProcessData`. |
| `backend/dependencies.py` | `get_current_user()`, `require_auth()`, `require_admin()`, `verify_api_key()` | Reads `alpha_sid` cookie from `user_sessions` (or `X-API-KEY` header for service-to-service calls), validates user status (`active`), and enforces role checks. |
| `backend/schemas/auth.py` | `GoogleLoginRequest`, `UserProfileResponse`, `AuthEnvResponse` | Pydantic v2 schemas for authentication and user session endpoints. |
| `backend/schemas/market.py` | `WatchlistItemSchema`, `EodBarSchema`, `TickBarSchema`, `WatchlistDataResponse` | Pydantic v2 schemas for watchlist, EOD, FX, and intraday tick endpoints. |
| `backend/schemas/portfolio.py` | `PortfolioDashboardResponse`, `PositionItemSchema`, `BalanceRowSchema` | Pydantic v2 schemas for portfolio dashboard and balance matrix responses. |
| `backend/schemas/transactions.py` | `TradeInputSchema`, `CapitalInputSchema`, `WatchlistInputSchema`, `SysValueInputSchema` | Pydantic v2 schemas for CRUD operations in Transaction Editor. |
| `backend/schemas/analysis.py` | `AnalyzeRequest`, `AnalyzeResponse`, `PromptPreviewRequest` | Pydantic v2 schemas for Gemini / Kimi stock analysis requests. |
| `backend/schemas/jobs.py` | `JobExecutionLogSchema`, `JobTriggerRequest`, `JobTriggerResponse` | Pydantic v2 schemas for daily pipeline job logs and manual execution triggers. |
| `backend/repositories/user_repo.py` | `UserRepository` | Encapsulates user lookup, Google OAuth upsert, role verification, and `user_sessions` CRUD. |
| `backend/repositories/market_repo.py` | `MarketRepository` | Encapsulates watchlist, EOD, tick, and FX queries wrapping `ProcessData`. |
| `backend/repositories/portfolio_repo.py` | `PortfolioRepository` | Encapsulates portfolio dashboard, positions, trades, capital, and margin interest queries. |
| `backend/repositories/sys_repo.py` | `SysRepository` | Encapsulates `sysvalue` CRUD and `job_execution_log` recording/retrieval. |
| `backend/services/chart_runner.py` | `generate_candlestick_png()` | Writes EOD + trade JSON into `tempfile.TemporaryDirectory()`, invokes `sys.executable charting.py candlestick ...`, and returns base64 PNG data. |
| `backend/services/prompt_builder.py` | `build_stock_analysis_prompt()` | Builds structured multi-horizon technical & fundamental prompt strings matching `promptBuilder.ts`. |
| `backend/services/agent_orchestrator.py` | `run_stock_analysis()` | Executes Gemini (`google-genai` with optional Google Search grounding and multimodal chart image attachment) or Kimi (`AsyncOpenAI` client configured via `settings.kimi_base_url`). |
| `backend/api/v1/auth.py` | `/api/auth/env`, `/api/auth/google-login`, `/api/auth/me`, `/api/auth/logout` | Replaces `server.ts` auth endpoints with persistent DB sessions. |
| `backend/api/v1/dataops.py` | `/api/v1/sys/init`, `/api/v1/eod/*`, `/api/v1/fx/*`, `/api/v1/tick/*` | Preserves backward-compatible ingestion endpoints for `main.py` and external callers. |
| `backend/api/v1/watchlist.py` | `/api/watchlist/symbols`, `/api/watchlist/data` | Returns watchlist symbols, EOD + tick data, system dates, and `chartScreenshot` from untouched `charting.py`. |
| `backend/api/v1/portfolio.py` | `/api/portfolio/dashboard`, `/api/portfolio/positions`, `/api/portfolio/trades` | Serves portfolio metrics, balance matrix, performance series, and trade markers. |
| `backend/api/v1/transactions.py` | `/api/transactions/watchlist`, `/api/transactions/trade`, `/api/transactions/capital`, `/api/transactions/sysvalue` | Full CRUD + post-mutation background recalculation (`run_mark_to_market`, `run_daily_margin_interest`, `run_portfolio_summary`). |
| `backend/api/v1/admin.py` | `/api/admin/users`, `/api/admin/users/status`, `/api/admin/users/roles`, `/api/admin/jobs`, `/api/admin/jobs/run` | Admin user management plus `job_execution_log` viewer and on-demand pipeline trigger. |
| `backend/api/v1/analysis.py` | `/api/analyze` | Executes AI stock analysis via `agent_orchestrator.py`. |
| `backend/main.py` | `create_app()`, `app` | Mounts all `/api/*` routers, configures CORS and exception handlers, and serves `frontend/dist` SPA with catch-all `index.html` fallback. |

### 2.3 Centralized Design System & Responsive Frontend (`frontend/`)

1. **Design System Tokens (`frontend/src/index.css` & `frontend/src/design-system/tokens.ts`):**
   * Implement all **Option 2: Bento Modular Dark** CSS custom variables and Tailwind v4 `@theme` bindings (`--bg-canvas: #090D16`, `--bg-bento-card: #111827`, `--bg-surface-elevated: #1E293B`, `--accent-primary: #38BDF8`, `--accent-ai: #818CF8`, `--semantic-positive: #34D399`, `--semantic-negative: #FB7185`, `--semantic-warning: #FBBF24`, font families `Plus Jakarta Sans`, `Inter`, `JetBrains Mono`).
   * Export typed `DESIGN_TOKENS` in `frontend/src/design-system/tokens.ts` for canvas chart rendering (`lightweight-charts` and SVG curves).
2. **Design System Primitive Library (`frontend/src/design-system/components/`):**
   * `BentoCard.tsx`: Modular card container (`bg-bento-card border border-subtle rounded-bento shadow-bento`) with optional header badge, title, subtitle, and right-aligned action slot.
   * `AccordionCard.tsx`: Mobile-first collapsible Bento card (`aria-expanded`, smooth height transition, summary badges when collapsed).
   * `PillToggle.tsx`: Interactive module pill toggle (`min-h-11` on mobile, active cyan border/tint).
   * `SegmentedControl.tsx`: Generic segmented tab bar used for Chart Comparison mode (`Matplotlib (charting.py)` | `Interactive Canvas` | `Split Compare`), Currency filter (`USD` | `HKD`), and Account filter (`All` | `Investment` | `Leverage`).
   * `Button.tsx`: Variants `primary`, `ai`, `secondary`, `danger`, `ghost` with loading spinner and `min-h-11` mobile tap height.
   * `FormField.tsx`: Standardized `Input`, `Select`, `NumericInput`, and `CheckboxCard` with `text-base` (`16px`) on mobile to prevent iOS Safari auto-zoom.
   * `MetricCard.tsx` & `SwipeableKpiStrip.tsx`: Tabular numeric KPI display (`font-mono tabular-nums`) that renders as a responsive grid on desktop and a horizontal snap-scroll strip on mobile (`< 768px`).
   * `ResponsiveTable.tsx`: Renders a sticky-header table on viewports `>= 640px` and automatically switches to stacked key-value record cards on `< 640px`.
   * `Badge.tsx`: Semantic pills (`positive`, `negative`, `warning`, `accent`, `neutral`).
3. **Dual Charting Components (`frontend/src/components/analyst/`):**
   * `MatplotlibChartView.tsx`: Renders the base64 PNG generated by untouched `charting.py`, paired with an interactive SVG crosshair overlay and timeline zoom slider supporting **both** mouse (`onMouseDown`/`onMouseMove`/`onMouseUp`) and mobile touch (`onTouchStart`/`onTouchMove`/`onTouchEnd`) events.
   * `InteractiveCanvasChart.tsx`: Uses TradingView `lightweight-charts` to render interactive HTML5 Canvas candlesticks, SMA(30), EMA(100), Bollinger Bands(30, 2), active-window Fibonacci levels, trade markers (`Buy`, `Sell`, `Mixed`), and synchronized RSI(13), MACD(12, 26, 9), and Volume panes using `DESIGN_TOKENS.chart`.
   * `ChartComparisonView.tsx`: Wraps `MatplotlibChartView` and `InteractiveCanvasChart` with a 3-way `SegmentedControl` (`Matplotlib (charting.py)` | `Interactive Canvas` | `Split Compare`) and synchronized zoom window state (`zoomRange`).
4. **Refactored Feature Views (`frontend/src/components/`):**
   * `layout/BentoAppShell.tsx`, `TopCommandBar.tsx`, `LeftNavRail.tsx`, `MobileFloatingBar.tsx`: Responsive shell switching cleanly between desktop left rail (`>= 768px`) and mobile floating 5-icon bottom bar (`< 768px`).
   * `auth/LoginScreen.tsx`: Centered Bento authentication card using Design System primitives.
   * `analyst/StockAnalyst.tsx`, `ReportView.tsx`, `RawDataView.tsx`: 12-column Bento layout on desktop; collapsible `AccordionCard` stack on mobile.
   * `portfolio/PortfolioManager.tsx`, `BalanceMatrixCard.tsx`, `PerformanceCurveCard.tsx`, `DualLedgerPnL.tsx`: Uses `SwipeableKpiStrip`, `SegmentedControl`, and `ResponsiveTable`.
   * `editor/TransactionEditor.tsx`: Uses `SegmentedControl` (Watchlist, Trades, Capital, System Params), `FormField` drawer/card, and `ResponsiveTable`.
   * `admin/AdminPanel.tsx` & `JobExecutionLogCard.tsx`: Uses `ResponsiveTable` for tenant/role management and displays `job_execution_log` history with a manual "Run Daily Pipeline" button.
   * `faq/FAQ.tsx`: Uses `BentoCard` and `AccordionCard` primitives.

### 2.4 Containers & GCP Cloud Automation (`Dockerfile.web`, `Dockerfile.job`, `cloudbuild.yaml`)
1. **`Dockerfile.web`:** Multi-stage build (Stage 1: `node:22-slim` builds `frontend/dist`; Stage 2: `python:3.11-slim` installs `pyproject.toml` dependencies via `uv`, copies `backend/`, `alembic/`, `ProcessData.py`, `charting.py`, and `frontend/dist`, and runs `uvicorn backend.main:app --host 0.0.0.0 --port 8080`).
2. **`Dockerfile.job`:** Lightweight Python 3.11 container installing batch dependencies via `uv`, copying `main.py`, `marketdata.py`, `ProcessData.py`, `run_mark_to_market.py`, `run_daily_margin_interest.py`, `run_portfolio_summary.py`, and `backend/`, with `ENTRYPOINT ["uv", "run", "python", "main.py"]`.
3. **`cloudbuild.yaml`:** Builds and pushes both `alpha-insight-web` and `alpha-insight-daily-job` images to GCP Artifact Registry, deploys the Cloud Run Service and Cloud Run Job, and configures the daily GCP Cloud Scheduler trigger (`0 22 * * 1-5` America/New_York / post-US market close).

---

## 3. Skill Allocation

| Skill Name | Assigned Role in Epic 0.1 |
| :--- | :--- |
| `spec-orchestrator` | Authors PRD, System Architecture, Implementation Plan, `.agents/UAT_CHECKLIST.json`, and conducts final CI-Parity & Architecture/DRY audit. |
| `ui-ux-designer` | Authors `UI_DESIGN.md`, generates visual mockups, and audits final frontend components for strict adherence to Option 2 Bento Modular Dark and zero hardcoded hex colors. |
| `logic-generator` | *(If Mode 1 selected)* Executes `tasklist.md` sequentially across Phase 1 and Phase 2, continuously updating indented progress remarks. |
| `swarm-dispatcher` | *(If Mode 2 selected)* Executes Phase 1 Prerequisite Barrier (models, Alembic migrations, contracts, copy-over) and dispatches parallel worker streams (`backend-worker`, `frontend-worker`, `test-worker`). |
| `backend-worker` | *(If Mode 2 selected)* Implements `backend/*`, batch pipeline scripts (`main.py`, `run_*.py`), and Docker configurations (`[STREAM: BE]`). |
| `frontend-worker` | *(If Mode 2 selected)* Implements `frontend/src/design-system/*`, dual chart components, and refactored Bento/mobile views (`[STREAM: FE]`). |
| `test-worker` | *(If Mode 2 selected)* Implements backend Pytest and frontend Vitest test suites validating all 7 UAT items (`[STREAM: QA]`). |
| `swarm-integrator` | *(If Mode 2 selected)* Harmonizes `pyproject.toml` and `package.json`, verifies API-to-client contracts, and updates `tasklist.md` convergence. |
| `deterministic-resolver` | Runs Fast Targeted Gates during inner loops and the Full 3-Tier CI-Parity Gate (`ruff`, `mypy`, `tsc`, `pytest`, `vitest`) prior to completion. |

---

## 4. Phased Execution Plan & File Ownership Matrix

### Phase 1: Prerequisite Foundation, Copy-Over, Alembic Baseline & Frozen Contracts
1. Initialize `pyproject.toml` (with `ruff`, `mypy`, `pytest`, `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg2-binary`, `pydantic-settings`, `google-auth`, `google-genai`, `openai`, `yfinance`, `pandas`, `numpy`, `matplotlib`, `mplfinance`, `scipy`, `requests`, `httpx`).
2. Copy untouched `charting.py` from `AlphaInsight` and batch modules (`ProcessData.py`, `marketdata.py`, `main.py`, `run_mark_to_market.py`, `run_daily_margin_interest.py`, `run_portfolio_summary.py`) from `4leafclover` into `C:\Users\ferri\devt\Alpha_Insight`.
3. Create `backend/config.py`, `backend/db/models.py` (all 15 tables), `backend/db/session.py`, `alembic.ini`, `alembic/env.py`, `0001_baseline_4leafclover_schema.py`, and `0002_pipeline_job_logs_and_sessions.py`.
4. Create frozen Pydantic v2 contracts (`backend/schemas/*`) and shared TypeScript interfaces (`frontend/src/types/api.ts`) + mirror copies in `.agents/contracts/`.

### Phase 2: Core Implementation & Verification Streams

| Stream ID | Owner | Owned Files / Directories (Strict Non-Overlapping Invariant) |
| :--- | :--- | :--- |
| **`[STREAM: BE]`** | `backend-worker` / `logic-generator` | `backend/dependencies.py`, `backend/repositories/*`, `backend/services/*`, `backend/api/v1/*`, `backend/main.py`, `main.py`, `marketdata.py`, `ProcessData.py`, `run_mark_to_market.py`, `run_daily_margin_interest.py`, `run_portfolio_summary.py`, `Dockerfile.web`, `Dockerfile.job`, `cloudbuild.yaml` |
| **`[STREAM: FE]`** | `frontend-worker` / `logic-generator` | `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/index.css`, `frontend/src/design-system/**`, `frontend/src/services/**`, `frontend/src/lib/**`, `frontend/src/hooks/**`, `frontend/src/components/**`, `frontend/src/App.tsx`, `frontend/src/main.tsx` |
| **`[STREAM: QA]`** | `test-worker` / `logic-generator` | `tests/conftest.py`, `tests/backend/test_source_isolation.py`, `tests/backend/test_alembic_migrations.py`, `tests/backend/test_api_endpoints.py`, `tests/backend/test_chart_runner.py`, `tests/backend/test_daily_job_pipeline.py`, `tests/frontend/design_system_audit.test.tsx`, `tests/frontend/components.test.tsx` |

---

## 5. Engineering & Testing Standards

1. **Database Protection:** Tests in `tests/backend/` must never drop or truncate tables in the shared development database. Unit and contract tests use isolated SQLite/in-memory or transactional rollback fixtures (`SAVEPOINT`).
2. **Automated Design System & Source Isolation Gate:**
   * `tests/backend/test_source_isolation.py` verifies via SHA-256 hash comparison that `C:\Users\ferri\devt\Alpha_Insight\charting.py` is identical to `c:\Users\ferri\OneDrive\Documents\AlphaInsight\charting.py`.
   * `tests/frontend/design_system_audit.test.tsx` scans all `.tsx` files in `frontend/src/components/` to assert zero occurrences of arbitrary hex color classes (`/#[0-9A-Fa-f]{3,8}/`) or hardcoded `http://localhost` URLs.
3. **Full 3-Tier CI-Parity Gate:**
   * **Tier 1 (Formatting & Linting):** `uv run ruff check .` and `uv run ruff format --check .`
   * **Tier 2 (Static Type Checking):** `uv run mypy backend` and `npx --prefix frontend tsc --noEmit`
   * **Tier 3 (Automated Test Suites):** `uv run pytest` and `npx --prefix frontend vitest run`
