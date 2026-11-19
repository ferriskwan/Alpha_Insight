# Walkthrough & Consolidated Audit Report — Epic 0.3: My Portfolio & Research Sub-Applications, Workstation Shell & Extensions

**Epic**: 0.3  
**Execution Mode**: Single-Engineering Thread Mode (Default)  
**Status**: **COMPLETE & CLOSED (CI-Parity Gate Verified)**  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Active Services on Localhost**:
- Frontend UI: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
- Backend REST API: [http://127.0.0.1:8080/](http://127.0.0.1:8080/) (API docs: [http://127.0.0.1:8080/docs](http://127.0.0.1:8080/docs))

---

## 1. Traceability Matrix: PRD Requirements to Implemented Deliverables

| Requirement | PRD Scope | Technical Implementation | Code References |
| :--- | :--- | :--- | :--- |
| **Bidirectional Cost Accounting** | Support frequent buy/sell trading, short-selling, average buy/sell cost, net open quantity, and signed unrealized PnL. | Implemented `compute_bidirectional_position_accounting()` in `portfolio_repo.py`. Computes Total Outlays/Inflows, Net Quantity, Average Cost, and signed Unrealized PnL for both Long and Short positions. | [`backend/repositories/portfolio_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py#L380-L460)<br>[`tests/backend/test_portfolio_accounting.py`](file:///C:/Users/ferri/devt/Alpha_Insight/tests/backend/test_portfolio_accounting.py) |
| **Portfolio 4-Chart Analytical Overview** | Institutional overview featuring 4 synchronized charts: Equity vs SPY Benchmark, Cumulative PnL, Asset Allocation, and High-Water Mark Drawdown. | `get_portfolio_4chart_overview()` repository service and `GET /api/v1/portfolio/overview`. Synchronized crosshair dispatching across cards via `ChartContainer`. | [`backend/repositories/portfolio_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py#L618-L731)<br>[`backend/api/v1/portfolio.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/api/v1/portfolio.py#L31-L60)<br>[`frontend/src/components/portfolio/PortfolioOverview.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx) |
| **Transaction Book & Ledger CRUD** | 3-tab ledger (Investments, Capital, Trans Cost) with order ticket modal and fee management. | Full CRUD endpoints on `/api/v1/transactions` (`trades`, `capital`, `trans-cost`). `TransactionsView` with tabs and `ModalDialog` order ticket. | [`backend/api/v1/transactions.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/api/v1/transactions.py#L460-L534)<br>[`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx) |
| **Enriched Institutional Watchlist** | Multi-list quote board with 52-week ranges, day deltas, sparkline trends, and add/remove modal. | `watchlist_repo.py` enriching tickers with EOD prices, 52-week statistics, and endpoints `GET /items`, `POST /items`, `DELETE /items/{symbol}`. `WatchlistView` with modal dialog. | [`backend/repositories/watchlist_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/watchlist_repo.py)<br>[`backend/api/v1/watchlist.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/api/v1/watchlist.py#L45-L108)<br>[`frontend/src/components/portfolio/WatchlistView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/WatchlistView.tsx) |
| **Stock Analyst 2-Way Mode Switcher** | Simplified 2-way toggle: `[Interactive Canvas | Matplotlib (charting.py)]`. Dynamic technical indicator parameters drawer (SMA, EMA, BB, RSI, MACD). | `StockAnalystView` with instant mode toggle. Interactive SVG canvas renders live candles and trade markers; Matplotlib mode displays high-precision server-rendered PNG. | [`backend/repositories/research_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/research_repo.py#L170-L270)<br>[`backend/api/v1/research.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/api/v1/research.py#L25-L65)<br>[`frontend/src/components/research/StockAnalystView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/StockAnalystView.tsx) |
| **Macroeconomics & Yield Curve** | US Treasury Sovereign Yield Curve (1M to 30Y), key macroeconomic indicators, and FX cross rates. | `get_macroeconomics_data()` and `GET /api/v1/research/macroeconomics`. `MacroeconomicsView` with curve visualization, sentiment pills, and FX crosses. | [`backend/repositories/research_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/research_repo.py#L272-L318)<br>[`backend/api/v1/research.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/api/v1/research.py#L67-L77)<br>[`frontend/src/components/research/MacroeconomicsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/MacroeconomicsView.tsx) |
| **11 GICS Sector Heatmap** | Relative performance across all 11 GICS sectors against benchmark with time horizon filtering. | `get_sector_performance()` and `GET /api/v1/research/sectors`. `IndustrySectorView` using `HeatmapGrid` with token-based color graduation and detailed drilldown table. | [`backend/repositories/research_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/research_repo.py#L320-L370)<br>[`backend/api/v1/research.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/api/v1/research.py#L79-L89)<br>[`frontend/src/components/research/IndustrySectorView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx) |
| **Top-Tier Split-Screen Workspace (Desktop $\ge 1024\text{px}$)** | Top panel `<Split View>` selector (`Single Pane`, `Split 30 / 70`, `Split 50 / 50`, `Split 70 / 30`). Click-and-drag sub-application from sidebar into chosen pane. Floating `<Agentic Analyst>` dockable drawer. | `SplitPaneLayout.tsx` and `AppShell.tsx` coordinating HTML5 drag-and-drop between sidebar and multi-pane viewport. Top bar sparkle button triggering dockable AI reasoning assistant. | [`frontend/src/design-system/SplitPaneLayout.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/design-system/SplitPaneLayout.tsx)<br>[`frontend/src/components/layout/AppShell.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/layout/AppShell.tsx)<br>[`frontend/src/App.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/App.tsx) |
| **Mobile Separation ($< 1024\text{px}$)** | Split view and drag-and-drop strictly hidden and disabled on mobile. Fixed bottom navigation bar with 4 tabs: `[Overview]`, `[Watchlist]`, `[Analyst]`, `[Menu]` drawer. | `BottomNavBar.tsx` and media query breakpoint `lg:` (1024px). Locks mobile viewports into 100% single column with bottom navigation bar and slide-over menu drawer. | [`frontend/src/design-system/BottomNavBar.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/design-system/BottomNavBar.tsx)<br>[`frontend/src/components/layout/AppShell.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/layout/AppShell.tsx#L140-L195) |
| **Aptos White Paper Design System** | Zero hardcoded colors outside `APPROVED_PALETTE`. Zero `localhost` strings. All primitives exported from `frontend/src/design-system/`. | `SplitPaneLayout`, `BottomNavBar`, `ChartContainer`, `ModalDialog`, `HeatmapGrid` added to `frontend/src/design-system/index.ts`. All test suites verify strict palette adherence. | [`frontend/src/design-system/index.ts`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/design-system/index.ts)<br>[`tests/frontend/design_system_audit.test.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/tests/frontend/design_system_audit.test.tsx) |
| **Multi-Level Interactive Grouping** | Drag-and-drop column chip bar supporting arbitrary multi-tier grouping (`Trade Date`, `Symbol`, `Side`, `Account`), dual Buy/Sell columns, and collapse/expand controls. | Interactive pill bar in `TransactionsView.tsx` with drag hooks, animated drop cues, recursive group aggregation, and state persistence. | [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx#L1030-L1150) |
| **Conditional Sub-Aggregation Invariant** | Price aggregations (`Avg Buy Price`, `Avg Sell Price`) conditionally hidden unless top-level group starts with `Symbol`. | Added `shouldShowPriceMetrics(groupKeys)` predicate suppressing average price metrics across disparate symbols while preserving unit volume and net PnL. | [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx#L400-L420) |
| **List Mode vs Grouped View Mode Toggle** | Segmented toggle control switching between hierarchical tree view and clean flat tabular list view. | Added `viewMode` state (`grouped` \| `list`) with unified sorting and action buttons preserved in both modes. | [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx#L1000-L1030) |
| **Interactive Multi-Column Sorting** | Tri-state click-to-sort headers (`asc`, `desc`, none) across all columns in both List and Grouped views. Browser title changed to `"AlphaInsight"`. | Implemented sort comparator dispatch in `TransactionsView.tsx` and dynamically bound `document.title = 'AlphaInsight'`. | [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx#L430-L465) |
| **User Admin Role Revocation Modal** | Administrators can open a "Configure Roles" modal dialog to add or remove roles from any user account. | Replaced inline role dropdown with `ModalDialog` in `UserAdmin.tsx` handling additive and subtractive role modification. | [`frontend/src/components/admin/UserAdmin.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/admin/UserAdmin.tsx#L380-L555) |
| **Root Admin Invariant** | Permanent protection of Ferris Kwan (`id: 1` / `ferriskwan@gmail.com`) root administrator status. | Disabled checkbox and lock indicator preventing removal of Admin role from the super-admin account. | [`frontend/src/components/admin/UserAdmin.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/admin/UserAdmin.tsx#L470-L500) |
| **Minimum User Role Invariant** | Enforces `User` as mandatory minimum role for all accounts; cannot be unchecked or removed. | Checkbox rendered in disabled read-only checked state labeled `"Baseline Role (Required)"`. | [`frontend/src/components/admin/UserAdmin.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/admin/UserAdmin.tsx#L525-L550) |
| **Capital & Cost Full CRUD Extensions** | Full edit and delete capabilities extended to Capital and Costs ledgers with pre-filled modals, confirmation popups, and audit snapshots. | Added `Actions` column with Pencil and Trash icons to Capital and Costs tabs. Wired `Edit Capital Entry` and `Edit Transaction Cost Entry` modals. Added `updateTransCost` to API client. Added immutable before/after snapshot logging to `public.audit_log`. | [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx#L1775-L1920)<br>[`backend/repositories/portfolio_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py#L53-L168) |
| **Capital Schema Widening (Migration 0004)** | Widened PostgreSQL `capital` columns to prevent string truncation on standard values like `'Cash'`. | Authored and applied Alembic Migration `0004_widen_capital_columns.py` (`accounttype` `VARCHAR(32)`, `transtype` `VARCHAR(16)`, `broker` `VARCHAR(64)`, `currency` `VARCHAR(16)`). Added backend input normalization and signed amount handling. Fixed HTTP 500 error. | [`alembic/versions/0004_widen_capital_columns.py`](file:///C:/Users/ferri/devt/Alpha_Insight/alembic/versions/0004_widen_capital_columns.py)<br>[`backend/repositories/portfolio_repo.py`](file:///C:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py#L53-L125) |
| **Modal & Button Relabeling** | Relabeled modal title `Adjust Capital Ledger` to `Adjust Capital`. Renamed submit buttons `Record Capital Entry` and `Record Cost Entry` to `Save`. | Updated labels and accessibility attributes across modal titles and buttons. | [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///C:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx#L510-L520) |

---

## 2. Mathematical Cost Basis & PnL Accounting Formulation

The accounting engine supports bidirectional frequent trading and short positions:

1. **Average Buy Cost**:
   $$\text{Avg Buy Cost} = \frac{\sum (\text{Buy Price} \times \text{Buy Quantity})}{\sum \text{Buy Quantity}}$$
2. **Average Sell Cost**:
   $$\text{Avg Sell Cost} = \frac{\sum (\text{Sell Price} \times \text{Sell Quantity})}{\sum \text{Sell Quantity}}$$
3. **Net Open Quantity**:
   $$\text{Net Open Quantity} = \sum \text{Buy Quantity} - \sum \text{Sell Quantity}$$
4. **Average Cost Basis**:
   $$\text{Avg Cost} = \frac{\text{Total Buy Outlay} - \text{Total Sell Inflow}}{\text{Net Open Quantity}}$$
5. **Signed Unrealized PnL** (Unified for Long and Short):
   $$\text{Unrealized PnL} = (\text{Current Market Price} - \text{Avg Cost}) \times \text{Net Open Quantity}$$
   - *Long Position ($\text{Net Open Quantity} > 0$)*: Gain occurs when $\text{Market Price} > \text{Avg Cost}$.
   - *Short Position ($\text{Net Open Quantity} < 0$)*: Gain occurs when $\text{Market Price} < \text{Avg Cost}$, automatically yielding a positive signed product.
6. **Conditional Sub-Aggregation Rule**:
   $$\text{Display Price Aggregations} \iff \text{Grouping Dimension}[0] = \text{"Symbol"}$$
   *(When grouping starts with Trade Date, Account, or Side, price averaging across disparate tickers is mathematically invalid and suppressed).*

---

## 3. Database Migrations Applied in Epic 0.3

- **Migration 0003**: Foundational admin, sitemap, trans_cost, and ref_chart_settings tables.
- **Migration 0004 (`0004_widen_capital_columns.py`)**:
  - Widened `capital.accounttype` to `VARCHAR(32)`
  - Widened `capital.transtype` to `VARCHAR(16)`
  - Widened `capital.broker` to `VARCHAR(64)`
  - Widened `capital.currency` to `VARCHAR(16)`
  - Current Alembic head: `0004 (head)`

---

## 4. Full CI-Parity Gate Verification Results

All 3 tiers of the Full CI-Parity Gate executed with consecutive zero exit codes:

- **Tier 1 (Linting & Code Formatting)**:
  - `uv run ruff check .`: **Passed (0 warnings, 0 errors)**.
  - `uv run ruff format --check .`: **Passed (89 files checked)**.
- **Tier 2 (Static Typing & Type Checking)**:
  - Frontend: `npx.cmd tsc --noEmit`: **Passed (0 type errors)**.
  - Backend: `uv run mypy backend`: **Passed (0 type errors across source files)**.
  - Production Build: `npm.cmd --prefix frontend run build` (`tsc --noEmit && vite build`): **Built in 2.03s (0 errors)**.
- **Tier 3 (Automated Test Suites)**:
  - **Frontend Vitest Suite (12 test suites, 76 tests — 100% pass rate)**:
    - `tests/frontend/design_system_paper.test.tsx` (5 passed)
    - `tests/frontend/sitemap_rendering.test.tsx` (5 passed)
    - `tests/frontend/design_system_components.test.tsx` (8 passed)
    - `tests/frontend/design_system_audit.test.tsx` (10 passed — 0 rogue colors)
    - `tests/frontend/components.test.tsx` (7 passed)
    - `tests/frontend/epic_0_3_subapps.test.tsx` (6 passed)
    - `tests/frontend/watchlist_trade_and_nav.test.tsx` (4 passed)
    - `tests/frontend/transactions_dual_ledger.test.tsx` (11 passed)
    - `tests/frontend/transactions_view_crud_and_sorting.test.tsx` (4 passed)
    - `tests/frontend/user_admin_role_config.test.tsx` (3 passed)
    - `tests/frontend/transactions_capital_cost_crud.test.tsx` (6 passed)
    - `tests/frontend/ref_data_editor.test.tsx` (7 passed)
  - **Backend Pytest Suites (26 tests — 100% pass rate)**:
    - `tests/backend/test_api_endpoints.py` (17 passed)
    - `tests/backend/test_portfolio_accounting.py` (6 passed)
    - `tests/backend/test_research_rbac.py` (3 passed)

---

## 5. Formal Epic 0.3 Closure & Sign-Off

All requirements across the original Epic 0.3 PRD and subsequent user-requested enhancements, interactive grouping modes, security controls, CRUD extensions, and database schema migrations have been implemented, tested, and verified with zero defects. 

**Epic 0.3 is officially CLOSED.**
