# Epic 1.0.1 — Product Requirements Document (PRD)

**Branch:** `1.0.1`  
**Scope Classification:** `[SCOPE: MAJOR_ARCHITECTURAL]` (touches CI/CD Cloud Run deployment workflows, DB connection pooling, batch valuation pipeline, backend API schemas/repositories, and 5 frontend views; no Alembic DDL migrations required)  
**Source Scope:** `Epics/1.0.1/SCOPE.md`  
**Status:** Pending Explicit User Sign-off (`proceed`)

---

## 1. Overview

Epic `1.0.1` consists of **7 items** addressing post-cutover defects, missing UI controls, data quality guards, and Cloud Run job deployment gaps across Portfolio, Research, Admin, and DevOps:

| # | Area | Summary |
|---|---|---|
| 1 | `My Portfolio -> Transactions` | Dynamic multi-currency sub-totals (alphabetical), remove irrelevant quantity/avg columns from aggregations, fix Grand Total FX consolidation across all currencies, and fix currency prefixes (`HK$`, `S$`, `$`). |
| 2 | `My Portfolio -> Portfolio Overview` | Replace Chart 1 & Chart 2 legends with visibility checkboxes (including all symbols in Chart 2 without altering `Total`), add BUY/SELL and Capital Deposit/Withdrawal markers + tooltip details + toggles, and implement a 3-layer self-healing fix for single-day `NaN`/zero-price dips. |
| 3 | `Cloud Run Daily Jobs (DEV & PROD)` | Fix `alpha-insight-daily-job-dev` (`API_URL`, `API_KEY`), add `alpha-insight-daily-job-prod` to `deploy-prod.yml`, bound DB connection pools in `backend/db/session.py`, and add a Cloud Run `localhost` guard in `main.py`. |
| 4 | `Research -> Macroeconomics` | Add backdated research run stepper/dropdown (`< [Date/Time · Run #X of N] >`) matching `Stock Analysis` via a shared reusable component. |
| 5 | `Admin -> Site Map Admin` | Reconstruct and sort the `Navigation Hierarchy Tree` by `parent_id` and `order_index` to match the left sidebar navigation order, and persist `parent_id` on node updates. |
| 6 | `Research -> Stock Analysis` | Sort the `Watchlist Symbol` dropdown into 3 `<optgroup>` tiers (1. Open Positions, 2. Other Stocks, 3. Indexes), each sorted ascending alphabetically by symbol. |
| 7 | `AI Model Catalog` | Add `gemini-4-neon` (`Gemini 4 Neon`) and remove all Gemini models with major version `< 4` (`gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`). |

*(Note: `[Research] -> [By Industry/Sector]` has been deferred to `Epics/1.1/SCOPE.md`.)*

---

## 2. Detailed Functional & UI Requirements

### Item 1: `My Portfolio -> Transactions` — Multi-Currency Sub-Totals & Grand Total
- **Files:** `frontend/src/components/portfolio/TransactionsView.tsx`, `backend/api/v1/transactions.py`
- **Requirements:**
  1. **Dynamic Currency Sub-Totals**: Group all trades by currency dynamically (mutually exclusive) and render one sub-total row per currency present, sorted alphabetically by currency code (`HKD`, `SGD`, `USD`, ...).
  2. **Fallback Currency Inference**: Add `.HK -> HKD` fallback alongside `.SI -> SGD` in both `list_trade_records` (`backend/api/v1/transactions.py`) and `getTradeCurrency` (`TransactionsView.tsx`) when a symbol has no `watchlist` currency.
  3. **Remove Irrelevant Aggregation Cells**: Omit/blank BUY Price (`Avg —`), BUY Quantity, SELL Price (`Avg —`), SELL Quantity, and `Net Bal: ... shs` on all currency sub-total rows and the Grand Total row.
  4. **Grand Total Consolidation (Option A — Historical Per-Trade FX)**:
     - Buy Consideration (USD) and Sell Consideration (USD): Sum across all trades in all currencies using each trade's previous-day FX rate (`max(date) < tradedate`).
     - Realized PnL (USD): Dynamically sum Realized PnL across all currencies present, converting each non-USD currency's Realized PnL to USD using that currency's FX rate (remove the hardcoded `SGD`-only logic and `1.30` fallback).
  5. **Consistent Currency Prefixes**: Format prices, considerations, and PnL using a shared currency prefix helper (`USD -> $`, `SGD -> S$`, `HKD -> HK$`, fallback `<CCY> `) across detail rows (Grouped and List modes), symbol group header strips, and sub-total rows.

### Item 2: `My Portfolio -> Portfolio Overview` — Checkboxes, Annotations & EOD Dip Fix
- **Files:** `frontend/src/components/portfolio/PortfolioOverview.tsx`, `frontend/src/types/api.ts`, `backend/repositories/portfolio_repo.py`, `backend/schemas/portfolio.py`, `ProcessData.py`, `run_mark_to_market.py`, `run_portfolio_summary.py`
- **Requirements:**
  1. **Legend Checkboxes**:
     - Chart 1: Checkboxes for `Portfolio Size`, `Capital`, and `Margin Loan`. Y-axis scales to visible curves only.
     - Chart 2: Checkboxes for `Total` and **all** traded/held symbols in the timeframe (remove the `[:5]` cap in `get_portfolio_4chart_overview`). Toggling any individual stock checkbox only shows/hides that stock's polyline and never recalculates `Total`.
  2. **Transaction Annotations (Option A)**:
     - Extend `GET /api/v1/portfolio/overview` response schema with `trade_annotations` (`date`, `symbol`, `buysell`, `quantity`, `price`, `currency`, `remarks`) for the active date window.
     - Plot BUY (`▲`, emerald) and SELL (`▼`, rose) markers on Chart 1 (`Portfolio Size` line) and Chart 2 (`Total` line when visible, plus each checked stock's line).
     - Show full trade details for the hovered date in the synchronized hover tooltip.
     - Add a `Show Trades` checkbox toggle.
  3. **Capital Adjustment Annotations (Option A)**:
     - Extend `GET /api/v1/portfolio/overview` response schema with `capital_annotations` (`date`, `transtype`, `amount`, `currency`, `broker`, `remarks`) for the active date window.
     - Plot Deposit (blue `◆`) and Withdrawal (amber `◆`) markers on Chart 1's `Capital` line.
     - Show full capital adjustment details for the hovered date in Chart 1's hover tooltip.
     - Add a `Show Capital` checkbox toggle.
  4. **3-Layer Self-Healing EOD Dip Fix**:
     - `ProcessData.py` (`insert_EODData`): Skip/reject rows where `close` is `None`, `NaN`, or `<= 0`.
     - `run_mark_to_market.py`: Clean existing `eoddata` / `position` rows with `NULL`, `NaN`, or `<= 0` prices before refreshing positions.
     - `run_portfolio_summary.py`: Filter `eodprice IS NOT NULL AND eodprice::text != 'NaN' AND eodprice > 0` inside the `latest_pos` CTE so missing/invalid days forward-fill the prior valid closing price.
     - `backend/repositories/portfolio_repo.py`: Skip `NULL`/`NaN`/`<= 0` `eodprice` rows when constructing Chart 2 stock series so invalid days forward-fill cleanly.

### Item 3: Cloud Run Daily Jobs (`DEV` & `PROD`) & DB Connection Pool Sizing
- **Files:** `.github/workflows/deploy-dev.yml`, `.github/workflows/deploy-prod.yml`, `backend/db/session.py`, `backend/config.py`, `main.py`
- **Requirements:**
  1. **`deploy-dev.yml` (`alpha-insight-daily-job-dev`)**: Resolve `alpha-insight-web-dev` URL dynamically via `gcloud run services describe` and pass `API_URL=${WEB_URL}` in `--set-env-vars` and `API_KEY=alpha-api-key-dev:latest` in `--set-secrets` for both `update` and `create`.
  2. **`deploy-prod.yml` (`alpha-insight-daily-job-prod`)**: Build and push `Dockerfile.job` (`alpha-insight-daily-job`), resolve `alpha-insight-web-prod` URL dynamically, and create/update `alpha-insight-daily-job-prod` with `ENV=PRD`, `DB_NAME=4leafclover`, `DB_HOST=/cloudsql/${{ env.INSTANCE_CONNECTION }}`, `API_URL=${WEB_URL}`, and secrets `DB_PASSWORD=alpha-db-password:latest`, `TWELVEDATA_API_KEY=alpha-twelvedata-api-key:latest`, `API_KEY=alpha-api-key:latest`.
  3. **DB Connection Pool Bounds**: Configure SQLAlchemy engine pool (`DB_POOL_SIZE=3`, `DB_MAX_OVERFLOW=5`, `DB_POOL_RECYCLE=300`, `DB_POOL_TIMEOUT=30`) and `psycopg2` pool (`DB_RAW_POOL_MAXCONN=5`) via `backend/config.py` and `backend/db/session.py`. Dispose SQLAlchemy engine cleanly in `main.py`'s `finally` block.
  4. **Cloud Run Startup Guard (`main.py`)**: Raise a clear configuration error if `CLOUD_RUN_JOB` is set and `API_URL` points to `localhost` or `127.0.0.1`.

### Item 4: `Research -> Macroeconomics` — Backdated Research Run Selector
- **Files:** `frontend/src/components/research/RunHistoryStepper.tsx` (new shared component), `frontend/src/components/research/MacroeconomicsView.tsx`, `frontend/src/components/research/AnalystCommitteeView.tsx`
- **Requirements:**
  1. Extract the `< [Date/Time · Run #X of N ▾] >` historical run selector from `AnalystCommitteeView.tsx` into a shared component (`RunHistoryStepper.tsx`) used by both `Stock Analysis` and `Macroeconomics`.
  2. Load stored Macro runs (`GET /api/v1/committee/runs?symbol=MACRO&limit=30`) on mount and after each new Macro analysis run.
  3. Stepping backward/forward, selecting from the dropdown, or clicking a row in the bottom "Stored Macroeconomics Outputs History" table loads that run via `GET /api/v1/committee/runs/{run_id}` and updates all four tabs (`Global & US Macro`, `SG & Asia-Pacific Macro`, `Secular & Geopolitics`, `Overview`) plus the active screen context.

### Item 5: `Admin -> Site Map Admin` — Hierarchical Tree Ordering
- **Files:** `frontend/src/components/admin/SiteMapAdmin.tsx`
- **Requirements:**
  1. Reconstruct the nested parent-child tree from the flat `apiClient.getAdminSitemap()` response using `parent_id`, sorting every sibling level by `order_index` ascending (tie-break by `id`), matching the exact visual hierarchy and order of the left `NAVIGATION` sidebar.
  2. Include `parent_id` in the `SiteMapUpdateRequest` payload in `handleSaveNode()` so reparenting and reordering persist and immediately reflect in the tree.

### Item 6: `Research -> Stock Analysis` — 3-Tier Watchlist Symbol Sorting
- **Files:** `frontend/src/components/research/AnalystCommitteeView.tsx`
- **Requirements:**
  1. Fetch active positions alongside watchlist items and sort the `Watchlist Symbol` dropdown into 3 `<optgroup>` tiers:
     - **My Positions**: Open positions (`quantity != 0`, non-index), ascending alphabetical by `symbol`.
     - **Other Stocks**: Remaining non-index watchlist symbols, ascending alphabetical by `symbol`.
     - **Indexes**: Symbols starting with `^` or tagged in the Index watchlist, ascending alphabetical by `symbol`.
  2. Default initial selection (when no symbol is pre-selected) to the first symbol in the sorted list.

### Item 7: AI Model Catalog Update
- **Files:** `backend/services/agent_orchestrator.py` (and check frontend fallback lists)
- **Requirements:**
  1. Add `("gemini-4-neon", "Gemini 4 Neon", "gemini")` to `get_supported_models()`.
  2. Remove `gemini-3.8-flash`, `gemini-2.5-pro`, and `gemini-2.5-flash`.
  3. Retained model list: `gemini-4-argon` (default), `gemini-4-neon`, `gemini-4-carbon`, `gemini-4-hydrogen`, `kimi-k2-0711-preview`.

---

## 3. Success Criteria & Verification (UAT)

### Functional Criteria
- **UAT-1 (Transactions):** Ledger with `HKD`, `SGD`, and `USD` trades renders 3 mutually exclusive sub-total rows in alphabetical order (`HKD`, `SGD`, `USD`); sum of sub-total trade counts equals Grand Total count; BUY/SELL Price, BUY/SELL Quantity, and `Net Bal` are blank on sub-total and Grand Total rows; Grand Total Buy, Sell, and Realized PnL consolidate all 3 currencies using historical FX; `9988.HK`/`0700.HK` rows and headers display `HK$`.
- **UAT-2 (Portfolio Overview):** All Chart 1 and Chart 2 series toggle via checkboxes; Chart 2 includes all held symbols (`9988.HK`, `0700.HK`, etc.) and unchecking any stock does not alter `Total`; BUY/SELL and Deposit/Withdrawal markers render with tooltip details and toggle checkboxes; `insert_EODData` rejects `NaN`/`<= 0` closes; `run_portfolio_summary` and `portfolio_repo` forward-fill invalid `eodprice` without 1-day valuation plunges.
- **UAT-3 (Cloud Run Jobs & Pooling):** `deploy-dev.yml` injects `API_URL` and `API_KEY` into `alpha-insight-daily-job-dev`; `deploy-prod.yml` builds and deploys `alpha-insight-daily-job-prod`; `backend/db/session.py` bounds SQLAlchemy and `psycopg2` pools; `main.py` fails fast if `CLOUD_RUN_JOB` is set with `localhost` `API_URL`.
- **UAT-4 (Macroeconomics History):** `< [Date/Time · Run #X of N ▾] >` stepper renders in `Macroeconomics` and switches all 4 tabs to backdated runs; both `Stock Analysis` and `Macroeconomics` share `RunHistoryStepper.tsx`.
- **UAT-5 (Site Map Admin):** `Navigation Hierarchy Tree` renders nested parent/child nodes sorted by `order_index` matching the sidebar order; saving `parent_id` or `order_index` updates the tree immediately.
- **UAT-6 (Stock Analysis Dropdown):** `Watchlist Symbol` dropdown groups symbols into `My Positions`, `Other Stocks`, and `Indexes`, each sorted ascending alphabetically by `symbol`.
- **UAT-7 (AI Models):** `GET /api/v1/committee/models` includes `gemini-4-neon` and excludes all Gemini `< 4` models.

### UI/UX & Engineering Criteria
- All UI additions match the existing Tailwind slate/blue/emerald/rose design system with zero regressions to existing layouts.
- Zero hardcoded URLs, secrets, or magic numbers.
- Full CI-Parity Gate passes cleanly (`uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy backend`, `uv run pytest`, and `npm test` / `npx vitest run` in `frontend/`).
