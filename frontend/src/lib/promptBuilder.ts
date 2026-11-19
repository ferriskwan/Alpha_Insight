/**
 * Quantitative Prompt Builder for Alpha_Insight AI stock analysis.
 * Generates structured prompts for Gemini / Kimi models.
 */

import { AnalysisModulesConfig } from '../types/api';

export const DEFAULT_ANALYSIS_MODULES: AnalysisModulesConfig = {
  chartPatternRecognition: true,
  shortTermTechnical: true,
  longTermTechnical: true,
  fundamental: false,
  valuation: false,
};

export interface PromptInput {
  symbol: string;
  name?: string;
  modules?: Partial<AnalysisModulesConfig>;
}

export function buildStockAnalysisPrompt(input: PromptInput): string {
  const modules: AnalysisModulesConfig = {
    ...DEFAULT_ANALYSIS_MODULES,
    ...(input.modules || {}),
  };

  const tasks: string[] = [
    '1. Executive Summary: Provide a succinct verdict (Bullish / Bearish / Neutral) and directional bias.',
    '2. Horizon Breakdown:',
  ];

  if (modules.chartPatternRecognition) {
    tasks.push('   - Chart Pattern Recognition: Scan candlesticks and classical chart patterns (Head & Shoulders, Double Bottoms/Tops, Wedges, Channels).');
  }

  if (modules.shortTermTechnical) {
    tasks.push('   - Short-Term Technical: Evaluate SMA(30), EMA(100), Bollinger Bands(30, 2), and RSI(13) momentum/mean-reversion levels.');
  }

  if (modules.longTermTechnical) {
    tasks.push('   - Long-Term Technical: Assess macro trend structure, MACD(12, 26, 9) signal lines, and key Fibonacci retracement levels (23.6%, 38.2%, 50.0%, 61.8%).');
  }

  if (modules.fundamental) {
    tasks.push('   - Fundamental & Web Research: Scan recent corporate developments, earnings, industry trends, and macro regulatory catalysts.');
  }

  if (modules.valuation) {
    tasks.push('   - Valuation & Risk Sizing: Evaluate risk/reward ratio, stop-loss anchor levels, and margin loan carrying cost impact.');
  }

  return `# Role & Objective
You are AlphaInsight, a quantitative equity analyst.
Analyze ${input.name || input.symbol} (${input.symbol}) using the attached market data and chart images.

${tasks.join('\n')}

Format requirements:
- Produce an Executive Summary table with Overall Bias, Confidence Grade, and Target Horizon.
- Provide clear bullet points with explicit price levels for support, resistance, and stop-loss.
- Return structured markdown with no unnecessary preamble.`;
}

export default buildStockAnalysisPrompt;
