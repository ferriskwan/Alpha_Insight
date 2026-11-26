# Implementation Plan — Epic 1.1: By Industry / Sector Research & Portfolio Overview Refinements

**Project**: `Alpha_Insight`  
**Milestone**: Epic 1.1  
**Status**: Pending Explicit User Sign-off (`proceed`) & Execution Mode Selection  
**Branch**: `feat/epic-1.1-sector-research` (branched from `1.0.1` / `dev`)  
**Scope Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]`  
**PRD Reference**: [`Epics/1.1/PRD.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/PRD.md)  
**UI Design Reference**: [`Epics/1.1/ui_design.md`](file:///c:/Users/ferri/devt/Alpha_Insight/Epics/1.1/ui_design.md)

---

## 1. Technical Scope & Architecture Allocation

| Module / Layer | Files Affected | Technical Scope & Specifics |
|---|---|---|
| **Database Migration** | `alembic/versions/0010_seed_gics_sector_indexes_in_watchlist.py` | Seed 11 GICS sector ETFs (`XLK`, `XLF`, `XLV`, `XLE`, `XLI`, `XLC`, `XLY`, `XLP`, `XLB`, `XLU`, `XLRE`) and `SPY` into `watchlist` (`watchlistname = 'Indexes'`, `currency = 'USD'`). Seed `/research/sectors` node in `sitemap_node`. |
| **Backend Schemas** | `backend/schemas/committee.py`, `backend/schemas/portfolio.py`, `backend/schemas/research.py` | Add `fallback_warning: Optional[str] = None` across AI response schemas. Define `SectorPerformanceResponse`, `SectorRotationQuadrant`, `SectorNewsItem`, `SectorCommitteeResponse`. |
| **RSS Ingestion** | `backend/services/rss_service.py` | Implement `fetch_sector_rss_news(ticker, limit=5)` using standard library `urllib` and `xml.etree.ElementTree` with 5s timeout and empty-list fallback. |
| **Sector Performance** | `backend/repositories/research_repo.py`, `backend/api/v1/research.py` | Query `public.eoddata` for 11 sectors and `SPY`. Compute returns (`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`) and Relative Rotation Quadrants (`Leading`, `Improving`, `Weakening`, `Lagging`) based on RS and RS Momentum. |
| **Sector AI Committee** | `backend/services/agent_orchestrator.py`, `backend/services/prompt_builder.py`, `backend/repositories/committee_repo.py` | Author 4 sector analyst prompts (`technical`, `fundamental`, `macro`, `risk`) + `executive_summary`. Capture provider errors (e.g., `402 RESOURCE_EXHAUSTED`) into `fallback_warning`. Run 4 roles via `asyncio.gather` with Gemini Search Grounding and RSS news. Persist to `agent_committee_runs` / `agent_analyst_outputs`. |
| **Portfolio Backend** | `backend/repositories/portfolio_repo.py`, `backend/api/v1/portfolio.py` | Resolve default date from `max(date)` in `daily_portfolio_summary`. Change default timeframe to `6M`. Correct `Total Portfolio` formula to aggregate active positions market value. Compute holdings pie chart data as of target date. |
| **Batch Pipeline** | `main.py`, `run_sector_research.py` | Author `run_sector_research.py` to pre-generate committee research runs for 11 sectors post-EOD ingestion in `alpha-insight-daily-job`. |
| **Frontend Routing** | `frontend/src/App.tsx`, `frontend/src/components/layout/DynamicSidebar.tsx` | Wire `/research/sectors` route and add `By Industry / Sector` navigation node under Research. |
| **Frontend Types & API**| `frontend/src/types/api.ts`, `frontend/src/services/apiClient.ts` | Add TypeScript interfaces and API client methods (`getSectorPerformance`, `getSectorCommittee`, `refreshSectorCommittee`, `fallback_warning` fields). |
| **Sector Research View**| `frontend/src/components/research/IndustrySectorView.tsx` | Implement full view: GICS switcher, run stepper, model selector, heatmap grid, rotation quadrant card with formula popover, cited news panel, 4-analyst committee tabs, fallback warning banner, and `Reference in Note` button. |
| **Portfolio Overview** | `frontend/src/components/portfolio/PortfolioOverview.tsx` | Restructure into 2 columns (Left: Charts; Right: AI Commentary). Fold `Capital Adj` into `Capital`. Interactive Holdings Pie Chart as of `[date]`. Remove old headings. Move "Generate Commentary" to top bar. Add fallback warning banner. |
| **Research Views** | `frontend/src/components/research/AnalystCommitteeView.tsx`, `MacroeconomicsView.tsx` | Render `fallback_warning` banner with link to Google AI Studio when credits are depleted. |
| **Automated Tests** | `tests/backend/test_epic_1_1.py`, `tests/frontend/epic_1_1.test.tsx` | Comprehensive test suites for all 13 Success Criteria. |

---

## 2. Skill Allocation

- **`spec-orchestrator`**: Oversees architectural adherence, schema validation, and verification audits.
- **`logic-generator`** (Single-Engineering Thread Mode) OR specialized Swarm Workers (**`backend-worker`**, **`frontend-worker`**, **`test-worker`** coordinated by **`swarm-dispatcher`**): Executes database migrations, backend algorithms, API contracts, and frontend components.
- **`ui-ux-designer`**: Validates adherence to the Aptos White Paper design system, 2-column layout, and responsive matrix.
- **`deterministic-resolver`**: Drives the dual-gate protocol (Fast Targeted Gate during inner loop; Full CI-Parity Gate across the entire repository prior to handoff).

---

## 3. Engineering Standards & Quality Gates

1. **Anti-Fluff Standard**: Factual documentation, no buzzwords or marketing adjectives.
2. **Deterministic Fallback & Error Resilience**: All network operations (RSS fetching, LLM calls) have bounded timeouts and graceful fallbacks. If Gemini API credits are depleted, the system operates without crashing and surfaces an actionable alert banner.
3. **No Outer Shell Wrappers**: Direct execution of all commands (`uv run ruff`, `uv run pytest`, `npm test`) without `cmd /c`.
4. **Verification Protocol**:
   - **Fast Targeted Gate**: `uv run pytest tests/backend/test_epic_1_1.py` and `npm.cmd test tests/frontend/epic_1_1.test.tsx`.
   - **Full CI-Parity Gate**:
     - Tier 1: `uv run ruff check .` and `uv run ruff format --check .` (exit code 0).
     - Tier 2: `uv run mypy` (exit code 0).
     - Tier 3: `uv run pytest` and `npm.cmd test` across entire workspace (exit code 0).

---

## 4. Execution Mode Selection Gate (Rule 0)

In accordance with user rule Section 0, you must choose your desired execution mode before implementation begins:

- **[1] Single-Engineering Thread Mode (Default)**: Linear, single-agent execution using the unified `logic-generator` pipeline. Generates `tasklist.md` with continuous remark tracking.
- **[2] Swarm Mode**: Concurrently dispatched work streams using specialized swarm workers (`backend-worker`, `frontend-worker`, `test-worker`, coordinated by `swarm-dispatcher` through a 2-Phase Synchronization Barrier with frozen contracts and federated stream logs).
- **Default Fallback**: If no mode is specified (e.g. simply replying "proceed"), **Single-Engineering Thread Mode** will be adopted automatically.

---

## 5. Sign-off Request

Please review this Implementation Plan and confirm your approval by replying with:
- **"proceed"** (to adopt default **Single-Engineering Thread Mode**), OR
- **"proceed with Swarm Mode"** (to dispatch parallel specialized worker streams).