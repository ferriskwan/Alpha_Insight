# Tasklist — Epic 1.1.1: Single-Engineering Thread Mode

- [x] **Task 1: Transactions "Inv Amt" Aggregation**
  - Remarks:
    - Updated `TradeGroup` interface in `frontend/src/components/portfolio/TransactionsView.tsx` with `invAmt: number`.
    - Computed `invAmt = buyConsideration - sellConsideration` across `tradeGroups`, currency subtotals, and consolidated USD grand total.
    - Inserted `Inv Amt` pill between `Bal` and `Realized` in the group header sub-aggregation strip adhering to `Bal` color token conventions (`text-blue-700` positive, `text-amber-700` negative, `text-slate-600` zero).
    - Displayed `Inv Amt` in currency subtotal and consolidated USD grand total footer rows.
    - Added comprehensive unit tests in `tests/frontend/transactions_dual_ledger.test.tsx` verifying exact amounts, styling classes, and footer integration. All 12 tests passed with exit code 0.
  - [x] Update `TradeGroup` interface in `frontend/src/components/portfolio/TransactionsView.tsx` to include `invAmt: number`.
  - [x] Compute `invAmt = buyConsideration - sellConsideration` inside `tradeGroups` calculation.
  - [x] Insert `Inv Amt` pill between `Bal` and `Realized` in the group header sub-aggregation strip with matching `Bal` color tokens.
  - [x] Add `Inv Amt` to currency subtotals and consolidated USD grand total in table footer.
  - [x] Update and execute `TransactionsView.test.tsx` to verify zero regressions and complete coverage.

- [x] **Task 2: [Portfolio Overview] Smart Layout Reflow, Whitespace & Decimals Removal**
  - Remarks:
    - Added container resize tracking and `layoutMode` state (`auto`, `stacked`, `side-by-side`). When width < 1400px or stacked mode is active, the 4 charts take full width across 2 columns, and Executive Commentary reflows below the charts across full width in a 4-column quadrant grid.
    - Added layout toggle buttons in the header toolbar (`Auto` / `Stacked` / `Side-by-Side`) with persistent preference.
    - Optimized whitespace and padding throughout the container and chart cards.
    - Removed decimals from currency figures in all 6 top KPI cards (`minimumFractionDigits: 0, maximumFractionDigits: 0`) and holdings values.
    - Updated `tests/frontend/portfolio_overview.test.tsx` with layout switching and integer currency checks. All 5 tests passed with exit code 0.
  - [x] Implement responsive space ascertainment in `frontend/src/components/portfolio/PortfolioOverview.tsx` to automatically reflow "Executive Commentary" below the 4 charts on standard displays / constrained widths.
  - [x] Add explicit layout switcher (`Auto` / `Stacked Below` / `Side-by-Side`) in the toolbar.
  - [x] Optimize whitespace and chart aspect ratio to make full use of canvas area.
  - [x] Remove decimals from currency metrics in `KpiBadgeWithTooltip` and holdings values.
  - [x] Execute `PortfolioOverview.test.tsx` via Vitest.

- [x] **Task 3: [By Industry/Sector] Multi-Index Relative % Comparison Chart Component**
  - Remarks:
    - Authored `frontend/src/components/research/SectorComparisonChart.tsx` supporting multi-select chips for 11 GICS sector ETFs + SPY.
    - Implemented base-date 0% return normalization across timeframes (`1M`, `3M`, `6M`, `1Y`) using formula `((P_t - P_0) / P_0) * 100%`.
    - Implemented interactive multi-line SVG visualization with crosshair cursor, hover tooltip, and color-coded chips with select-all and clear actions.
  - [x] Create `frontend/src/components/research/SectorComparisonChart.tsx` with multi-select index pills (11 sector ETFs + SPY).
  - [x] Implement base-date 0% return normalization across timeframes (`1M`, `3M`, `6M`, `1Y`).
  - [x] Implement interactive multi-line SVG/canvas chart with crosshair and dynamic legend.

- [x] **Task 4: [By Industry/Sector] Layout Redesign & Integration**
  - Remarks:
    - Restructured `frontend/src/components/research/IndustrySectorView.tsx` into the 2x2 grid layout per annotated instructions.
    - Updated `SectorCommitteeResponse` interface in `frontend/src/types/api.ts` with `history` array.
  - [x] Move GICS Sector Performance Heatmap to Top Left, integrating RS score, RS momentum, quadrant badges, and Formula popup. Remove standalone RRG card.
  - [x] Embed Charts & Technicals container at Bottom Left with mode switcher (`Relative % Comparison` vs `Single Sector Candlestick`).
  - [x] Replace static header at Top Right with Historical `<Date>` run stepper and selector dropdown wired to `apiClient.getSectorCommittee(symbol, runId)`.
  - [x] Move Cited Sector News Feed to Bottom Right.
  - [x] Author / update `IndustrySectorView.test.tsx` and verify cleanly.

- [x] **Task 5: Final Verification & Audit Gate**
  - Remarks:
    - Executed targeted frontend tests: all 26 tests passed with exit code 0.
    - Checked TypeScript compilation (`tsc --noEmit`): 0 errors.
    - Executed Ruff static analysis (`uv run ruff check .`): All checks passed.
  - [x] Run fast targeted Vitest test suites.
  - [x] Run full workspace CI-parity check (`uv run ruff check .`).
  - [x] Prepare initial `walkthrough.md`.

- [x] **Task 6: Split View 1-Column Reflow, Financial Treemap Heatmap & 1-per-day Cross-Sector AI Analysis**
  - Remarks:
    - **Split View 1-Column Reflow**:
      - Passed `isSplitView={splitMode !== 'single'}` from `frontend/src/App.tsx` into `IndustrySectorView`.
      - Mounted `ResizeObserver` tracking container width (< 1100px).
      - Added toolbar layout switcher (`Auto` / `1 Col` / `2 Col`).
      - In Split View or 1-Col mode, reflowed the 4 quadrants into a single clean vertical stack:
        1. GICS Sector Performance Heatmap (Full width)
        2. Charts & Technicals (Full width)
        3. Sector Committee Synthesis (Full width, placed below charts)
        4. Cited Sector News & Feed (Full width, at bottom)
      - In single pane full desktop mode, preserves the 2-column side-by-side workstation layout.
    - **Header Dropdown Removal**:
      - Removed the redundant Sector selector dropdown and Model selector dropdown from the toolbar.
    - **True Financial Heatmap (Finviz Weighted Treemap & Matrix View)**:
      - Implemented full background color heat mapping based on return % from deep emerald green (`#15803d`) to deep crimson red (`#b91c1c`).
      - Implemented **Treemap View (Finviz Style)**: 3-row layout sized proportionally by sector S&P 500 weight (Mega caps `XLK 29.5%`, `XLF 13.2%`, `XLV 12.4%`; Large caps `XLY`, `XLC`, `XLI`; Mid/Defensives `XLP`, `XLE`, `XLB`, `XLU`, `XLRE`). Clicking any tile selects that sector.
      - Implemented **Matrix View (Bloomberg Style)**: cross-timeframe performance table covering `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, and RRG Quadrant with color-filled heat cells.
    - **Cross-Sector AI Analysis & 1-Run-Per-Day Rate Limiting**:
      - Enforced in `backend/api/v1/research.py`: checks if a committee run already exists for today (`created_at >= today_start`). If so, returns existing today's run with `daily_quota_reached: True`.
      - Enriched context in `backend/repositories/committee_repo.py`: assembles all 11 sectors' rotation metrics in `all_sectors` for cross-market committee evaluation.
      - Frontend UI: when an analysis has already run today, the "AI Analysis" button is disabled and displays `Analyzed Today (1/day)`.
    - **Verification**:
      - All 29 tests in `tests/frontend/epic_1_1_1.test.tsx`, `epic_1_1.test.tsx`, `portfolio_overview.test.tsx`, and `transactions_dual_ledger.test.tsx` pass (0 failures).
      - `tsc --noEmit -p frontend/tsconfig.json`: 0 errors.
      - `uv run ruff check .`: all checks passed.
  - [x] Connect `isSplitView` from `App.tsx` and container `ResizeObserver` in `IndustrySectorView.tsx`.
  - [x] Restructure grid into 1-column stack when in Split View or narrow screens.
  - [x] Remove Sector and Model dropdowns from the top header toolbar.
  - [x] Implement real color-shaded Treemap and Multi-Horizon Matrix heatmap with toggle.
  - [x] Implement backend and frontend 1-run-per-day rate limit for AI Analysis.
  - [x] Verify full test suites and CI-parity.
