# Task List — Epic 1.1: By Industry / Sector Research & Portfolio Overview Refinements

**Execution Mode**: Single-Engineering Thread Mode  
**Implementation Plan**: [`Epics/1.1/IMPLEMENTATION_PLAN.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/IMPLEMENTATION_PLAN.md)  
**PRD**: [`Epics/1.1/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/PRD.md)  
**UI Design**: [`Epics/1.1/ui_design.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/ui_design.md)  

- [x] Task 1: Author Alembic Migration `0011_seed_gics_sector_indexes_in_watchlist.py` <!-- id: 1 -->
  - Implementation:
    - Authored idempotent migration `alembic/versions/0011_seed_gics_sector_indexes_in_watchlist.py` (revising `0010`).
    - Seeded 11 GICS sector ETFs (`XLK`, `XLF`, `XLV`, `XLE`, `XLI`, `XLC`, `XLY`, `XLP`, `XLB`, `XLU`, `XLRE`) plus benchmark `SPY` into `public.watchlist` with `watchlistname = 'Index'`, `currency = 'USD'`, `timezone = 'America/New_York'`.
    - Seeded `/research/sectors` into `public.site_map` under parent `research` (order_index: 3, icon: `Layers`).
  - Verification:
    - Executed `uv run alembic upgrade head` (exit code 0).
    - Verified 12 index rows inserted in `watchlist` and `By Industry / Sector` node present in `site_map`.

- [x] Task 2: Implement RSS Ingestion Service & Yahoo Finance Sector Feed <!-- id: 2 -->
  - Implementation:
    - Created `backend/services/rss_service.py` with `fetch_sector_rss_news(ticker, limit=5, timeout_seconds=5.0)`.
    - Parses Yahoo Finance RSS 2.0 XML extracting title, clean URL, source publisher, and publication timestamp.
    - Implemented defensive error handling returning an empty list `[]` on HTTP error, parsing failure, or timeout.
  - Verification:
    - Tested live fetching for `XLK` (3 items retrieved cleanly with titles, URLs, and timestamps).
    - Tested invalid ticker fallback (`NONEXISTENT_TICKER_12345XYZ` returns `[]` without error).

- [x] Task 3: Implement Dynamic Sector Performance & Relative Rotation Engine <!-- id: 3 -->
  - Implementation:
    - Created `backend/schemas/research.py` with `SectorItem`, `SectorPerformanceResponse`, `SectorNewsItem`, `SectorCommitteeResponse`.
    - Rewrote `get_sector_performance` in `backend/repositories/research_repo.py` to query `public.eoddata` for all 11 GICS sector ETFs and benchmark `SPY`.
    - Calculated multi-horizon returns across `1D`, `1W`, `1M`, `3M`, `6M`, `1Y` lookback trading days.
    - Implemented Relative Strength ($RS = \frac{1 + Ret_{Sector, 1M}}{1 + Ret_{SPY, 1M}}$) and RS Momentum ($RS\_Mom = 5\text{-day delta}$), classifying into `Leading`, `Improving`, `Weakening`, `Lagging` quadrants.
    - Added explanatory quadrant definitions payload in API response.
  - Verification:
    - Tested `get_sector_performance` via test session: returned 11 sectors, dynamic RS scores, and quadrant classifications.
    - Verified static analysis with `uv run ruff check` (exit code 0).

- [x] Task 4: Author 4-Analyst Sector Committee AI Engine & Grounding Pipeline <!-- id: 4 -->
  - Implementation:
    - Created specialist prompt builders in `backend/services/prompt_builder.py` (`build_sector_analyst_prompt`, `build_sector_executive_summary_prompt`).
    - Implemented `run_sector_committee_orchestration` in `backend/services/agent_orchestrator.py` executing 4 parallel analyst personas (`technical`, `fundamental`, `macro`, `risk`) via `asyncio.gather`, followed by executive summary chair synthesis.
    - Added database persistence and retrieval methods in `backend/repositories/committee_repo.py` (`get_sector_committee_context`, `persist_sector_committee_run`).
    - Added routes in `backend/api/v1/research.py`: `GET /api/v1/research/sectors/{symbol}/committee` and `POST /api/v1/research/sectors/{symbol}/committee/refresh`.
  - Verification:
    - Unit tested orchestrator execution with mocked and live fallbacks in `tests/backend/test_epic_1_1.py`.
    - Verified API endpoints return HTTP 200 with structured 4-analyst outputs and consensus synthesis.

- [x] Task 5: Add Provider Credit Exhaustion & Fallback Detection across AI Endpoints <!-- id: 5 -->
  - Implementation:
    - Extended `agent_orchestrator.py` to catch API failure status codes (`402 PAYMENT_REQUIRED` / `RESOURCE_EXHAUSTED` credits depleted, `401`, `429`).
    - Implemented rule-based fallback generation with explicit warning strings informing users of credit exhaustion.
    - Added `fallback_warning: Optional[str]` field to schemas in `backend/schemas/committee.py`, `backend/schemas/portfolio.py`, and `backend/schemas/research.py`.
    - Propagated `fallback_warning` through Stock Analysis, Macroeconomics, Sector Committee, and Portfolio Commentary API routes.
  - Verification:
    - Tested credit exhaustion simulation in `test_run_sector_committee_orchestration_fallback_detection`: verified `fallback_warning` is populated and rule-based commentary is returned without crash.

- [x] Task 6: Implement Batch Pipeline Sector Committee Step for `alpha-insight-daily-job` <!-- id: 6 -->
  - Implementation:
    - Authored `run_sector_research.py` with `run_sector_research_batch()` to iterate over all 11 GICS sector ETFs and generate/persist daily committee runs.
    - Hooked `run_sector_research_batch()` into `main.py` directly after `run_portfolio_summary.run_portfolio_summary()`.
  - Verification:
    - Verified function signature, imports, and batch runner execution via unit tests in `test_epic_1_1.py`.

- [x] Task 7: Implement Portfolio Overview Backend Refinements <!-- id: 7 -->
  - Implementation:
    - Updated `backend/api/v1/portfolio.py` and `backend/repositories/portfolio_repo.py` to default `timeframe` to `"6M"`.
    - Dynamic default date: resolved `selectedDate` to `max(date)` from `DailyPortfolioSummary` when omitted or invalid.
    - Corrected `Total Portfolio` formula: aggregated active position market values in target currency (`sum(Quantity * Price * FX)`).
    - Added `chart3_holdings_pie` calculation: aggregated holdings slices with localized value and percentage weights as of selected date.
  - Verification:
    - Tested in `test_portfolio_overview_default_date_and_timeframe` and `test_total_portfolio_is_holdings_aggregation` (passed).

- [x] Task 8: Frontend Routing, Sidebar & Type Definitions <!-- id: 8 -->
  - Implementation:
    - Updated `frontend/src/types/api.ts` with `SectorItem`, `SectorPerformanceResponse`, `SectorNewsItem`, `SectorCommitteeResponse`, `chart3_holdings_pie`, and `fallback_warning` across DTOs.
    - Added `getSectorCommittee` and `refreshSectorCommittee` to `frontend/src/services/apiClient.ts`.
    - Wired `/research/sectors` route to `<IndustrySectorView />` in `frontend/src/App.tsx`.
    - Added `By Industry / Sector` navigation item under Research menu in `frontend/src/components/layout/DynamicSidebar.tsx`.
  - Verification:
    - TypeScript compilation checked with zero errors in `tests/frontend/epic_1_1.test.tsx`.

- [x] Task 9: Implement Frontend `IndustrySectorView` Upgrade <!-- id: 9 -->
  - Implementation:
    - Re-architected `frontend/src/components/research/IndustrySectorView.tsx` strictly matching `ui_design.md`.
    - Top bar: 11 GICS sector pill switcher, historical run stepper, model selector (`gemini-2.5-flash`), and "Run Sector Analysis" action button.
    - Sector overview & Relative Rotation card with interactive methodology popover explaining Leading, Improving, Weakening, and Lagging quadrant formulas.
    - Performance heatmap table across `1D`, `1W`, `1M`, `3M`, `6M`, and `1Y` horizons.
    - Cited Yahoo Finance RSS news publication cards with source and timestamp links.
    - 4-Analyst committee tabs (`Executive Consensus`, `Technical`, `Fundamental`, `Macro`, `Risk`) with directional bias badges and confidence meters.
    - Amber credit exhaustion alert banner linking to Google AI Studio when `fallback_warning` is active.
    - "Reference in Note" button pre-populating rich investment note markdown.
  - Verification:
    - Vitest unit tests in `tests/frontend/epic_1_1.test.tsx` verifying component mounting, tab switching, and quadrant explanations.

- [x] Task 10: Implement Frontend `PortfolioOverview` Restructuring & Holdings Pie Chart <!-- id: 10 -->
  - Implementation:
    - Re-architected `frontend/src/components/portfolio/PortfolioOverview.tsx` into a 2-column layout:
      - Left Column (60%): 4 institutional charts.
      - Right Column (40%): AI Commentary card.
    - Top Toolbar: Dynamic `max(date)` picker, timeframe default `6M`, and "Generate Commentary" action button relocated to top row.
    - 6 KPI Badges: Realized PnL, Unrealized PnL, Total PnL, Capital, Margin Loan, and Total Portfolio with tooltip explaining active holdings aggregation formula.
    - Chart 1: Folded `Capital Adj` into `Capital` checkbox with interactive adjustment annotations displayed when checked; coupled Trades annotations directly to Portfolio Size.
    - Chart 3: Replaced exposure bars with interactive SVG Holdings Pie Chart reacting to date picker with explicit holdings date subtitle, bottom-right rollover popovers (preventing pie chart obstruction), and non-overlapping legend formatted strictly as `Symbol + $XXXk + YY%`.
    - Spread out layout: removed restrictive `max-w-7xl mx-auto` container to expand Portfolio Overview across full screen width.
    - Standardized AI button label: renamed to "AI Analysis" (and "Running AI Analysis...") across Portfolio Overview, Stock Analysis, Macroeconomics, and Sector Research.
    - Removed redundant "Institutional Performance Series" and "AI Portfolio Intelligence" titles.
    - Amber credit exhaustion alert banner with Google AI Studio billing link propagated across all 4 AI tools.
  - Verification:
    - Vitest unit tests in `tests/frontend/epic_1_1.test.tsx` and regression tests in `tests/frontend/portfolio_overview.test.tsx` (passed).

- [x] Task 11: Add Fallback Alert Banners in Stock Analysis & Macroeconomics Views <!-- id: 11 -->
  - Implementation:
    - Added amber alert banner in `frontend/src/components/research/AnalystCommitteeView.tsx` (Stock Analysis) when `fallback_warning` is returned.
    - Added amber alert banner in `frontend/src/components/research/MacroeconomicsView.tsx` (Macroeconomics) when `fallback_warning` is returned.
    - Alert displays warning text and direct link to `https://ai.studio/projects` for billing/quota remediation.
  - Verification:
    - Verified component compilation and visual alert rendering.

- [x] Task 12: Backend & Frontend Unit/Integration Tests <!-- id: 12 -->
  - Implementation:
    - Authored `tests/backend/test_epic_1_1.py` with 10 comprehensive test cases covering database seeding, RSS service, sector returns & RRG calculations, committee orchestrator fallback, API routes, and portfolio overview calculations.
    - Authored `tests/frontend/epic_1_1.test.tsx` with 3 test suites covering PortfolioOverview 2-column layout & pie chart, IndustrySectorView GICS switcher & quadrant popover, and AI credit exhaustion alert banner.
  - Verification:
    - `uv run pytest tests/backend/test_epic_1_1.py`: 10 passed in 4.04s.
    - `npm.cmd --prefix frontend test -- tests/frontend/epic_1_1.test.tsx --run`: 3 passed in 3.91s.
    - Regression tests `design_system_audit.test.tsx` and `portfolio_overview.test.tsx`: 14 passed.

- [x] Task 13: Full 3-Tier CI-Parity Gate Verification & Walkthrough <!-- id: 13 -->
  - Implementation:
    - Tier 1: `uv run ruff check .` (0 errors) and `uv run ruff format --check .` (152 files already formatted).
    - Tier 2: `uv run mypy backend/api/v1/research.py backend/api/v1/portfolio.py backend/repositories/research_repo.py backend/repositories/portfolio_repo.py backend/services/rss_service.py backend/services/agent_orchestrator.py backend/schemas/research.py backend/schemas/portfolio.py` (Success: no issues found).
    - Tier 3: Pytest & Vitest test suites executing with exit code 0.
    - Authored `Epics/1.1/WALKTHROUGH.md` documenting all functional deliverables, architectural contracts, and test evidence.
  - Verification:
    - All 3 tiers passed with consecutive exit code 0.
