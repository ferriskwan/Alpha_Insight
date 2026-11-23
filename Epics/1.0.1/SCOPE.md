# Epic 1.0.1 — Scope Document

**Branch:** `1.0.1`  
**Status:** Draft (Gathering Requirements)

---

## Item 1: My Portfolio -> Transactions — Multi-Currency Sub-Totals & Grand Total Rectification (Firmed Up)

### Affected Files
- Frontend: `frontend/src/components/portfolio/TransactionsView.tsx`
- Backend: `backend/api/v1/transactions.py`

### Confirmed Requirements
1. **Dynamic, Mutually Exclusive Currency Sub-Totals**
   - Group all loaded trades dynamically by currency (no hardcoded `USD`/`SGD` filter).
   - Render one sub-total row per distinct currency present in the trade ledger (e.g., `HKD`, `SGD`, `USD`).
   - Sort currency sub-total rows in **alphabetical order** by currency code (`HKD`, `SGD`, `USD`, ...).
   - Ensure fallback currency inference handles `.HK` -> `HKD` in addition to `.SI` -> `SGD` (in both backend `list_trade_records` and frontend `getTradeCurrency`) when a symbol is absent from `watchlist`.
   - Each currency sub-total displays:
     - Label: `<CCY> SUB-TOTAL (<n> trade[s])`
     - BUY Consideration (formatted with currency prefix)
     - SELL Consideration (formatted with currency prefix)
     - Realized PnL (formatted with currency prefix)

2. **Remove Irrelevant Aggregated Fields from Sub-Totals and Grand Total**
   - Remove/blank **BUY Price (`Avg —`)**, **BUY Quantity**, **SELL Price (`Avg —`)**, **SELL Quantity**, and **`Net Bal: ... shs`** from all currency sub-total rows and the Grand Total row.

3. **Grand Total Consolidation (Option A — Historical Per-Trade FX)**
   - **Buy Consideration (USD)** & **Sell Consideration (USD)**: Sum across **all** trades regardless of currency, converting each non-USD trade using its historical previous-day FX rate (`max(date) < tradedate`) returned by `GET /api/v1/transactions/trade`.
   - **Realized PnL (USD)**: Dynamically sum Realized PnL across **all** currencies present (not just `USD` + `SGD`), converting each non-USD currency's Realized PnL to USD using that currency's FX rate (removing the hardcoded `1.30` SGD fallback).
   - Label displays total trade count across all currencies and the `CONSOLIDATED USD` badge.

4. **Consistent Currency Prefix Formatting**
   - Apply a shared currency prefix helper (e.g., `USD -> $`, `SGD -> S$`, `HKD -> HK$`, fallback `<CCY> `) consistently across:
     - Trade detail rows (Price and Consideration in both Grouped and List modes)
     - Symbol group header metrics strip (`Avg Buy`, `Avg Sell`, `Realized`, `Unrealized`)
     - Currency sub-total rows
     - Currency badge styling (support `HKD` and other currencies cleanly, not only `SGD` vs default).

### Acceptance Criteria (Item 1)
- Every currency present in the trade book (including `HKD`) appears as its own mutually exclusive sub-total row, ordered alphabetically.
- Sum of trade counts across all currency sub-total rows equals the Grand Total trade count.
- BUY Price, BUY Quantity, SELL Price, SELL Quantity, and `Net Bal` are not shown on sub-total or Grand Total rows.
- Grand Total Buy Consideration, Sell Consideration, and Realized PnL include all currencies (including `HKD`) converted to USD using historical FX rates.
- `9988.HK` and `0700.HK` group headers and detail rows display `HK$` instead of `$`.

---

## Item 2: My Portfolio -> Portfolio Overview — Interactive Checkboxes, Event Annotations & EOD Data Dip Fix (Firmed Up)

### Affected Files
- Frontend: `frontend/src/components/portfolio/PortfolioOverview.tsx`, `frontend/src/types/api.ts`
- Backend API/Repo: `backend/repositories/portfolio_repo.py`, `backend/schemas/portfolio.py`
- Data Pipeline: `ProcessData.py`, `run_mark_to_market.py`, `run_portfolio_summary.py`

### Confirmed Requirements
1. **Checkbox Visibility Toggles (Chart 1 & Chart 2)**
   - **Chart 1 (`Portfolio Size`, `Capital`, `Margin Loan`)**: Replace static legend spans with checkboxes so each curve can be toggled visible/invisible independently. Y-axis scaling adapts to visible series without altering underlying data.
   - **Chart 2 (`Total` + All Traded/Held Symbols)**:
     - Replace `Total` static span and stock pill buttons with checkboxes.
     - Remove the top-5 symbol cap (`[:5]`) in `get_portfolio_4chart_overview` (`portfolio_repo.py`) so **all** traded/held symbols in the timeframe (including `9988.HK`, `0700.HK`, etc.) appear in Chart 2.
     - Checking/unchecking individual stock checkboxes only shows/hides those stock lines and **does not** alter or recalculate the `Total` aggregated curve.

2. **Transaction Annotations (Chart 1 & Chart 2 — Option A)**
   - Return executed trade events within the active chart date window from `GET /api/v1/portfolio/overview` (`date`, `symbol`, `buysell`, `quantity`, `price`, `currency`, `remarks`).
   - Plot compact markers directly on the chart lines (green `▲` for BUY, red `▼` for SELL):
     - **Chart 1**: Plotted on the `Portfolio Size` line.
     - **Chart 2**: Plotted on the `Total` line (when visible) and on each individual stock's line (matching that stock's visible checkbox).
   - Display full trade details for the hovered date inside the synchronized point-in-time hover tooltip.
   - Provide a `Show Trades` checkbox toggle to show/hide transaction markers.

3. **Capital Adjustment Annotations (Chart 1 — Option A)**
   - Return capital adjustment events within the active chart date window from `GET /api/v1/portfolio/overview` (`date`, `transtype`, `amount`, `currency`, `broker`, `remarks`).
   - Plot compact markers directly on the `Capital` line in Chart 1 (blue `◆` for Deposit, amber `◆` for Withdrawal).
   - Display full capital adjustment details for the hovered date inside Chart 1's hover tooltip.
   - Provide a `Show Capital` checkbox toggle to show/hide capital markers.

4. **Eliminate Single-Day Valuation Dips (3-Layer Self-Healing Fix)**
   - **Ingestion (`ProcessData.py`)**: Reject/skip rows where `close` is `None`, `NaN`, or `<= 0` in `insert_EODData()`.
   - **Batch Valuation (`run_mark_to_market.py` & `run_portfolio_summary.py`)**:
     - Clean/ignore any existing `NaN`/`NULL`/`<= 0` `eoddata` and `position` rows during batch execution (self-healing).
     - Filter `eodprice IS NOT NULL AND eodprice::text != 'NaN' AND eodprice > 0` inside the `latest_pos` CTE in `run_portfolio_summary.py` so missing/invalid days forward-fill the prior valid closing price instead of valuing the position at `0`.
   - **Overview Query (`backend/repositories/portfolio_repo.py`)**: Ignore invalid `eodprice` (`None`, `NaN`, `<= 0`) when building Chart 2 stock series so invalid days forward-fill instead of plotting `qty * (0 - avg)`.

### Acceptance Criteria (Item 2)
- All series in Chart 1 and Chart 2 (including `Total` and all traded/held symbols) can be toggled via checkboxes; toggling individual stock checkboxes does not change the `Total` curve.
- BUY/SELL markers appear on Chart 1 and Chart 2 with hover tooltip details and a `Show Trades` toggle.
- Capital Deposit/Withdrawal markers appear on Chart 1's `Capital` line with hover tooltip details and a `Show Capital` toggle.
- No single-day `NaN`/zero-price valuation dips occur in Chart 1, Chart 2, or Chart 4 after running the self-healing batch refresh.

---

## Item 3: Cloud Run Daily Job (`alpha-insight-daily-job-dev`) Failure Rectification

### Troubleshooting Findings (Execution `alpha-insight-daily-job-dev-tvhc7`, 2026-11-23 01:59 UTC)
1. **Primary Fatal Error — `ConnectionRefusedError` to `http://localhost:8080/api/v1/sys/init`**
   - `main.py` calls `settings.api_url` (`API_URL`) with header `X-API-KEY: settings.api_key` (`API_KEY`).
   - `.github/workflows/deploy-dev.yml` (lines 144–187) deploys `alpha-insight-daily-job-dev` **without** `API_URL` or `API_KEY`.
   - `API_URL` falls back to `http://localhost:8080` (`backend/config.py:25`), causing immediate connection refusal inside the Cloud Run Job container.
   - Without `API_KEY=alpha-api-key-dev:latest`, API calls to `alpha-insight-web-dev` would also fail authentication.
2. **Secondary Error — Cloud SQL `max_connections` Exhaustion**
   - Log: `FATAL: remaining connection slots are reserved for roles with the SUPERUSER attribute` when `main.py` initializes `job_execution_log` on `/cloudsql/gen-lang-client-0632004807:asia-southeast1:clover`.
   - Cause: Each Cloud Run container currently creates two unbounded/large pools (`SQLAlchemy` default `pool_size=5, max_overflow=10` + `psycopg2 ThreadedConnectionPool(minconn=1, maxconn=20)` = up to 35 connections per instance) across multiple Cloud Run services sharing one Cloud SQL instance (`clover`).

### Affected Files
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`
- `backend/db/session.py`, `backend/config.py`
- `main.py` (fail-fast validation if `API_URL` is `localhost` in non-local Cloud Run environments)

### Rectification Steps
1. **Inject `API_URL` and `API_KEY` into `alpha-insight-daily-job-dev` in `deploy-dev.yml`:**
   - Dynamically resolve the deployed `alpha-insight-web-dev` URL via `gcloud run services describe alpha-insight-web-dev --region ${{ env.REGION }} --format="value(status.url)"` before deploying the job.
   - Pass `API_URL=${WEB_URL}` in `--set-env-vars` and `API_KEY=alpha-api-key-dev:latest` in `--set-secrets` for both `gcloud run jobs update` and `gcloud run jobs create`.
2. **Add `alpha-insight-daily-job-prod` Build & Deployment to `deploy-prod.yml`:**
   - Build and push `Dockerfile.job` to `asia-southeast1-docker.pkg.dev/gen-lang-client-0632004807/alpha-insight-repo/alpha-insight-daily-job:${{ github.sha }}` (and `:latest`).
   - Dynamically resolve `alpha-insight-web-prod` URL via `gcloud run services describe alpha-insight-web-prod --region ${{ env.REGION }} --format="value(status.url)"`.
   - Create or update Cloud Run Job `alpha-insight-daily-job-prod` (`ENV=PRD`, `DB_NAME=4leafclover`, `DB_HOST=/cloudsql/${{ env.INSTANCE_CONNECTION }}`, `API_URL=${WEB_URL}`, secrets `DB_PASSWORD=alpha-db-password:latest`, `TWELVEDATA_API_KEY=alpha-twelvedata-api-key:latest`, `API_KEY=alpha-api-key:latest`).
3. **Right-size Database Connection Pools (`backend/db/session.py` & `backend/config.py`):**
   - Bound SQLAlchemy engine pool (`pool_size=3`, `max_overflow=5`, `pool_recycle=300`, `pool_timeout=30`) and `psycopg2` pool (`minconn=1`, `maxconn=5`) via configurable env vars in `backend/config.py` so multiple Cloud Run services + jobs do not exhaust Cloud SQL connection slots.
   - Dispose engine cleanly in `main.py`'s `finally` block.
4. **Startup Config Guard (`main.py`):**
   - Fail fast with a clear configuration error if running inside Cloud Run (`CLOUD_RUN_JOB` env var present) while `API_URL` points to `localhost`/`127.0.0.1`.
5. **Live Verification:**
   - Verify `alpha-insight-daily-job-dev` execution completes with exit code `0` and `SUCCESS` in `job_execution_log` after DEV deploy; confirm `alpha-insight-daily-job-prod` is created and healthy on PROD release.

---

## Item 4: Research -> Macroeconomics — Backdated Research Run Selector (Parity with Stock Analysis)

### Affected Files
- Frontend: `frontend/src/components/research/MacroeconomicsView.tsx`, `frontend/src/components/research/AnalystCommitteeView.tsx` (extract shared run-selector component for DRY reuse)
- Backend (verify/reuse): `backend/api/v1/committee.py` (`GET /api/v1/committee/runs?symbol=MACRO`, `GET /api/v1/committee/runs/{run_id}`)

### Confirmed Requirements
1. **Historical Run Stepper & Dropdown in Macroeconomics Panel**:
   - Add the same historical run navigation control used in `Stock Analysis` (`<` previous run, date/timestamp dropdown showing `Run #X of N`, `>` next run) to the `Macroeconomics` research panel header (next to / below the `Global & US Macro`, `SG & Asia-Pacific Macro`, `Secular & Geopolitics`, `Overview` tabs).
   - Extract the stepper/dropdown into a shared reusable component used by both `AnalystCommitteeView.tsx` and `MacroeconomicsView.tsx` (DRY).
2. **Backdated Run Loading**:
   - Fetch stored Macro runs (`symbol=MACRO`) on load and after executing a new analysis.
   - Selecting or stepping to a backdated run loads that run's full outputs (`Global & US Macro`, `SG & Asia-Pacific Macro`, `Secular & Geopolitics`, `Overview`), confidence score, bias badge, and updates the active screen context for `Reference in Note` / chat.
   - Clicking a run in the bottom "Stored Macroeconomics Outputs History" ledger also jumps to that run.

### Acceptance Criteria (Item 4)
- `Macroeconomics` displays the `< [Date/Time · Run #X of N v] >` selector matching `Stock Analysis`.
- Stepping backward/forward or picking a historical run from the dropdown updates all four Macro tabs (`Global & US Macro`, `SG & Asia-Pacific Macro`, `Secular & Geopolitics`, `Overview`) to the selected backdated run.
- Running a new Macro analysis prepends the new run and selects it as `Run #1 of N`.

---

## Item 5: Admin -> Site Map Admin — Hierarchical Tree Ordering Matching Sidebar Navigation

### Current State (Verified in Code)
- **File:** `frontend/src/components/admin/SiteMapAdmin.tsx` (and `backend/api/v1/sitemap.py`)
- `apiClient.getAdminSitemap()` returns a flat list of all 17 `site_map` records sorted globally by `order_index` (`#1 Overview`, `#1 Stock Analysis`, `#1 User Admin`, `#1 Investment`, `#2 Transactions`, ...), without nesting children under their `parent_id`.
- `SiteMapAdmin.tsx` renders the returned array directly at root level, making the tree flat and out of order relative to the left `NAVIGATION` sidebar.
- In `handleSaveNode()`, `parent_id` is also omitted from the `SiteMapUpdateRequest` payload when updating an existing node.

### Confirmed Requirements
1. **Hierarchical Tree Construction & Ordering**:
   - Reconstruct the parent-child tree using `parent_id` (supporting multi-level nesting, e.g., `My Portfolio -> Transactions -> Investment / Capital / Trans Cost`) and sort every sibling level by `order_index` ascending (tie-break by `id`), so the `Navigation Hierarchy Tree` in `Site Map Admin` mirrors the exact hierarchy and visual order of the left `NAVIGATION` sidebar.
   - Visually indent child nodes by depth level with expand/collapse chevrons and folder/item icons matching the hierarchy.
2. **Persist `parent_id` on Update & Live Sync**:
   - Include `parent_id` in `SiteMapUpdateRequest` when saving changes to an existing node so reparenting works cleanly and updates the displayed tree order immediately.

### Acceptance Criteria (Item 5)
- `Navigation Hierarchy Tree` in `Site Map Admin` displays nodes nested by `parent_id` and sorted by `order_index` at each level, matching the exact top-to-bottom order in the left `NAVIGATION` sidebar.
- Editing a node's `Sort Order` or `Parent Node` immediately updates its position in the tree upon save.

---

## Item 6: Research -> Stock Analysis — Tiered Sorting for Watchlist Symbol Dropdown

### Affected Files
- Frontend: `frontend/src/components/research/AnalystCommitteeView.tsx`

### Confirmed Requirements
1. **3-Tier Watchlist Symbol Ordering**:
   - **Tier 1 (Top)**: Symbols in which the user currently holds an open position (`quantity != 0` from active positions), sorted alphabetically by `symbol` ascending (e.g., `0700.HK`, `5E2.SI`, `9988.HK`, `BN4.SI`, `D05.SI`, `GLW`).
   - **Tier 2 (Middle)**: All other non-index watchlist symbols (no active open position), sorted alphabetically by `symbol` ascending.
   - **Tier 3 (Bottom)**: Market indexes (symbols starting with `^` or tagged in the Index watchlist, e.g., `^DJI`, `^HSI`, `^NDX`, `^SPX`, `^STI`), sorted alphabetically by `symbol` ascending.
   - Render each non-empty tier inside a labeled `<optgroup>` (`My Positions`, `Other Stocks`, `Indexes`) for clear visual separation.
2. **Default Selection**:
   - When no symbol is pre-selected, default to the first symbol in the sorted list (i.e., first open position).

### Acceptance Criteria (Item 6)
- Open-position stocks appear at the top of the `Watchlist Symbol` dropdown in ascending alphabetical order by symbol.
- Other non-index stocks appear second in ascending alphabetical order by symbol.
- Indexes (`^DJI`, `^HSI`, `^NDX`, `^SPX`, `^STI`, etc.) appear at the bottom in ascending alphabetical order by symbol.

---

## Item 7: AI Model Catalog Update — Add Gemini 4 Neon & Remove Pre-Gemini-4 Models

### Affected Files
- Backend: `backend/services/agent_orchestrator.py` (`get_supported_models`)
- Frontend (fallback state check): `frontend/src/components/research/AnalystCommitteeView.tsx`, `frontend/src/components/research/MacroeconomicsView.tsx`

### Confirmed Requirements
1. **Add `gemini-4-neon`**: Add `("gemini-4-neon", "Gemini 4 Neon", "gemini")` to `get_supported_models()`.
2. **Remove Gemini `< 4` Models**: Remove `gemini-3.8-flash`, `gemini-2.5-pro`, and `gemini-2.5-flash` from `get_supported_models()` (and any frontend fallback model arrays).
3. **Retained Catalog**:
   - `gemini-4-argon` (default)
   - `gemini-4-neon`
   - `gemini-4-carbon`
   - `gemini-4-hydrogen`
   - `kimi-k2-0711-preview`

### Acceptance Criteria (Item 7)
- `GET /api/v1/committee/models` returns `gemini-4-neon` and no Gemini model with major version `< 4`.
- The `Agent Model` dropdown in both `Stock Analysis` and `Macroeconomics` reflects the updated catalog.






