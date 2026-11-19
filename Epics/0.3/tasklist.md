# Tasklist — Epic 0.3: My Portfolio & Research Sub-Applications, Workstation Shell & Extensions

**Project**: Alpha_Insight  
**Epic**: 0.3 — My Portfolio & Research Sub-Applications  
**Execution Mode**: **Single-Engineering Thread Mode (Default)**  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Implementation Plan**: `Epics/0.3/implementation_plan.md`  
**Status**: **COMPLETE (100% Verified & Closed)**  

---

## Phase 1: Design System Centralization (`frontend/src/design-system/`)
- [x] Task 1.1: Author `SplitPaneLayout.tsx` supporting `single`, `30/70`, `50/50`, `70/30` splits with HTML5 drag-and-drop zone hooks.
  - Remarks: Created `frontend/src/design-system/SplitPaneLayout.tsx`. Verified across all split configurations.
- [x] Task 1.2: Author `BottomNavBar.tsx` supporting mobile 4-tab thumb navigation (`Overview`, `Watchlist`, `Analyst`, `Menu` drawer trigger).
  - Remarks: Created `frontend/src/design-system/BottomNavBar.tsx`. Verified responsive suppression above 1024px.
- [x] Task 1.3: Author `ChartContainer.tsx` providing white paper card styling, Aptos header, timeframe pills, and synchronized crosshair event dispatching.
  - Remarks: Created `frontend/src/design-system/ChartContainer.tsx`.
- [x] Task 1.4: Author `ModalDialog.tsx` providing accessible white paper modal dialog with focus trapping for trade tickets and symbol searches.
  - Remarks: Created `frontend/src/design-system/ModalDialog.tsx`.
- [x] Task 1.5: Author `HeatmapGrid.tsx` providing token-driven color-interpolated matrix for GICS sectors.
  - Remarks: Created `frontend/src/design-system/HeatmapGrid.tsx`.
- [x] Task 1.6: Export all new components in `design-system/index.ts` and verify with Vitest (`tests/frontend/design_system_components.test.tsx`).
  - Remarks: Exported all primitives in `design-system/index.ts`. All 8 tests passed.

## Phase 2: Backend Accounting Engine, Domain Repositories & REST APIs
- [x] Task 2.1: Author `portfolio_repo.py` implementing Average Buy/Sell Cost, Net Open Quantity, Average Cost, unified signed Unrealized PnL, Realized PnL, and NAV.
  - Remarks: Created `compute_bidirectional_position_accounting()` and 4-chart analytical overview services in `backend/repositories/portfolio_repo.py`.
- [x] Task 2.2: Author `transactions_repo.py` implementing CRUD and validations for `trades`, `capital`, and `trans_cost`.
  - Remarks: Implemented transaction CRUD functions in `backend/repositories/portfolio_repo.py` and `backend/api/v1/transactions.py`.
- [x] Task 2.3: Author `watchlist_repo.py` implementing CRUD for `watchlist` tickers with market quote enrichment.
  - Remarks: Implemented watchlist repository services in `backend/repositories/watchlist_repo.py`.
- [x] Task 2.4: Author `research_repo.py` and `charting_service.py` implementing Stock Analyst candles/indicators/markers, Matplotlib PNG rendering, Treasury Yield curve, and GICS sector performance.
  - Remarks: Created `backend/repositories/research_repo.py` with multi-horizon indicators and yield curve generation.
- [x] Task 2.5: Implement FastAPI REST routers in `backend/api/v1/` (`portfolio.py`, `transactions.py`, `watchlist.py`, `research.py`) with RBAC enforcement and mount in `backend/main.py`.
  - Remarks: Routers mounted under `/api/v1/` with role dependencies.
- [x] Task 2.6: Validate backend suite via Fast Targeted Gate (`uv run pytest tests/backend/test_portfolio_accounting.py tests/backend/test_research_rbac.py`).
  - Remarks: All 9 backend accounting and RBAC tests passed.

## Phase 3: Frontend Sub-Applications & Workstation Shell Integration
- [x] Task 3.1: Define TypeScript contracts in `frontend/src/types/api.ts` and author REST methods in `frontend/src/services/apiClient.ts`.
  - Remarks: Authoritative schemas declared; full API client implemented.
- [x] Task 3.2: Update `AppShell.tsx` to integrate top `<Split View>` dropdown, `<Agentic Analyst>` sparkle button, `SplitPaneLayout`, `BottomNavBar` on mobile, and draggable sidebar nodes in `DynamicSidebar.tsx`.
  - Remarks: Multi-pane layout and mobile bottom navigation wired in `AppShell.tsx`.
- [x] Task 3.3: Implement `PortfolioOverview.tsx` featuring 4-chart synchronized grid and top KPI cards using `ChartContainer` and `MetricCard`.
  - Remarks: 4-chart analytical grid operational with shared crosshair timeline.
- [x] Task 3.4: Implement `TransactionsView.tsx` (3-tab trade book with order ticket `ModalDialog`).
  - Remarks: 3-tab ledger operational with trade ticket order entry.
- [x] Task 3.5: Implement `WatchlistView.tsx` (multi-list board with quick-add `ModalDialog`).
  - Remarks: Multi-list watchlist with add/remove modals and mini sparkline trends.
- [x] Task 3.6: Implement `StockAnalystView.tsx` (2-way toggle `[Matplotlib | Interactive Canvas]`, indicators, zoom slider).
  - Remarks: Interactive dual-engine chart workstation operational with indicator settings.
- [x] Task 3.7: Implement `MacroeconomicsView.tsx` (US Treasury Yield curve, core economic series).
  - Remarks: Treasury yield curve and core macroeconomic indicators rendered.
- [x] Task 3.8: Implement `IndustrySectorView.tsx` (11 GICS sector performance heatmap using `HeatmapGrid`).
  - Remarks: Sector performance heatmaps across 1D, 1W, 1M, YTD, 1Y horizons operational.
- [x] Task 3.9: Wire routing in `App.tsx` and verify live navigation.
  - Remarks: All routes wired with active fallback handling and dynamic sitemap dispatch.

## Phase 4: Verification, Audit & Initial Walkthrough
- [x] Task 4.1: Fast Targeted Gate on frontend tests (`npm test`).
  - Remarks: All targeted tests passed.
- [x] Task 4.2: Full CI-Parity Gate (Tier 1: Ruff check/format; Tier 2: TypeScript & Mypy; Tier 3: Pytest & Vitest).
  - Remarks: All 3 tiers passed with zero exit codes.
- [x] Task 4.3: Spec Orchestrator & UI/UX Designer internal audit (DRY, hardcoding scan, mobile viewport check).
  - Remarks: Design system compliance verified. Rogue color scan passed with 0 violations.
- [x] Task 4.4: Generate `WALKTHROUGH.md` mapping requirements to deliverables.
  - Remarks: Generated initial walkthrough in `Epics/0.3/WALKTHROUGH.md`.

## Phase 5: Iterative Scope Extensions & Bug Fixes Consolidated in Epic 0.3
- [x] Task 5.1: Multi-Level Drag-and-Drop Column Grouping in `TransactionsView.tsx`.
  - Remarks: Implemented drag-and-drop grouping bar (`Trade Date`, `Symbol`, `Side`, `Account`), dual Buy/Sell separated columns, and collapse/expand controls.
- [x] Task 5.2: Conditional Sub-Aggregation Visibility.
  - Remarks: Avg Buy/Sell Price aggregations conditionally hidden unless top-level group starts with `Symbol`, preventing misleading metrics across disparate tickers.
- [x] Task 5.3: View Mode Toggle (List Mode vs Grouped Mode).
  - Remarks: Added segmented toggle in `TransactionsView.tsx` to seamlessly switch between hierarchical tree view and clean flat tabular ledger.
- [x] Task 5.4: Interactive Tri-State Column Sorting.
  - Remarks: Click-to-sort headers (`asc`, `desc`, none) implemented across all columns in both List and Grouped views. Changed browser tab title to `"AlphaInsight"`.
- [x] Task 5.5: User Admin Role Configuration Modal Dialog.
  - Remarks: Replaced inline role dropdown with a "Configure Roles" modal dialog. Implemented role assignment and revocation, permanent protection of Ferris Kwan's root admin role, and enforced `User` as mandatory minimum baseline.
- [x] Task 5.6: Capital and Cost Full CRUD Extensions.
  - Remarks: Extended Actions column (Edit Pencil and Delete Trash) to Capital and Costs tabs in `TransactionsView.tsx`. Added pre-filled edit modals, deletion confirmations, and backend audit trail snapshots in `public.audit_log`.
- [x] Task 5.7: Database Schema Migration 0004 & Backend Input Normalization.
  - Remarks: Authored and executed Alembic Migration `0004_widen_capital_columns.py` to widen `accounttype`, `transtype`, `broker`, and `currency` in the `capital` table. Added backend normalization and signed amount handling in `portfolio_repo.py`. Fixed HTTP 500 error.
- [x] Task 5.8: UI Labels Relabeling.
  - Remarks: Relabeled modal title `Adjust Capital Ledger` to `Adjust Capital`. Renamed submit buttons `Record Capital Entry` and `Record Cost Entry` to `Save`.
