# Walkthrough — Epic 1.1.1: Enhancements & UI Refinements

This walkthrough documents the implementation and verification for Epic 1.1.1 on git branch `1.1.1`.

---

## 1. Requirement & Implementation Mapping

### Requirement 1: Transactions "Inv Amt" Aggregation
- **Files Modified**:
  - [`frontend/src/components/portfolio/TransactionsView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/TransactionsView.tsx)
  - [`tests/frontend/transactions_dual_ledger.test.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/tests/frontend/transactions_dual_ledger.test.tsx)
- **Changes**:
  - Extended the `TradeGroup` interface to include `invAmt: number`.
  - Computed `invAmt = buyConsideration - sellConsideration` per trade group, currency subtotal, and consolidated USD grand total.
  - Inserted the `Inv Amt` pill directly between `Bal` and `Realized` in the group header sub-aggregation strip.
  - Applied the exact color token conventions of `Bal`: `text-blue-700` when $> 0$, `text-amber-700` when $< 0$, and `text-slate-600` when $= 0$.
  - Rendered `Inv Amt` in currency subtotal rows and the consolidated USD grand total footer row.

### Requirement 2: [Portfolio Overview] Smart Layout Reflow, Whitespace & Decimals
- **Files Modified**:
  - [`frontend/src/components/portfolio/PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx)
  - [`tests/frontend/portfolio_overview.test.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/tests/frontend/portfolio_overview.test.tsx)
- **Changes**:
  - Implemented container resize ascertainment via `ResizeObserver` on the root container.
  - Added layout modes (`auto`, `stacked`, `side-by-side`) with toolbar toggle buttons and `localStorage` preference persistence.
  - Under `stacked` mode or when available width $< 1400$px in `auto` mode, the 4 charts span full width across 2 columns, and Executive Commentary reflows below the charts across full width in a 4-column quadrant grid.
  - Reduced redundant padding and whitespace to optimize screen utilization.
  - Formatted all 6 top KPI cards (`minimumFractionDigits: 0, maximumFractionDigits: 0`) and portfolio holdings to omit decimal places (e.g., `SGD 45,210` instead of `SGD 45,210.00`).

### Requirement 3: [By Industry / Sector] True Financial Heatmap & Dropdown Removal
- **Files Modified**:
  - [`frontend/src/components/research/IndustrySectorView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx)
  - [`frontend/src/types/api.ts`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/types/api.ts)
- **Changes**:
  - **Removed Header Dropdowns**: Eliminated the redundant Sector selector and Model selector dropdowns from the top toolbar. Clicking any tile in the heatmap selects that sector.
  - **Real Performance Heat Color Fills**: Replaced plain white cards with vibrant performance heat fills mapped dynamically from return %:
    - $\ge +2.0\%$: Deep emerald green (`bg-emerald-700 text-white`)
    - $+1.0\%$ to $+2.0\%$: Medium green (`bg-emerald-600 text-white`)
    - $+0.2\%$ to $+1.0\%$: Soft green (`bg-emerald-500 text-white`)
    - $-0.2\%$ to $+0.2\%$: Slate neutral (`bg-slate-600 text-white`)
    - $-1.0\%$ to $-0.2\%$: Light red (`bg-rose-500 text-white`)
    - $-2.0\%$ to $-1.0\%$: Medium red (`bg-rose-600 text-white`)
    - $\le -2.0\%$: Deep crimson (`bg-rose-700 text-white`)
  - **Treemap View (Finviz Style)**: 3-tier weighted layout where box sizes reflect S&P 500 sector market weight:
    - Tier 1: Mega-caps (`XLK 29.5%`, `XLF 13.2%`, `XLV 12.4%`)
    - Tier 2: Large-caps (`XLY 10.3%`, `XLC 9.1%`, `XLI 8.7%`)
    - Tier 3: Mid/Defensives (`XLP 5.9%`, `XLE 3.8%`, `XLB 2.4%`, `XLU 2.3%`, `XLRE 2.2%`)
    - Displays large bold ticker, sector name, return %, weight %, and RRG quadrant badge.
  - **Matrix View (Bloomberg Style)**: Added view switcher toggle (`Treemap | Matrix`) displaying a complete cross-horizon matrix table covering all 11 sectors across `1D`, `1W`, `1M`, `3M`, `6M`, and `1Y`, with every return cell filled with its corresponding heat color.

### Requirement 4: Split View 1-Column Adaptive Reflow
- **Files Modified**:
  - [`frontend/src/App.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/App.tsx)
  - [`frontend/src/components/research/IndustrySectorView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx)
- **Changes**:
  - Passed `isSplitView={splitMode !== 'single'}` from `App.tsx` into `IndustrySectorView`.
  - Mounted a container `ResizeObserver` tracking actual rendered width ($< 1100$px).
  - Added toolbar layout mode selector (`Auto`, `1 Col`, `2 Col`).
  - When in Split View (`isSplitView === true`) or when container width $< 1100$px:
    - Reflows from 2 columns to a single column (`grid-cols-1`):
      1. **GICS Sector Performance Heatmap** (Full width on top)
      2. **Charts & Technicals** (Full width)
      3. **Sector Committee Synthesis** (Full width, reflowed below charts)
      4. **Cited Sector News & Feed** (Full width, at the bottom)
  - When in Single Pane full desktop mode, preserves the 2-column side-by-side workstation layout.

### Requirement 5: Cross-Sector AI Analysis & 1-Run-Per-Day Rate Limiting
- **Files Modified**:
  - [`backend/api/v1/research.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/research.py)
  - [`backend/repositories/committee_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/committee_repo.py)
  - [`frontend/src/components/research/IndustrySectorView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx)
- **Changes**:
  - **Cross-Sector Scope**: Assembles quantitative metrics across all 11 GICS sectors in `sector_metrics["all_sectors"]` so the 4-analyst committee evaluates the entire market's relative rotation, leadership, and sector allocation.
  - **1-Per-Day Backend Enforcement**: Checks if a committee run has already been created today (`created_at >= today_start`). If found, returns the active run with `daily_quota_reached: True`.
  - **UI Quota Gate**: When an analysis has already been executed today, the "AI Analysis" button is disabled and displays `Analyzed Today (1/day)` with tooltip confirmation, preventing accidental credit depletion.
  - **Historical Storage**: All past runs remain permanently stored in PostgreSQL and accessible via the `<Date>` stepper.

### Requirement 6: Treemap Sorting Logic by 4 RRG Quadrants (Approach B — Continuous Lifecycle Flow)
- **Files Modified**:
  - [`frontend/src/components/research/IndustrySectorView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx)
  - [`tests/frontend/epic_1_1_1.test.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/tests/frontend/epic_1_1_1.test.tsx)
- **Changes**:
  - **Continuous Lifecycle Flow Sorting**: All 11 sectors in the Treemap are dynamically ordered by the 4 Relative Rotation Graph quadrants:
    $$\text{Leading} \;\longrightarrow\; \text{Weakening} \;\longrightarrow\; \text{Improving} \;\longrightarrow\; \text{Lagging}$$
  - **Magnitude Sizing Preserved**: Within each quadrant, sectors are sorted by market weight descending. Sizing of each tile continues to be proportional to its S&P 500 market weight magnitude (`flexBasis` & `flexGrow` normalized to row total weights).
  - **Interactive Sort Switcher**: Card header toolbar features a sort toggle: `Sort: [ Quadrants (Default) | Weight | Return ]`, allowing users to switch between quadrant lifecycle flow, pure weight descending, and performance return descending.
  - **Market Breadcrumb Indicator**: In Quadrants sort mode, displays an informative rotation breadth strip: `RRG Rotation Order: Leading (N) -> Weakening (N) -> Improving (N) -> Lagging (N)` with live sector counts in each state.
  - **Quadrant Badges**: Integrated distinct styled quadrant badges on each sector tile (`Leading`, `Weakening`, `Improving`, `Lagging`).

---

## 2. Verification Results

### Fast Targeted Gate & Unit Test Suites

| Test Suite File | Tests Run | Passed | Failed | Execution Time |
| :--- | :---: | :---: | :---: | :---: |
| `tests/frontend/transactions_dual_ledger.test.tsx` | 12 | 12 | 0 | 1.37s |
| `tests/frontend/portfolio_overview.test.tsx` | 5 | 5 | 0 | 0.94s |
| `tests/frontend/epic_1_1.test.tsx` | 4 | 4 | 0 | 0.90s |
| `tests/frontend/epic_1_1_1.test.tsx` | 9 | 9 | 0 | 1.15s |
| **Total** | **30** | **30** | **0** | **4.36s** |

### Static Analysis & Type Checking
- **TypeScript Compilation** (`tsc --noEmit -p frontend/tsconfig.json`): **0 errors (Exit code 0)**.
- **Python Linter** (`uv run ruff check .`): **All checks passed (Exit code 0)**.

---

## 3. Git Status Summary
- **Branch**: `1.1.1`
- **Tracked modified files**:
  - `backend/api/v1/research.py`
  - `backend/repositories/committee_repo.py`
  - `frontend/src/App.tsx`
  - `frontend/src/components/portfolio/PortfolioOverview.tsx`
  - `frontend/src/components/portfolio/TransactionsView.tsx`
  - `frontend/src/components/research/IndustrySectorView.tsx`
  - `frontend/src/types/api.ts`
  - `tasklist.md`
  - `tests/frontend/epic_1_1.test.tsx`
  - `tests/frontend/epic_1_1_1.test.tsx`
  - `tests/frontend/portfolio_overview.test.tsx`
  - `tests/frontend/transactions_dual_ledger.test.tsx`
- **New files**:
  - `Epics/1.1.1/PRD.md`
  - `Epics/1.1.1/ui_design.md`
  - `Epics/1.1.1/IMPLEMENTATION_PLAN.md`
  - `Epics/1.1.1/tasklist.md`
  - `Epics/1.1.1/walkthrough.md`
  - `frontend/src/components/research/SectorComparisonChart.tsx`
