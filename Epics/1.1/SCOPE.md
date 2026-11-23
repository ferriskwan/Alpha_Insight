# Epic 1.1 — Scope Document: By Industry / Sector Research

**Status:** Draft (Future Epic — Deferred from 1.0.1)

---

## Objective
Build the `[Research] -> [By Industry/Sector]` page and its supporting backend research pipeline to:
1. Maintain a user-curated list of **industries and sectors of interest**.
2. Map each industry/sector to **proxy indexes, ETFs, and market indicators** (tracked in `eoddata` / `watchlist`).
3. Periodically run automated and on-demand **sector research** that combines:
   - Quantitative analysis of proxy index/ETF market data (returns, relative strength, trend/volatility across horizons).
   - Extraction and synthesis of publications and articles from reliable news/research sources with citations.
4. Persist historical research runs for trend comparison and allow referencing outputs in `Investment Notes`.

---

## Agent Architecture Assessment
- **Existing Agents (`backend/services/agent_orchestrator.py`)**:
  - Single-stock 4-Analyst Committee (`technical`, `fundamental`, `macro`, `risk`)
  - Macroeconomics 3-Dimension Strategist (`macro_us`, `macro_apac`, `macro_secular`)
  - Portfolio Overview 4-Quadrant Commentary
- **Gap**: No dedicated Industry/Sector Research Agent exists today.
- **Recommended Approach (Produce a Dedicated Sector Research Agent on Existing Orchestrator Infrastructure)**:
  - Add a new **Sector/Industry Research Agent** inside `backend/services/agent_orchestrator.py` and `backend/services/prompt_builder.py` (reusing the existing `gemini-4-argon` / Kimi client, structured output parser, `agent_committee_runs` / `agent_analyst_outputs` persistence, and `Investment Notes` linking).
  - Equip the agent with:
    1. **Market Data Context**: Computed multi-horizon returns, relative strength vs benchmark, and technical regime from `eoddata` for each sector's proxy indexes/ETFs.
    2. **Reliable News & Publication Retrieval**: Grounded web search (Gemini Google Search grounding) and/or curated financial news/RSS sources, returning explicit source URLs, publication dates, and key takeaways.
    3. **Periodic Execution**: Triggerable both on-demand from `[Research] -> [By Industry/Sector]` and on a recurring schedule (e.g., weekly/daily Cloud Run Job).

---

## Initial Scope Breakdown (To Be Refined in Epic 1.1 Discovery)
1. **Sector & Proxy Configuration**:
   - Database table(s) for user-defined industries/sectors, proxy tickers/indexes, indicators, and preferred news sources.
   - Admin / UI management to add, edit, or remove sectors and their proxy symbols.
2. **Market Data Ingestion & Metrics**:
   - Ensure configured proxy indexes/ETFs are included in the daily EOD ingestion pipeline (`eoddata`).
   - Expand `GET /api/v1/research/sectors` to compute multi-horizon performance (`1D`, `1W`, `1M`, `3M`, `6M`, `1Y`) and relative strength from actual `eoddata`.
3. **Sector Research Agent**:
   - New agent role(s) in `agent_orchestrator.py` / `prompt_builder.py` combining proxy market data + reliable news/publication extraction with citations.
   - Periodic scheduled run support + historical run comparison.
4. **Frontend Page (`[Research] -> [By Industry/Sector]`)**:
   - Dedicated view wired in `frontend/src/App.tsx` (replacing the current fallback to `<PortfolioOverview />`).
   - Sector/industry list with proxy index performance cards/heatmap, latest agent research brief with cited publications, run history, and `Reference in Note` button.
