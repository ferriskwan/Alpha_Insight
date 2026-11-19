# Product Requirements Document (PRD) — Epic 0.4: Autonomous Committee, Macroeconomics, Investment Notes, Multi-Currency Ledger & Extensible Chart Settings

**Project**: Alpha_Insight  
**Milestone**: Epic 0.4 (Consolidated Release & Deliverable Review)  
**Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]`  
**Target Database**: `gen-lang-client-0632004807:asia-southeast1:clover` (`4leafclover_dev`)  
**Target Codebase Paths**:
- Backend: `backend/api/v1/`, `backend/services/`, `backend/repositories/`, `backend/schemas/`, `backend/db/models.py`, `alembic/versions/`
- Frontend: `frontend/src/components/research/`, `frontend/src/components/portfolio/`, `frontend/src/components/notes/`, `frontend/src/components/admin/`, `frontend/src/components/analyst/`, `frontend/src/design-system/`

---

## 1. Overview & Epic Scope

Epic 0.4 establishes the core quantitative research, multi-agent intelligence, portfolio ledger accuracy, and parameter configuration systems for the Alpha_Insight platform. It consolidates initial epics and all user deliverable review enhancements into seven cohesive workstreams:

1. **Autonomous 4-Analyst Committee & Historical Output Ledger**: Concurrent execution of segregated specialist agents (`Technical`, `Fundamental`, `Macro`, `Risk Mgt`) followed by `Executive Summary` consolidation and PostgreSQL historical trend tracking.
2. **Watchlist-Derived Macroeconomics Workbench**: Benchmark index canvas chart, live database FX, watchlist index snapshots, and three regional/thematic macro analyst tabs with Google Search grounding citations.
3. **Investment Notes Sub-Application**: Research thesis capture with watchlist ticker validation, 0..N linking to analyst committee outputs, and trade execution mapping.
4. **52-Week Fibonacci Technical Harmonization**: Aligning chart canvas overlays and agentic Technical Analyst prompts to the canonical 52-week High/Low cycle (`252` multi-day bars, `78` intraday bars).
5. **Transactions Multi-Currency Ledger**: Dedicated `CURRENCY` column sourced from `public.watchlist` and Option B table footers (USD Sub-Total, SGD Sub-Total, and Consolidated USD using previous-day exchange rates $\max(\text{date}) < \text{tradedate}$).
6. **Exchange Rate Ingestion Repair**: Removal of invalid future test records, `date <= CURRENT_DATE` boundary guard, 750 daily historical USD/SGD rates ingestion, and Windows SSL bypass fallback.
7. **Extensible Chart Settings (`JSONB`) & 4-Tier Parameter Store**: Evolution of `public.ref_chart_settings` from a rigid flat table to a PostgreSQL `JSONB` parameter store with partial unique constraints, 4-tier inheritance cascade (`user+symbol` $\to$ `user` $\to$ `symbol` $\to$ `global`), and zero-DDL extensibility.

---

## 2. Detailed Workstream Specifications

### Workstream 1: Autonomous 4-Analyst Committee & Historical Output Ledger
- **Model Engine**: Default model set to `gemini-4-argon` with multi-model selector supporting `gemini-4-carbon`, `gemini-4-hydrogen`, `gemini-3.8-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`, and Moonshot `kimi-k2-0711-preview`.
- **Segregated Concurrency**: Four domain specialist agents execute concurrently via `asyncio.gather` in isolated prompt contexts to eliminate confirmation bias.
- **Executive Summary Consolidation**: Synthesizes the 4 specialist outputs into directional consensus bias, confidence score, 1-sentence synthesis per role, and cross-analyst divergence summary.
- **Historical Output Ledger**: Persists outputs to `agent_committee_runs` and `agent_analyst_outputs`. On subsequent runs, analysts review prior outputs across all 4 roles to classify trend status (`Initiation`, `Continuation`, `Reversal`, `Gap`).
- **Interactive Canvas Charting**: Multi-day (default 6M/126 bars) and intraday (5m) interactive candlestick chart with Bollinger Bands (`2px` `#7C3AED`), RSI (`3px` `#7C3AED`), MACD (`3px` `#1D4ED8`/`#D97706`), and 52-week Fibonacci retracements.
- **Contextual Floating Chat**: Drag-to-resize, persistent chat session window (`FloatingAgentChat`) anchored to active route and symbol, stored in `agent_chat_messages`.

### Workstream 2: Watchlist-Derived Macroeconomics Workbench (`/research/macro`)
- **Navigation Harmonization**: Permanently removed `"By Industry/Sector"` and `"Stock Analyst"`; `[Research]` contains `Stock Analysis` (`/research/committee`) and `Macroeconomics` (`/research/macro`).
- **Componentized Output Panel**: Reusable `AnalystOutputPanel` shared across Stock Analysis and Macroeconomics.
- **Benchmark Index Canvas Chart**: Interactive canvas chart switching between `^SPX`, `^NDX`, `^DJI`, `^STI`, `SOXX`, and `IBIT`.
- **Live FX & Watchlist Snapshot**: Live rates from `public.exchange_rate` and latest market closes from `public.eoddata`.
- **3 Specialist Macro Tabs**:
  1. *Global & US Macro*: Fed funds rate, US Treasury yield curve (1M to 30Y), inflation, GDP, and US watchlist equity impacts.
  2. *SG & Asia-Pacific Macro*: MAS S$NEER, SORA, SGS yields, PBoC/HKMA policies, China credit impulse, Bank of Japan rates/JGBs, yen carry spillovers, and Asia-Pacific watchlist exposures (`D05.SI`, `BN4.SI`, `5E2.SI`, `S58.SI`, `S61.SI`, `^STI`, `TSM`).
  3. *Secular & Geopolitics*: Hyperscaler AI CapEx, semiconductor supply chain, export tariffs, and thematic holdings (`NVDA`, `ASML`, `MU`, `TSM`, `GLW`, `SOXX`, `AMZN`, `GOOG`, `META`, `XE`, `IBIT`, `AA`).
- **Google Search Grounding & Mandatory Citations**: Inline Markdown citations `[Source Name](https://...)` for all factual claims, ending with `### Verified Sources & Citations`.

### Workstream 3: Investment Notes Sub-Application (`/notes`)
- **Watchlist Ticker Validation**: Ticker symbols selectable in Investment Notes are validated against `public.watchlist`.
- **0..N Relational Entity Linking**: Each note can link to `0..N` records from `agent_analyst_outputs` via `investment_note_analyst_links`.
- **Trade & Thesis Tracking**: Link to executed trades (`trade.id`), Markdown editor with KaTeX math rendering, thesis status tracking (`In-Progress`, `Validated`, `Invalidated`), and full-text search.

### Workstream 4: 52-Week Fibonacci Technical Harmonization
- **Lookback Window Standardization**: Aligned `InteractiveCanvasChart.tsx` and `committee_repo.py` to the 52-week High/Low cycle:
  - Multi-day lookback: `252` trading bars (1 full trading year).
  - Intraday lookback: `78` bars (6.5 hours of 5-minute bars).
- **Configuration Persistence**: Persisted in `public.ref_chart_settings` and exposed for institutional adjustment in `RefDataEditor.tsx`.

### Workstream 5: Transactions Multi-Currency Ledger Accuracy (`/portfolio/transactions`)
- **Dedicated Currency Column**: Added `CURRENCY` column immediately right of `ACCOUNT` in `TransactionsView.tsx`, populated from `public.watchlist` with visual badges (`USD` in slate, `SGD` in blue).
- **Option B Aggregations Table Footer**:
  - Row 1: `USD SUB-TOTAL` (Buy/Sell quantities, considerations in `$`, realized PnL).
  - Row 2: `SGD SUB-TOTAL` (Buy/Sell quantities, considerations in `S$`, realized PnL).
  - Row 3: `CONSOLIDATED TOTAL (USD)` (Converted considerations and realized PnL using the previous-day exchange rate).
- **Previous-Day Exchange Rate Formula**: For each transaction executed on `tradedate`, lookup the exchange rate at $\text{date} = \max(\text{date}) < \text{tradedate}$ from `public.exchange_rate` (`base_currency='USD'`, `currency=symbol_currency`).

### Workstream 6: Exchange Rate Ingestion Repair & Protection
- **Future Date Guard**: Purged invalid test record `2027-07-13` and added defensive guard `ExchangeRate.date <= func.current_date()` in `backend/api/v1/dataops.py`.
- **Historical Rate Seeding**: Ingested 750 daily historical USD/SGD rates from `2024-01-01` to `2026-11-19` into `public.exchange_rate`.
- **Windows SSL Compatibility**: Added `curl_cffi` fallback in `marketdata.py` to bypass Windows Python 3.14 `CertificateVerifyError` when retrieving Yahoo Finance market data.

### Workstream 7: Extensible Chart Settings (`JSONB`) & 4-Tier Parameter Store
- **Database Schema Evolution**:
  ```sql
  CREATE TABLE public.ref_chart_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
      symbol VARCHAR(16),
      parameters JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
- **Physical Uniqueness Enforcement**:
  - `UNIQUE (user_id, symbol) WHERE user_id IS NOT NULL AND symbol IS NOT NULL`
  - `UNIQUE (user_id) WHERE user_id IS NOT NULL AND symbol IS NULL`
  - `UNIQUE (symbol) WHERE user_id IS NULL AND symbol IS NOT NULL`
  - `CREATE UNIQUE INDEX uq_ref_chart_settings_global ON public.ref_chart_settings ((1)) WHERE user_id IS NULL AND symbol IS NULL`
- **Data Migration & Deduplication**:
  - Remove duplicate row `id=2`.
  - Migrate flat column values from `id=1` into structured JSONB `parameters`:
    ```json
    {
      "moving_averages": { "sma_period": 30, "ema_period": 100 },
      "bollinger_bands": { "period": 30, "std_dev": 2.0 },
      "rsi": { "period": 13, "overbought": 70.0, "oversold": 30.0 },
      "macd": { "fast": 12, "slow": 26, "signal": 9 },
      "fibonacci": { "lookback_bars": 252, "intraday_bars": 78 }
    }
    ```
  - Drop obsolete flat columns.
- **4-Tier Cascade with Deep Merge**:
  - Tier 1: User + Symbol Override (`user_id = X, symbol = S`)
  - Tier 2: User Default (`user_id = X, symbol = NULL`)
  - Tier 3: Symbol Preset (`user_id = NULL, symbol = S`)
  - Tier 4: Global Baseline (`user_id = NULL, symbol = NULL`)
  - Partial overrides merge on top of the baseline without duplicating unedited parameters.
- **API & UI Alignment**:
  - Correct client endpoint in `apiClient.ts` to `/api/v1/admin/ref-data/chart-settings`.
  - Update `RefDataEditor.tsx` to bind to the structured JSON schema.

---

## 3. Success Criteria (Consolidated Audit Matrix)

| ID | Success Criteria Description | Verification Method |
| :--- | :--- | :--- |
| **SC-01** | Default AI model set to `gemini-4-argon` with multi-model dropdown selection. | API inspection & UI test |
| **SC-02** | 4 segregated specialist agents execute concurrently with unbiased isolated contexts. | Backend pytest & log inspection |
| **SC-03** | Executive Summary synthesizer consolidates consensus bias, votes, and divergences. | Backend pytest & committee run |
| **SC-04** | Historical outputs persisted in PostgreSQL and used for trend/reversal classification. | Database queries & UI verification |
| **SC-05** | High-impact white-paper chart overlays (BB `2px`, RSI `3px`, MACD `3px`, 6M default). | Visual inspection & Vitest |
| **SC-06** | Top bar persistent floating chat session (`FloatingAgentChat`) anchored to active run. | UI interaction & test |
| **SC-07** | Investment Notes enforces `public.watchlist` validation and `0..N` analyst links. | CRUD API test & UI form |
| **SC-08** | Permanent removal of `"Stock Analyst"` and `"By Industry/Sector"` from navigation. | Site map audit test |
| **SC-09** | Componentized `AnalystOutputPanel` shared across Stock Analysis and Macroeconomics. | Component reuse audit |
| **SC-10** | Watchlist-derived Macroeconomics workbench with 3 specialist tabs & Google citations. | Grounding link verification |
| **SC-11** | 52-week Fibonacci harmonized (`252` bars multi-day, `78` bars intraday) across chart & AI. | Calculation parity test |
| **SC-12** | Dedicated `CURRENCY` column displayed in `[Transactions]` table. | UI component test |
| **SC-13** | Option B footer displays USD Sub-Total, SGD Sub-Total, and Consolidated USD total. | Dual-ledger calculation test |
| **SC-14** | Previous-day FX rate $\max(\text{date}) < \text{tradedate}$ applied for currency conversions. | Math verification & test |
| **SC-15** | `public.exchange_rate` table seeded with 750 historical USD/SGD rates and future date guard. | Database count & query test |
| **SC-16** | `ref_chart_settings` migrated to `JSONB` parameter store with 4-tier deep merge and unique indexes. | Alembic migration & repository test |
