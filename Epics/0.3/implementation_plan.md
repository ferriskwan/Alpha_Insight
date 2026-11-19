# Implementation Plan — Epic 0.3: My Portfolio & Research Sub-Applications

**Project**: Alpha_Insight  
**Epic**: 0.3 — My Portfolio & Research Sub-Applications  
**Document Path**: `C:\Users\ferri\devt\Alpha_Insight\Epics\0.3\implementation_plan.md`  
**Execution Mode**: **Single-Engineering Thread Mode (Default)**  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  

---

## 1. Technical Scope & Architecture Overview

Epic 0.3 operationalizes all user-facing views in **My Portfolio** and **Research** through a decoupled REST architecture, backed by PostgreSQL (`4leafclover_dev`) and rendered in the **Aptos White Paper Design System**.

### 1.1 Database Objects (Existing in `4leafclover_dev`, Verified in Epic 0.2)
- `trades`: Investment trade executions (Buy/Sell, Cash vs Margin ledger).
- `capital`: Capital inflows/outflows (Deposits, Withdrawals, Initial injections).
- `trans_cost`: Trade commissions, SEC fees, exchange levies, margin interest.
- `watchlist`: Tracked symbols per user.
- `positions`: Computed snapshot positions.
- `daily_portfolio_summary`: Historical daily portfolio NAV and PnL.
- `eod_data` & `tick_data`: Historical OHLCV and market quotes.
- `margin_interest_rate` & `daily_margin_interest`: Financing rates and daily accruals.
- `ref_chart_settings`: Technical indicator baseline parameters.

### 1.2 Skill Allocation
- **`logic-generator`**: Primary single-engineering pipeline responsible for typing, implementing backend repositories/routers, authoring reusable design-system components, and building frontend sub-applications.
- **`deterministic-resolver`**: Fast Targeted Gate verification loop executing terminal commands (`uv run ruff`, `uv run pytest`, `npx vitest`) and analyzing stdout/stderr.
- **`ui-ux-designer`**: Audits frontend aesthetics against `ui_design.md` (Aptos typography, paper cards, high-contrast chart palettes, mobile responsiveness).
- **`spec-orchestrator`**: Audits deliverables against PRD requirements, verifying 100% REST API coverage, mathematical accounting rigor, and zero hardcoded markup.

---

## 2. Component & Codebase Breakdown

### Phase 1: Design System Centralization (`frontend/src/design-system/`)
*Strict Mandate: Zero hardcoded components or inline duplication in sub-applications.*
- `components/SplitPaneLayout.tsx`: Top-tier multi-pane layout component supporting `single`, `30/70`, `50/50`, `70/30` splits, HTML5 drag-and-drop zone hooks, drop visual cues, active pane borders, and automatic mobile split suppression.
- `components/BottomNavBar.tsx`: Mobile-exclusive fixed bottom navigation bar (Slide 2) providing 4 thumb-zone tabs (`Overview`, `Watchlist`, `Analyst`, `Menu` drawer trigger).
- `components/ChartContainer.tsx`: Standardized white paper chart card wrapper with Aptos header, timeframe pills, and synchronized crosshair event dispatcher.
- `components/ModalDialog.tsx`: Reusable accessible white paper modal dialog for Buy/Sell trade tickets and symbol search with focus trapping.
- `components/HeatmapGrid.tsx`: Standardized performance heatmap matrix component for GICS sectors driven by centralized color tokens.
- `tokens.ts`: Export layout breakpoints (`breakpoints.mobile = 1024px`) and split ratio classes.
- `index.ts`: Re-export all new components.

### Phase 2: Backend Domain Logic & REST APIs
- **Accounting Engine & Repositories (`backend/repositories/`)**:
  - `portfolio_repo.py`:
    - `get_portfolio_overview(db, user_id, start_date, end_date)`: Calculates daily equity curve, cumulative Realized vs Unrealized PnL, asset allocation breakdown, daily PnL distribution histogram, and drawdown series.
    - Bidirectional Cost Accounting: Implements Average Buy Cost, Average Sell Cost, Net Open Quantity, and Average Cost:
      $$\text{Avg Cost} = \frac{\sum (\text{Buy Price} \times \text{Buy Quantity}) - \sum (\text{Sell Price} \times \text{Sell Quantity})}{\sum \text{Buy Quantity} - \sum \text{Sell Quantity}}$$
    - Unified Signed Unrealized PnL: $(\text{Current Price} - \text{Avg Cost}) \times \text{Net Open Quantity}$ for both Long and Short positions.
    - `get_open_positions(db, user_id)`: Active positions, weights, and current market values.
  - `transactions_repo.py`:
    - CRUD for `trades` with validation rejecting negative quantities or prices.
    - CRUD for `capital` inflows and outflows.
    - CRUD for `trans_cost` (commissions, fees, margin interest).
  - `watchlist_repo.py`:
    - CRUD for `watchlist` tickers, ticker validation, and latest market quote enrichment.
  - `research_repo.py`:
    - `get_stock_analyst_data(db, symbol, start_date, end_date, timeframe)`: OHLCV candles, technical indicators (SMA 30, EMA 100, Bollinger Bands, RSI 13, MACD 12/26/9 sourced from `ref_chart_settings`), and executed trade markers.
    - `get_macroeconomics_data(db)`: US Treasury Yield curve points, CPI, Fed Funds rate, and FX currency crosses.
    - `get_sector_performance(db, horizon)`: 11 GICS sector returns and relative rotation scores vs SPY.
  - `charting_service.py` (`backend/services/`):
    - Server-rendered Matplotlib PNG endpoint (`charting.py` integration) returning base64 PNG string.
- **FastAPI REST Routers (`backend/api/v1/`)**:
  - `portfolio.py`: Mounted at `/api/v1/portfolio/*` (Roles: `user`, `analyst`, `admin`).
  - `transactions.py`: Mounted at `/api/v1/transactions/*` (Roles: `user`, `analyst`, `admin`).
  - `watchlist.py`: Mounted at `/api/v1/watchlist/*` (Roles: `user`, `analyst`, `admin`).
  - `research.py`: Mounted at `/api/v1/research/*` (Roles: `analyst`, `admin` with 403 RBAC enforcement).
  - Register routers in `backend/main.py`.

### Phase 3: Frontend Sub-Applications & Shell Integration
- **Contracts & API Services**:
  - `frontend/src/types/api.ts`: Strongly typed schemas for Portfolio Overview, Positions, Trade CRUD, Watchlist, Stock Analyst, Macro, Sectors.
  - `frontend/src/services/apiClient.ts`: Full REST client methods calling backend endpoints.
- **Top-Tier Multi-Application Split-Screen Shell (`AppShell.tsx`)**:
  - Integrate Top Panel `<Split View>` dropdown (`Single Pane`, `30/70`, `50/50`, `70/30`) visible on desktop ($\ge 1024\text{px}$).
  - Integrate `<Agentic Analyst>` sparkle trigger with dockable/floating drawer.
  - Wrap workspace contents in `SplitPaneLayout`, tracking `leftPaneView`, `rightPaneView`, and `activeFocusPane`.
  - Add `draggable={true}` to leaf navigation nodes in `DynamicSidebar.tsx`.
  - Integrate `BottomNavBar` on mobile viewports ($< 1024\text{px}$) with full-screen slide-over drawer for `Menu`.
- **Sub-Application Views (`frontend/src/components/`)**:
  - `portfolio/PortfolioOverview.tsx`: 4-chart synchronized grid (Equity Curve vs SPY, Cumulative PnL, Allocation Donut, Daily PnL Distribution) using `ChartContainer` and `MetricCard`.
  - `portfolio/TransactionsView.tsx`: 3-tab trade book (Investment, Capital, Trans Cost) with order ticket `ModalDialog` and Buy vs Sell badge indicators.
  - `portfolio/WatchlistView.tsx`: Multi-list board with real-time price changes and quick-add modal.
  - `research/StockAnalystView.tsx`: Workbench with 2-way toggle `[Matplotlib (charting.py) | Interactive Canvas]`, technical overlays, and timeline zoom slider.
  - `research/MacroeconomicsView.tsx`: US Treasury Yield curve and core economic indicators.
  - `research/IndustrySectorView.tsx`: 11 GICS sector performance heatmap using `HeatmapGrid`.
  - Wire all views into `App.tsx` and dynamic navigation routing.

### Phase 4: Verification & Fast Targeted Gate Protocol
- **Backend Unit & Integration Tests**:
  - `tests/backend/test_portfolio_accounting.py`: Verifies Average Buy/Sell/Net Cost, Long & Short Unrealized PnL, Realized PnL, and NAV calculations.
  - `tests/backend/test_transactions_crud.py`: Verifies trade insertion, validation boundaries, and audit logging.
  - `tests/backend/test_watchlist_crud.py`: Verifies adding/removing tickers.
  - `tests/backend/test_research_rbac.py`: Verifies `analyst`/`admin` access and `user` 403 Forbidden rejection.
- **Frontend Vitest Tests**:
  - `tests/frontend/split_pane_layout.test.tsx`: Tests `single`, `30/70`, `50/50`, `70/30` modes, pane swapping, and drag-and-drop drop events.
  - `tests/frontend/mobile_bottom_nav.test.tsx`: Tests mobile breakpoint suppression of split screen and bottom tab routing.
  - `tests/frontend/portfolio_overview.test.tsx`: Tests 4-chart rendering, crosshair event dispatching, and KPI metric cards.
  - `tests/frontend/design_system_components.test.tsx`: Validates `SplitPaneLayout`, `BottomNavBar`, `ChartContainer`, `ModalDialog`, `HeatmapGrid`.
- **Full CI-Parity Gate**:
  - Tier 1: `uv run ruff check .` & `uv run ruff format --check .`
  - Tier 2: `cd frontend; npx.cmd tsc --noEmit`
  - Tier 3: `uv run pytest` & `cd frontend; npm.cmd test`

---

## 3. Engineering Standards & Quality Checklist
- **No Outer Shell Wrappers**: Direct invocation of commands (`uv run pytest`, `npx vitest`, `npm test`).
- **Python Execution**: Strictly prefix with `uv run`.
- **DRY & Design System Centralization**: Zero inline hardcoding; 100% of UI elements compose design system components.
- **Anti-Fluff Standard**: Factual, concise documentation and comments explaining *why* complex financial logic was written.
- **Task Tracking**: Strict maintenance of `tasklist.md` with indented progress remarks.
