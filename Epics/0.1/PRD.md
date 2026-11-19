# Product Requirements Document (PRD) — Epic 0.1: Alpha_Insight Monolithic Reboot & Cloud Automation

**Document Path:** `Epics/0.1/PRD.md`  
**Repository:** `https://github.com/ferriskwan/Alpha_Insight`  
**Local Workspace:** `C:\Users\ferri\devt\Alpha_Insight`  
**Scope Classification:** `[SCOPE: MAJOR_ARCHITECTURAL]`

---

## 1. Objective

Consolidate the existing `AlphaInsight` frontend/BFF repository and the `4leafclover` Python backend/batch repository into a single monolithic repository (`Alpha_Insight` at `C:\Users\ferri\devt\Alpha_Insight`).
* **Non-Destructive Source Isolation:** The legacy `AlphaInsight` (`c:\Users\ferri\OneDrive\Documents\AlphaInsight`) and `4leafclover` (`c:\Users\ferri\OneDrive\Documents\4leafclover`) directories must remain completely untouched as read-only reference sources. Decommissioning of those applications will occur at a later time. All reusable code must be copied into `C:\Users\ferri\devt\Alpha_Insight` prior to refactoring.
* **Database Continuity & Version Control:** Continue using the existing `4leafclover` PostgreSQL database while introducing SQLAlchemy 2.0 and Alembic for schema version control.
* **Cloud Pipeline Automation:** Package `main.py` as an isolated GCP Cloud Run Job container triggered daily by GCP Cloud Scheduler (and executable manually on demand).
* **Unified Design System & Responsive UI:** Implement a centralized, token-driven Design System based on **Option 2: Bento Modular Dark** (`Epics/0.1/UI_DESIGN.md`). Apply the design system across every UI screen for both laptop browsers and mobile phones with zero hardcoded colors, fonts, or spacing values in feature components.
* **Dual Chart Comparison:** Copy `charting.py` untouched into `Alpha_Insight` and implement an interactive client-side canvas chart library (`lightweight-charts`) alongside it so both engines can be compared side-by-side.

---

## 2. Current State Analysis

### 2.1 `4leafclover` (Legacy Backend & Batch Pipeline — Read-Only Source)
* **Runtime & Framework:** Python 3.11, FastAPI (`4leafclover-dataops.py`), `psycopg2` (`ProcessData.py`), `yfinance` and TwelveData (`marketdata.py`).
* **Database:** GCP Cloud SQL for PostgreSQL (`public` schema). Connection pooling uses `psycopg2.pool.ThreadedConnectionPool` configured via environment variables (`DB_PUBLIC_IP` / `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`).
* **Schema State:** 13 tables exist in PostgreSQL (`users`, `user_roles`, `sysvalue`, `watchlist`, `eoddata`, `tickdata`, `exchange_rate`, `trade`, `capital`, `position`, `margin_interest_rate`, `daily_margin_interest`, `daily_portfolio_summary`). All queries in `ProcessData.py` (1,689 lines) use raw parameterized SQL strings. No ORM models or migration history exist.
* **Daily Pipeline (`main.py`):** Executed manually on a local workstation:
  1. Calls `POST /api/v1/sys/init` to set `GLOBAL_TODAY = CURRENT_DATE` and read `GLOBAL_STARTDATE`.
  2. Writes logs to a local directory (`Logs/{global_today}.log`).
  3. Fetches symbol queues via HTTP (`GET /api/v1/eod/symbols`, `/api/v1/fx/symbols`, `/api/v1/tick/symbols`), downloads OHLCV/FX series from Yahoo Finance (`yfinance`), and uploads payloads via HTTP (`POST /api/v1/eod`, `/api/v1/fx`, `/api/v1/tick`).
  4. Connects directly to PostgreSQL to execute three sequential batch scripts:
     * `run_mark_to_market.py`: Computes daily position quantities, weighted average buy price, and EOD valuations into `public.position` (using a 5-day lookback smart refresh on `trade.updatetimestamp`).
     * `run_daily_margin_interest.py`: Computes daily cash availability, negative cash loan balances, broker/currency interest rates, and cumulative interest into `public.daily_margin_interest`.
     * `run_portfolio_summary.py`: Aggregates capital, position market value, realized PnL, unrealized PnL, and margin interest per user, date, currency, and account type into `public.daily_portfolio_summary`.

### 2.2 `AlphaInsight` (Legacy Frontend & Express Proxy — Read-Only Source)
* **Runtime & Framework:** Node.js Express (`server.ts`, 873 lines) + React 19 + TypeScript + Tailwind CSS v4 + Vite (`src/`).
* **Architecture Bottlenecks:**
  1. **Dual-Server Hop:** The browser calls Express (`server.ts` on port 3000), which proxies CRUD and portfolio requests over HTTP to FastAPI (`4leafclover-dataops.py` on port 8080) using a static `X-API-KEY` header.
  2. **In-Memory Session Store:** `server.ts` stores user sessions in a volatile JavaScript `Map` (`sessions`), which resets on every server restart or container scale-down.
  3. **Hardcoded Local Paths & Inline Styling:** `server.ts` contains hardcoded Windows file paths (`c:\Users\ferri\OneDrive\Documents\4leafclover\.venv\Scripts\python.exe` and `c:\Users\ferri\OneDrive\Documents\AlphaInsight\api_requests.log`), and React components contain hardcoded hex values (`bg-[#0B0C0E]`, `bg-[#15171C]`, `border-[#2D3139]`) scattered across files.
* **UI Limitations on Mobile Devices:**
  * Top header navigation (`AlphaInsight.tsx`) uses horizontal scrolling tabs with dense controls that crowd narrow viewports.
  * `ReportView.tsx` timeline zoom slider and chart crosshair rely solely on desktop mouse events (`onMouseDown`, `onMouseMove`, `onMouseUp`) and do not respond to mobile touch events (`onTouchStart`, `onTouchMove`, `onTouchEnd`).
  * `PortfolioDashboardNew.tsx`, `PortfolioManager.tsx`, `TransactionEditor.tsx`, and `AdminPanel.tsx` render wide multi-column tables (7 to 9 columns) and fixed `p-8` / `p-12` container padding that require horizontal scrolling and reduce readability on phone screens (`< 640px`).

---

## 3. Reusable Components & Copy-Over Inventory

All files in `c:\Users\ferri\OneDrive\Documents\4leafclover` and `c:\Users\ferri\OneDrive\Documents\AlphaInsight` remain untouched. Reusable modules are copied into `C:\Users\ferri\devt\Alpha_Insight` according to the following mapping:

| Source Repo (Untouched) | Source File | Target Path in `Alpha_Insight` | Action in `Alpha_Insight` |
| :--- | :--- | :--- | :--- |
| `AlphaInsight` | `charting.py` | `charting.py` | **Copy Untouched:** Copy byte-for-byte into root `charting.py`. Do not modify. |
| `4leafclover` | `ProcessData.py` | `ProcessData.py` & `backend/repositories/*` | **Copy & Modularize:** Copy `ProcessData.py` for batch script compatibility and extract domain repository modules (`user_repo.py`, `market_repo.py`, `portfolio_repo.py`, `sys_repo.py`) for FastAPI routers. |
| `4leafclover` | `4leafclover-dataops.py` | `backend/api/v1/*` | **Copy & Split into Routers:** Copy endpoint logic and Pydantic models into modular FastAPI routers (`auth.py`, `dataops.py`, `watchlist.py`, `portfolio.py`, `transactions.py`, `admin.py`, `analysis.py`). |
| `4leafclover` | `marketdata.py` | `marketdata.py` | **Copy & Externalize Config:** Copy to root `marketdata.py` for the daily pipeline; ensure API keys and URLs load from environment config. |
| `4leafclover` | `run_mark_to_market.py` | `run_mark_to_market.py` | **Copy for Batch Pipeline:** Copy to root `run_mark_to_market.py` for execution by `main.py`. |
| `4leafclover` | `run_daily_margin_interest.py` | `run_daily_margin_interest.py` | **Copy & Externalize Rates:** Copy to root `run_daily_margin_interest.py`; move fallback rate constants (`0.0565`, `0.0291`) to environment/config constants. |
| `4leafclover` | `run_portfolio_summary.py` | `run_portfolio_summary.py` | **Copy for Batch Pipeline:** Copy to root `run_portfolio_summary.py` for execution by `main.py`. |
| `4leafclover` | `main.py` | `main.py` | **Copy & Hoist to Cloud Run Job:** Copy to root `main.py`, add `job_execution_log` recording and structured Cloud Logging output, and package into `Dockerfile.job`. |
| `AlphaInsight` | `server.ts` | `backend/api/v1/auth.py` & `analysis.py` | **Port Logic to Python (Do Not Copy `server.ts`):** Port Google OAuth verification, session management, `charting.py` runner, and Gemini/Kimi `/api/analyze` logic into Python FastAPI. |
| `AlphaInsight` | `src/lib/promptBuilder.ts` | `frontend/src/lib/promptBuilder.ts` & `backend/services/prompt_builder.py` | **Copy & Sync:** Copy to `frontend/src/lib/promptBuilder.ts` and mirror in Python `backend/services/prompt_builder.py`. |
| `AlphaInsight` | `src/components/*` | `frontend/src/components/*` | **Copy & Refactor to Design System:** Copy all domain components (`StockAnalyst`, `PortfolioManager`, `TransactionEditor`, `AdminPanel`, `FAQ`, `LoginScreen`) into `frontend/src/components/` and refactor them to consume the centralized Design System primitives and tokens with zero hardcoded styles. |

---

## 4. Functional Requirements

### FR-1: Non-Destructive Source Isolation
1. **Zero Modifications to Legacy Directories:** No file in `c:\Users\ferri\OneDrive\Documents\AlphaInsight` or `c:\Users\ferri\OneDrive\Documents\4leafclover` may be edited, deleted, moved, or renamed.
2. **Self-Contained Monorepo:** `C:\Users\ferri\devt\Alpha_Insight` must contain all backend, frontend, migration, test, Docker, and Epic documentation files required to build, test, and deploy `Alpha_Insight` independently.

### FR-2: Monolithic Application Consolidation (`server.ts` Retirement)
1. **Single Web Application Container:** The web application runs as a single FastAPI service (`backend/main.py`) that serves both the REST API (`/api/*`) and the compiled React SPA static bundle (`frontend/dist`).
2. **Authentication & Session Persistence:**
   * Support Google OAuth 2.0 ID token authentication (`POST /api/auth/google-login`) and development mock login when `ENV != "PRD"`.
   * Store sessions in PostgreSQL (`user_sessions` table) with signed `HttpOnly`, `SameSite=Lax` cookies so sessions survive Cloud Run container restarts.
   * Enforce role-based access control (`user`, `admin`) via FastAPI dependencies (`require_auth`, `require_admin`).
3. **AI Analysis Endpoint (`POST /api/analyze`):**
   * Port Gemini (`google-genai` SDK with Google Search grounding) and Kimi (`openai` SDK pointing to configured `KIMI_BASE_URL`) execution to FastAPI.

### FR-3: Centralized Design System & Responsive UI Revamp (Option 2: Bento Modular Dark)
1. **Token-Driven Design System (`frontend/src/design-system/` & `frontend/src/index.css`):**
   * Define all color tokens, typography scales, spacing tokens, border radii, elevation shadows, and animation transitions centrally in `frontend/src/index.css` (Tailwind v4 `@theme` and CSS custom variables) and `frontend/src/design-system/tokens.ts`.
   * Build reusable, typed Design System primitive components in `frontend/src/design-system/components/`:
     * `BentoCard`: Standard modular card container with header, subtitle, action slot, and elevation variants.
     * `AccordionCard`: Collapsible card container for mobile viewports with animated chevron and `aria-expanded` state.
     * `PillToggle` & `SegmentedControl`: Interactive pill toggles for analysis modules and chart mode switching.
     * `Button`, `IconButton`, `Input`, `Select`, `Badge`, `StatusPill`: Standardized form and action controls with built-in focus rings and `44px` minimum mobile touch targets.
     * `ResponsiveDataView`: Renders full data tables on desktop (`>= 640px`) and structured key-value record cards on mobile (`< 640px`).
2. **Strict No-Hardcoding Rule:**
   * Feature components (`LoginScreen`, `StockAnalyst`, `PortfolioManager`, `TransactionEditor`, `AdminPanel`, `FAQ`) must import and use Design System primitives and semantic classes (`bg-canvas`, `bg-bento-card`, `bg-surface-elevated`, `border-subtle`, `text-primary`, `text-secondary`, `text-accent-primary`, `text-semantic-positive`, `text-semantic-negative`).
   * Arbitrary hardcoded hex values (e.g., `bg-[#0B0C0E]`, `text-[#38BDF8]`) and hardcoded API URLs (e.g., `http://localhost:8080`) inside feature components are forbidden.
3. **Laptop (`>= 768px`) & Mobile (`< 768px`) Ergonomics:**
   * **Laptop / Desktop:** Left collapsible navigation rail + top command bar + 12-column Bento grid.
   * **Mobile Phone:** Compact top bar + horizontal swipeable KPI pill strip + collapsible accordion cards + floating 5-icon bottom navigation bar.

### FR-4: Dual Chart Rendering Engine (`charting.py` Untouched + Interactive Canvas Library)
1. **Untouched `charting.py` Pipeline:**
   * Copy `charting.py` unmodified from `AlphaInsight` to `C:\Users\ferri\devt\Alpha_Insight\charting.py`.
   * FastAPI invokes `charting.py` using cross-platform temporary directories (`tempfile.TemporaryDirectory()`), returning the base64 PNG string for both the `charting.py` UI view and Gemini Vision Chart Pattern Recognition.
2. **Interactive Client-Side Canvas Chart (`lightweight-charts`):**
   * Implement `InteractiveCanvasChart.tsx` using TradingView `lightweight-charts` to render Candlesticks, SMA(30), EMA(100), Bollinger Bands(30, 2), active-window Fibonacci retracement lines, Buy/Sell trade markers, and synchronized RSI(13), MACD(12, 26, 9), and Volume panes.
3. **Chart Engine Comparison Switcher:**
   * Provide a 3-way `SegmentedControl` in `StockAnalyst` (`Matplotlib (charting.py)` | `Interactive Canvas` | `Split Compare`) so both chart implementations can be compared side-by-side.

### FR-5: Database Continuity & Alembic Version Control
1. **Database Preservation:** Continue using the existing `4leafclover` PostgreSQL database without dropping or truncating any existing tables or user data.
2. **SQLAlchemy Declarative Metadata:** Define SQLAlchemy 2.0 models in `backend/db/models.py` representing all 13 existing tables (`users`, `user_roles`, `sysvalue`, `watchlist`, `eoddata`, `tickdata`, `exchange_rate`, `trade`, `capital`, `position`, `margin_interest_rate`, `daily_margin_interest`, `daily_portfolio_summary`).
3. **Alembic Baseline & New Migrations:**
   * Author baseline migration `0001_baseline_4leafclover_schema.py` using `CREATE TABLE IF NOT EXISTS` and stamp the existing database via `alembic stamp 0001`.
   * Author migration `0002_pipeline_job_logs_and_sessions.py` adding `job_execution_log` and `user_sessions`.

### FR-6: Separate GCP Cloud Run Job Container for `main.py` + Cloud Scheduler
1. **Dedicated Cloud Run Job Container (`Dockerfile.job`):**
   * Package `main.py`, `marketdata.py`, `ProcessData.py`, `run_mark_to_market.py`, `run_daily_margin_interest.py`, and `run_portfolio_summary.py` into a standalone **GCP Cloud Run Job** (`alpha-insight-daily-job`).
   * Log every execution start, completion, row count summary, and error trace into `job_execution_log` and GCP Cloud Logging (`stdout`).
2. **Execution Triggers:**
   * **Automated Daily Schedule:** GCP Cloud Scheduler triggers `alpha-insight-daily-job` daily.
   * **Manual Execution:** Executable on-demand anytime via the GCP Console (**Cloud Run -> Jobs -> Execute**), `gcloud run jobs execute`, the Admin Panel UI trigger endpoint, or locally via `uv run python main.py`.

---

## 5. Success Criteria

### Functional & Backend Targets
1. **Legacy Repositories Untouched:** `git status` / file timestamps in `c:\Users\ferri\OneDrive\Documents\AlphaInsight` and `c:\Users\ferri\OneDrive\Documents\4leafclover` confirm zero modifications to legacy folders.
2. **Unified FastAPI Monolith:** FastAPI serves the React SPA and all `/api/*` endpoints from `C:\Users\ferri\devt\Alpha_Insight`.
3. **Dual Chart Comparison:** Untouched `charting.py` and the new client-side `lightweight-charts` canvas component both render in `StockAnalyst` and can be toggled or viewed side-by-side.
4. **Alembic Verification:** `uv run alembic current` and `uv run alembic upgrade head` execute cleanly with exit code `0` against the `4leafclover` PostgreSQL schema without data loss.
5. **Cloud Run Job Execution:** `main.py` executes cleanly as a standalone job, records its run in `job_execution_log`, and exits with code `0`.
6. **CI-Parity Gate:** All three verification tiers pass with exit code `0`:
   * Tier 1: `uv run ruff check .` and `uv run ruff format --check .` (with untouched `charting.py` in `extend-exclude`)
   * Tier 2: `uv run mypy backend` and `npx tsc --noEmit`
   * Tier 3: `uv run pytest` and `npx vitest run`

### UI/UX & Design System Targets
1. **Centralized Design System & Zero Hardcoding:** All UI views consume the centralized `frontend/src/design-system/` primitives and semantic theme tokens (`bg-canvas`, `bg-bento-card`, `text-accent-primary`, etc.) with zero hardcoded hex color strings or magic URLs in feature components.
2. **Desktop & Mobile Viewport Compliance:** Every view renders without unintended horizontal page overflow at both `1440x900` (laptop) and `390x844` (mobile phone), featuring collapsible accordion cards, swipeable KPI pills, and floating bottom navigation on mobile.
