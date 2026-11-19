# Technical Specification — Epic 0.4 Architecture & Systems

**Project**: Alpha_Insight  
**Milestone**: Epic 0.4  
**Path**: `docs/epic_0.4/technical_specification.md`  

---

## 1. Multi-Agent Orchestration Architecture

```
                    +-----------------------------+
                    |    Client Committee Call    |
                    | POST /api/v1/committee/run  |
                    +-----------------------------+
                                   |
                                   v
                    +-----------------------------+
                    | agent_orchestrator.py       |
                    | (gemini-4-argon default)    |
                    +-----------------------------+
                                   |
               +-------------------+-------------------+
               |                   |                   |                   |
               v                   v                   v                   v
      +-----------------+ +-----------------+ +-----------------+ +-----------------+
      | Technical Agent | | Fundamental Agt | |   Macro Agent   | | Risk Mgt Agent  |
      | (52w Fib, BB,   | | (Catalyst Scan, | | (Yield Curve,   | | (Cost Basis,    |
      |  RSI, MACD)     | |  Valuation)     | |  GICS Sectors)  | |  Stop Loss)     |
      +-----------------+ +-----------------+ +-----------------+ +-----------------+
               |                   |                   |                   |
               +-------------------+-------------------+-------------------+
                                   |
                                   v
                    +-----------------------------+
                    | Executive Summary           |
                    | Synthesizer                 |
                    +-----------------------------+
                                   |
                                   v
                    +-----------------------------+
                    | PostgreSQL Persistence      |
                    | - agent_committee_runs      |
                    | - agent_analyst_outputs     |
                    +-----------------------------+
```

---

## 2. Parameter Store Schema & Resolution Architecture

### 2.1 Target Schema (`public.ref_chart_settings`)
```sql
CREATE TABLE public.ref_chart_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    symbol VARCHAR(16),
    parameters JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial Unique Constraints
CREATE UNIQUE INDEX uq_ref_chart_settings_user_symbol 
    ON public.ref_chart_settings (user_id, symbol) 
    WHERE user_id IS NOT NULL AND symbol IS NOT NULL;

CREATE UNIQUE INDEX uq_ref_chart_settings_user_default 
    ON public.ref_chart_settings (user_id) 
    WHERE user_id IS NOT NULL AND symbol IS NULL;

CREATE UNIQUE INDEX uq_ref_chart_settings_symbol_preset 
    ON public.ref_chart_settings (symbol) 
    WHERE user_id IS NULL AND symbol IS NOT NULL;

CREATE UNIQUE INDEX uq_ref_chart_settings_global_default 
    ON public.ref_chart_settings ((1)) 
    WHERE user_id IS NULL AND symbol IS NULL;
```

### 2.2 Canonical JSON Schema Structure
```json
{
  "moving_averages": {
    "sma_period": 30,
    "ema_period": 100
  },
  "bollinger_bands": {
    "period": 30,
    "std_dev": 2.0
  },
  "rsi": {
    "period": 13,
    "overbought": 70.0,
    "oversold": 30.0
  },
  "macd": {
    "fast": 12,
    "slow": 26,
    "signal": 9
  },
  "fibonacci": {
    "lookback_bars": 252,
    "intraday_bars": 78
  }
}
```

### 2.3 4-Tier Inheritance Cascade
```
Resolution Priority:
Tier 1: user_id = :user_id AND symbol = :symbol
Tier 2: user_id = :user_id AND symbol IS NULL
Tier 3: user_id IS NULL     AND symbol = :symbol
Tier 4: user_id IS NULL     AND symbol IS NULL (Global Baseline)

Merge Order: Tier 4 -> Overlay Tier 3 -> Overlay Tier 2 -> Overlay Tier 1
```

---

## 3. Multi-Currency Transactions Ledger Architecture

### 3.1 Exchange Rate Ingestion & Lookup
- Source: Yahoo Finance (`SGD=X` for `base_currency='USD', currency='SGD'`).
- Guard: `date <= CURRENT_DATE`.
- Previous-day lookup formula:
  $$\text{FX}(\text{trade}) = \text{rate at } \max(\text{date}) < \text{trade.tradedate}$$
- Conversion formula:
  $$\text{Consideration}_{USD} = \frac{\text{Consideration}_{SGD}}{\text{FX}}$$

### 3.2 Dual Subtotals and USD Consolidation (Option B)
- Table Footer Rows:
  1. `USD SUB-TOTAL`: Explicit sum across trades where `currency = 'USD'`.
  2. `SGD SUB-TOTAL`: Explicit sum across trades where `currency = 'SGD'`.
  3. `CONSOLIDATED TOTAL (USD)`: Sum across all trades converted to USD via each trade's previous-day FX rate.
