# Product Requirements Document (PRD) — Epic 1.1: By Industry / Sector Research & Portfolio Overview Refinements

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.1  
**Status**: Pending Explicit User Sign-off (`proceed`)  
**Scope Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]` (Alembic migration for watchlist seed & sitemap, dynamic EOD sector performance & rotation engine, Yahoo Finance RSS service, 4-analyst sector committee AI engine, daily Cloud Run job batch integration, frontend `IndustrySectorView` upgrade, and comprehensive `PortfolioOverview` layout/formula refinements)

---

## 1. Objective

Epic 1.1 delivers two coordinated capabilities in `Alpha_Insight`:
1. **Industry / Sector Research Suite (`[Research] -> [By Industry/Sector]`)**:
   - Seed the standard 11 GICS sector ETFs and benchmark `SPY` into `public.watchlist` as indexes, enabling automated daily EOD data ingestion into `public.eoddata`.
   - Compute real multi-horizon returns and Relative Rotation Quadrants (`Leading`, `Improving`, `Weakening`, `Lagging`) from `eoddata`.
   - Extract recent sector news headlines via Yahoo Finance RSS and feed them with market metrics into a 4-analyst Sector Committee (`technical`, `fundamental`, `macro`, `risk` + `consensus`) using Gemini Google Search Grounding.
   - Automate daily sector research pre-computation in `alpha-insight-daily-job` and upgrade the frontend view with run history, cited sources, quadrant explanations, provider fallback alerts, and `Investment Notes` integration.
2. **Portfolio Overview Refinements (`[My Portfolio] -> [Overview]`)**:
   - Resolve default date dynamically from `max(date)` in `daily_portfolio_summary`.
   - Default timeframe to 6 months (`6M`).
   - Fold `Capital Adj` into `Capital` in Chart 1, displaying adjustment annotations when `Capital` is enabled.
   - Replace exposure progress bars with an interactive Holdings Pie Chart reacting to the selected `[date]`.
   - Correct `Total Portfolio` formula to aggregate the market value of active positions (`sum(quantity * price)`).
   - Remove "Institutional Performance Series" subtitle wording.
   - Relocate and rename the commentary button to "Generate Commentary" in the top control bar, and restructure the page into a 2-column layout (Graphs on the left column, AI Commentary on the right column).
3. **AI Provider Fallback & Credit Exhaustion Alert Banner**:
   - Detect provider failures (e.g., `402 RESOURCE_EXHAUSTED`, depleted prepayment credits, quota/rate limits) in `agent_orchestrator.py`.
   - Propagate `fallback_warning` in API response payloads across Stock Analysis, Macroeconomics, Sector Research, and Portfolio Commentary.
   - Display an actionable warning alert banner in the UI with direct link to Google AI Studio billing management.

---

## 2. Scope Item Breakdown

### Area A: By Industry / Sector Research

#### Item 1: Database Seed Migration (`0010_seed_gics_sector_indexes_in_watchlist.py`)
- **Files**: `alembic/versions/0010_seed_gics_sector_indexes_in_watchlist.py`
- **Actions**:
  1. Insert 11 GICS sector ETFs (`XLK`, `XLF`, `XLV`, `XLE`, `XLI`, `XLC`, `XLY`, `XLP`, `XLB`, `XLU`, `XLRE`) and `SPY` into `public.watchlist` for `user_id = 1` (`watchlistname = 'Indexes'`, `currency = 'USD'`, `timezone = 'America/New_York'`) using `ON CONFLICT DO NOTHING`.
  2. Insert sitemap node for `[Research] -> [By Industry/Sector]` in `public.sitemap_node`:
     - `parent_id`: ID of `research` menu
     - `menu_code`: `'research.sectors'`, `label`: `'By Industry / Sector'`, `route`: `'/research/sectors'`, `icon`: `'Layers'`, `order_index`: 3, `role_required`: `'user'`, `is_active`: true.

#### Item 2: Dynamic Sector Performance & Relative Rotation Engine
- **Files**: `backend/repositories/research_repo.py`, `backend/schemas/research.py`, `backend/api/v1/research.py`
- **Actions**:
  1. Replace static mock multipliers in `get_sector_performance` with queries against `public.eoddata` for the 11 sector ETFs and `SPY`.
  2. Compute returns across 6 horizons: `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`.
  3. Compute Relative Rotation Quadrant against `SPY`:
     - Relative Strength ratio: $RS = \frac{Close_{sector, t} / Close_{sector, t-21}}{Close_{SPY, t} / Close_{SPY, t-21}}$
     - RS Momentum: $RS\_Mom = RS_t - RS_{t-5}$
     - Quadrant classification:
       - **Leading**: $RS > 1.0$ and $RS\_Mom \ge 0$
       - **Weakening**: $RS > 1.0$ and $RS\_Mom < 0$
       - **Lagging**: $RS \le 1.0$ and $RS\_Mom < 0$
       - **Improving**: $RS \le 1.0$ and $RS\_Mom \ge 0$
  4. Include quadrant definitions, current RS score, and momentum delta in the API response.

#### Item 3: Yahoo Finance RSS Ingestion Service
- **Files**: `backend/services/rss_service.py`
- **Actions**:
  1. Implement `fetch_sector_rss_news(ticker: str, limit: int = 5) -> list[dict[str, str]]` querying `https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US`.
  2. Parse `<item>` nodes (`title`, `link`, `pubDate`, `source`/`publisher`).
  3. Include 5-second timeout and fallback returning `[]` on failure.

#### Item 4: Multi-Analyst Sector Committee AI Engine
- **Files**: `backend/services/agent_orchestrator.py`, `backend/services/prompt_builder.py`, `backend/repositories/committee_repo.py`, `backend/api/v1/research.py`
- **Actions**:
  1. Context Builder: combine sector multi-horizon metrics, rotation quadrant, constituent weights, and Yahoo Finance RSS news items.
  2. Prompt Builder: author 4 analyst roles (`technical`, `fundamental`, `macro`, `risk`) + `executive_summary` consensus for sectors.
  3. Orchestrator: execute 4 roles concurrently via `asyncio.gather`, followed by `executive_summary`. Enable Gemini Google Search Grounding for web citations.
  4. Persist runs into `agent_committee_runs` (`symbol = <SECTOR_ETF>`) and `agent_analyst_outputs`.
  5. Expose endpoints: `GET /api/v1/research/sectors/{symbol}/committee` and `POST /api/v1/research/sectors/{symbol}/committee/refresh`.

#### Item 5: Daily Cloud Run Job Batch Pipeline Integration
- **Files**: `main.py`, `run_sector_research.py`
- **Actions**:
  1. Author `run_sector_research.py` executing after mark-to-market and portfolio summary in `main.py`.
  2. Pre-generate and persist daily committee research runs for all 11 GICS sector ETFs.
  3. Wrap in per-sector try/except so individual failures do not interrupt the daily pipeline.

#### Item 6: Frontend Route & Navigation Wiring
- **Files**: `frontend/src/App.tsx`, `frontend/src/components/layout/DynamicSidebar.tsx`
- **Actions**:
  1. Register `/research/sectors` in `App.tsx` pointing to `<IndustrySectorView />`.
  2. Add `By Industry / Sector` node under `Research` group in `DynamicSidebar.tsx`.

#### Item 7: Frontend `IndustrySectorView` Upgrade
- **Files**: `frontend/src/components/research/IndustrySectorView.tsx`, `frontend/src/types/api.ts`, `frontend/src/services/apiClient.ts`
- **Actions**:
  1. Header Bar: Sector switcher dropdown, historical run stepper (`< [Run Date/Time · Run #X of N] >`), model selector, `Run / Refresh` button, `Reference in Note` button.
  2. Heatmap & Table: dynamic cards with horizon toggles (`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`) and relative rotation column.
  3. Rotation Quadrant Explanatory Section: visual quadrant badge, formula popup/card explaining RS and momentum definitions.
  4. AI Committee Tabs: Executive Summary with stance badge and 4 analyst role tabs (`Technical`, `Fundamental`, `Macro`, `Risk`).
  5. Sources & News Citations Panel: list of cited articles with title, publisher, date, external link, and explanatory notes on agent usage.

---

### Area B: Portfolio Overview Refinements

#### Item 8: Dynamic Default Date from `max(date)` of `daily_portfolio_summary`
- **Files**: `backend/repositories/portfolio_repo.py`, `backend/api/v1/portfolio.py`, `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. In `portfolio_repo.py`: when `date` parameter is not supplied or empty, resolve the default date from `select(func.max(DailyPortfolioSummary.date)).where(DailyPortfolioSummary.user_id == user_id)` (fallback to `user_id = 1`).
  2. In `PortfolioOverview.tsx`: initialize `selectedDate` as empty, population driven by backend `parameters.selectedDate` response on first load.

#### Item 9: Default Horizon / Timeframe to 6 Months (`6M`)
- **Files**: `frontend/src/components/portfolio/PortfolioOverview.tsx`, `backend/repositories/portfolio_repo.py`
- **Actions**:
  1. Update initial `timeframe` state in `PortfolioOverview.tsx` from `'12M'` to `'6M'`.
  2. Update default `timeframe` parameter in `portfolio_repo.py` line 852 from `"12M"` to `"6M"`.

#### Item 10: Fold `Capital Adj` into `Capital` in Chart 1
- **Files**: `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. Remove the standalone `Capital Adj` checkbox from the Chart 1 legend.
  2. When the `Capital` checkbox is toggled ON, automatically display both the Capital curve line and the capital adjustment event markers/annotations.

#### Item 11: Holdings Pie Chart as of `[date]`
- **Files**: `backend/repositories/portfolio_repo.py`, `backend/schemas/portfolio.py`, `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. In `portfolio_repo.py`: update `get_portfolio_dashboard` and `get_portfolio_4chart_overview` to accept `tradedate` and query `get_positions(db, user_id=user_id, tradedate=target_date)`.
  2. Compute per-holding market value in base currency and percentage share as of `selectedDate`.
  3. In `PortfolioOverview.tsx`: replace the horizontal bar list in "Asset & Currency Exposure Distribution" with an interactive SVG/HTML5 Holdings Pie Chart displaying portfolio distribution reacting dynamically whenever `selectedDate` changes.

#### Item 12: Correct `Total Portfolio` KPI Formula
- **Files**: `backend/repositories/portfolio_repo.py`, `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. In `portfolio_repo.py`: set `kpis_dict["totalPortfolio"]` to the aggregation of positions (`sum(p.quantity * p.eodprice * fx_rate)` across active holdings on that date).
  2. In `PortfolioOverview.tsx`: update the formula rollover tooltip on the `Total Portfolio` badge to display `Aggregation of active positions: sum(Quantity * Market Price * FX)`.

#### Item 13: Remove Subtitle Wording
- **Files**: `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. Remove `Institutional Performance Series` heading and `Dynamic time-series curves with synchronized crosshair date alignment.` description from the charts header.

#### Item 14: Top Bar Commentary Button, Title Removal & 2-Column Dashboard Layout
- **Files**: `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. Top Bar: Relocate the commentary button from the bottom section into the top parameter bar alongside `< [date] >`, and rename it from "Refresh AI Commentary" to **"Generate Commentary"**.
  2. Commentary Panel Header: Remove the `AI Portfolio Intelligence` title and subtitle (`4-Quadrant executive commentary synthesizing Technical, Fundamental, Macro, and Risk Management dimensions.`) entirely.
  3. 2-Column Layout Restructuring:
     - **Left Column (Graphs)**:
       - Chart 1: Portfolio Size, Capital & Margin
       - Chart 2: Cumulative PnL Attribution
       - Chart 3: Holdings Pie Chart as of [date]
       - Chart 4: Daily PnL & High-Water Mark Drawdown
     - **Right Column (AI Commentary)**:
       - AI Portfolio Commentary panel (Technical, Fundamental, Macro, Risk quadrants with stance badges and bullet summaries) rendered side-by-side with the charts.

#### Item 15: AI Provider Fallback & Credit Exhaustion Alert Banner
- **Files**: `backend/services/agent_orchestrator.py`, `backend/schemas/committee.py`, `backend/schemas/portfolio.py`, `frontend/src/components/research/AnalystCommitteeView.tsx`, `frontend/src/components/research/MacroeconomicsView.tsx`, `frontend/src/components/research/IndustrySectorView.tsx`, `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Actions**:
  1. Backend Detection & Propagation:
     - In `agent_orchestrator.py`: when `_invoke_llm_text` catches provider errors (specifically `402 RESOURCE_EXHAUSTED` / depleted credits, 401 unauthorized, or 429 quota exhaustion), capture a descriptive `fallback_warning`.
     - Expose `fallback_warning: Optional[str]` across API schemas (`CommitteeRunSummaryResponse`, `MacroWorkbenchResponse`, `PortfolioCommentaryResponse`, and sector responses).
  2. Frontend Alert Banner:
     - In `AnalystCommitteeView`, `MacroeconomicsView`, `IndustrySectorView`, and `PortfolioOverview`:
     - When `fallback_warning` is populated, render an amber institutional alert banner above the commentary tabs:
       - Amber warning icon (`AlertTriangle`).
       - Clear text stating: `"AI Provider Notice: Google Gemini credits depleted (402 RESOURCE_EXHAUSTED). Operating in deterministic fallback mode."`
       - Action link button: `"Manage Billing & Credits ↗"` linking to `https://ai.studio/projects`.

---

## 3. Success Criteria

| ID | Category | Target Metric / Acceptance Criteria | Verification Method |
|---|---|---|---|
| **SC-1** | Database Migration | 11 GICS sector ETFs + `SPY` seeded in `watchlist` as `Indexes`; `/research/sectors` in `sitemap_node` | `uv run alembic upgrade head` exit code 0; SQL check confirms 12 symbols and sitemap row. |
| **SC-2** | Real Data Calculation | `/api/v1/research/sectors` computes multi-horizon returns and rotation quadrants from `eoddata` | API test asserting non-mock returns across all 6 horizons and dynamic quadrant classification. |
| **SC-3** | RSS News Ingestion | `rss_service.py` fetches top headlines and links from Yahoo Finance RSS with fallback on network error | Unit test verifying RSS XML parsing, timeout handling, and empty list fallback on failure. |
| **SC-4** | Multi-Analyst Committee | Sector committee executes 4 roles + consensus, populating `agent_committee_runs` and `agent_analyst_outputs` | Integration test verifying run generation, database persistence, and cited source URLs. |
| **SC-5** | Batch Job Integration | `alpha-insight-daily-job` runs sector research step for all 11 sectors post-EOD ingestion | Unit test asserting sector research runner execution in `main.py` pipeline. |
| **SC-6** | Sector Research UI | `/research/sectors` renders heatmap, quadrant explanation, committee tabs, cited sources, run stepper, and note linking | Vitest test asserting all UI panels render without error and match design standards. |
| **SC-7** | Default Date & 6M Timeframe | `PortfolioOverview` defaults date to `max(date)` of `daily_portfolio_summary` and timeframe to `6M` | Vitest and backend API test confirming `selectedDate` equals latest summary date and `timeframe` is `6M`. |
| **SC-8** | Chart 1 Capital Folding | `Capital Adj` checkbox removed; toggling `Capital` displays both line and adjustment annotations | Vitest UI assertion checking single Capital toggle and annotation rendering. |
| **SC-9** | Holdings Pie Chart | Exposure card renders an SVG pie chart of holdings that recalculates dynamically upon date change | Vitest test checking pie chart slices and date-driven position updates. |
| **SC-10** | Total Portfolio Formula | `Total Portfolio` badge equals sum of holding market values; tooltip displays corrected formula | API test asserting `totalPortfolio == sum(holdings_value)` and UI test checking formula tooltip. |
| **SC-11** | Header Cleanliness & 2-Column Layout | Subtitle and "AI Portfolio Intelligence" titles removed; "Generate Commentary" in top bar; Charts on left column, AI Commentary on right column | Vitest test verifying 2-column DOM layout, button presence in top bar, and removal of old headings. |
| **SC-12** | Credit Exhaustion Alert Banner | Provider credit errors (402) propagate `fallback_warning` and render an actionable amber alert banner with billing link | Backend test asserting `fallback_warning` on 402 exception and Vitest UI test asserting alert banner rendering. |
| **SC-13** | CI-Parity Gate | Full 3-Tier verification passes cleanly | Tier 1 (Ruff check & format), Tier 2 (Mypy), Tier 3 (Pytest & Vitest) all exit code 0. |

---

## 4. Explicit Sign-off Gate

Please review the expanded PRD above covering both **Industry/Sector Research** and the **7 Portfolio Overview Refinements**.  
To indicate your sign-off, please reply with **"proceed"**.  
Upon sign-off, per our execution rules, we will generate the dedicated `ui_design.md` artifact before authoring the Implementation Plan.