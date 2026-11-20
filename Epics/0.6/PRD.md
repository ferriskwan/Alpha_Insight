# Product Requirements Document (PRD) — Epic 0.6: Portfolio Overview Upgrade

**Project**: Alpha_Insight  
**Milestone**: Epic 0.6  
**Status**: Draft for User Sign-off  
**Scope Classification**: `[SCOPE: MAJOR_ARCHITECTURAL]` (Batch pipeline sanitization, new API contracts, time-series data aggregation across `daily_portfolio_summary`, `position`, `trade`, and `agent_analyst_outputs`)

---

## 1. Executive Summary & Objective

Epic 0.6 replaces the static mockup in `frontend/src/components/portfolio/PortfolioOverview.tsx` with a fully interactive, production-grade financial dashboard. The view integrates parameters for Date, Currency, and Amount/Percentage toggle, provides 6 metric badges with rollover formula explanations, renders two synchronized time-series charts (Portfolio Size/Capital/Margin and Total vs. Stock-level PnL), and incorporates a 4-quadrant AI commentary engine covering Technical, Fundamental, Macro, and Risk Management analysis.

---

## 2. Current State Analysis & Defect Remediation

### 2.1 Current State
- `PortfolioOverview.tsx` renders hardcoded SVG polyline coordinates (`points="0,170 80,150..."`) and fallback constants instead of dynamic chart data.
- The backend repository function `get_portfolio_4chart_overview` uses synthetic SPY calculations and does not expose individual stock PnL time-series.
- `daily_portfolio_summary` aggregates at the portfolio level; it lacks per-symbol time-series tracking.

### 2.2 Data Defect Remediation
- **Defect**: Recent USD rows in `public.daily_portfolio_summary` contain `NaN` in `position_market_value`, `unrealized_pnl`, `total_asset_value`, and `total_pnl` (e.g. for date `2026-11-18`).
- **Root Cause**: Tickers `IBIT` and `GLW` have `NaN` values for `eodprice` in `public.position` on `2026-11-17`. `SUM(quantity * eodprice)` in PostgreSQL propagates `NaN` across the aggregate.
- **Fix**:
  1. In `run_mark_to_market.py`: sanitize `eodprice` using `COALESCE(NULLIF(eodprice, 'NaN'::float), previous_valid_close)`.
  2. In `run_portfolio_summary.py`: sanitize position aggregates against `NaN` inputs.

### 2.3 Database Level Impact & Migration Strategy
- **DDL Schema Alterations**: **None required**.
  - All requisite reporting tables (`daily_portfolio_summary`, `position`, `trade`, `agent_analyst_outputs`, `sysvalue`, `exchange_rate`) already exist with the required columns.
  - No new tables, altered constraints, or modified column types are needed.
- **DML Data Seeding (Alembic Migration `0009`)**:
  - Requires inserting a configuration record into `public.sysvalue`:
    - `name`: `'DEFAULT_CURRENCY'`
    - `strvalue`: `'SGD'`
    - `updatetimestamp`: `CURRENT_TIMESTAMP`
  - Packaged into an idempotent Alembic migration (`0009_seed_default_currency_sysvalue.py`) so the Cloud Run CI/CD deployment pipeline automatically applies it across development (`4leafclover_dev`) and production (`4leafclover`).

### 2.4 Stock Analysis Defect & Synthetic Mock Data Elimination
- **Defect 1 (UI Desynchronization)**: In `Stock Analysis` (`/research/committee`), the symbol dropdown displays the first watchlist symbol (e.g. `5E2.SI - Seatrium Ltd.`), but the chart header reads `Interactive Canvas Chart — AAPL`, and queries `AAPL`.
  - **Root Cause**: `AnalystCommitteeView.tsx` and `App.tsx` hardcoded `'AAPL'` as initial state. When the actual watchlist items (`wlItems`) loaded, `selectedSymbol` was not updated to `wlItems[0].symbol`. Since `'AAPL'` was not an option in the `<select>` element, the browser rendered the first option (`5E2.SI`) visually while React state queried `'AAPL'`.
- **Defect 2 (Fabricated Candlesticks)**: When `AAPL` had no data in `public.eoddata`, `backend/repositories/research_repo.py` generated 30 days of synthetic mock candles with sine wave oscillations around base price $180.
  - **Remediation**: Eliminate all synthetic mock candle generators from `backend/repositories/research_repo.py` (lines 291-307, 402-419, 450-464). If no rows exist for a symbol, return an empty list `[]`. The UI must render a clean, reflective blank state ("No price series data available for Canvas Chart") instead of fake prices.
  - **Watchlist Synchronization**: `AnalystCommitteeView.tsx` and `App.tsx` must dynamically initialize `selectedSymbol` to the first available ticker in the user's fetched watchlist (e.g. `5E2.SI`). If the watchlist is empty, display a clean blank state. Eliminate mock fallback watchlists (`AAPL`, `NVDA`).

---

## 3. Scope & Functional Requirements

### 3.1 Parameters Bar
The top control bar must provide:
1. **Date Selector**:
   - Snapshot date selection defaulted to `GLOBAL_TODAY` (`2026-11-18`).
   - Restricts data queries and badge valuations to the selected date.
2. **Amount / % Toggle Switch**:
   - Segmented toggle (`[$] Amount` vs. `[%] Percentage`).
   - Toggling switches badge figures between currency values and percentage values.
   - Toggling switches chart Y-axes between raw currency ($) and percentage changes (%).
3. **Currency Selector**:
   - Selector pills for `USD`, `SGD`, and `HKD`.
   - Initial default value is dynamically resolved from `public.sysvalue` where `name = 'DEFAULT_CURRENCY'` (seeded with value `'SGD'`).
   - Converts foreign currency positions, cash, and loans to the target base currency using `public.exchange_rate`.

---

### 3.2 Metric Badges (KPI Grid)
Six badges rendered in a responsive grid. Each badge displays the metric in dollar amount or percentage based on the global toggle, and includes a rollover/tooltip displaying the exact calculation formula:

| Badge | Amount Metric | Percentage Metric | Rollover Tooltip Formula |
| :--- | :--- | :--- | :--- |
| **1. Realized PnL** | `realized_pnl` | `(realized_pnl / total_capital) * 100` | `Cumulative realized gains from closed trades / Total capital injected` |
| **2. Unrealized PnL** | `unrealized_pnl` | `(unrealized_pnl / total_capital) * 100` | `Current open positions mark-to-market gain / Total capital injected` |
| **3. Total PnL** | `total_pnl` | `(total_pnl / total_capital) * 100` | `(Realized PnL + Unrealized PnL - Cumulative Interest) / Total Capital` |
| **4. Capital** | `total_capital` | `(total_capital / total_asset_value) * 100` | `Net capital injected / Total asset value (Equity ratio)` |
| **5. Margin** | `margin_loan_balance` | `(margin_loan_balance / total_capital) * 100` | `Drawn margin loan balance / Total capital (Leverage ratio)` |
| **6. Total Portfolio** | `total_asset_value` | Period return % over selected timeframe | `Total portfolio asset value (Capital + Positions + Realized PnL) / Period % Return` |

---

### 3.3 Time Series Charts

#### Timeframe Selector
Pill control allowing selection across:
- `1M` (30 calendar days)
- `3M` (90 calendar days)
- `6M` (180 calendar days)
- `12M` (365 calendar days)

#### Chart 1: Total Portfolio Size, Capital, and Margin Over Time
- **Data Source**: `public.daily_portfolio_summary` (filtered by user, date range, and currency).
- **Series**:
  1. `Total Portfolio Size`: `total_asset_value`.
  2. `Capital`: `total_capital`.
  3. `Margin`: `margin_loan_balance`.
- **Display Modes**:
  - `Amount Mode`: Displays values in target currency ($).
  - `% Mode`: Normalized percentage growth/change indexed from the start of the selected timeframe (Base = 0% or 100%).
- **Interactions**: Shared cursor crosshair displaying exact date, portfolio size, capital, and margin values.

#### Chart 2: PnL Over Time (Total Portfolio vs. Top Stocks)
- **Data Source**:
  - Total Portfolio PnL: `daily_portfolio_summary.total_pnl`.
  - Individual Stock PnL: Derived from `public.position` (`quantity * (eodprice - avgprice)`) and `public.trade` (realized gains).
- **Visualization (Option A)**:
  - Multi-line chart featuring:
    1. Primary line: Total Portfolio PnL.
    2. Distinct colored lines for top N active stocks (ranked by absolute PnL or position weight).
  - Interactive legend with toggle switches enabling the user to show or hide individual stock lines.
- **Display Modes**:
  - `Amount Mode`: Dollar PnL per series.
  - `% Mode`: Return percentage per series (`(P - Cost) / Cost * 100`).

---

### 3.4 AI Commentaries Engine
A dedicated 4-quadrant panel summarizing portfolio-level intelligence:
1. **`[Technical]`**: Trend direction, momentum, moving average status, and overbought/oversold levels across top portfolio holdings.
2. **`[Fundamental]`**: Valuation levels, portfolio sector distribution, and dividend contributions.
3. **`[Macro]`**: Interest rate sensitivity, inflation impact, and FX exposure (USD vs. SGD).
4. **`[Risk Management]`**: Margin loan utilization, leverage health, portfolio beta, and peak drawdown metrics.

#### Operational Workflow:
- **On-Demand Generation**: Triggered via a **"Refresh AI Commentary"** button.
- **Backend Orchestration**:
  1. Extracts latest structured metrics from `public.agent_analyst_outputs` for active portfolio symbols.
  2. Extracts current portfolio metrics (`NAV`, `Margin`, `Realized/Unrealized PnL`, `Asset Allocation`).
  3. Submits consolidated payload to Gemini prompt builder.
  4. Returns structured JSON containing markdown and key takeaways for all 4 quadrants.
- **Caching**: Commentary is cached in database/memory keyed by `(user_id, date, currency)` to prevent redundant API calls.

### 3.5 Stock Analysis Data Grounding & Blank State Mandate
- **Complete Elimination of Fabricated Data**: No endpoint or component in Alpha_Insight may generate synthetic candlestick series or mock watchlists.
- **Dynamic Watchlist Initialization**: The initial active symbol must dynamically resolve to the user's first available watchlist ticker (e.g. `5E2.SI`), ensuring UI controls, chart titles, and backend queries remain synchronized.
- **Reflective Blank State**: If a symbol has no historical EOD or intraday records in the database, the chart component must render a clean, reflective blank state ("No price series data available for Canvas Chart") instead of fake candles.

---

## 4. API Endpoints Contract

### 4.1 GET `/api/v1/portfolio/overview`
**Query Parameters**:
- `currency` (string, default: `"USD"`): Target base currency.
- `date` (string, optional): Snapshot date (YYYY-MM-DD). Defaults to latest date.
- `timeframe` (string, default: `"12M"`): `"1M"`, `"3M"`, `"6M"`, `"12M"`.

**Response Schema (`PortfolioOverviewResponse`)**:
```json
{
  "parameters": {
    "currency": "USD",
    "selectedDate": "2026-11-18",
    "timeframe": "12M"
  },
  "kpis": {
    "realizedPnL": 8450.20,
    "realizedPnLPct": 11.23,
    "unrealizedPnL": 16130.25,
    "unrealizedPnLPct": 21.44,
    "totalPnL": 24580.45,
    "totalPnLPct": 32.67,
    "capital": 75240.00,
    "capitalPct": 75.38,
    "margin": 24560.00,
    "marginPct": 32.64,
    "totalPortfolio": 99800.45,
    "totalPortfolioPct": 18.40
  },
  "chart1_portfolio_capital_margin": [
    {
      "date": "2026-01-02",
      "portfolioSize": 85000.00,
      "portfolioSizePct": 0.0,
      "capital": 70000.00,
      "capitalPct": 0.0,
      "margin": 15000.00,
      "marginPct": 0.0
    }
  ],
  "chart2_pnl_breakdown": {
    "portfolio": [
      { "date": "2026-01-02", "pnl": 500.00, "pnlPct": 0.71 }
    ],
    "stocks": {
      "AAPL": [
        { "date": "2026-01-02", "pnl": 350.00, "pnlPct": 1.20 }
      ],
      "D05.SI": [
        { "date": "2026-01-02", "pnl": 150.00, "pnlPct": 0.50 }
      ]
    }
  }
}
```

### 4.2 GET `/api/v1/portfolio/overview/commentary`
**Query Parameters**:
- `currency` (string, default: `"USD"`)
- `date` (string, optional: YYYY-MM-DD)

**Response Schema**:
```json
{
  "cached": true,
  "lastUpdated": "2026-11-19T14:00:00Z",
  "commentaries": {
    "technical": {
      "title": "Technical Posture",
      "status": "Bullish",
      "content": "Core holdings maintain upward momentum above 50-day moving averages..."
    },
    "fundamental": {
      "title": "Fundamental Analysis",
      "status": "Neutral",
      "content": "Valuations remain fair with solid free cash flow yields in banking..."
    },
    "macro": {
      "title": "Macroeconomic Context",
      "status": "Caution",
      "content": "Yield curve flattening poses duration sensitivity on margin costs..."
    },
    "risk": {
      "title": "Risk Management",
      "status": "Healthy",
      "content": "Margin utilization stands at 32.6%, well below the 60% liquidation threshold..."
    }
  }
}
```

### 4.3 POST `/api/v1/portfolio/overview/commentary/refresh`
Triggered by the UI button. Recomputes synthesis using Gemini and updates the cache.

---

## 5. Success Criteria

- **SC-1**: Top bar parameters (Date, Currency, Amount/%) immediately re-render badges and charts with zero console errors.
- **SC-2**: All 6 KPI badges correctly display both dollar values and percentages according to the global toggle, and expose hover rollover tooltips displaying the exact calculation formula.
- **SC-3**: `Chart 1` plots dynamic time-series curves for Portfolio Size, Capital, and Margin over 1M, 3M, 6M, and 12M windows in both currency and percentage modes.
- **SC-4**: `Chart 2` plots Total Portfolio PnL alongside individual stock PnL curves (Option A) with functioning interactive line toggles.
- **SC-5**: Cursors across Chart 1 and Chart 2 remain synchronized on mouse hover.
- **SC-6**: AI Commentary panel renders 4 distinct quadrants ([Technical], [Fundamental], [Macro], [Risk Mgt]) with working manual refresh and caching.
- **SC-7**: Database and batch pipeline sanitization prevents `NaN` values from propagating into `public.daily_portfolio_summary`.
- **SC-8**: `public.sysvalue` contains seeded `DEFAULT_CURRENCY = 'SGD'`, and the Currency dropdown selector defaults to `'SGD'` on initial application load.
- **SC-10**: Stock Analysis (`/research/committee`) removes hardcoded `'AAPL'` defaults and mock watchlists; it initializes dynamically to the user's first active watchlist symbol (e.g. `5E2.SI`), aligning dropdown selection with chart rendering.
- **SC-11**: Backend `research_repo.py` eliminates all synthetic candlestick generators; symbols without historical data return an empty series `[]` and render a clean reflective blank state in `InteractiveCanvasChart`.
- **SC-9**: Full CI Parity Gate passes cleanly across the workspace root with exit code 0 (`uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy`, `uv run pytest`, `npx vitest run`).
