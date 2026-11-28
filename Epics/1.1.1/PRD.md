# Product Requirements Document (PRD) — Epic 1.1.1: Transactions, Industry/Sector Redesign & Responsive Reflow

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.1.1  
**Status**: Pending Explicit User Sign-off (`proceed`)  
**Scope Classification**: `[SCOPE: MINOR_ISOLATED]` (Frontend presentation, responsive container layout across `IndustrySectorView.tsx`, `App.tsx`, and associated tests)

---

## 1. Objective

Epic 1.1.1 addresses tool enhancements and UI refinements across three core areas, plus responsive layout optimization for split-screen workflows:
1. **Transactions View**: Introduce the **Invested Amount (`Inv Amt`)** aggregation metric in the grouped transactions table and multi-currency footer summaries ($\text{Total Buy Consideration} - \text{Total Sell Consideration}$). *(Completed & Verified)*
2. **Portfolio Overview Refinements**: Smart Space Reflow (moving Commentary below charts when width $< 1400$px), whitespace optimization, and integer currency formatting without decimals. *(Completed & Verified)*
3. **By Industry / Sector Research Suite**:
   - 2-column workstation layout in full pane:
     - **Top Left**: Feature-rich **GICS Sector Performance Heatmap** integrating Relative Rotation measures and RRG formula popup.
     - **Bottom Left**: **Charts & Technicals** with **Multi-Index Relative % Performance Comparison** and **Single Sector Candlestick**.
     - **Top Right**: **Sector Committee Synthesis** with historical `<Date>` run stepper & dropdown.
     - **Bottom Right**: **Cited Sector News & Feed** panel.
   - **Split View Adaptive 1-Column Layout (New Enhancement)**:
     - When the tool is being used via **Split View** (`splitMode !== 'single'`) or in constrained width environments ($< 1100$px), automatically change the 2-column display to a **1-column display**.
     - All 4 sections reflow into a clean, vertical single-column stack:
       1. **GICS Sector Performance Heatmap** (Full Width)
       2. **Charts & Technicals** (Full Width)
       3. **Sector Committee Synthesis** (Full Width, below the charts)
       4. **Cited Sector News & Feed** (Full Width, at bottom)
     - Add explicit layout switcher (`Auto` / `1 Column` / `2 Columns`) in the toolbar for user preference control.

---

## 2. Scope Item Breakdown

### Area A: Transactions "Inv Amt" Aggregation *(Completed)*
- **File**: `frontend/src/components/portfolio/TransactionsView.tsx`
- Calculated $\text{invAmt} = \text{buyConsideration} - \text{sellConsideration}$. Positioned between `Bal` and `Realized` with `Bal` color tokens.

### Area B: Portfolio Overview Refinements *(Completed)*
- **File**: `frontend/src/components/portfolio/PortfolioOverview.tsx`
- Responsive space ascertainment with layout modes (`Auto`, `Stacked`, `Side-by-Side`), zero decimals on currency KPI cards and holdings.

### Area C: [By Industry/Sector] Split View Adaptive 1-Column Layout *(Current Enhancement)*
- **Files**:
  - `frontend/src/components/research/IndustrySectorView.tsx`
  - `frontend/src/App.tsx`
  - `tests/frontend/epic_1_1_1.test.tsx`
- **Specification**:
  1. **Split View Awareness**:
     - Pass `isSplitView={splitMode !== 'single'}` from `App.tsx` into `IndustrySectorView`.
     - Mount a `ResizeObserver` on `IndustrySectorView` container to ascertain actual pixel width ($< 1100$px).
  2. **1-Column Reflow Structure**:
     - When `isSplitView` is true or container width $< 1100$px (or when layout mode is set to `'1-col'`), restructure the layout into a single column (`grid-cols-1`).
     - Display sequence:
       - **Top**: Column 1 items: GICS Sector Performance Heatmap, followed by Charts & Technicals.
       - **Bottom**: Column 2 items: Sector Committee Synthesis, followed by Cited Sector News & Feed.
     - When `isSplitView` is false and container width $\ge 1100$px (in `'2-col'` or `'auto'`), display the side-by-side 2-column layout.
  3. **Toolbar Layout Toggle**:
     - Provide optional layout pills (`Auto`, `1 Col`, `2 Col`) in the header toolbar next to the sector selector, with active state styling.

---

## 3. Success Criteria

1. **Split View Behavior**:
   - When the app is in Split View (`Split 50 / 50`, `Split 30 / 70`, `Split 70 / 30`), `IndustrySectorView` renders in a **1-column display** with zero squashed content.
   - Heatmap and Charts & Technicals render at full pane width on top.
   - Sector Committee Synthesis and Cited Sector News & Feed render at full pane width below.
2. **Single Pane Behavior**:
   - When the app is in Single Pane mode (`100%`) on standard/large displays ($\ge 1100$px), `IndustrySectorView` renders in its spacious **2-column layout** (Heatmap & Charts on left; Committee & News on right).
3. **Manual Override**:
   - User can manually switch between `Auto`, `1 Col`, and `2 Col` via toolbar toggles.
4. **Deterministic Gate**:
   - All tests in `tests/frontend/epic_1_1_1.test.tsx`, `tests/frontend/epic_1_1.test.tsx`, `tests/frontend/portfolio_overview.test.tsx`, and `tests/frontend/transactions_dual_ledger.test.tsx` pass with exit code `0`.
   - `tsc --noEmit` and `uv run ruff check .` pass with exit code `0`.
