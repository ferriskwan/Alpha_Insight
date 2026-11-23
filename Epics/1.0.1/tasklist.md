# Epic 1.0.1 — Task List (Single-Engineering Thread Mode)

**Branch:** `1.0.1`  
**Implementation Plan:** `Epics/1.0.1/IMPLEMENTATION_PLAN.md`  
**PRD:** `Epics/1.0.1/PRD.md`  
**Mode:** `[1] Single-Engineering Thread Mode`

---

## Backend, Batch Pipeline & CI/CD Tasks
- [x] **T1 (Item 7)**: Update AI model catalog in `backend/services/agent_orchestrator.py` (add `gemini-4-neon`, remove Gemini `< 4` models).
  - Added `gemini-4-neon`; removed `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`.
- [x] **T2 (Item 3)**: Bound DB connection pools in `backend/config.py` and `backend/db/session.py` (`dispose_engine`), add Cloud Run `localhost` guard in `main.py`, and update `.github/workflows/deploy-dev.yml` and `.github/workflows/deploy-prod.yml`.
  - Bounded SQLAlchemy (`pool_size=3`, `max_overflow=5`, `pool_recycle=300`, `pool_timeout=30`) and `psycopg2` (`maxconn=5`) via env-configurable settings.
  - Added `validate_runtime_api_url()` and `dispose_engine()` in `main.py`.
  - Wired `API_URL` + `API_KEY` for `alpha-insight-daily-job-dev` (`deploy-dev.yml`) and added `alpha-insight-daily-job-prod` build + deploy (`deploy-prod.yml`).
- [x] **T3 (Item 1 & Item 2 Backend)**:
  - Added `.HK -> HKD` fallback in `backend/api/v1/transactions.py` and `backend/api/v1/portfolio.py`.
  - Added `PortfolioTradeAnnotation` & `PortfolioCapitalAnnotation` to `backend/schemas/portfolio.py`.
  - Updated `get_portfolio_4chart_overview()` in `backend/repositories/portfolio_repo.py` (removed `[:5]` cap, skipped invalid `eodprice`, returned `trade_annotations` and `capital_annotations`).
- [x] **T4 (Item 2 Batch Data Dip Fix)**: Implement 3-layer self-healing EOD guard in `ProcessData.py`, `run_mark_to_market.py`, and `run_portfolio_summary.py`.
  - Guarded `insert_EODData()` against `NaN`/`<= 0`; added self-healing cleanup in `run_mark_to_market.py`; filtered invalid `eodprice` in `latest_pos` CTE in `run_portfolio_summary.py`.

## Frontend Tasks
- [x] **T5 (Shared Contracts & Helpers)**: Update `frontend/src/types/api.ts`, create `frontend/src/lib/currency.ts`, and verify `AnalystOutputPanel` already provides the reusable run stepper (no duplicate component needed).
- [x] **T6 (Item 1 Frontend)**: Update `frontend/src/components/portfolio/TransactionsView.tsx` (dynamic alphabetical currency sub-totals, remove irrelevant qty/avg/net-bal cells, fix Grand Total FX consolidation, consistent currency prefixes).
  - Replaced hardcoded USD/SGD sub-totals with dynamic alphabetical currency grouping; removed BUY/SELL Price, Qty, and Net Bal from sub-totals and Grand Total; applied `getCurrencyPrefix()` across detail rows, group headers, and sub-totals.
- [x] **T7 (Item 2 Frontend)**: Update `frontend/src/components/portfolio/PortfolioOverview.tsx` (Chart 1 & Chart 2 checkboxes without altering `Total`, BUY/SELL & Capital Deposit/Withdrawal markers + tooltip details + toggles).
  - Added visibility checkboxes for Chart 1 (`Portfolio Size`, `Capital`, `Margin Loan`, `Trades`, `Capital Adj`) and Chart 2 (`Total`, all stock symbols, `Trades`); plotted BUY/SELL triangles and Capital diamonds with hover tooltip details.
- [x] **T8 (Item 4 & Item 6 Frontend)**: Update `frontend/src/components/research/AnalystCommitteeView.tsx` (3-tier `<optgroup>` Watchlist Symbol sorting) and `frontend/src/components/research/MacroeconomicsView.tsx` (wired `AnalystOutputPanel` run stepper + backdated run loading + history table click-to-load).
  - Reused `AnalystOutputPanel`'s built-in `runs` / `onSelectRun` stepper in `MacroeconomicsView.tsx` (DRY).
  - Added 3-tier `<optgroup>` (`My Positions`, `Other Stocks`, `Indexes`) ascending alphabetical sort in `AnalystCommitteeView.tsx`.
- [x] **T9 (Item 5 Frontend)**: Update `frontend/src/components/admin/SiteMapAdmin.tsx` (reconstruct & sort nested `parent_id` tree by `order_index` ascending + persist `parent_id` on save).
  - Added `buildSortedHierarchyTree()` and included `parent_id` in `SiteMapUpdateRequest`.

## Testing, Verification & Audit
- [x] **T10**: Author backend unit tests (`tests/backend/test_epic_1_0_1.py`) and frontend unit tests (`tests/frontend/epic_1_0_1.test.tsx`).
  - Added 6 backend unit tests and 5 frontend unit tests covering all 7 Epic 1.0.1 items.
  - Updated legacy assertions in `test_prod_compatibility.py`, `portfolio_overview.test.tsx`, `transactions_grouping.test.tsx`, and `transactions_dual_ledger.test.tsx` to match Epic 1.0.1 specifications.
  - Replaced non-palette SVG hex codes in `PortfolioOverview.tsx` with `APPROVED_PALETTE` tokens (`#34D399`, `#FB7185`, `#2563EB`, `#D97706`).
- [x] **T11**: Execute Full CI-Parity Gate (Ruff check & format, Mypy, Pytest, Vitest) until all tiers achieve consecutive exit code `0`.
  - Tier 1: `ruff check .` (0 errors), `ruff format --check .` (141 files formatted).
  - Tier 2: `mypy backend` (0 issues in 48 files), `tsc --noEmit` (0 errors).
  - Tier 3: `pytest` (123 passed), `vitest run` (17 files / 93 passed).
- [x] **T12**: Perform `spec-orchestrator` + `ui-ux-designer` audit (hardcoding, DRY, architecture, PRD cross-reference) and author `Epics/1.0.1/WALKTHROUGH.md`.
  - All 7 PRD items verified `[UAT PASSED]`; walkthrough written to `Epics/1.0.1/WALKTHROUGH.md`.
- [x] **T13 (PR & Merge)**: Pre-PR scan verified via `deterministic-resolver`, branch `1.0.1` pushed to GitHub, PR #9 created against `dev`, CI validation gate passed (Tier 1-3), and PR merged into `dev` (`834695a2`). Deploy to Development Cloud Run workflow triggered.
