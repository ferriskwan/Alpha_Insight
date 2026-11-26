import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IndustrySectorView } from '../../frontend/src/components/research/IndustrySectorView';
import { PortfolioOverview } from '../../frontend/src/components/portfolio/PortfolioOverview';
import apiClient from '../../frontend/src/services/apiClient';

describe('Epic 1.1: By Industry / Sector Research Frontend Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders IndustrySectorView with sector selector, RRG card, cited news, and 4-analyst committee', async () => {
    vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue({
      horizon: '1D',
      asOfDate: '2026-11-26',
      benchmark: 'SPY',
      benchmarkReturn: 0.85,
      sectors: [
        {
          id: 'XLK',
          label: 'Technology',
          ticker: 'XLK',
          value: 1.45,
          weight: 29.5,
          subtext: 'XLK',
          relativeRotation: 'Leading',
          rsScore: 1.035,
          rsMomentum: 0.012,
        },
        {
          id: 'XLF',
          label: 'Financials',
          ticker: 'XLF',
          value: 0.42,
          weight: 13.2,
          subtext: 'XLF',
          relativeRotation: 'Improving',
          rsScore: 0.985,
          rsMomentum: 0.008,
        },
      ],
      quadrantDefinitions: {
        Leading: 'RS >= 1.0, RS Mom >= 0',
        Weakening: 'RS >= 1.0, RS Mom < 0',
        Improving: 'RS < 1.0, RS Mom >= 0',
        Lagging: 'RS < 1.0, RS Mom < 0',
      },
    });

    vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue({
      run_id: 101,
      symbol: 'XLK',
      sector_name: 'Technology',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      consensus_bias: 'Bullish',
      consensus_confidence: 85,
      executive_summary: 'Consensus synthesis: Technology exhibits leadership across multiple horizons.',
      vote_breakdown: { bullish: 3, neutral: 1, bearish: 0 },
      outputs: [
        {
          role: 'technical',
          directional_bias: 'Bullish',
          confidence_score: 85,
          key_metrics: { rs_score: 1.035 },
          report_content: 'Technical analysis demonstrates upward momentum above 20 EMA.',
        },
        {
          role: 'fundamental',
          directional_bias: 'Bullish',
          confidence_score: 80,
          key_metrics: { weight: 29.5 },
          report_content: 'Valuations supported by enterprise AI demand.',
        },
      ],
      news_sources: [
        {
          title: 'Tech ETF XLK Gains On Cloud Inflow',
          url: 'https://finance.yahoo.com/news/xlk-cloud-inflow',
          publisher: 'Yahoo Finance',
          published_at: '2026-11-26 10:00:00',
        },
      ],
      fallback_warning: null,
      created_at: '2026-11-26T10:00:00Z',
    });

    const onNoteSpy = vi.fn();
    const onContextSpy = vi.fn();

    render(
      <IndustrySectorView
        onReferenceInNote={onNoteSpy}
        onContextUpdate={onContextSpy}
      />
    );

    // 1. Header & Sector selector
    expect(await screen.findByText('By Industry / Sector Research')).toBeInTheDocument();
    expect(screen.getByText('Relative Rotation Quadrant')).toBeInTheDocument();

    // 2. Action Button labeled "AI Analysis"
    expect(screen.getByRole('button', { name: /AI Analysis/i })).toBeInTheDocument();

    // 3. RRG metrics & formula modal toggle
    expect(screen.getAllByText('Leading').length).toBeGreaterThan(0);
    const formulaBtn = screen.getByRole('button', { name: /Formula/i });
    fireEvent.click(formulaBtn);
    expect(screen.getByText(/Relative Rotation Graph \(RRG\) Methodology/i)).toBeInTheDocument();

    // 4. Cited RSS News
    expect(screen.getByText('Tech ETF XLK Gains On Cloud Inflow')).toBeInTheDocument();

    // 5. Committee consensus
    expect(screen.getByText('Bullish: 3')).toBeInTheDocument();

    // 6. Specialist tab switching
    const techTab = screen.getByRole('button', { name: 'Technical' });
    fireEvent.click(techTab);
    expect(await screen.findByText(/Technical analysis demonstrates upward momentum/i)).toBeInTheDocument();

    // 7. Reference in note
    const refBtn = screen.getByRole('button', { name: /Reference in Note/i });
    fireEvent.click(refBtn);
    expect(onNoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'XLK',
        analyst_role: 'technical',
      })
    );
  });

  it('renders amber fallback warning banner when Gemini credits are depleted', async () => {
    vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue({
      horizon: '1D',
      asOfDate: '2026-11-26',
      benchmark: 'SPY',
      benchmarkReturn: 0.5,
      sectors: [],
    });

    vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue({
      run_id: 102,
      symbol: 'XLK',
      sector_name: 'Technology',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      consensus_bias: 'Neutral',
      consensus_confidence: 60,
      executive_summary: 'Fallback executive summary generated deterministically.',
      vote_breakdown: {},
      outputs: [],
      news_sources: [],
      fallback_warning: 'Prepayment credits depleted (402 RESOURCE_EXHAUSTED).',
      created_at: '2026-11-26T10:00:00Z',
    });

    render(<IndustrySectorView />);

    expect(await screen.findByText(/AI Provider Service Notice:/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepayment credits depleted \(402 RESOURCE_EXHAUSTED\)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage Billing & Credits/i })).toHaveAttribute(
      'href',
      'https://ai.studio/projects'
    );
  });
});

describe('Epic 1.1: Portfolio Overview Refinements Frontend Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders 2-column layout, default 6M timeframe, holdings pie chart, and AI Analysis button', async () => {
    vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValue({
      parameters: {
        currency: 'SGD',
        selectedDate: '2026-11-24',
        timeframe: '6M',
      },
      kpis: {
        netAssetValue: 287517.05,
        cashBalance: 0,
        marginLoan: 120000,
        dayPnL: 1450.2,
        realizedPnL: 31155.61,
        realizedPnLPct: 9.57,
        unrealizedPnL: -150867.45,
        unrealizedPnLPct: -46.11,
        totalPnL: -129337.74,
        totalPnLPct: -39.53,
        capital: 327203.09,
        capitalPct: 39.0,
        margin: 482499.19,
        marginPct: 147.46,
        totalPortfolio: 287517.05,
        totalPortfolioPct: 14.5,
        pctReturn: -39.53,
        currency: 'SGD',
      },
      chart1_portfolio_capital_margin: [
        {
          date: '2026-11-20',
          portfolioSize: 280000,
          portfolioSizePct: 0,
          capital: 320000,
          capitalPct: 0,
          margin: 120000,
          marginPct: 0,
        },
        {
          date: '2026-11-24',
          portfolioSize: 287517.05,
          portfolioSizePct: 2.68,
          capital: 327203.09,
          capitalPct: 2.25,
          margin: 120000,
          marginPct: 0,
        },
      ],
      chart2_pnl_breakdown: {
        portfolio: [
          { date: '2026-11-20', pnl: -130000, pnlPct: -40 },
          { date: '2026-11-24', pnl: -129337.74, pnlPct: -39.53 },
        ],
        stocks: {
          '0700.HK': [{ date: '2026-11-24', pnl: 5000, pnlPct: 2.5 }],
        },
      },
      chart3_asset_allocation: [
        {
          category: 'Equities',
          symbol: '0700.HK',
          name: '0700.HK',
          quantity: 600,
          price: 337.4,
          value: 202440.0,
          percentage: 70.41,
          currency: 'SGD',
        },
        {
          category: 'Equities',
          symbol: '5E2.SI',
          name: '5E2.SI',
          quantity: 50000,
          price: 1.56,
          value: 78000.0,
          percentage: 27.13,
          currency: 'SGD',
        },
      ],
      chart3_holdings_pie: [
        {
          category: 'Equities',
          symbol: '0700.HK',
          name: '0700.HK',
          quantity: 600,
          price: 337.4,
          value: 202440.0,
          percentage: 70.41,
          currency: 'SGD',
        },
        {
          category: 'Equities',
          symbol: '5E2.SI',
          name: '5E2.SI',
          quantity: 50000,
          price: 1.56,
          value: 78000.0,
          percentage: 27.13,
          currency: 'SGD',
        },
      ],
      chart4_daily_pnl_drawdown: [
        { date: '2026-11-24', dailyPnL: 1450.2, drawdownPct: -12.5, highWaterMark: 300000 },
      ],
      trade_annotations: [
        {
          date: '2026-11-24',
          symbol: '0700.HK',
          buysell: 'B',
          quantity: 600,
          price: 337.4,
          currency: 'HKD',
          remarks: 'Entry',
        },
      ],
      capital_annotations: [],
    });

    vi.spyOn(apiClient, 'getPortfolioCommentary').mockResolvedValue({
      cached: true,
      lastUpdated: '2026-11-24T10:00:00Z',
      commentaries: {
        technical: { title: 'Technical Posture', status: 'Bullish', content: 'Support at 20 EMA.' },
        fundamental: { title: 'Fundamental Analysis', status: 'Favorable', content: 'Solvency strong.' },
        macro: { title: 'Macroeconomic Context', status: 'Stable', content: 'FX hedged.' },
        risk: { title: 'Risk Management', status: 'Healthy', content: 'Margin contained.' },
      },
      fallback_warning: 'Google Gemini credits depleted (402 RESOURCE_EXHAUSTED). Operating in deterministic fallback mode.',
    });

    const refreshCommentarySpy = vi.spyOn(apiClient, 'refreshPortfolioCommentary').mockResolvedValue({
      cached: false,
      lastUpdated: '2026-11-24T10:05:00Z',
      commentaries: {
        technical: { title: 'Technical Posture', status: 'Bullish', content: 'Support at 20 EMA.' },
        fundamental: { title: 'Fundamental Analysis', status: 'Favorable', content: 'Solvency strong.' },
        macro: { title: 'Macroeconomic Context', status: 'Stable', content: 'FX hedged.' },
        risk: { title: 'Risk Management', status: 'Healthy', content: 'Margin contained.' },
      },
      fallback_warning: null,
    });

    render(<PortfolioOverview />);

    // 1. Top bar: AI Analysis button exists on the top row
    const aiBtn = await screen.findByRole('button', { name: /AI Analysis/i });
    expect(aiBtn).toBeInTheDocument();

    // 2. Fallback warning banner rendered prominently at top
    expect(screen.getAllByText(/AI Provider Service Notice:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Manage Billing & Credits/i }).length).toBeGreaterThan(0);

    // 3. Chart 1: Trades checkbox removed from legend; annotations coupled to Portfolio Size
    expect(screen.queryByRole('checkbox', { name: 'Show Trades' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Toggle Portfolio Size' })).toBeChecked();
    expect(screen.getByTestId('chart1-trade-marker-2026-11-24')).toBeInTheDocument();

    // 4. Total Portfolio KPI badge reflects holdings aggregation
    expect(screen.getByText(/Total Portfolio/i)).toBeInTheDocument();
    expect(screen.getAllByText(/287,517.05/).length).toBeGreaterThan(0);

    // 5. Timeframe defaults to 6M
    const tf6M = screen.getByRole('button', { name: '6M' });
    expect(tf6M).toHaveClass('bg-blue-600');

    // 6. Holdings Pie Chart quotes date explicitly and displays symbols clearly
    expect(screen.getByText(/Holdings as of/i)).toBeInTheDocument();
    expect(screen.getAllByText('0700.HK').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5E2.SI').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/70\.4%/).length).toBeGreaterThan(0);

    // 7. Hovering slice triggers popover tooltip
    const slice0700 = screen.getByTestId('holdings-pie-slice-0');
    fireEvent.mouseEnter(slice0700);
    expect(screen.getByTestId('holdings-pie-tooltip')).toBeInTheDocument();
    expect(screen.getAllByText(/600 shs/i).length).toBeGreaterThan(0);

    // 8. Clicking AI Analysis triggers refresh
    fireEvent.click(aiBtn);
    expect(refreshCommentarySpy).toHaveBeenCalled();
  });
});
