# Product Requirements Document (PRD) — Epic 1.1.1: Transactions, Industry/Sector Redesign & Portfolio Overview Smart Reflow

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.1.1  
**Status**: Pending Explicit User Sign-off (`proceed`)  
**Scope Classification**: `[SCOPE: MINOR_ISOLATED]` (Frontend presentation, calculations, and responsive layout across `TransactionsView.tsx`, `IndustrySectorView.tsx`, and `PortfolioOverview.tsx`)

---

## 1. Objective

Epic 1.1.1 addresses tool enhancements and UI refinements across three core areas:
1. **Transactions View**: Introduce the **Invested Amount (`Inv Amt`)** aggregation metric in the grouped transactions table and multi-currency footer summaries ($\text{Total Buy Consideration} - \text{Total Sell Consideration}$).
2. **By Industry / Sector Research Suite**: Re-architect into a 2-column layout:
   - **Top Left**: Feature-rich **GICS Sector Performance Heatmap** integrating Relative Rotation measures and RRG formula popup.
   - **Bottom Left**: **Charts & Technicals** with **Multi-Index Relative % Performance Comparison** (multi-sector $+ SPY$ on a $0\%$ normalized baseline) and **Single Sector Candlestick OHLCV**.
   - **Top Right**: **Sector Committee Synthesis** with historical `<Date>` run stepper & dropdown.
   - **Bottom Right**: **Cited Sector News & Feed** panel.
3. **Portfolio Overview Refinements**:
   - **Smart Space Reflow (Responsive Container Query)**: Automatically reflow content based on available container space. On standard screens or when horizontal space is constrained, move "Executive Commentary" **below the charts**, allowing the 4 institutional charts to expand into a spacious, unsquashed 2x2 grid, with Commentary expanding across the full width below.
   - **White Space Optimization**: Tighten vertical margins, expand container utilization, and maximize canvas display areas.
   - **Decimal Display Removal**: Format currency amounts in the KPI cards (and holdings/tooltips as specified) as clean whole numbers (e.g. `SGD 142,500` instead of `SGD 142,500.00`).

---

## 2. Scope Item Breakdown

### Area A: Transactions "Inv Amt" Aggregation
- **File**: `frontend/src/components/portfolio/TransactionsView.tsx`
- **Specification**:
  1. Calculate $\text{invAmt} = \text{buyConsideration} - \text{sellConsideration}$ for each `TradeGroup`.
  2. Insert `Inv Amt` pill in the group header strip between `Bal` and `Realized`.
  3. Color formatting matching `Bal`:
     - $\text{invAmt} > 0$: `text-blue-700` (`+${prefix}${amount}`)
     - $\text{invAmt} < 0$: `text-amber-700` (`-${prefix}${Math.abs(amount)}`)
     - $\text{invAmt} === 0$: `text-slate-600` (`${prefix}0.00`)
  4. Display net `Inv Amt` in currency subtotal rows and consolidated USD grand total footer rows.

---

### Area B: [By Industry/Sector] Layout Redesign & Multi-Index Comparison
- **Files**: `frontend/src/components/research/IndustrySectorView.tsx`, `frontend/src/components/research/SectorComparisonChart.tsx`
- **Specification**:
  1. **Top Left**: Heatmap with integrated RS score, RS Momentum, Quadrant badges, horizon selector, and Formula button. Standalone RRG card removed.
  2. **Bottom Left**: Charts & Technicals supporting:
     - **Mode 1: Multi-Index Relative % Comparison**: Toggle chips for 11 sectors + `SPY`, $0\%$ normalized baseline, interactive multi-line canvas.
     - **Mode 2: Single Sector Candlestick**: Candlestick OHLCV and volume chart for active sector ETF.
  3. **Top Right**: Sector Committee card with functional `<Date>` stepper / dropdown loading historical runs from PostgreSQL.
  4. **Bottom Right**: Cited News Feed panel with active links.

---

### Area C: [Portfolio Overview] Smart Layout Reflow & UI Refinements
- **File**: `frontend/src/components/portfolio/PortfolioOverview.tsx`
- **Specification**:
  1. **Smart Space Ascertainment & Auto-Reflow**:
     - Implement responsive space ascertainment:
       - On wide screens ($\ge 1536$px or when container width $> 1400$px): support 2-column side-by-side workstation layout (Charts left, Commentary right).
       - On standard/constrained widths ($< 1400$px, laptop screens, or split views): **automatically move "Executive Commentary" below the charts**.
       - In stacked mode, the 4 charts take full width across 2 columns (`grid-cols-1 md:grid-cols-2`), giving each chart $\ge 600$px width to prevent being squashed.
       - Executive Commentary reflows below into a wide, balanced grid (e.g. 2x2 or 4 horizontal quadrants) making optimal use of full screen width.
     - Add an explicit layout mode toggle in the toolbar (`Auto`, `Stacked Below`, `Side-by-Side`) so the user can lock their preferred view.
  2. **White Space Optimization**:
     - Reduce excessive padding and empty gaps around the charts and container edges.
     - Increase chart SVG plot aspect ratio to fully occupy card containers.
  3. **Decimal Removal**:
     - In the 6 top KPI cards (`KpiBadgeWithTooltip`), format currency amounts with `maximumFractionDigits: 0` (e.g. `SGD 45,210` instead of `SGD 45,210.00`).
     - Percentage metrics retain 2 decimals (e.g. `+12.45%`) or 1 decimal for clarity.
     - Remove decimals from holdings values in the pie chart / legend (`$45,210`).

---

## 3. Success Criteria

1. **Transactions View**: `Inv Amt` computes accurately and displays with matching `Bal` color codes.
2. **Industry / Sector Page**:
   - Heatmap at Top Left with integrated RRG metrics and Formula popup.
   - Multi-Index Relative % Comparison and Single Candlestick at Bottom Left.
   - Historical `<Date>` Stepper at Top Right loading past runs.
   - News Feed at Bottom Right.
3. **Portfolio Overview**:
   - Smartly moves "Executive Commentary" below the charts when space is constrained or on standard desktop/laptop widths.
   - 4 institutional charts render spacious and unsquashed.
   - White space is tightened and utilized effectively.
   - Currency numbers in KPI cards and holdings display without decimals as clean integers.
4. **Deterministic Gate**: Scoped Vitest and Pytest suites execute with exit code `0`.
