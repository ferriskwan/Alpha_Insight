import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionsView } from '../../frontend/src/components/portfolio/TransactionsView';
import { PortfolioOverview } from '../../frontend/src/components/portfolio/PortfolioOverview';
import { IndustrySectorView } from '../../frontend/src/components/research/IndustrySectorView';
import apiClient from '../../frontend/src/services/apiClient';

describe('Epic 1.1.1: Frontend Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. TransactionsView "Inv Amt" Aggregation
  // ==========================================
  describe('TransactionsView — "Inv Amt" Aggregation', () => {
    const mockPositions = [
      {
        symbol: '5E2.SI',
        eodprice: 2.5,
        quantity: 6000,
        avgprice: 1.6667,
        tradedate: '2026-06-25',
        investment: false,
      },
    ];

    it('computes Inv Amt = buyConsideration - sellConsideration and applies Bal color tokens', async () => {
      vi.spyOn(apiClient, 'getTrades').mockResolvedValue([
        {
          id: 1,
          symbol: '5E2.SI',
          buysell: 'B',
          price: 2.0,
          quantity: 10000,
          tradedate: '2026-06-25T00:00:00',
          investment: false,
          remarks: 'Tactical buy long',
        },
        {
          id: 2,
          symbol: '5E2.SI',
          buysell: 'S',
          price: 2.5,
          quantity: 4000,
          tradedate: '2026-06-25T00:00:00',
          investment: false,
          remarks: 'Partial profit take',
        },
      ] as any);
      vi.spyOn(apiClient, 'getCapital').mockResolvedValue([]);
      vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue([]);
      vi.spyOn(apiClient, 'getPositions').mockResolvedValue(mockPositions as any);

      render(<TransactionsView />);

      const symbolCells = await screen.findAllByText('5E2.SI');
      expect(symbolCells.length).toBeGreaterThan(0);

      // Check for "Inv Amt" in group sub-aggregation strip
      expect(screen.getAllByText(/Inv Amt/i).length).toBeGreaterThan(0);

      // Buy = 10,000 * 2.0 = 20,000; Sell = 4,000 * 2.5 = 10,000.
      // Inv Amt = 20,000 - 10,000 = +S$10,000.00
      const invAmtBadges = screen.getAllByText('+S$10,000.00');
      expect(invAmtBadges.length).toBeGreaterThan(0);
      invAmtBadges.forEach((badge) => {
        expect(badge).toHaveClass('text-blue-700');
      });
    });

    it('renders negative Inv Amt with text-amber-700 for net short / profit taken positions', async () => {
      vi.spyOn(apiClient, 'getTrades').mockResolvedValue([
        {
          id: 1,
          symbol: '5E2.SI',
          buysell: 'B',
          price: 2.0,
          quantity: 2000,
          tradedate: '2026-06-25T00:00:00',
          investment: false,
          remarks: 'Initial buy',
        },
        {
          id: 2,
          symbol: '5E2.SI',
          buysell: 'S',
          price: 3.0,
          quantity: 3000,
          tradedate: '2026-06-26T00:00:00',
          investment: false,
          remarks: 'Short oversell',
        },
      ] as any);
      vi.spyOn(apiClient, 'getCapital').mockResolvedValue([]);
      vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue([]);
      vi.spyOn(apiClient, 'getPositions').mockResolvedValue(mockPositions as any);

      render(<TransactionsView />);

      const symbolCells = await screen.findAllByText('5E2.SI');
      expect(symbolCells.length).toBeGreaterThan(0);

      // Buy = 4,000, Sell = 9,000. Inv Amt = 4,000 - 9,000 = -S$5,000.00
      const negInvBadges = screen.getAllByText('-S$5,000.00');
      expect(negInvBadges.length).toBeGreaterThan(0);
      negInvBadges.forEach((badge) => {
        expect(badge).toHaveClass('text-amber-700');
      });
    });
  });

  // ==========================================
  // 2. PortfolioOverview Smart Layout & Decimals
  // ==========================================
  describe('PortfolioOverview — Smart Layout & Decimals', () => {
    const mockOverviewResponse = {
      parameters: {
        currency: 'SGD',
        selectedDate: '2026-11-18',
        timeframe: '12M',
      },
      kpis: {
        netAssetValue: 120000.0,
        cashBalance: 20000.0,
        marginLoan: 15000.0,
        dayPnL: 850.0,
        realizedPnL: 5000.0,
        realizedPnLPct: 6.25,
        unrealizedPnL: 15000.0,
        unrealizedPnLPct: 18.75,
        totalPnL: 20000.0,
        totalPnLPct: 25.0,
        capital: 80000.0,
        capitalPct: 66.67,
        margin: 15000.0,
        marginPct: 18.75,
        totalPortfolio: 120000.0,
        totalPortfolioPct: 20.0,
        pctReturn: 20.0,
        currency: 'SGD',
      },
      chart1_portfolio_capital_margin: [],
      chart2_pnl_breakdown: { portfolio: [], stocks: {} },
      chart1_equity_vs_benchmark: [],
      chart2_cumulative_pnl: [],
      chart3_asset_allocation: [],
      chart4_daily_pnl_drawdown: [],
    };

    const mockCommentaryResponse = {
      cached: true,
      lastUpdated: '2026-11-18T12:00:00Z',
      commentaries: {
        technical: { title: 'Technical Posture', status: 'Bullish', content: 'Support holds.' },
        fundamental: { title: 'Fundamental Analysis', status: 'Favorable', content: 'Sound metrics.' },
        macro: { title: 'Macroeconomic Context', status: 'Stable', content: 'Stable environment.' },
        risk: { title: 'Risk Management', status: 'Healthy', content: 'Prudent leverage.' },
      },
    };

    it('removes decimals from top KPI cards and provides layout mode toggles', async () => {
      vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValue(mockOverviewResponse);
      vi.spyOn(apiClient, 'getPortfolioCommentary').mockResolvedValue(mockCommentaryResponse);

      render(<PortfolioOverview />);

      // Decimals removed: e.g. SGD 120,000 instead of SGD 120,000.00
      expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();
      expect(screen.getAllByText(/SGD 120,000\b/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/SGD 80,000\b/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/SGD 15,000\b/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/SGD 5,000\b/).length).toBeGreaterThan(0);

      // Layout mode toggles should exist: Auto, Stacked, Side-by-Side
      expect(screen.getByRole('button', { name: /Auto/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stacked/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Side-by-Side/i })).toBeInTheDocument();

      // Clicking Stacked switches layout
      const stackedBtn = screen.getByRole('button', { name: /Stacked/i });
      fireEvent.click(stackedBtn);
      expect(stackedBtn).toHaveClass('bg-white');
    });
  });

  // ==========================================
  // 3. By Industry/Sector Redesign, Heatmap & Split View Reflow
  // ==========================================
  describe('IndustrySectorView — True Heatmap, Dropdown Removal & Split View 1-Col Reflow', () => {
    const mockPerfData = {
      horizon: '1D',
      asOfDate: '2026-11-26',
      benchmark: 'SPY',
      benchmarkReturn: 0.85,
      sectors: [
        {
          id: 'XLK',
          label: 'Technology',
          ticker: 'XLK',
          value: 2.07,
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
          value: 0.71,
          weight: 13.2,
          subtext: 'XLF',
          relativeRotation: 'Leading',
          rsScore: 1.012,
          rsMomentum: 0.005,
        },
        {
          id: 'XLU',
          label: 'Utilities',
          ticker: 'XLU',
          value: -1.25,
          weight: 2.3,
          subtext: 'XLU',
          relativeRotation: 'Lagging',
          rsScore: 0.94,
          rsMomentum: -0.015,
        },
      ],
      quadrantDefinitions: {},
    };

    const mockCommitteeData = {
      run_id: 205,
      symbol: 'XLK',
      sector_name: 'Technology',
      provider: 'gemini',
      model: 'gemini-4-neon',
      consensus_bias: 'Bullish',
      consensus_confidence: 88,
      executive_summary: 'Tech leadership is verified by strong AI inflows.',
      vote_breakdown: { bullish: 3, neutral: 1, bearish: 0 },
      outputs: [
        {
          role: 'technical',
          directional_bias: 'Bullish',
          confidence_score: 85,
          report_content: 'Above all major MAs.',
          key_metrics: { rs_score: 1.035 },
        },
      ],
      news_sources: [
        {
          title: 'Tech ETF XLK Rallies with AI demand',
          url: 'https://finance.yahoo.com/news/xlk-rally',
          publisher: 'Yahoo Finance',
          published_at: '2026-11-26 12:00:00',
        },
      ],
      history: [
        { run_id: 205, created_at: '2026-11-26T12:00:00Z', consensus_bias: 'Bullish', model: 'gemini-4-neon' },
        { run_id: 198, created_at: '2026-11-20T10:00:00Z', consensus_bias: 'Neutral', model: 'gemini-4-neon' },
      ],
      created_at: '2026-11-26T12:00:00Z',
    };

    it('removes sector and model dropdown lists from the top toolbar', async () => {
      vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue(mockPerfData);
      vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue(mockCommitteeData);

      render(<IndustrySectorView />);

      expect(await screen.findByText('GICS Sector Performance Heatmap')).toBeInTheDocument();

      // Ensure dropdowns are removed
      expect(screen.queryByRole('combobox', { name: /Sector/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /Agent Model/i })).not.toBeInTheDocument();
    });

    it('renders true financial heatmap with weighted treemap tiles, heat colors, and matrix view switcher', async () => {
      vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue(mockPerfData);
      vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue(mockCommitteeData);

      render(<IndustrySectorView />);

      expect(await screen.findByText('GICS Sector Performance Heatmap')).toBeInTheDocument();

      // S&P 500 benchmark pill
      expect(screen.getByText(/SPY: \+0\.85%/)).toBeInTheDocument();

      // Treemap tiles should exist with sector weights and performance
      expect(screen.getAllByText('XLK').length).toBeGreaterThan(0);
      expect(screen.getByText('29.5% wt')).toBeInTheDocument();
      expect(screen.getAllByText('+2.07%').length).toBeGreaterThan(0);

      // Switch to Matrix view
      const matrixBtn = screen.getByRole('button', { name: /Matrix/i });
      fireEvent.click(matrixBtn);

      // Matrix table headers and sectors should appear
      expect(screen.getByText('Sector')).toBeInTheDocument();
      expect(screen.getAllByText('1D').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1Y').length).toBeGreaterThan(0);
    });

    it('sorts Treemap sectors by 4 RRG Quadrants with lifecycle breadcrumb and supports sort toggling', async () => {
      vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue(mockPerfData);
      vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue(mockCommitteeData);

      render(<IndustrySectorView />);

      expect(await screen.findByText('GICS Sector Performance Heatmap')).toBeInTheDocument();

      // Breadcrumb showing RRG rotation sequence should be rendered by default
      expect(screen.getByText('RRG Rotation Order:')).toBeInTheDocument();
      expect(screen.getByText(/Leading \(/i)).toBeInTheDocument();
      expect(screen.getByText(/Lagging \(/i)).toBeInTheDocument();

      // Sort buttons are present in the header
      const quadSortBtn = screen.getByRole('button', { name: 'Quadrants' });
      const weightSortBtn = screen.getByRole('button', { name: 'Weight' });
      const returnSortBtn = screen.getByRole('button', { name: 'Return' });

      expect(quadSortBtn).toBeInTheDocument();
      expect(weightSortBtn).toBeInTheDocument();
      expect(returnSortBtn).toBeInTheDocument();

      // Toggle to Weight sort
      fireEvent.click(weightSortBtn);
      expect(screen.queryByText('RRG Rotation Order:')).not.toBeInTheDocument();

      // Toggle to Return sort
      fireEvent.click(returnSortBtn);
      expect(screen.queryByText('RRG Rotation Order:')).not.toBeInTheDocument();

      // Toggle back to Quadrant sort
      fireEvent.click(quadSortBtn);
      expect(screen.getByText('RRG Rotation Order:')).toBeInTheDocument();
    });

    it('enforces 1 analysis per day limit: active when not run today, disabled when already run today', async () => {
      vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue(mockPerfData);

      // Case 1: Run was in the past (e.g. 2026-11-20) -> button is active
      vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue({
        ...mockCommitteeData,
        created_at: '2026-11-20T10:00:00Z',
        daily_quota_reached: false,
      });

      const { unmount } = render(<IndustrySectorView />);
      expect(await screen.findByRole('button', { name: /AI Analysis \(1\/day\)/i })).toBeInTheDocument();
      unmount();

      // Case 2: Run was created today -> button shows "Analyzed Today"
      const todayISO = new Date().toISOString();
      vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue({
        ...mockCommitteeData,
        created_at: todayISO,
        daily_quota_reached: true,
      });

      render(<IndustrySectorView />);
      expect(await screen.findByText(/Analyzed Today \(1\/day\)/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /AI Analysis \(1\/day\)/i })).not.toBeInTheDocument();
    });

    it('reflows from 2-column layout to 1-column layout when isSplitView is true or 1 Col selected', async () => {
      vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue(mockPerfData);
      vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue(mockCommitteeData);

      // Render in Split View
      const { container } = render(<IndustrySectorView isSplitView={true} />);

      expect(await screen.findByText('GICS Sector Performance Heatmap')).toBeInTheDocument();

      // The grid should have class 'grid-cols-1' and NOT 'lg:grid-cols-2'
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1');
      expect(gridContainer).not.toHaveClass('lg:grid-cols-2');

      // Manual toolbar layout switcher can also be clicked
      const twoColBtn = screen.getByRole('button', { name: '2 Col' });
      fireEvent.click(twoColBtn);
      expect(gridContainer).toHaveClass('lg:grid-cols-2');
    });

    it('navigates historical runs via date stepper', async () => {
      vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValue(mockPerfData);

      const committeeSpy = vi.spyOn(apiClient, 'getSectorCommittee').mockResolvedValue({
        ...mockCommitteeData,
        history: [
          { run_id: 205, created_at: '2026-11-26T12:00:00Z', consensus_bias: 'Bullish', model: 'gemini-4-neon' },
          { run_id: 198, created_at: '2026-11-20T10:00:00Z', consensus_bias: 'Neutral', model: 'gemini-4-neon' },
        ],
      });

      render(<IndustrySectorView />);

      expect(await screen.findByText('GICS Sector Performance Heatmap')).toBeInTheDocument();

      // Click previous historical run stepper button
      const prevBtn = screen.getByTitle('Previous historical analysis run');
      fireEvent.click(prevBtn);

      // Should have triggered loadCommittee with run_id 198
      await waitFor(() => {
        expect(committeeSpy).toHaveBeenCalledWith('XLK', 198);
      });
    });
  });
});
