# Product Requirements Document (PRD) — Epic 0.3
**Project**: Alpha_Insight  
**Epic**: 0.3 — My Portfolio & Research Sub-Applications  
**Database Instance**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Document Path**: `C:\Users\ferri\devt\Alpha_Insight\Epics\0.3\PRD.md`  
**Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]`  

---

## 1. Executive Scope & Objective

Epic 0.3 implements the core analytical, portfolio tracking, and research capabilities of Alpha_Insight, replacing the placeholder views in `DynamicSidebar.tsx` with production UI components backed 100% by FastAPI endpoints and PostgreSQL (`4leafclover_dev`):

1. **My Portfolio Suite** (RBAC: `user`, `analyst`, `admin`):
   - **Overview**: 4-chart synchronized analytical workspace (NAV Equity Curve, Cumulative Realized vs Unrealized PnL, Asset/Currency Allocation, Daily PnL Distribution & Drawdown) with shared crosshairs.
   - **Transactions**:
     - *Investment*: Full CRUD and validation for executed stock trades (`trades`), Buy/Sell order tickets, ledger tagging (`Cash` vs `Margin`).
     - *Capital*: Full CRUD for capital flows (`capital`), Deposits, Withdrawals, Initial injections, broker accounts.
     - *Trans Cost*: Full CRUD for trade execution fees, commissions, exchange stamp duties, and margin borrowing interest (`trans_cost`).
   - **Watch List**:
     - Multi-list ticker board (`watchlist`), real-time quote/snapshot feed, sorting, quick mini-sparkline, and symbol modal.

2. **Research Suite** (RBAC: `analyst`, `admin`):
   - **Stock Analyst**: Deep-dive analytical workbench featuring the Dual Chart Engine (Server Matplotlib PNG vs Client TradingView Canvas), a 2-way toggle (`Matplotlib (charting.py)` | `Interactive Canvas`), timeline zoom slider, indicator overlays (SMA, EMA, Bollinger Bands, RSI, MACD from `ref_chart_settings`), and trade execution markers.
   - **Macroeconomics**: US Treasury Yield Curve, benchmark macro indicators (Fed Funds rate, CPI Inflation, GDP Growth, Unemployment Rate), and FX currency crosses.
   - **By Industry / Sector**: 11 GICS sector performance heatmaps across multiple horizons (1D, 1W, 1M, YTD, 1Y), sector rotation relative strength (RRG), and industry constituent drilldowns.

3. **Top-Tier Multi-Application Split-Screen Workspace (Desktop / Laptop Only)**:
   - **Desktop Viewport Requirement**: Active exclusively on PC / Laptop viewports ($\ge 1024\text{px}$).
   - **Top Panel `<Split View>` Control**: Dropdown allowing users to configure the application workspace into:
     - `Single Pane` (100% full width)
     - `30/70 Split` (Left 30%, Right 70%)
     - `50/50 Split` (Left 50%, Right 50%)
     - `70/30 Split` (Left 70%, Right 30%)
   - **Drag-and-Drop Application Routing**: Users can click and drag any sub-application from the left menu directly into the chosen pane (e.g., drag `My Portfolio > Overview` into the Left Pane, and drag `Research > Stock Analyst` into the Right Pane).
   - **Focused Pane Direct Routing**: Clicking a sidebar item normally routes into whichever pane is currently designated as active/focused.
   - **Independent Execution & Scroll**: Each pane runs its designated sub-application independently with its own query lifecycle, local state, and scroll bounds.
   - **Top Panel `<Agentic Analyst>` Trigger**: Launches a floating / dockable assistant drawer/panel in the workspace (foundational integration hook for Epic 0.4).

4. **Mobile Device Layout Architecture (Slide 2 of `Visualizations.pptx`)**:
   - **Explicit Mobile Exclusion**: The Split Screen feature and Drag-and-Drop routing are **strictly unavailable on mobile devices** ($< 1024\text{px}$). The `<Split View>` dropdown is hidden from the header, and the workspace forcibly renders in a single full-width column (`Single Pane`).
   - **Compact Mobile Header**: Renders the `AlphaInsight` logo on the left and `UserId` / `Role` / `Logout` on the right.
   - **Bottom Navigation Bar**: Fixed bottom tab bar docked to the thumb zone:
     - `Overview` (Quick link to Portfolio Overview)
     - `Watchlist` (Quick link to Watch List)
     - `Analyst` (Quick link to Stock Analyst)
     - `Menu` (Slide-over drawer providing access to all dynamic sub-applications: Transactions, Research, Investment Notes, and Admin).
   - **Single-Column Vertical Stacking**: Analytical charts, KPI summaries, and data tables stack vertically in clean 1-column paper cards with touch scrubbers.

---

## 2. Mathematical & Accounting Engine Specifications

### 2.1 Position & Cost Accounting (Long & Short Positions)
Alpha_Insight supports high-frequency trading with both long positions and short-selling. Cost basis and PnL formulas are structured to support bidirectional exposure:

1. **Average Buy Cost**:
   $$\text{Avg Buy Cost} = \frac{\sum (\text{Buy Price} \times \text{Buy Quantity})}{\sum \text{Buy Quantity}}$$

2. **Average Sell Cost**:
   $$\text{Avg Sell Cost} = \frac{\sum (\text{Sell Price} \times \text{Sell Quantity})}{\sum \text{Sell Quantity}}$$

3. **Net Open Quantity**:
   $$\text{Net Open Quantity} = \sum \text{Buy Quantity} - \sum \text{Sell Quantity}$$
   - **Long Position**: $\text{Net Open Quantity} > 0$
   - **Short Position**: $\text{Net Open Quantity} < 0$
   - **Flat / Fully Closed**: $\text{Net Open Quantity} = 0$

4. **Average Cost (Net Position Cost Basis)**:
   For any active position ($\text{Net Open Quantity} \neq 0$):
   $$\text{Avg Cost} = \frac{\sum (\text{Buy Price} \times \text{Buy Quantity}) - \sum (\text{Sell Price} \times \text{Sell Quantity})}{\sum \text{Buy Quantity} - \sum \text{Sell Quantity}} = \frac{\text{Net Invested Capital}}{\text{Net Open Quantity}}$$

5. **Unrealized PnL Calculation**:
   - **Unified Signed Formula**:
     $$\text{Unrealized PnL} = (\text{Current Market Price} - \text{Avg Cost}) \times \text{Net Open Quantity}$$
   - **Behavior by Position State**:
     - **Long Positions** ($\text{Net Open Quantity} > 0$):
       $$\text{Unrealized PnL} = (\text{Current Market Price} - \text{Avg Cost}) \times \text{Net Open Quantity}$$
       *(Profits when Current Price rises above Avg Cost; loses when Current Price falls).*
     - **Short Positions** ($\text{Net Open Quantity} < 0$):
       $$\text{Unrealized PnL} = (\text{Avg Cost} - \text{Current Market Price}) \times |\text{Net Open Quantity}|$$
       *(Profits when Current Price drops below Avg Cost; loses when Current Price rises).*
     - **Flat Positions** ($\text{Net Open Quantity} = 0$):
       $$\text{Unrealized PnL} = 0$$

6. **Realized PnL Calculation**:
   $$\text{Realized PnL} = \sum (\text{Sell Price} \times \text{Sell Quantity}) - \sum (\text{Buy Price} \times \text{Buy Quantity}) - \sum \text{Transaction Costs}$$
   *(Computed across closed lots or closed trading cycles).*

7. **Portfolio Net Asset Value (NAV)**:
   $$\text{NAV} = \sum (\text{Net Open Quantity} \times \text{Current Market Price}) + \text{Cash Balance} - \text{Margin Loan Balance}$$
   *(For short positions, $\text{Net Open Quantity} \times \text{Current Market Price}$ is negative, correctly reflecting the liability to repurchase borrowed shares).*

### 2.2 Margin Interest & Financing Accrual
- Margin interest formula conforming to broker conventions (360-day money market basis):
  $$\text{Daily Margin Interest} = \frac{\text{Margin Loan Balance} \times \text{Annual Rate}}{360}$$
- Sourced dynamically from database table `margin_interest_rate`.

---

## 3. Database Objects & Data Model Alignment

All required database tables exist in `4leafclover_dev` and were validated during Epic 0.2:
- `trades` (Trade executions)
- `capital` (Cash flow events)
- `trans_cost` (Transaction and carrying fees)
- `watchlist` (Tracked ticker symbols)
- `positions` (Computed snapshot positions)
- `daily_portfolio_summary` (Aggregated portfolio metrics per day)
- `eod_data` & `tick_data` (Historical and intraday market data)
- `margin_interest_rate` & `daily_margin_interest` (Financing rates and daily accruals)
- `ref_chart_settings` (Indicator parameters)

---

## 4. REST API Endpoint Specifications

All endpoints are strictly typed with Pydantic v2 schemas:

| Endpoint Path | Method | Roles | Request Body / Params | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/portfolio/overview` | GET | `user` | `start_date`, `end_date`, `currency` | Returns KPI cards, equity series, cumulative PnL series, allocation slices, and drawdown curves |
| `/api/v1/portfolio/positions` | GET | `user` | `as_of_date` | Returns open positions, market values, weights, and unrealized gains |
| `/api/v1/transactions/investment` | GET | `user` | `symbol`, `start_date`, `end_date`, `limit` | Paginated query of stock trade records |
| `/api/v1/transactions/investment` | POST | `user` | `TradeCreate` | Inserts new trade execution, logs audit row |
| `/api/v1/transactions/investment/{id}`| PUT, DELETE | `user` | `TradeUpdate` | Modifies or cancels trade execution, logs audit row |
| `/api/v1/transactions/capital` | GET, POST, PUT, DELETE | `user` | `CapitalCreate` / `CapitalUpdate` | CRUD for capital injections, withdrawals, and initial deposits |
| `/api/v1/transactions/trans-cost` | GET, POST, PUT, DELETE | `user` | `TransCostCreate` / `TransCostUpdate` | CRUD for commissions, fees, stamp duties, and financing |
| `/api/v1/watchlist` | GET | `user` | `watchlist_name` | Returns list of tickers with latest market quotes, day change, and 52-week statistics |
| `/api/v1/watchlist` | POST | `user` | `WatchlistCreate` | Adds new ticker symbol to specified watchlist |
| `/api/v1/watchlist/{id}` | DELETE | `user` | None | Removes ticker symbol from watchlist |
| `/api/v1/research/stock-analyst/{symbol}` | GET | `analyst`, `admin` | `start_date`, `end_date`, `timeframe` | Returns OHLCV candles, technical indicators, and executed trades |
| `/api/v1/research/stock-analyst/chart-render` | GET | `analyst`, `admin` | `symbol`, `start_date`, `end_date` | Returns server-rendered Matplotlib PNG base64 and indicator metadata |
| `/api/v1/research/macroeconomics` | GET | `analyst`, `admin` | None | Returns Treasury Yield Curve points, CPI, Fed Funds rate, and FX crosses |
| `/api/v1/research/sectors` | GET | `analyst`, `admin` | `horizon` (`1D`, `1W`, `1M`, `YTD`, `1Y`) | Returns 11 GICS sector performance, heatmaps, and relative rotation scores |

---

## 5. UI Architecture & Design Standards

Adheres strictly to the **Aptos White Paper Design System**:
1. **Paper Aesthetic**: Pure white sheets (`#FFFFFF`), light canvas (`#FBFBFC`), sharp 1px borders (`#E2E8F0`), deep ink (`#0F172A`).
2. **Typography**: Aptos for all body text, navigation, and labels; tabular monospace (`JetBrains Mono`) for all numeric prices, PnL percentages, and trade tickets.
3. **High-Contrast Charts**:
   - Primary: Deep cobalt blue (`#1D4ED8`) or emerald (`#047857`).
   - Drawdowns / Negative PnL: Sharp carmine red (`#B91C1C`).
   - Benchmark: Dashed amber (`#D97706`).
4. **Ergonomic Controls**:
   - Date range pickers (1M, 3M, 6M, 1Y, YTD, All, Custom).
   - Multi-chart cursor synchronization across Portfolio Overview 4-chart grid.
   - 2-Way render toggle for Stock Analyst (`Matplotlib (charting.py)` | `Interactive Canvas`).
   - Top-Tier `<Split View>` control (`Single Pane`, `30/70`, `50/50`, `70/30`) with drag-and-drop application loading.

5. **Design System Centralization & Zero-Hardcoding Mandate**:
   - **Central Component Library (`frontend/src/design-system/`)**: All layout primitives, modals, chart containers, split panes, and navigation bars must be implemented exclusively as reusable components within `design-system/` and exported via `design-system/index.ts`.
   - **Zero Inline Hardcoding**: Sub-applications (`Overview`, `Transactions`, `WatchList`, `StockAnalyst`, `Macroeconomics`, `ByIndustrySector`) are strictly prohibited from authoring one-off hardcoded markup, magic numbers, or duplicate CSS for tables, buttons, cards, forms, or split layouts.
   - **Required Design System Additions for Epic 0.3**:
     - `SplitPaneLayout`: Top-tier multi-pane layout component (`single`, `30/70`, `50/50`, `70/30`) with HTML5 drag-and-drop zone hooks.
     - `BottomNavBar`: Fixed mobile navigation bar component with active tab states and drawer triggers.
     - `ChartContainer`: Institutional white paper chart card wrapper with Aptos header, time-range pills, and synchronized crosshair dispatcher.
     - `ModalDialog`: Standardized accessible white paper modal dialog for trade tickets and symbol lookups.
     - `HeatmapGrid`: Generic performance heatmap grid component driven by centralized color tokens.

---

## 6. Success Criteria Matrix

| ID | Category | Requirement / Success Criteria | Verification Method |
| :--- | :--- | :--- | :--- |
| **SC-01** | Portfolio Overview | 4 synchronized charts render with shared crosshair timeline and correct NAV calculations. | Vitest interaction test and visual check. |
| **SC-02** | Trade CRUD | User can create, edit, and delete Buy/Sell trades; validations reject negative quantities or prices. | API pytest and Vitest form validation. |
| **SC-03** | Capital & Cost CRUD | Capital transactions and transaction costs calculate net cash impact accurately. | Pytest accounting tests on ledger balance. |
| **SC-04** | Watchlist Board | User can add/remove tickers across multiple lists and view latest market snapshot. | Vitest table interaction test. |
| **SC-05** | Stock Analyst Dual Engine | Stock Analyst provides a 2-way toggle between Matplotlib PNG and Interactive Canvas with indicator overlays. | Vitest snapshot & canvas test; API render test. |
| **SC-06** | Macroeconomics View | Displays US Treasury Yield curve and core economic series accurately. | Vitest data render test. |
| **SC-07** | Sector Heatmap | Displays 11 GICS sectors with color-coded returns for 1D, 1W, 1M, YTD. | Vitest heatmap render test. |
| **SC-08** | RBAC Enforcement | Standard `user` role blocked from Research suite with HTTP 403; `analyst` and `admin` permitted. | Pytest RBAC authorization tests. |
| **SC-09** | Design System Adherence | 100% compliant with white paper design system; zero dark mode bleed or unstyled elements. | Automated design system token audit. |
| **SC-10** | Top-Tier Split Screen | Top panel `<Split View>` dropdown allows selecting `Single Pane`, `30/70`, `50/50`, and `70/30` layouts on desktop. | Vitest layout mode switcher test and visual audit. |
| **SC-11** | Drag-and-Drop Routing | Sub-applications can be dragged from the left sidebar directly into either pane on desktop. | Vitest drag-and-drop HTML5 event simulation test. |
| **SC-12** | Mobile Device Separation | On viewports $< 1024\text{px}$, `<Split View>` is suppressed, single-column vertical layout is locked, and bottom navigation bar provides thumb-zone routing (Slide 2). | Vitest mobile viewport responsive test. |
| **SC-13** | Design System Centralization | All layout mechanisms (`SplitPaneLayout`), mobile bars (`BottomNavBar`), chart wrappers, and modals are built as reusable components in `design-system/` with zero inline duplication. | Design system audit test & ESLint inspection. |
| **SC-14** | Multi-Level Interactive Grouping | Users can drag-and-drop column chips (`Trade Date`, `Symbol`, `Side`, `Account`) to dynamically reorder and collapse/expand multi-level hierarchical groups. | Vitest drag-and-drop & rendering tests. |
| **SC-15** | Conditional Sub-Aggregation Invariant | Price aggregations (Avg Buy/Sell Price) only display when top-level group starts with `Symbol`. Suppressed when grouping starts with Date, Side, or Account. | Vitest aggregation visibility assertion. |
| **SC-16** | List vs Grouped View Mode Toggle | Segmented control toggles between hierarchical tree view and flat tabular list view without data loss. | Vitest toggle state and table layout test. |
| **SC-17** | Interactive Multi-Column Sorting | Clicking any table column header sorts rows (`asc`, `desc`, `none`) across both List and Grouped views. | Vitest sorting assertion across string and numeric keys. |
| **SC-18** | User Admin Role Revocation Modal | Administrators can open a "Configure Roles" modal dialog to add or remove roles from any user account. | Vitest role config modal interaction test. |
| **SC-19** | Root Super-Admin Protection | Permanent lock on Ferris Kwan (`id: 1`) preventing accidental admin role revocation. | Vitest security invariant test. |
| **SC-20** | Minimum Baseline Role Invariant | Enforces `User` as mandatory minimum role for all accounts; cannot be unchecked or removed. | Vitest minimum role validation test. |
| **SC-21** | Capital & Cost CRUD Extensions | Full edit and delete capabilities extended to Capital and Costs ledgers with pre-filled modals, confirmation popups, and audit snapshots. | Vitest modal & CRUD tests; backend pytest. |
| **SC-22** | Database Schema Column Widening | PostgreSQL `capital` columns widened via Alembic migration `0004` to eliminate string truncation on standard values. | Alembic migration execution & pytest. |

---

## 7. Scope Extensions, Enhancements & Bug Fixes Consolidated in Epic 0.3

During active user testing and iteration of Epic 0.3, the following major capabilities and architectural fixes were incorporated and delivered:

### 7.1 Browser Document Title
- Dynamically updated application browser tab title to `"AlphaInsight"`.

### 7.2 Multi-Level Drag-and-Drop Column Grouping & Dual Buy/Sell Ledger
- Implemented drag-and-drop column chip bar in `TransactionsView.tsx` supporting arbitrary grouping combinations across `Trade Date`, `Symbol`, `Side`, and `Account`.
- Dual Buy/Sell presentation layout separating buy considerations from sell considerations.
- Expand all / Collapse all controls.

### 7.3 Conditional Sub-Aggregation Visibility
- **Mathematical Invariant**: Price aggregations (`Avg Buy Price`, `Avg Sell Price`) are mathematically meaningless when transactions span multiple tickers.
- **Rule**: When the primary group-by dimension does not start with `Symbol`, average price metrics are hidden, displaying only unit quantities, balances, and realized/unrealized PnL figures.

### 7.4 List Mode vs Grouped View Mode Toggle
- Added a segmented view mode toggle in `TransactionsView.tsx`:
  - `Grouped View`: Hierarchical tree with nested summaries.
  - `List View`: Clean flat tabular ledger.

### 7.5 Interactive Multi-Column Sorting
- Column headers in both List Mode and Grouped Mode support click-to-sort tri-state toggling (`asc`, `desc`, reset).
- Implemented across Trade Date, Symbol, Account, Buy Price, Buy Quantity, Buy Consideration, Sell Price, Sell Quantity, Sell Consideration, and Remarks.

### 7.6 User Admin Role Configuration Modal
- Replaced the inline role selector with a `"Configure Roles"` modal dialog.
- Allows administrators to grant or revoke `Admin`, `Analyst`, and `User` roles.
- **Root Admin Invariant**: Ferris Kwan (`id: 1` / `ferriskwan@gmail.com`) is permanently locked as Admin with a visual security indicator.
- **Minimum Role Invariant**: All users must retain at least the baseline `User` role.

### 7.7 Capital & Transaction Cost CRUD Operations
- Added `Actions` column with Edit (Pencil) and Delete (Trash) buttons to both Capital and Costs tabs.
- Added pre-filled edit modals (`Edit Capital Entry`, `Edit Transaction Cost Entry`).
- Added browser confirmation dialogs before deletions.
- Implemented `updateTransCost` in frontend API client.
- Added full audit trail snapshotting (`public.audit_log`) for all Capital and Cost CRUD actions.

### 7.8 Capital Table Schema Widening (Alembic Migration 0004)
- **Root Cause**: Legacy PostgreSQL `capital` table constrained `accounttype` and `transtype` to `character(1)`. Submitting standard values like `'Cash'` triggered `StringDataRightTruncation` (HTTP 500).
- **Resolution**: Authored and executed Alembic Migration `0004_widen_capital_columns.py`, widening `accounttype` to `VARCHAR(32)`, `transtype` to `VARCHAR(16)`, `broker` to `VARCHAR(64)`, and `currency` to `VARCHAR(16)`.
- **Normalization**: Added backend input normalization in `portfolio_repo.py` (`create_capital` and `update_capital`), standardizing account types (`Cash` -> `C`, `Margin` -> `M`, `Leverage` -> `L`) and signed amounts (Deposits positive, Withdrawals negative).

### 7.9 Modal & Action Button Relabeling
- Renamed Capital modal title from `"Adjust Capital Ledger"` to `"Adjust Capital"`.
- Renamed modal submit buttons from `"Record Capital Entry"` and `"Record Cost Entry"` to `"Save"`.
