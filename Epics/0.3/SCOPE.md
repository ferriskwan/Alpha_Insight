# Epic 0.3 Scope: My Portfolio & Research Sub-Applications

**Project**: Alpha_Insight  
**Target Milestone**: Epic 0.3  
**Status**: Ready for Requirements / PRD Review  

---

## 1. High-Level Scope Summary

Epic 0.3 operationalizes all user-facing financial views across **My Portfolio** and **Research**, building upon the database schema, dynamic sitemap, and white paper design system established in Epic 0.2:

### 1.1 My Portfolio Sub-Applications
1. **Overview (Synchronized 4-Chart Dashboard)**:
   - Synchronized 4-panel analytical grid:
     - Chart 1: Total Asset Value & Portfolio Equity curve vs benchmark (SPY/QQQ).
     - Chart 2: Cumulative Realized vs Unrealized PnL timeline.
     - Chart 3: Asset & Currency Allocation breakdown (Donut / Treemap).
     - Chart 4: Daily PnL distribution histogram and drawdown curve.
   - Synchronized cursor / date crosshair across time-series charts.
   - Top-level KPI cards: Net Asset Value (NAV), Cash vs Margin Loan Balance, Day PnL, Total Realized PnL, Unrealized PnL.
2. **Transactions (Full CRUD & Trade Book)**:
   - **Investment Transactions**: Trade execution book (`trades`), Buy/Sell tickets, price/quantity validation, Cash vs Margin ledger attribution.
   - **Capital Transactions**: Cash inflows and outflows (`capital`), Deposits, Withdrawals, Initial capital, broker tracking.
   - **Transaction Costs (`trans_cost`)**: Broker commissions, SEC fees, exchange levies, margin interest charges.
3. **Watch List**:
   - Multi-list support (Default, Tech Growth, Dividend, etc.).
   - Interactive ticker table: Last price, Change, % Change, Day High/Low, 52-week Range, Volume, Quick Mini Sparkline.
   - Quick-add / remove symbol modal with ticker search.

### 1.2 Research Sub-Applications
1. **Stock Analyst**:
   - Deep-dive ticker workbench.
   - Dual Chart Engine: Matplotlib high-precision PNG rendering (`charting.py`) vs TradingView Lightweight Charts canvas.
   - 3-Way Mode Switcher: Matplotlib only, Canvas only, Split Compare side-by-side.
   - Technical Indicator Overlays: SMA, EMA, Bollinger Bands, RSI, MACD driven dynamically from database `ref_chart_settings`.
   - Timeline Zoom Range Slider: Scoped date filtering from `GLOBAL_STARTDATE` to `GLOBAL_TODAY`.
   - Historical Executed Trade markers mapped directly to price bars.
2. **Macroeconomics**:
   - US Treasury Yield Curve visualization (3M, 2Y, 5Y, 10Y, 30Y).
   - Core macroeconomic indicators: Federal Funds Effective Rate, CPI Inflation, Real GDP Growth, Unemployment Rate.
   - Currency Cross Rates: USD/SGD, USD/HKD, USD/CNY.
3. **By Industry / Sector**:
   - S&P 500 / Global 11 GICS Sector performance heatmaps (1D, 1W, 1M, YTD, 1Y).
   - Sector Rotation Relative Strength (RRG / Relative Rotation Graph against SPY).
   - Industry group drilldown with top constituents.

### 1.3 Architecture & Design Principles
- **100% REST API**: All calculations and queries served through FastAPI routers under `/api/v1/portfolio/*`, `/api/v1/transactions/*`, `/api/v1/watchlist/*`, `/api/v1/research/*`.
- **Aptos Paper Design**: Clean white background (`#FFFFFF` / `#FBFBFC`), sharp thin borders (`#E2E8F0`), deep ink (`#0F172A`), high-contrast chart palettes.
- **RBAC Gating**: `user` role entitled to My Portfolio; `analyst` and `admin` roles entitled to Research sub-applications.
