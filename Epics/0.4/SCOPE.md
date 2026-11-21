# Epic 0.4 Scope: Investment Notes & Agentic Capabilities

**Project**: Alpha_Insight  
**Target Milestone**: Epic 0.4  
**Status**: Scoped (Backlog)  

---

## 1. High-Level Scope Summary

Epic 0.4 focuses on institutional journal capabilities and autonomous agentic intelligence built on top of the Alpha_Insight data foundation and analysis engine:

### 1.1 Investment Notes Sub-Application
- **Structured Journaling**: Trade rationale documentation, thesis capture, post-trade analysis, and emotional/discipline tracking.
- **Entity Linking**: Direct bidirectional relational linking between notes and database entities:
  - Specific stock symbols (`AAPL`, `MSFT`, `NVDA`).
  - Specific executed trades (`trades.id`).
  - Specific portfolio benchmark periods and dates.
- **Rich Text & Artifact Attachment**: Markdown editor with math notation, image/chart snapshot embedding, and tagged metadata.
- **Search & Filter**: Full-text search, symbol filtering, date filtering, and thesis outcome tag audits (`Validated`, `Invalidated`, `In-Progress`).

### 1.2 Agentic Intelligence & Multi-Agent Committee
- **Autonomous Analyst Agents**:
  - Technical Analyst agent: Scans charts, price actions, and indicator patterns.
  - Fundamental Analyst agent: Synthesizes financial metrics, valuation multiples, and earnings reports.
  - Macro Strategist agent: Analyzes interest rate cycles, yield curves, and inflation data.
  - Risk Manager agent: Analyzes portfolio drawdown limits, margin exposure, and position sizing.
- **Multi-Agent Consensus Committee**:
  - Orchestrated debate between agents before trade entry or capital allocation.
  - Structured decision artifact with voting breakdown and risk caveats.
- **Autonomous Risk & Drift Audits**:
  - Scheduled background evaluations of portfolio health and stop-loss adherence.
  - Automated alert generation for margin call proximity and anomalous sector concentration.
