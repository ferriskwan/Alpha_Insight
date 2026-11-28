# Implementation Plan — Epic 1.1.1 Enhancement: Industry/Sector Split View 1-Column Reflow

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.1.1 Enhancement  
**Status**: Pending Explicit User Sign-off (`proceed`)  
**Execution Mode**: Single-Engineering Thread Mode (Default)  

---

## 1. Technical Scope

| Target File | Changes Required |
| :--- | :--- |
| `frontend/src/App.tsx` | Compute `isSplit = splitMode !== 'single'` and pass `isSplitView={isSplit}` to `<IndustrySectorView />` inside `renderSubApp`. |
| `frontend/src/components/research/IndustrySectorView.tsx` | 1. Add `isSplitView?: boolean` to `IndustrySectorViewProps`.<br>2. Add container `ResizeObserver` tracking `containerWidth`.<br>3. Add `layoutMode` state (`auto`, `1-col`, `2-col`) with toolbar toggle buttons.<br>4. Compute `isSingleColumn`: `layoutMode === '1-col' ? true : layoutMode === '2-col' ? false : (isSplitView || containerWidth < 1100)`.<br>5. Structure the layout grid into: Column 1 (`space-y-5`: Heatmap, Charts) and Column 2 (`space-y-5`: Committee, News).<br>6. When `isSingleColumn` is true, render `grid-cols-1` (Column 1 followed by Column 2). When false, render `grid-cols-1 lg:grid-cols-2`. |
| `tests/frontend/epic_1_1_1.test.tsx` | Add unit tests verifying that passing `isSplitView={true}` or toggling `1 Col` reflows the grid to `grid-cols-1` with Committee below Charts, and `isSplitView={false}` maintains 2 columns. |

---

## 2. Skill Allocation
- **`spec-orchestrator`**: PRD and scope validation against user screenshot.
- **`logic-generator`**: Linear component updates in `App.tsx` and `IndustrySectorView.tsx`.
- **`deterministic-resolver`**: Fast targeted test suite execution (`vitest`) and linting (`ruff`, `tsc`).

---

## 3. Engineering Standards
- **Component Modularity**: Preserve all sub-tab capabilities (`Multi-Index Relative %` and `Single Sector Candlestick`), historical `<Date>` stepper, and RRG formula modal.
- **Tailwind Tokens**: Adhere to existing border, padding, and text tokens (`bg-slate-50`, `border-slate-200`, `text-blue-700`).
- **No Outer Shell Wrappers**: Invoke `vitest.cmd`, `tsc.cmd`, and `uv run` directly.

---

## 4. Verification Protocol
1. **Targeted Gate**:
   - `vitest tests/frontend/epic_1_1_1.test.tsx`
   - `tsc --noEmit -p frontend/tsconfig.json`
2. **Regression Gate**:
   - All 4 test files (`transactions_dual_ledger.test.tsx`, `portfolio_overview.test.tsx`, `epic_1_1.test.tsx`, `epic_1_1_1.test.tsx`).
3. **Walkthrough Document**: Update `Epics/1.1.1/walkthrough.md`.
