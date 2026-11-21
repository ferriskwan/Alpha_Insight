# Walkthrough — Epic 0.6: Portfolio Overview Upgrade & Stock Analyst Bug-Fix

**Project**: Alpha_Insight  
**Milestone**: Epic 0.6  
**Branch**: `feat/epic-0.6-portfolio-overview`  
**Status**: Verification Complete  

---

## 1. Overview of Changes

Epic 0.6 delivers the following changes:
1. Upgrades `[Overview]` dashboard (`frontend/src/components/portfolio/PortfolioOverview.tsx`) from a static SVG mockup to an interactive view driven by `daily_portfolio_summary`, `position`, `trade`, and `agent_analyst_outputs`.
2. Seeds `DEFAULT_CURRENCY = 'SGD'` into `public.sysvalue` via Alembic migration `0009` and defaults the currency selector to `SGD`.
3. Sanitizes `NaN` values in `run_mark_to_market.py` and `run_portfolio_summary.py`, and recalculates historical summaries cleanly.
4. Fixes Stock Analyst (`/research/committee`) bug by removing hardcoded `'AAPL'` defaults and mock watchlists; initializes `selectedSymbol` dynamically to the first active ticker (`5E2.SI`) and eliminates all synthetic candlestick generators (`math.sin` loops) in `backend/repositories/research_repo.py`, returning an empty list `[]` when data is absent.
5. Provides 6 metric badges (Realized PnL, Unrealized PnL, Total PnL, Capital, Margin, Total Portfolio) with Amount and % toggles, and rollover tooltips containing arithmetic calculation formulas.
6. Implements Chart 1 (Total Portfolio Size, Capital, Margin over 1M/3M/6M/12M) and Chart 2 (Cumulative PnL Attribution comparing Total Portfolio to top 5 stocks with interactive legend pill toggles and synchronized crosshairs).
7. Implements 4-quadrant AI Commentary synthesis engine ([Technical], [Fundamental], [Macro], [Risk Mgt]) with database/in-memory caching keyed by `(user_id, date, currency)` and on-demand refresh.

---

## 2. File Change Matrix

| Component / Layer | File Path | Nature of Change |
| :--- | :--- | :--- |
| **Database Migration** | `alembic/versions/0009_seed_default_currency_sysvalue.py` | Idempotent migration inserting `('DEFAULT_CURRENCY', 'STRING', 'SGD')` into `sysvalue`. |
| **Batch Pipeline** | `run_mark_to_market.py` | Added `AND e.close::text != 'NaN' AND e.close > 0` and fallback close sanitization. |
| **Batch Pipeline** | `run_portfolio_summary.py` | Added NaN sanitization in SQL aggregation and Python validation before database insertion. |
| **Backend Repo** | `backend/repositories/ref_data_repo.py` | Added `get_default_currency(db)` resolving default from `sysvalue`. |
| **Backend Repo** | `backend/repositories/portfolio_repo.py` | Added loan/interest tracking in performance series and implemented `get_portfolio_4chart_overview` with badges, Chart 1 (PCM), and Chart 2 (top stocks). |
| **Backend Repo** | `backend/repositories/research_repo.py` | Removed all synthetic mock candlestick generators from `get_stock_intraday_data` and `get_stock_analyst_data`. |
| **Backend Schemas** | `backend/schemas/portfolio.py` | Defined Pydantic v2 schemas: `PortfolioOverviewKPIs`, `PortfolioCapitalMarginPoint`, `PortfolioStockPnLPoint`, `PortfolioChart2Data`, `PortfolioOverviewResponse`, `PortfolioCommentaryResponse`. |
| **Backend Service** | `backend/services/agent_orchestrator.py` | Implemented `generate_portfolio_overview_commentary` synthesizing 4 quadrants from portfolio metrics and `agent_analyst_outputs`. |
| **Backend API** | `backend/api/v1/portfolio.py` | Exposed updated `GET /overview`, `GET /overview/commentary`, and `POST /overview/commentary/refresh`. |
| **Frontend Types** | `frontend/src/types/api.ts` | Added TypeScript models matching backend response schemas. |
| **Frontend Service** | `frontend/src/services/apiClient.ts` | Added `getPortfolioOverview`, `getPortfolioCommentary`, and `refreshPortfolioCommentary`. |
| **Frontend Component** | `frontend/src/components/portfolio/PortfolioOverview.tsx` | Full dashboard rewrite with toolbar, 6 badges with rollover formula tooltips, 2 SVG charts, interactive stock pills, and 4-quadrant AI commentary panel. |
| **Frontend Component** | `frontend/src/App.tsx` | Removed hardcoded `'AAPL'` default for `selectedSymbol` and `displayedContext`. |
| **Frontend Component** | `frontend/src/components/research/AnalystCommitteeView.tsx` | Removed mock watchlist fallback; defaults `selectedSymbol` to first active watchlist symbol. |
| **Frontend Component** | `frontend/src/components/research/StockAnalystView.tsx` | Replaced hardcoded ticker array with dynamic watchlist tickers. |
| **Backend Tests** | `tests/backend/test_portfolio_overview.py` | Unit and integration test suite covering badges, formulas, series, commentary, and API routes. |
| **Backend Tests** | `tests/backend/test_research_no_mock.py` | Unit test verifying empty series returned on missing data. |
| **Frontend Tests** | `tests/frontend/portfolio_overview.test.tsx` | Component test verifying badges, formula tooltips, amount/% mode toggles, and stock pills. |
| **Frontend Tests** | `tests/frontend/analyst_committee_sync.test.tsx` | Component test verifying dynamic watchlist resolution (`5E2.SI`) and canvas chart title alignment. |

---

## 3. Metric Badges Formula Specification

| Badge | Amount Metric | Percentage Metric | Rollover Tooltip Formula |
| :--- | :--- | :--- | :--- |
| **1. Realized PnL** | `realized_pnl` | `(realized_pnl / total_capital) * 100` | `Cumulative realized gains from closed trades / Total capital injected` |
| **2. Unrealized PnL** | `unrealized_pnl` | `(unrealized_pnl / total_capital) * 100` | `Current open positions mark-to-market gain / Total capital injected` |
| **3. Total PnL** | `total_pnl` | `(total_pnl / total_capital) * 100` | `(Realized PnL + Unrealized PnL - Cumulative Interest) / Total Capital` |
| **4. Capital** | `total_capital` | `(total_capital / total_asset_value) * 100` | `Net capital injected / Total asset value (Equity ratio)` |
| **5. Margin** | `margin_loan_balance` | `(margin_loan_balance / total_capital) * 100` | `Drawn margin loan balance / Total capital (Leverage ratio)` |
| **6. Total Portfolio** | `total_asset_value` | Period return % over selected timeframe | `Total portfolio asset value (Capital + Positions + Realized PnL) / Period % Return` |

---

## 4. Verification & Gate Results

### 4.1 Tier 1: Linting & Code Style
- `uv run ruff check .`: Passed (0 errors).
- `uv run ruff format --check .`: Passed (127 files checked, 0 errors).

### 4.2 Tier 2: Static Type Analysis
- `uv run mypy backend tests/backend run_mark_to_market.py run_portfolio_summary.py`: Passed (Success: no issues found in 66 source files).

### 4.3 Tier 3: Unit & Integration Test Suites
- **Backend Pytest**: `uv run pytest`:
  - 92 tests executed across `tests/backend/`.
  - **Result**: `92 passed, 1 warning in 13.81s` (Exit code: 0).
- **Frontend Vitest**: `npm.cmd test`:
  - 15 test files executed across `tests/frontend/`.
  - **Result**: `15 passed (15), 85 passed (85) in 9.61s` (Exit code: 0).
- **Frontend TypeScript Check**: `npm.cmd run typecheck`:
  - `tsc --noEmit` executed with zero errors (Exit code: 0).

---

## 5. Stock Analysis Bug-Fix Verification

1. **Watchlist Symbol Synchronization**:
   - `selectedSymbol` initializes from `wlItems[0].symbol` (resolving to `5E2.SI - Seatrium Ltd.` on user's active watchlist).
   - Dropdown selection matches the canvas chart header (`Interactive Canvas Chart — 5E2.SI`).
2. **Zero Mock Candles**:
   - Symbols with no tick or EOD records return `series: []`.
   - The canvas chart displays an empty canvas or message rather than synthetic sine-wave candles.

---

## 4. UI Review & Feedback Resolution (Annotated Screenshot)

### 1. Title Change (Circled Gray)
- **Change**: Renamed header to `"Portfolio Overview"` and removed all sub-text paragraphs beneath it in [PortfolioOverview.tsx](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx).

### 2. Point-in-Time Date Scrolling (Circled Blue)
- **Change**: Added `<` (Previous Day) and `>` (Next Day) chevron buttons flanking the date picker input, allowing single-day stepping across historical dates. Stepping triggers `fetchOverview` with the point-in-time date.

### 3. Graph Axes, Ticks & Point-in-Time Hover Tooltips (Annotated Green)
- **Change**:
  - Rendered explicit solid Y-axis line (`stroke="#94A3B8"`, `strokeWidth="1.5"`) with tick marks and unit label (`SGD` or `%`).
  - Rendered explicit solid X-axis baseline (`stroke="#94A3B8"`, `strokeWidth="1.5"`) with 5-point date tick marks.
  - Interactive hover crosshair now displays point-in-time highlight dots on all series and an overlay card showing exact valuations:
    - **Chart 1**: Portfolio Size, Capital, Margin Loan.
    - **Chart 2**: Total Portfolio PnL and active stock-by-stock PnL attribution.

### 4. SPY Benchmark Explanation (Circled Brown)
- **Explanation**: In the legacy Epic 0.3 mockup, "SPY Benchmark" was a synthetic curve simulated via a hardcoded formula (`spy_mult = 1.0 + (idx * 0.00045)...`). It did not represent actual market SPY returns or benchmark tracking. In Epic 0.6, it has been completely retired in favor of real portfolio valuation and stock-level PnL attribution.

### 5. Missing "GLW" Holding Resolution (Circled Red)
- **Root Cause**: `GLW` (Corning Inc.) trades on the NYSE, while `5E2.SI`, `BN4.SI`, and `D05.SI` trade on SGX. Because Singapore is UTC+8, the SGX records were stamped `2026-11-17` while the latest NYSE close was `2026-11-16`. The legacy query filtered `WHERE Position.tradedate == max(Position.tradedate)` (`2026-11-17`), which omitted `GLW` (600 shares) due to the exchange date difference.
- **Resolution**: Updated [portfolio_repo.py](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py#L32-L55) to query the latest position *per symbol* on or before the target date using a `(symbol, investment, max_tradedate)` group-by subquery. `GLW` (600 shares) is now included in Chart 2 and asset breakdowns with its valuation converted to base currency via official FX rates.

### 6. Capital Metric Aggregation (Circled Orange)
- **Change**: Card 2 is configured as **"Capital"** with value calculated directly from all deposit and withdrawal records in the `[capital]` table (`SELECT * FROM capital WHERE user_id = :uid AND date <= :as_of_date`), converted to target currency (`$197,491.09 SGD`). Hover formula tooltip explains: `"Aggregated net capital injections from capital table"`.

---

## 5. UI Review Round 2: 2x2 Matrix, Mouse Alignment, Weekend Exclusion & Historical Capital

### 1. Mouse Pointer & Crosshair Alignment (Annotated Red)
- **Root Cause**: SVG default `preserveAspectRatio="xMidYMid meet"` created letterboxing when scaling `viewBox="0 0 800 220"` within responsive containers (`w-full h-64`). This introduced lateral pixel offsets between screen mouse `clientX` and the SVG internal viewBox.
- **Resolution**:
  - Applied `preserveAspectRatio="none"` to allow 1:1 filling.
  - Implemented `getHoverIndexFromEvent` using `svg.getScreenCTM().inverse()` to map exact screen coordinates `(e.clientX, e.clientY)` into SVG viewport coordinates, ensuring pixel-perfect crosshair and tooltip alignment.

### 2. 2x2 Chart Matrix Layout (Annotated Green)
- **Resolution**: Reorganized the chart layout from vertical stacked blocks into a balanced 2x2 grid (`grid-cols-1 lg:grid-cols-2 gap-4`):
  - **Top-Left (Chart 1)**: Portfolio Size, Capital & Margin Loan time-series with crosshair tracking.
  - **Top-Right (Chart 2)**: Cumulative PnL Attribution with interactive stock pill toggles.
  - **Bottom-Left (Chart 3)**: Asset & Currency Exposure Distribution with proportional horizontal progress bars for all active holdings (`GLW`, `5E2.SI`, `BN4.SI`, `D05.SI`, `Cash`).
  - **Bottom-Right (Chart 4)**: Daily PnL Distribution (green/rose bars) with High-Water Mark Peak Drawdown curve.

### 3. Weekend Drops to 0 (Annotated Purple)
- **Root Cause**: Weekend calendar dates (Saturdays and Sundays) existed in `daily_portfolio_summary`, but no market trading or EOD price data exists on weekends.
- **Resolution**:
  - Filtered `perf_series = [p for p in perf_series if datetime.fromisoformat(p["date"]).date().weekday() < 5]`, dropping all Saturday and Sunday data points.
  - Forward-filled stock position values across mid-week trading gaps so individual stock PnLs do not dip to zero on holidays.

### 4. Capital Fluctuations & Historical Time Horizon (Circled Orange)
- **Root Cause**: In `daily_portfolio_summary`, 4 currency/account bucket rows exist per calendar day (`SGD Inv`, `SGD Lev`, `USD Inv`, `USD Lev`). A query limit of `limit=365` only fetched 91 days of history (August 19 to November 18), during which no new capital injections occurred.
- **Resolution**:
  - Increased query `limit` to 1500 rows in `get_daily_portfolio_summaries` and `get_portfolio_dashboard`.
  - Now spans the full 12-month timeline, capturing all 8 capital step-ups from $45,339.85 up to $197,491.09.
