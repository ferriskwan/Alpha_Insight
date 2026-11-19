import React from 'react';
import { HelpCircle, BookOpen, Activity, Percent, TrendingUp } from 'lucide-react';
import { BentoCard, AccordionCard, Badge } from '../../design-system';

interface FAQEntry {
  id: string;
  category: string;
  title: string;
  formula: string;
  explanation: string;
  insights: string[];
}

export const FAQ: React.FC = () => {
  const faqEntries: FAQEntry[] = [
    {
      id: 'bollinger',
      category: 'Volatility',
      title: 'Bollinger Bands (BB 30, 2)',
      formula: 'Upper = SMA(30) + 2σ, Lower = SMA(30) - 2σ',
      explanation:
        'A volatility envelope plotted two standard deviations away from the 30-day Simple Moving Average. It identifies overbought and oversold extremes relative to recent volatility regimes.',
      insights: [
        'Band Squeeze: Extreme narrowing denotes volatility compression, frequently preceding explosive breakout moves.',
        'Band Walking: During sustained institutional trends, price can track along outer bands continuously.',
        'Mean Reversion Target: The center SMA(30) line acts as the primary dynamic equilibrium target.',
      ],
    },
    {
      id: 'rsi',
      category: 'Momentum',
      title: 'Relative Strength Index (RSI 13)',
      formula: 'RSI = 100 - [100 / (1 + RS)], RS = Avg Gain / Avg Loss',
      explanation:
        'A momentum oscillator evaluating the magnitude and speed of directional price movements on a 0-100 scale.',
      insights: [
        'Overbought (> 70) / Oversold (< 30): Flags extended moves where mean reversion probability increases.',
        'Momentum Divergence: Higher high in price with a lower high in RSI signals bullish exhaustion.',
        '50-Centerline Bias: Sustained trading above 50 validates bullish trend dominance.',
      ],
    },
    {
      id: 'macd',
      category: 'Trend',
      title: 'MACD (12, 26, 9)',
      formula: 'MACD = EMA(12) - EMA(26); Signal = EMA(9) of MACD',
      explanation:
        'Trend-following momentum indicator capturing the relationship between two exponential moving averages.',
      insights: [
        'Signal Crossover: MACD crossing above signal line triggers tactical momentum buy signals.',
        'Zero-Line Cross: Indicates long-term regime shift from bearish to bullish alignment.',
        'Histogram Expansion: Increasing bar heights confirm accelerating trend velocity.',
      ],
    },
    {
      id: 'atr',
      category: 'Microstructure',
      title: 'Average True Range (ATR 14)',
      formula: 'TR = Max(High - Low, |High - Close_prev|, |Low - Close_prev|)',
      explanation:
        'Measures pure market volatility without directional bias. Essential for intraday friction filtering and dynamic stop-loss placement.',
      insights: [
        'Friction Filter: In 5-minute trading, ATR must comfortably exceed bid-ask spread + commissions.',
        'Position Sizing: Position size is inversely scaled to ATR to equalize dollar risk per trade.',
      ],
    },
    {
      id: 'fibonacci',
      category: 'Technicals',
      title: 'Fibonacci Retracement Geometry',
      formula: 'Levels = High - (High - Low) * [0.236, 0.382, 0.500, 0.618, 0.786]',
      explanation:
        'Mathematical horizontal support and resistance levels derived from natural golden ratio sequences across macro swing ranges.',
      insights: [
        '61.8% Golden Pocket: Primary institutional reload level during corrective pullbacks.',
        '50.0% Equilibrium: Psychological halfway mark often triggering aggressive counter-trend defense.',
      ],
    },
    {
      id: 'dual_ledger',
      category: 'Portfolio',
      title: 'Dual-Ledger Accounting: Investment vs Leverage',
      formula: 'Total Asset Value = Market Value + Cash Available - Margin Loan',
      explanation:
        'Segregates long-term fully paid cash equities (Investment) from margin-financed tactical positions (Leverage) to avoid commingling risk and accurately attribute interest carrying charges.',
      insights: [
        'Daily Margin Accrual: Interest is computed daily per broker and currency based on ACT/360 or ACT/365.',
        'Clean Mark-to-Market: Prevents margin loan friction from obscuring true capital injection performance.',
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <BentoCard
        title="Quantitative Reference Guide & Methodology"
        subtitle="Mathematical specifications and operational rules of AlphaInsight indicators"
        icon={<HelpCircle className="w-4 h-4 text-accent-primary" />}
      >
        <div className="space-y-3 mt-2">
          {faqEntries.map((entry) => (
            <AccordionCard
              key={entry.id}
              title={entry.title}
              subtitle={entry.explanation}
              summaryBadge={<Badge variant="neutral">{entry.category}</Badge>}
              defaultExpanded={entry.id === 'bollinger'}
            >
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block mb-1">
                    Mathematical Formula:
                  </span>
                  <div className="p-2.5 rounded-lg bg-surface-elevated/70 border border-subtle font-mono text-accent-primary">
                    {entry.formula}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block mb-1">
                    Operational Insights & Tactical Rules:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-secondary">
                    {entry.insights.map((insight, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AccordionCard>
          ))}
        </div>
      </BentoCard>
    </div>
  );
};

export default FAQ;
