"""Multi-horizon quantitative analysis and 4-Analyst Committee prompt builders.

References and expands upon C:\\Users\\ferri\\OneDrive\\Documents\\AlphaInsight\\src\\lib\\promptBuilder.ts
into four segregated specialist prompts (Technical, Fundamental, Macro, Risk), an Executive Summary
synthesizer, and a live screen-contextual interactive Q&A prompt builder.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from backend.schemas.analysis import AnalysisModulesConfig


def format_historical_outputs_block(past_outputs: list[dict[str, Any]]) -> str:
    """Format stored historical outputs from all 4 analyst roles for trend/reversal comparison."""
    if not past_outputs:
        return (
            "HISTORICAL ANALYST OUTPUT LEDGER:\n"
            "No prior stored analyst outputs exist for this symbol. "
            "Classify Trend Status as 'Initiation'."
        )

    lines = [
        "HISTORICAL ANALYST OUTPUT LEDGER (Prior Runs Across All 4 Analyst Roles):",
        "Use these past outputs to spot trend continuations, trend reversals, or thesis gaps:",
    ]
    for item in past_outputs:
        out_id = item.get("id", "N/A")
        role = item.get("analyst_role", "unknown")
        bias = item.get("directional_bias", "Neutral")
        conf = item.get("confidence_score", 50)
        trend = item.get("trend_status", "Initiation")
        created = item.get("created_at", "")
        headline = item.get("summary_headline", "")
        lines.append(
            f"- [Output #{out_id} | {created} | Role: {role} | Bias: {bias} ({conf}%) | "
            f"Prior Trend: {trend}]: {headline}"
        )
    return "\n".join(lines)


def build_technical_analyst_prompt(
    symbol: str,
    market_context: dict[str, Any],
    past_outputs: list[dict[str, Any]],
) -> str:
    """Construct segregated prompt for the Technical Analyst agent.

    Incorporates deterministic indicator fidelity, timeframe hierarchy, pattern discipline,
    intraday microstructure (5m ATR, session VWAP, execution friction), and historical ledger audit.
    """
    history_block = format_historical_outputs_block(past_outputs)
    context_json = json.dumps(market_context, indent=2, default=str)

    return (
        f"# Role & Strict Segregation Mandate\n"
        f"You are the **Technical Analyst** on the Alpha_Insight 4-Analyst Committee evaluating **{symbol}**.\n"
        f"You operate strictly independently of the current run's Fundamental, Macro, and Risk analysts. "
        f"Base your analysis **exclusively** on the pre-computed Python metrics, market data, and Historical Ledger "
        f"provided below.\n\n"
        f"# Analytical & Anti-Hallucination Guardrails\n"
        f"1. **Strict Grounding & Parameter Fidelity:** All technical indicators are deterministically pre-computed "
        f"by the backend. Do **not** recalculate indicators from raw price arrays, and do **not** assume standard "
        f"default periods. Always cite the exact parameter configurations (lookback periods, standard deviations, "
        f"thresholds) and values present in `context_json`.\n"
        f"2. **Timeframe Hierarchy & Bias Calibration:**\n"
        f"   - **Primary Bias (`DIRECTIONAL_BIAS`):** Governed strictly by the **EOD Swing Horizon** "
        f"(moving averages, momentum, EOD price structure, and Fibonacci levels).\n"
        f"   - **Tactical Conviction (`CONFIDENCE_SCORE`):** Modulated by **Intraday Microstructure** "
        f"(session VWAP alignment, liquidity, and 5m ATR vs. execution friction). "
        f"Penalize confidence by 15–25 points if intraday regime contradicts EOD bias.\n"
        f"3. **Strict Pattern Discipline:** Do not force-fit geometric patterns (Flags, Wedges, Double Tops/Bottoms) "
        f"onto noisy price action. If no clear structure meets strict criteria, explicitly state: "
        f'*"No high-probability geometric pattern present."*\n'
        f"4. **Missing Data & Cold-Start Rule:** If a metric or execution-cost input is absent from `context_json`, "
        f"explicitly note it as unavailable rather than estimating. If `history_block` is empty or indicates no "
        f"prior runs, you MUST set `TREND_STATUS: Initiation` and document the absence of prior baseline records.\n\n"
        f"# Domain Scope\n\n"
        f"### 1. Intraday Microstructure & Execution Friction (Intraday Horizon)\n"
        f"- **Friction Viability:** Compare pre-computed `atr_14_5m` against provided execution friction metrics "
        f"(spread, slippage, commission) in `intraday_microstructure`. Flag if friction materially erodes range.\n"
        f"- **Liquidity & Volatility Regime:** Screen volume consistency for liquidity gaps and evaluate "
        f"the classified volatility regime (**Trending**, **Mean-Reverting**, or **Choppy**).\n"
        f"- **VWAP & Price Action:** Assess price anchoring and slope relative to `session_vwap` and "
        f"`vwap_deviation_pct`. Evaluate candle rejection wicks (pin-bars/hammers) in recent candles.\n\n"
        f"### 2. Short/Medium-Term Technical Setup (EOD Horizon)\n"
        f"- **Geometric Structure:** Identify actionable Support/Resistance channels or validated chart patterns "
        f"with exact boundary prices.\n"
        f"- **Mean Reversion:** Evaluate configured **Bollinger Bands** (30, 2.0; bandwidth squeeze, band touches/%B) "
        f"and **RSI** (13; extremes and price-momentum divergences).\n"
        f"- **Trend & Momentum:** Analyze price alignment against configured **Moving Averages** (SMA 30, EMA 100) "
        f"and **MACD** (12, 26, 9) histogram inflection.\n"
        f"- **Fibonacci Retracement Matrix:** Evaluate current price relative to pre-computed retracement levels and "
        f"anchored Cycle High / Cycle Low in `fibonacci_levels`.\n\n"
        f"### 3. Historical Trend & Reversal Audit\n"
        f"- Audit current price action and technical indicators against the **Historical Analyst Output Ledger**.\n"
        f"- Classify status strictly as:\n"
        f"  - **Continuation:** Price confirms prior bias and holds key support/resistance.\n"
        f"  - **Reversal:** Price invalidates prior thesis by breaching key structural levels or "
        f"flipping trend/momentum.\n"
        f"  - **Initiation:** No prior ledger entry exists, or establishing a new baseline after prolonged "
        f"consolidation.\n"
        f"  - **Gap:** Discontinuous overnight/session price jump invalidating prior levels.\n\n"
        f"# Current Technical & Market Data for {symbol}\n"
        f"```json\n{context_json}\n```\n\n"
        f"# {history_block}\n\n"
        f"# Required Output Format\n"
        f"Begin your response with these exact metadata lines:\n"
        f"DIRECTIONAL_BIAS: [Bullish | Bearish | Neutral]\n"
        f"CONFIDENCE_SCORE: [Integer 0-100]\n"
        f"TREND_STATUS: [Continuation | Reversal | Initiation | Gap]\n"
        f"SUMMARY_HEADLINE: [Single concise sentence summarizing key technical setup and "
        f"support/resistance level]\n\n"
        f"Then provide your structured Markdown report with sections:\n"
        f"### 1. Price Structure, Moving Averages & Momentum\n"
        f"### 2. Intraday Microstructure & Fibonacci Retracement Levels\n"
        f"### 3. Historical Trend / Reversal Comparison\n"
    )


def build_fundamental_analyst_prompt(
    symbol: str,
    fundamental_context: dict[str, Any],
    past_outputs: list[dict[str, Any]],
) -> str:
    """Construct segregated prompt for the Fundamental Analyst agent.

    Expands Group 3 (newsScan) from legacy promptBuilder.ts with earnings trajectory,
    valuation multiples, balance sheet solvency, and historical comparison.
    """
    history_block = format_historical_outputs_block(past_outputs)
    context_json = json.dumps(fundamental_context, indent=2, default=str)

    return (
        f"# Role & Strict Segregation Mandate\n"
        f"You are the **Fundamental Analyst** on the Alpha_Insight 4-Analyst Committee "
        f"evaluating **{symbol}**.\n"
        f"You operate independently and unbiased of the current run's Technical, Macro, "
        f"and Risk analysts.\n\n"
        f"# Domain Scope (Expanded from AlphaInsight promptBuilder.ts Group 3)\n"
        f"1. **7-Day News & Catalyst Scan**:\n"
        f"   - Evaluate recent company announcements, earnings releases, product cycles, "
        f"supply-chain developments, and regulatory filings for {symbol}.\n"
        f"2. **Valuation Multiples & Earnings Quality**:\n"
        f"   - Assess valuation positioning (forward P/E, EV/EBITDA, Price/FCF yield relative "
        f"to historical norms and peer group).\n"
        f"   - Evaluate revenue growth durability, operating margin expansion/compression, "
        f"and free cash flow conversion.\n"
        f"3. **Balance Sheet Solvency & Capital Allocation**:\n"
        f"   - Inspect net debt/cash position, interest coverage, share buybacks, and "
        f"dividend sustainability.\n"
        f"4. **Historical Trend & Reversal Audit**:\n"
        f"   - Compare current fundamental catalysts and valuation against the Historical "
        f"Analyst Output Ledger.\n"
        f"   - Flag whether fundamental drivers show **Continuation**, **Reversal**, "
        f"**Initiation**, or a **Gap** vs prior outputs.\n\n"
        f"# Current Fundamental & Company Context for {symbol}\n"
        f"```json\n{context_json}\n```\n\n"
        f"# {history_block}\n\n"
        f"# Required Output Format\n"
        f"Begin your response with these exact metadata lines:\n"
        f"DIRECTIONAL_BIAS: [Bullish | Bearish | Neutral]\n"
        f"CONFIDENCE_SCORE: [Integer 0-100]\n"
        f"TREND_STATUS: [Continuation | Reversal | Initiation | Gap]\n"
        f"SUMMARY_HEADLINE: [Single concise sentence summarizing valuation and catalyst outlook]\n\n"
        f"Then provide your structured Markdown report with sections:\n"
        f"### 1. Catalyst Scan & Earnings Trajectory\n"
        f"### 2. Valuation Multiples & Balance Sheet Quality\n"
        f"### 3. Historical Fundamental Thesis Audit\n"
    )


def build_macro_strategist_prompt(
    symbol: str,
    macro_context: dict[str, Any],
    past_outputs: list[dict[str, Any]],
) -> str:
    """Construct segregated prompt for the Macro Strategist agent.

    Expands Group 3 (secularIndustry) from legacy promptBuilder.ts with US Treasury yield
    curve structure, macro indicators, FX cross rates, and 11 GICS sector rotation.
    """
    history_block = format_historical_outputs_block(past_outputs)
    context_json = json.dumps(macro_context, indent=2, default=str)

    return (
        f"# Role & Strict Segregation Mandate\n"
        f"You are the **Macro Strategist** on the Alpha_Insight 4-Analyst Committee "
        f"evaluating **{symbol}**.\n"
        f"You operate independently and unbiased of the current run's Technical, "
        f"Fundamental, and Risk analysts.\n\n"
        f"# Domain Scope (Expanded from AlphaInsight promptBuilder.ts Group 3 Secular & Macro)\n"
        f"1. **US Treasury Sovereign Yield Curve & Rate Cycle**:\n"
        f"   - Analyze the 1M to 30Y Treasury yield curve, 10Y-2Y spread, real yields, and "
        f"Federal Reserve policy trajectory.\n"
        f"   - Evaluate how discount-rate sensitivity impacts {symbol}'s equity duration.\n"
        f"2. **Inflation, Growth & FX Cross-Rate Sensitivity**:\n"
        f"   - Assess CPI inflation, GDP growth regime, and currency cross rates "
        f"(`USD/SGD`, `EUR/USD`, `USD/JPY`) from `exchange_rate`.\n"
        f"3. **11 GICS Sector Relative Rotation & Secular Industry Drivers**:\n"
        f"   - Evaluate relative strength across the 11 GICS sectors and secular industry "
        f"tailwinds/headwinds affecting {symbol}.\n"
        f"4. **Historical Trend & Reversal Audit**:\n"
        f"   - Compare current macro/sector conditions against the Historical Analyst Output Ledger.\n\n"
        f"# Current Macroeconomic & Sector Data for {symbol}\n"
        f"```json\n{context_json}\n```\n\n"
        f"# {history_block}\n\n"
        f"# Required Output Format\n"
        f"Begin your response with these exact metadata lines:\n"
        f"DIRECTIONAL_BIAS: [Bullish | Bearish | Neutral]\n"
        f"CONFIDENCE_SCORE: [Integer 0-100]\n"
        f"TREND_STATUS: [Continuation | Reversal | Initiation | Gap]\n"
        f"SUMMARY_HEADLINE: [Single concise sentence summarizing yield curve and sector rotation impact]\n\n"
        f"Then provide your structured Markdown report with inline citations `[Source Title](URL)` "
        f"for all factual figures:\n"
        f"### 1. Sovereign Yield Curve & Rate Cycle Impact\n"
        f"### 2. GICS Sector Rotation & FX Sensitivity\n"
        f"### 3. Historical Macro Regime Comparison\n"
    )


def build_macro_dimension_prompt(
    dimension_role: str,
    watchlist_exposure: dict[str, list[str]],
    fx_rates: list[dict[str, Any]],
    benchmark_snapshots: list[dict[str, Any]],
    past_outputs: list[dict[str, Any]],
) -> str:
    """Construct Watchlist-derived, citation-grounded prompt for each [Macroeconomics] tab.

    dimension_role:
      - 'macro_us': Global & US Macro
      - 'macro_apac': SG & Asia-Pacific Macro
      - 'macro_secular': Secular & Geopolitics
      - 'macro': Consolidated Macro Overview
    """
    history_block = format_historical_outputs_block(past_outputs)
    exposure_json = json.dumps(watchlist_exposure, indent=2, default=str)
    fx_json = json.dumps(fx_rates, indent=2, default=str)
    bench_json = json.dumps(benchmark_snapshots, indent=2, default=str)

    citation_mandate = (
        "# ZERO-HALLUCINATION & MANDATORY CITATION RULE\n"
        "- Do NOT guess, assume, or fabricate any macroeconomic statistics, yields, "
        "inflation prints, or policy actions.\n"
        "- Use Google Search Grounding to verify current figures and explicitly include inline Markdown links "
        "`[Source Name](https://...)` next to every factual claim, interest rate, GDP/CPI figure, "
        "or central bank statement.\n"
        "- End your report with a `### Verified Sources & Citations` section listing the exact sources used.\n"
    )

    if dimension_role == "macro_us":
        title = "Global & US Macro Strategist"
        scope_text = (
            "1. **Federal Reserve Monetary Policy & US Treasury Yield Curve**:\n"
            "   - Current Fed Funds target range, FOMC guidance, Quantitative Tightening/Easing, "
            "and US Treasury yields (3M, 2Y, 10Y, 30Y).\n"
            "2. **US Inflation, GDP Growth & Labor Regime**:\n"
            "   - Latest CPI/PCE inflation releases, real GDP growth, and labor market resilience.\n"
            "3. **Direct Transmission to User's US Watchlist Symbols**:\n"
            "   - Explicitly map how current US rates and growth impact the US equities, "
            "semiconductors, and ETFs in the user's `[watchlist]` below."
        )
    elif dimension_role == "macro_apac":
        title = "Singapore & Asia-Pacific (SG, Hong Kong/China, Japan) Macro Strategist"
        scope_text = (
            "1. **Singapore (MAS Monetary Policy, SORA & SGS)**:\n"
            "   - Monetary Authority of Singapore (MAS) S$NEER policy band, SORA interest rate "
            "trajectory, and Singapore Government Securities (SGS) yield environment.\n"
            "2. **Hong Kong & Mainland China (PBoC, HKMA, Credit Impulse & Industrial Demand)**:\n"
            "   - People's Bank of China (PBoC) LPR/RRR monetary policy, fiscal stimulus, PMI/industrial "
            "activity, HKMA Linked Exchange Rate System (`USD/HKD`, HIBOR), and `USD/CNH` dynamics.\n"
            "3. **Japan (Bank of Japan Policy Rate, JGB Yields & Yen Carry Regime)**:\n"
            "   - Bank of Japan (BoJ) policy rate normalization, 10Y JGB yields, Shunto wage-inflation "
            "cycle, and `USD/JPY` carry-trade / semiconductor equipment supply-chain spillovers.\n"
            "4. **FX (`USD/SGD`, `USD/CNH`, `USD/HKD`, `USD/JPY`) & Watchlist Transmission**:\n"
            "   - Explicitly map how Singapore, Hong Kong/China, and Japan macro conditions impact the "
            "user's SGX and Asia-Pacific `[watchlist]` symbols (`D05.SI`, `BN4.SI`, `5E2.SI`, `S58.SI`, "
            "`S61.SI`, `^STI`, `TSM`, and regional HK/China/Japan exposures)."
        )
    else:
        title = "Secular & Geopolitics Macro Strategist"
        scope_text = (
            "1. **Semiconductor, AI Infrastructure & Energy CapEx Cycle**:\n"
            "   - Global hyperscaler AI capital expenditure, optical/semiconductor supply chain "
            "bottlenecks, nuclear/clean energy demand, and industrial capex.\n"
            "2. **Geopolitics, Trade Tariffs & Export Controls**:\n"
            "   - US-China technology export controls, semiconductor tariffs, cross-border supply "
            "chain shifts, and digital asset liquidity.\n"
            "3. **Direct Transmission to User's Thematic Watchlist Symbols**:\n"
            "   - Explicitly evaluate the impact on the user's thematic `[watchlist]` holdings "
            "(`NVDA`, `ASML`, `MU`, `TSM`, `GLW`, `SOXX`, `AMZN`, `GOOG`, `META`, `XE`, `IBIT`, `AA`)."
        )

    return (
        f"# Role & Objective\n"
        f"You are the **{title}** for Alpha_Insight's `[Macroeconomics]` workbench.\n"
        f"Your analysis scope is strictly derived from the symbols of interest in the user's `[watchlist]` table.\n\n"
        f"{citation_mandate}\n"
        f"# Domain Scope\n"
        f"{scope_text}\n\n"
        f"# User's Active [watchlist] Symbols by Category\n"
        f"```json\n{exposure_json}\n```\n\n"
        f"# Live Database FX Rates (`public.exchange_rate`)\n"
        f"```json\n{fx_json}\n```\n\n"
        f"# Watchlist Benchmark Index Snapshot (`public.eoddata`)\n"
        f"```json\n{bench_json}\n```\n\n"
        f"# {history_block}\n\n"
        f"# Required Output Format\n"
        f"Begin your response with these exact metadata lines:\n"
        f"DIRECTIONAL_BIAS: [Bullish | Bearish | Neutral]\n"
        f"CONFIDENCE_SCORE: [Integer 0-100]\n"
        f"TREND_STATUS: [Continuation | Reversal | Initiation | Gap]\n"
        f"SUMMARY_HEADLINE: [Single concise sentence summarizing key macro finding and watchlist impact]\n\n"
        f"Then provide your rich-text Markdown report with inline `[Source Title](URL)` citations "
        f"and end with `### Verified Sources & Citations`.\n"
    )


def build_risk_manager_prompt(
    symbol: str,
    portfolio_risk_context: dict[str, Any],
    past_outputs: list[dict[str, Any]],
) -> str:
    """Construct segregated prompt for the Risk Manager agent.

    Evaluates bidirectional position exposure, concentration, margin loan accrual,
    drawdown budget, transaction cost friction, and ATR stop-loss sizing.
    """
    history_block = format_historical_outputs_block(past_outputs)
    context_json = json.dumps(portfolio_risk_context, indent=2, default=str)

    return (
        f"# Role & Strict Segregation Mandate\n"
        f"You are the **Risk Manager** on the Alpha_Insight 4-Analyst Committee "
        f"evaluating **{symbol}**.\n"
        f"You operate independently and unbiased of the current run's Technical, "
        f"Fundamental, and Macro analysts.\n\n"
        f"# Domain Scope\n"
        f"1. **Bidirectional Position & Cost Basis Exposure**:\n"
        f"   - Inspect current open quantity (Long or Short), Average Buy Cost, Average "
        f"Sell Cost, Net Average Cost Basis, and signed Unrealized PnL for {symbol}.\n"
        f"   - Evaluate position weight as a percentage of Total Net Asset Value (NAV).\n"
        f"2. **Margin Loan Utilization & Carrying Cost Friction**:\n"
        f"   - Evaluate portfolio cash balance vs margin loan balance, annual financing "
        f"rate (`margin_interest_rate`), and cumulative transaction costs (`trans_cost`).\n"
        f"3. **Drawdown Control, Stop-Loss & Position Sizing**:\n"
        f"   - Define hard stop-loss level, maximum permissible share addition/reduction, "
        f"and portfolio NAV risk budget (capping single-trade risk within drawdown limits).\n"
        f"4. **Historical Trend & Reversal Audit**:\n"
        f"   - Compare current risk metrics and exposure against the Historical Analyst Output Ledger.\n\n"
        f"# Current Portfolio & Risk Ledger Data for {symbol}\n"
        f"```json\n{context_json}\n```\n\n"
        f"# {history_block}\n\n"
        f"# Required Output Format\n"
        f"Begin your response with these exact metadata lines:\n"
        f"DIRECTIONAL_BIAS: [Bullish | Bearish | Neutral]\n"
        f"CONFIDENCE_SCORE: [Integer 0-100]\n"
        f"TREND_STATUS: [Continuation | Reversal | Initiation | Gap]\n"
        f"SUMMARY_HEADLINE: [Single concise sentence stating position sizing, cost basis "
        f"status, and stop-loss boundary]\n\n"
        f"Then provide your structured Markdown report with sections:\n"
        f"### 1. Position Exposure & Bidirectional Cost Basis Audit\n"
        f"### 2. Margin Utilization, Drawdown & Stop-Loss Sizing\n"
        f"### 3. Historical Risk Drift Comparison\n"
    )


def build_executive_summary_prompt(
    symbol: str,
    analyst_outputs: dict[str, dict[str, Any]],
    past_outputs: list[dict[str, Any]],
) -> str:
    """Construct prompt for the Executive Summary synthesizer consolidating all 4 analysts."""
    history_block = format_historical_outputs_block(past_outputs)
    outputs_json = json.dumps(analyst_outputs, indent=2, default=str)

    return (
        f"# Role & Consolidation Mandate\n"
        f"You are the **Committee Chair & Executive Summary Synthesizer** for Alpha_Insight "
        f"evaluating **{symbol}**.\n"
        f"Your task is to succinctly consolidate the key contents, recommendations, and "
        f"risk boundaries of all 4 segregated analysts (Technical, Fundamental, Macro, Risk) "
        f"who have just completed their independent evaluations.\n\n"
        f"# Completed Outputs from the 4 Segregated Analysts\n"
        f"```json\n{outputs_json}\n```\n\n"
        f"# {history_block}\n\n"
        f"# Required Output Format\n"
        f"Begin your response with these exact metadata lines:\n"
        f"DIRECTIONAL_BIAS: [Bullish | Bearish | Neutral]\n"
        f"CONFIDENCE_SCORE: [Integer 0-100]\n"
        f"TREND_STATUS: [Continuation | Reversal | Initiation | Gap]\n"
        f"SUMMARY_HEADLINE: [Succinct 1-sentence executive conclusion consolidating all 4 analysts]\n\n"
        f"Then provide a succinct Markdown Executive Summary structured as follows:\n"
        f"### Consolidated Committee Synthesis\n"
        f"- **Technical**: [1-sentence synthesis of technical setup and key price levels]\n"
        f"- **Fundamental**: [1-sentence synthesis of valuation and catalyst outlook]\n"
        f"- **Macro**: [1-sentence synthesis of yield curve and sector rotation impact]\n"
        f"- **Risk**: [1-sentence synthesis of position sizing, margin exposure, and stop-loss level]\n\n"
        f"### Cross-Analyst Consensus, Divergences & Historical Trend Shift\n"
        f"- Concisely highlight where the 4 analysts agree, any divergence/gaps between them, "
        f"and how the committee stance has evolved relative to prior recorded outputs.\n"
    )


def build_contextual_chat_prompt(
    messages: list[dict[str, str]],
    symbol: Optional[str],
    active_route: Optional[str],
    displayed_context: dict[str, Any],
) -> str:
    """Construct context-aware prompt for the floating [Agentic Analyst] interactive chat window."""
    context_json = json.dumps(displayed_context, indent=2, default=str)
    conversation_lines: list[str] = []
    for msg in messages:
        role_label = "User" if msg.get("role") == "user" else "Agentic Analyst"
        conversation_lines.append(f"{role_label}: {msg.get('content', '')}")
    conversation_str = "\n\n".join(conversation_lines)

    return (
        f"# Role & Objective\n"
        f"You are the **Alpha_Insight Agentic Analyst**, an interactive institutional "
        f"assistant embedded in a floating chat window.\n"
        f"You have full visibility into the information currently displayed on the user's screen:\n"
        f"- Active Route: `{active_route or '/research/committee'}`\n"
        f"- Active Symbol: `{symbol or 'N/A'}`\n\n"
        f"# Live Displayed Screen Context\n"
        f"```json\n{context_json}\n```\n\n"
        f"# Conversation History\n"
        f"{conversation_str}\n\n"
        f"# Instructions\n"
        f"Answer the user's latest question directly, concisely, and factually using the "
        f"Live Displayed Screen Context above (referencing specific analyst outputs, "
        f"Executive Summary points, Fibonacci/indicator numbers, stop-loss levels, or "
        f"Investment Note contents). Use clean Markdown bullets and exact numbers where applicable."
    )


def build_system_prompt(
    symbol: str,
    name: Optional[str] = None,
    modules: Optional[AnalysisModulesConfig | dict[str, Any]] = None,
) -> str:
    """Construct multi-horizon quantitative stock analysis prompt based on selected modules."""
    display_name = name or symbol

    mod_dict: dict[str, bool] = {}
    if isinstance(modules, AnalysisModulesConfig):
        mod_dict = {
            "chartPatternRecognition": modules.chartPatternRecognition,
            "shortTermTechnical": modules.shortTermTechnical,
            "longTermTechnical": modules.longTermTechnical,
            "fundamental": modules.fundamental,
            "valuation": modules.valuation,
            "intradayMicrostructure": True,
            "mathCandlePatterns": True,
            "meanReversion": modules.shortTermTechnical,
            "trendMomentum": modules.shortTermTechnical,
            "fibonacciRetracement": modules.longTermTechnical,
            "newsScan": modules.fundamental,
            "secularIndustry": modules.fundamental,
        }
    elif isinstance(modules, dict):
        mod_dict = {k: bool(v) for k, v in modules.items()}
    else:
        mod_dict = {
            "chartPatternRecognition": True,
            "shortTermTechnical": True,
            "longTermTechnical": True,
            "fundamental": True,
            "valuation": True,
            "intradayMicrostructure": True,
            "mathCandlePatterns": True,
            "meanReversion": True,
            "trendMomentum": True,
            "fibonacciRetracement": True,
            "newsScan": True,
            "secularIndustry": True,
        }

    has_intraday = mod_dict.get("intradayMicrostructure", True) or mod_dict.get("mathCandlePatterns", True)
    has_tactical = (
        mod_dict.get("chartPatternRecognition", True)
        or mod_dict.get("meanReversion", True)
        or mod_dict.get("trendMomentum", True)
        or mod_dict.get("shortTermTechnical", True)
    )
    has_long_term = (
        mod_dict.get("fibonacciRetracement", True)
        or mod_dict.get("secularIndustry", True)
        or mod_dict.get("newsScan", True)
        or mod_dict.get("longTermTechnical", True)
    )

    analysis_types: list[str] = []
    if has_tactical or mod_dict.get("fibonacciRetracement", True):
        analysis_types.append("technical")
    if mod_dict.get("newsScan", True) or mod_dict.get("secularIndustry", True):
        analysis_types.append("qualitative fundamental")
    if has_intraday:
        analysis_types.append("intraday microstructure")

    analysis_types_str = ", ".join(analysis_types) if analysis_types else "targeted quantitative"

    target_horizons: list[str] = []
    if has_intraday:
        target_horizons.append(
            "- Ultra-Short-Term Intraday / Same-Day (Positions taken and unwound within the same day; minutes to hours)"
        )
    if has_tactical:
        target_horizons.append("- Short-Term Tactical (Swing trading; days to weeks)")
    if has_long_term:
        target_horizons.append("- Medium to Long-Term (Investing; months to years)")

    if target_horizons:
        horizons_joined = "\n".join(f"  {h}" for h in target_horizons)
        horizons_section = (
            f"determine if a stock warrants positioning across the requested horizon(s):\n{horizons_joined}"
        )
    else:
        horizons_section = f"evaluate the specified custom analysis indicators for {display_name}."

    tasks_content = (
        "TASKS:\n"
        "1. Executive Summary: Provide a SUCCINCT overview in executive summary form with the final recommendation.\n"
        "2. Strategic Tasks:\n"
    )

    if has_intraday:
        tasks_content += (
            "   - Intraday Trading Strategies "
            "(Focused on evaluating microstructure & execution risk, using 5-Minute OHLCV Data):\n"
        )
        if mod_dict.get("intradayMicrostructure", True):
            tasks_content += (
                "       * Liquidity Consistency: Screen 5m volume for zero/near-zero volume gaps denoting risk.\n"
                "       * Volatility Regime: Classify price action as noisy/choppy or trending/smooth.\n"
            )
        if mod_dict.get("mathCandlePatterns", True):
            tasks_content += (
                "       * Mathematical Candle Patterns (5m Data): Scan 5m OHLCV data for volume breakouts "
                "(> 1.5x 20-period average volume) and pin bar/hammer reversals (wick > 70% of candle range).\n"
            )
    else:
        tasks_content += "   - Intraday Trading Strategies: [Not Evaluated (Module Disabled)]\n"

    if has_tactical or mod_dict.get("fibonacciRetracement", True):
        tasks_content += "   - Short/Medium term Technical & Tactical Strategies (Using EOD Data & Chart Image):\n"
        if mod_dict.get("chartPatternRecognition", True):
            tasks_content += (
                "       * Vision-Based Chart Pattern Recognition: Analyze chart screenshot for geometric patterns "
                "(Head & Shoulders, Double Tops/Bottoms, Channels, Flags, Wedges). "
                "If missing, perform mathematical OHLCV pattern scanning.\n"
            )
        if mod_dict.get("meanReversion", True):
            tasks_content += (
                "       * Mean Reversion Strategy: Analyze Bollinger Bands (20, 2) and RSI (14) extremes. "
                "Provide up to 3 key takeaways.\n"
            )
        if mod_dict.get("trendMomentum", True):
            tasks_content += (
                "       * Trend/Momentum Strategy: Analyze MACD and EMA (20, 50, 200) alignment across timeframes. "
                "Provide up to 3 key takeaways.\n"
            )
        if mod_dict.get("fibonacciRetracement", True):
            tasks_content += (
                "       * Fibonacci Retracement: Calculate key levels based on recent swing high/low "
                "(Cycle High, 23.6%, 38.2%, 50.0%, 61.8%, 78.6%, Cycle Low).\n"
            )
    else:
        tasks_content += "   - Short/Medium term Technical & Tactical Strategies: [Not Evaluated (Module Disabled)]\n"

    deep_research_task = ""
    if mod_dict.get("newsScan", True) or mod_dict.get("secularIndustry", True):
        deep_research_task = "3. Fundamental & Web Research:\n"
        if mod_dict.get("newsScan", True):
            deep_research_task += (
                f"   - 7-Day News & Catalyst Scan: Search recent news for {display_name} ({symbol}).\n"
            )
        if mod_dict.get("secularIndustry", True):
            deep_research_task += (
                "   - Secular Industry & Macro Context: Synthesize secular trends or regulatory drivers.\n"
            )

    intraday_rec = (
        "(Must explicitly state if 5m Liquidity/Volatility metrics clear execution safety threshold)"
        if has_intraday
        else "[Not Evaluated (Module Disabled)]"
    )
    tactical_rec = "" if has_tactical else "[Not Evaluated (Module Disabled)]"
    longterm_rec = "" if has_long_term else "[Not Evaluated (Module Disabled)]"

    extra_strategic = []
    if mod_dict.get("intradayMicrostructure", True):
        extra_strategic.append(
            "  * Intraday Microstructure Matrix: A markdown table displaying: Volume Consistency Grade "
            "(Excellent/Poor) and Volatility Regime (Trending/Choppy).\n"
        )
    if (
        mod_dict.get("meanReversion", True)
        or mod_dict.get("trendMomentum", True)
        or mod_dict.get("fibonacciRetracement", True)
    ):
        extra_strategic.append("  * Technical Indicator Findings: Bulleted takeaways for active technical setups.\n")
    if mod_dict.get("chartPatternRecognition", True) or mod_dict.get("mathCandlePatterns", True):
        extra_strategic.append(
            "  * Chart Pattern Recognition: Detailed notes on geometric structures and math candle patterns found.\n"
        )
    extra_strategic_str = "".join(extra_strategic)

    extra_fundamental = ""
    if mod_dict.get("newsScan", True) or mod_dict.get("secularIndustry", True):
        extra_fundamental = (
            "- Fundamental & Web Research Findings\n"
            "  * Industry/Macro Context: Bullets detailing key secular trends or fundamental news discovered.\n"
        )

    prompt = (
        f"# Role & Core Objective\n"
        f"You are AlphaInsight, an advanced quantitative stock analyst specializing in multi-horizon tactical trading, "
        f"market microstructure, and chart pattern recognition. Your task is to perform {analysis_types_str} "
        f"analysis to {horizons_section}\n\n"
        f"Analyze {display_name} ({symbol}) using the attached market data and charts.\n\n"
        f"{tasks_content}\n"
        f"{deep_research_task}\n"
        f"RECOMMENDATION: specifically justify if a position is warranted for the requested horizon(s) under the "
        f'"Horizon Recommendations" section of the Executive Summary. If any horizon is unselected above, explicitly '
        f'mark it as "[Not Evaluated (Module Disabled)]".\n\n'
        f"FORMAT:\n"
        f"Produce the output in this order:\n"
        f"- Executive Summary\n"
        f"  * Overall Directional Bias: (Bullish / Bearish / Neutral)\n"
        f"  * Horizon Recommendations: Concisely state whether a position is justified for:\n"
        f"    - Ultra-Short-Term Intraday {intraday_rec}\n"
        f"    - Short-Term Tactical {tactical_rec}\n"
        f"    - Medium to Long-Term {longterm_rec}\n"
        f"  * Synthesis: A 3-sentence maximum operational summary bridging quantitative and fundamental realities.\n\n"
        f"- Strategic Tasks\n"
        f"{extra_strategic_str}\n"
        f"{extra_fundamental}"
    )
    return prompt
