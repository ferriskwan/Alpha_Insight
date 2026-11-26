# Walkthrough — Epic 1.1: By Industry / Sector Research & Portfolio Overview Refinements

**Branch**: `1.1`  
**Workspace**: `c:\Users\ferri\devt\Alpha_Insight`  
**Execution Mode**: Single-Engineering Thread Mode  
**PRD Document**: [`Epics/1.1/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/PRD.md)  
**UI Design Document**: [`Epics/1.1/ui_design.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/ui_design.md)  
**Implementation Plan**: [`Epics/1.1/IMPLEMENTATION_PLAN.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/IMPLEMENTATION_PLAN.md)  
**Task List**: [`tasklist.md`](file:///c:/Users/ferri/devt/Alpha_Insight/tasklist.md)  

---

## 1. Executive Summary & Deliverables

Epic 1.1 delivers three integrated capability upgrades across AlphaInsight, refined per user review:

1. **By Industry / Sector Research (`/research/sectors`)**:
   - Seeded 11 standard GICS sector ETFs (`XLK`, `XLF`, `XLV`, `XLE`, `XLI`, `XLC`, `XLY`, `XLP`, `XLB`, `XLU`, `XLRE`) plus benchmark `SPY` into `public.watchlist` and `public.site_map`.
   - Real-time Relative Rotation Graph (RRG) quadrant classification (`Leading`, `Improving`, `Weakening`, `Lagging`) based on mathematical relative strength ($RS = \frac{1 + Ret_{Sector, 1M}}{1 + Ret_{SPY, 1M}}$) and 5-day RS momentum.
   - Syndicated RSS news extraction from Yahoo Finance with fallback handling.
   - Multi-analyst sector committee AI engine (`technical`, `fundamental`, `macro`, `risk`) plus chair executive consensus synthesis with Google Search grounding.
   - Action button standardized to **"AI Analysis"** (running state: **"Running AI Analysis..."**).
   - Pre-computation batch runner integrated into `alpha-insight-daily-job` (`main.py`).

2. **Portfolio Overview Refinements (`/portfolio/overview`)**:
   - Action button standardized to **"AI Analysis"** (running state: **"Running AI Analysis..."**), positioned on the top toolbar beside date and currency pickers.
   - Dynamic default date derived from `max(date)` of `daily_portfolio_summary`.
   - Default timeframe set to 6 months (`6M`).
   - Chart 1: Removed separate `Trades` checkbox; trade execution annotations are coupled directly to the `Portfolio Size` line. `Capital Adj` folded into `Capital`.
   - Chart 3:
     - Subtitle explicitly quotes the holdings date: `Holdings as of [selectedDate] (Active portfolio holdings)`.
     - Symbol name (`item.symbol`) is prominently rendered in bold in the legend with share count `([quantity] shs)` and formatted value/percentage to eliminate blank/clipped entries.
     - Interactive pie chart rollover: hovering any slice highlights the slice with a white border, dims remaining slices, displays symbol/shares/weight in the donut center, and opens an interactive floating card showing Symbol, Quantity, Price, Market Value, and Portfolio Weight.
   - Corrected `Total Portfolio` formula tooltip to aggregate active position market values (`sum(Quantity * Market Price * FX)`).
   - Removed `Institutional Performance Series` and `AI Portfolio Intelligence` headings.
   - Restructured layout into a 2-column view: Left (60% width, 4 Charts) and Right (40% width, AI Commentary).

3. **Unified AI Credit Exhaustion Alert Banner**:
   - Uniform amber alert banner applied across all 4 AI tools:
     (1) **Portfolio Overview**
     (2) **Macroeconomics**
     (3) **By Industry / Sector**
     (4) **Stock Analysis**
   - Matches the exact design:
     - Container: `p-3.5 bg-amber-50 border border-amber-300 rounded-md flex items-start gap-3 shadow-xs`
     - Icon: `AlertTriangle` in `text-amber-600`
     - Heading: `AI Provider Service Notice: Google Gemini credits depleted (402 RESOURCE_EXHAUSTED). Operating in deterministic fallback mode.`
     - Link: [Manage Billing & Credits ↗](https://ai.studio/projects)
     - Subtext: `Deterministic fallback analytics applied with standard quantitative technical rules.`
   - Standardized action buttons to **"AI Analysis"** across all 4 tools.

---

## 2. Requirement Traceability Matrix

| Requirement | Implementation Files | Status |
| :--- | :--- | :--- |
| **All AI buttons named "AI Analysis"** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx), [`MacroeconomicsView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/MacroeconomicsView.tsx), [`IndustrySectorView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx), [`AnalystCommitteeView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/AnalystCommitteeView.tsx) | **Verified** |
| **Unified AI credit exhaustion notice on all 4 tools** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx), [`MacroeconomicsView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/MacroeconomicsView.tsx), [`IndustrySectorView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/IndustrySectorView.tsx), [`AnalystCommitteeView.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/research/AnalystCommitteeView.tsx), [`agent_orchestrator.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/services/agent_orchestrator.py) | **Verified** |
| **Chart 3: Guaranteed symbol visibility in legend** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx), [`portfolio_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/portfolio_repo.py) | **Verified** |
| **Chart 3: Interactive rollover on pie chart (symbol, quantity, value)** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx) | **Verified** |
| **Chart 3: Holdings date explicitly quoted in chart header** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx) | **Verified** |
| **Chart 1: Remove Trades checkbox; couple annotations with Portfolio Size** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx) | **Verified** |
| **GICS Sector ETFs & benchmark `SPY` seed** | [`0011_seed_gics_sector_indexes_in_watchlist.py`](file:///c:/Users/ferri/devt/Alpha_Insight/alembic/versions/0011_seed_gics_sector_indexes_in_watchlist.py) | **Verified** |
| **Sector Performance & RRG Quadrants API** | [`research_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/research_repo.py), [`research.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/api/v1/research.py) | **Verified** |
| **Yahoo Finance RSS Ingestion** | [`rss_service.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/services/rss_service.py) | **Verified** |
| **4-Analyst Sector Committee Engine** | [`prompt_builder.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/services/prompt_builder.py), [`agent_orchestrator.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/services/agent_orchestrator.py), [`committee_repo.py`](file:///c:/Users/ferri/devt/Alpha_Insight/backend/repositories/committee_repo.py) | **Verified** |
| **Daily Batch Pipeline Step** | [`run_sector_research.py`](file:///c:/Users/ferri/devt/Alpha_Insight/run_sector_research.py), [`main.py`](file:///c:/Users/ferri/devt/Alpha_Insight/main.py) | **Verified** |
| **Total Portfolio formula tooltip** | [`PortfolioOverview.tsx`](file:///c:/Users/ferri/devt/Alpha_Insight/frontend/src/components/portfolio/PortfolioOverview.tsx) | **Verified** |

---

## 3. Verification & Gate Results

### Tier 1: Linting & Code Formatting
- `uv run ruff check .` $\rightarrow$ **0 errors** (Passed).
- `uv run ruff format --check .` $\rightarrow$ **153 files already formatted** (Passed).

### Tier 2: Static Type Checking
- `uv run mypy backend/api/v1/research.py backend/api/v1/portfolio.py backend/repositories/research_repo.py backend/repositories/portfolio_repo.py backend/repositories/committee_repo.py backend/services/rss_service.py backend/services/agent_orchestrator.py backend/schemas/research.py backend/schemas/portfolio.py` $\rightarrow$ **Success: no issues found in 9 source files** (Passed).

### Tier 3: Automated Tests
- **Backend Tests** (`tests/backend/test_epic_1_1.py`):
  - **10/10 passed** in 5.59s.
- **Frontend Tests** (`tests/frontend/epic_1_1.test.tsx`):
  - **3/3 passed** in 3.95s.
- **Frontend Regression & Design System Audits**:
  - `tests/frontend/portfolio_overview.test.tsx` + `tests/frontend/design_system_audit.test.tsx`: **14/14 passed**.

---

## 4. UI Refinements & User Feedback Additions

1. **Full-Width Layout (Space Utilization)**:
   - Removed restrictive `max-w-7xl mx-auto` class on the outer container in `PortfolioOverview.tsx`.
   - The view now uses `w-full`, expanding across the full width of the screen and eliminating blank side margins on widescreen displays.

2. **Holdings Distribution Legend Formatting & Popover Repositioning**:
   - Replaced multi-line/overlapping text in Chart 3 with strict non-wrapping format: `Symbol + $XXXk + YY%` (e.g. `D05.SI   $98.2k   36.5%`).
   - Implemented `formatHoldingsKValue` helper to format values into `$XXXk` or `$X.XM`.
   - Repositioned the interactive hover pop-up from `top-2 left-2` to `bottom-2 right-2` (`absolute bottom-2 right-2 z-30 min-w-[210px]`) so that hovering over slices or legend entries leaves the pie chart fully visible and unobstructed.
   - Slices and legend items are interactively synchronized with hover highlight and popovers detailing quantity, price, market value, and weight.

3. **Standardized AI Button Labeling**:
   - All AI generation buttons renamed to **"AI Analysis"** (with execution state **"Running AI Analysis..."**) across:
     - Portfolio Overview
     - Stock Analysis
     - Macroeconomics
     - By Industry / Sector

4. **Trade Annotations Coupling**:
   - Removed redundant standalone `Trades` checkbox on Chart 1; trade annotations are now coupled directly to the `Portfolio Size` series.

5. **Uniform Credit Exhaustion Banner**:
   - Ensured amber warning banner (`Google Gemini credits depleted (402 RESOURCE_EXHAUSTED)...`) with direct link to Google AI Studio is active across all 4 AI tools.
