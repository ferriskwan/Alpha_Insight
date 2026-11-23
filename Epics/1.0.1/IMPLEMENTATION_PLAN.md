# Epic 1.0.1 — Implementation Plan

**Branch:** `1.0.1`  
**PRD Reference:** `Epics/1.0.1/PRD.md`  
**Scope Classification:** `[SCOPE: MAJOR_ARCHITECTURAL]` (no Alembic DDL migrations required)  
**Status:** Pending Explicit User Sign-off (`proceed`) and Execution Mode Selection

---

## 1. Technical Scope (Files, Contracts & Functions)

### Database & Schema
- No Alembic DDL schema changes.
- Data cleanup (self-healing): `run_mark_to_market.py` purges `eoddata` rows with `close IS NULL OR close::text = 'NaN' OR close <= 0` and refreshes `position`; `run_portfolio_summary.py` excludes invalid `eodprice` rows in its `latest_pos` CTE.

### Backend & Batch Pipeline

| File | Changes |
|---|---|
| `backend/config.py` | Add configurable DB pool settings (`db_pool_size=3`, `db_max_overflow=5`, `db_pool_recycle=300`, `db_pool_timeout=30`, `db_raw_pool_maxconn=5`) loaded from environment variables. |
| `backend/db/session.py` | Apply `settings.db_pool_size`, `settings.db_max_overflow`, `settings.db_pool_recycle`, `settings.db_pool_timeout` to `create_engine()`; pass `maxconn=settings.db_raw_pool_maxconn` to `pd_module.init_pool()`. Add `dispose_engine()` helper for CLI/batch cleanup. |
| `backend/api/v1/transactions.py` & `backend/api/v1/portfolio.py` | Extract/use a shared currency fallback helper (`.SI -> SGD`, `.HK -> HKD`, default `USD`) in `list_trade_records` and `list_trades` when a symbol is absent from `watchlist`. |
| `backend/schemas/portfolio.py` | Add `PortfolioTradeAnnotation` (`date`, `symbol`, `buysell`, `quantity`, `price`, `currency`, `remarks`) and `PortfolioCapitalAnnotation` (`date`, `transtype`, `amount`, `currency`, `broker`, `remarks`) to `PortfolioOverviewResponse` (`trade_annotations`, `capital_annotations`, defaulting to `[]`). |
| `backend/repositories/portfolio_repo.py` | In `get_portfolio_4chart_overview()`: (1) Remove `[:5]` cap on `top_symbols` so all traded/held symbols in the timeframe are returned in `chart2_pnl_breakdown.stocks`, sorted alphabetically. (2) Skip `Position` rows where `eodprice` is `None`, `NaN`, or `<= 0` so invalid days forward-fill cleanly. (3) Query `Trade` and `Capital` rows within `[min_date_str, max_date_str]` and populate `trade_annotations` and `capital_annotations`. |
| `backend/services/agent_orchestrator.py` | In `get_supported_models()`: add `("gemini-4-neon", "Gemini 4 Neon", "gemini")` and remove `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`. |
| `ProcessData.py` | In `insert_EODData()`: validate `close_price` and skip rows where `close_price` is `None`, `NaN`, or `<= 0` (logging a warning). |
| `run_mark_to_market.py` | Before inserting positions, delete invalid `eoddata` rows (`close IS NULL OR close::text = 'NaN' OR close <= 0`) and invalid `position` rows (`eodprice IS NULL OR eodprice::text = 'NaN' OR eodprice <= 0`) so DEV and PROD self-heal on batch run. |
| `run_portfolio_summary.py` | Update `latest_pos` CTE to filter `eodprice IS NOT NULL AND eodprice::text != 'NaN' AND eodprice > 0` so any missing/bad day forward-fills the prior valid close. |
| `main.py` | Add Cloud Run startup guard: if `os.getenv("CLOUD_RUN_JOB")` is set and `api_url` targets `localhost` or `127.0.0.1`, raise a descriptive `RuntimeError` immediately. Call `dispose_engine()` in `finally`. |

### CI/CD Workflows (Cloud Run Jobs)

| File | Changes |
|---|---|
| `.github/workflows/deploy-dev.yml` | Before deploying `alpha-insight-daily-job-dev`, resolve `WEB_URL` from `alpha-insight-web-dev` and pass `API_URL=${WEB_URL}` in `--set-env-vars` and `API_KEY=alpha-api-key-dev:latest` in `--set-secrets` for both `jobs update` and `jobs create`. |
| `.github/workflows/deploy-prod.yml` | Add steps to build & push `Dockerfile.job` (`alpha-insight-daily-job:${{ github.sha }}` + `:latest`), resolve `WEB_URL` from `alpha-insight-web-prod`, and create/update `alpha-insight-daily-job-prod` (`ENV=PRD`, `DB_NAME=4leafclover`, `API_URL=${WEB_URL}`, secrets `DB_PASSWORD=alpha-db-password:latest`, `TWELVEDATA_API_KEY=alpha-twelvedata-api-key:latest`, `API_KEY=alpha-api-key:latest`). |

### Frontend

| File | Changes |
|---|---|
| `frontend/src/types/api.ts` | Add `PortfolioTradeAnnotation`, `PortfolioCapitalAnnotation`, and optional `trade_annotations` / `capital_annotations` fields on `PortfolioOverviewResponse`. Add `parent_id?: number | null` to `SiteMapUpdateRequest`. |
| `frontend/src/lib/currency.ts` (new shared helper) | Export `getCurrencyPrefix(ccy: string)` (`USD -> $`, `SGD -> S$`, `HKD -> HK$`, fallback `${ccy} `) and `inferSymbolCurrency(symbol: string, watchlistMap?: Map<string, string>)` (`.SI -> SGD`, `.HK -> HKD`, default `USD`). |
| `frontend/src/components/portfolio/TransactionsView.tsx` | Replace hardcoded `usd`/`sgd` subtotals with dynamic currency grouping sorted alphabetically (`HKD`, `SGD`, `USD`, ...). Remove BUY/SELL Price (`Avg —`), BUY/SELL Quantity, and `Net Bal` from all currency sub-total rows and the Grand Total row. Consolidate Grand Total Realized PnL dynamically across all currencies using each currency's historical FX rates (no hardcoded `1.30` SGD fallback). Use `getCurrencyPrefix()` across detail rows, group headers, and sub-totals. |
| `frontend/src/components/portfolio/PortfolioOverview.tsx` | (1) Replace Chart 1 legend spans (`Portfolio Size`, `Capital`, `Margin Loan`) with checkboxes controlling curve visibility and dynamic Y-axis scaling. (2) Replace Chart 2 legend (`Total` + all symbols) with checkboxes; toggling stocks never modifies `Total`. (3) Render BUY (`▲`) / SELL (`▼`) markers on Chart 1 (`Portfolio Size`) and Chart 2 (`Total` + matching visible stock lines) with `Show Trades` toggle and hover tooltip details. (4) Render Deposit / Withdrawal (`◆`) markers on Chart 1 (`Capital`) with `Show Capital` toggle and hover tooltip details. |
| `frontend/src/components/research/RunHistoryStepper.tsx` (new shared component) | Extract reusable `< [Date/Time · Run #X of N ▾] >` historical run selector used by both `AnalystCommitteeView.tsx` and `MacroeconomicsView.tsx`. |
| `frontend/src/components/research/MacroeconomicsView.tsx` | Fetch stored `MACRO` runs (`apiClient.getCommitteeRuns('MACRO', 30)`), render `RunHistoryStepper`, load selected run via `apiClient.getCommitteeRunDetail(runId)` to update all 4 Macro tabs, and allow clicking rows in the bottom history table to jump to that run. |
| `frontend/src/components/research/AnalystCommitteeView.tsx` | (1) Adopt shared `RunHistoryStepper`. (2) Fetch `apiClient.getPositions()` alongside watchlist items and sort the `Watchlist Symbol` dropdown into 3 `<optgroup>` tiers (`My Positions`, `Other Stocks`, `Indexes`), each sorted ascending alphabetically by `symbol`. |
| `frontend/src/components/admin/SiteMapAdmin.tsx` | Reconstruct the nested parent-child tree from the flat `getAdminSitemap()` list by `parent_id`, recursively sort each sibling level by `order_index` ascending (tie-break `id`), and include `parent_id` in `SiteMapUpdateRequest` in `handleSaveNode()`. |

---

## 2. Skill Allocation

- **Single-Engineering Thread Mode**: `logic-generator` executes tasks sequentially per `tasklist.md`; `deterministic-resolver` executes Fast Targeted Gate during inner loops and Full CI-Parity Gate before handoff; `spec-orchestrator` and `ui-ux-designer` perform final audit and generate `Epics/1.0.1/WALKTHROUGH.md`.
- **Swarm Mode (if selected)**:
  - Phase 1 (`swarm-dispatcher`): Freeze contracts (`backend/schemas/portfolio.py`, `backend/config.py`, `frontend/src/types/api.ts`, `frontend/src/lib/currency.ts`).
  - Phase 2 (parallel): `backend-worker` (backend/batch/workflows), `frontend-worker` (React views & shared `RunHistoryStepper.tsx`), `test-worker` (new unit/integration tests for Items 1–7).
  - Convergence (`swarm-integrator`): Harmonize workspace, run Full CI-Parity Gate via `deterministic-resolver`, audit via `spec-orchestrator` & `ui-ux-designer`.

---

## 3. Unit Test & Verification Plan

### New / Updated Tests
- **Backend (`tests/backend/test_epic_1_0_1.py`)**:
  - `get_supported_models()` includes `gemini-4-neon` and excludes `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`.
  - `get_portfolio_4chart_overview()` returns all symbols (no top-5 cap), forward-fills invalid/NaN/0 `eodprice`, and includes `trade_annotations` and `capital_annotations`.
  - `insert_EODData()` skips `None`/`NaN`/`<= 0` closes.
  - `list_trade_records()` infers `.HK -> HKD` and `.SI -> SGD`.
  - `main.py` Cloud Run guard raises when `CLOUD_RUN_JOB` is set with `localhost` `API_URL`.
  - `backend/config.py` & `backend/db/session.py` respect bounded pool config.
- **Frontend (`tests/frontend/epic_1_0_1.test.tsx`)**:
  - `TransactionsView`: renders alphabetical `HKD`, `SGD`, `USD` sub-total rows, omits BUY/SELL Price/Qty and `Net Bal` on sub-totals/Grand Total, consolidates all 3 currencies into Grand Total, displays `HK$` on `.HK` rows/headers.
  - `PortfolioOverview`: toggles Chart 1 and Chart 2 series via checkboxes without altering `Total`, toggles `Show Trades` and `Show Capital` markers.
  - `MacroeconomicsView`: renders `RunHistoryStepper` and switches tabs when selecting a backdated run.
  - `SiteMapAdmin`: nests flat nodes by `parent_id` and orders siblings by `order_index` ascending.
  - `AnalystCommitteeView`: renders `Watchlist Symbol` dropdown in 3 `<optgroup>` tiers (`My Positions`, `Other Stocks`, `Indexes`), alphabetically sorted within each tier.

### Verification Gate
- **Inner Loop**: Fast Targeted Gate (`uv run pytest tests/backend/test_epic_1_0_1.py`, `npx vitest run tests/frontend/epic_1_0_1.test.tsx`, `uv run ruff check <changed_files>`).
- **Final Handoff**: Full CI-Parity Gate across workspace root (`.`) — Tier 1 (`uv run ruff check .` & `uv run ruff format --check .`), Tier 2 (`uv run mypy backend`), Tier 3 (`uv run pytest` & `npx vitest run`).
