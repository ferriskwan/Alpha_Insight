# UI/UX Design Specification — Epic 1.1.1: Transactions, Industry/Sector Redesign & Portfolio Overview Smart Reflow

**Components**: 
- `TransactionsView` (`frontend/src/components/portfolio/TransactionsView.tsx`)
- `IndustrySectorView` (`frontend/src/components/research/IndustrySectorView.tsx`)
- `SectorComparisonChart` (`frontend/src/components/research/SectorComparisonChart.tsx`)
- `PortfolioOverview` (`frontend/src/components/portfolio/PortfolioOverview.tsx`)

---

## 1. Transactions View: "Inv Amt"

- **Location**: Between `Bal` and `Realized` in group header strip.
- **Tokens**:
  - `invAmt > 0`: `text-blue-700 font-bold font-mono` (`+S$34,440.00`)
  - `invAmt < 0`: `text-amber-700 font-bold font-mono` (`-S$7,500.00`)
  - `invAmt === 0`: `text-slate-600 font-bold font-mono` (`S$0.00`)
- **Footer**: Displayed in currency subtotals and consolidated USD grand total.

---

## 2. [By Industry / Sector] Layout Redesign

- **Top Left**: Enhanced Heatmap (with RS, RS Momentum, Quadrant badges, horizon pills, and Formula modal).
- **Bottom Left**: Charts & Technicals:
  - **Mode 1**: Multi-Index Relative % Comparison (toggle pills for sectors + SPY, 0% baseline multi-line curve).
  - **Mode 2**: Single Sector Candlestick (OHLCV + volume).
- **Top Right**: Sector Committee Synthesis with historical `<Date>` run stepper `< [YYYY-MM-DD HH:MM] >` and dropdown.
- **Bottom Right**: Cited Sector News & Feed (Yahoo Finance RSS).

---

## 3. [Portfolio Overview] Smart Layout Reflow & Refinements

### 3.1 Smart Spatial Reflow
- **Breakpoints & Layout Logic**:
  - **Stacked Mode (Default for width $< 1536$px / Laptop / Split views)**:
    - 4 Charts container occupies full width (`col-span-12`), rendering in a spacious 2-column grid (`grid-cols-1 md:grid-cols-2 gap-4`). Each chart gets full breathing room ($\ge 600$px).
    - "Executive Commentary" is positioned **below the charts** across the full width, rendering its 4 quadrants in a clean 2x2 grid or horizontal row, eliminating squashing and filling horizontal whitespace.
  - **Side-by-Side Mode (Ultra-wide $\ge 1536$px or explicit toggle)**:
    - Charts in left 8 columns, Commentary in right 4 columns.
  - **Layout Controls**: Compact toolbar pill toggle (`Auto` / `Stacked` / `Side-by-Side`).

### 3.2 Whitespace Optimization
- Maximize chart SVG plotting area by increasing `plotW` and `plotH` relative to outer padding.
- Reduce vertical margin gaps between KPI cards, chart containers, and commentary.

### 3.3 Decimal Formatting
- In top KPI cards (`Realized PnL`, `Unrealized PnL`, `Total PnL`, `Capital`, `Margin`, `Total Portfolio`):
  - Currency amount: rounded to nearest whole dollar (`maximumFractionDigits: 0`, e.g. `SGD 45,210`).
  - Percentage: 2 decimal places (`+12.45%`).
- In Holdings Donut / Legend:
  - Market values formatted without decimals (`SGD 12,450`).
