import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortfolioOverview from '../../frontend/src/components/portfolio/PortfolioOverview';
import apiClient from '../../frontend/src/services/apiClient';

describe('Epic 0.6: Portfolio Overview Upgrade Frontend Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
    chart1_portfolio_capital_margin: [
      {
        date: '2026-01-02',
        portfolioSize: 100000.0,
        portfolioSizePct: 0.0,
        capital: 80000.0,
        capitalPct: 0.0,
        margin: 20000.0,
        marginPct: 0.0,
      },
      {
        date: '2026-11-18',
        portfolioSize: 120000.0,
        portfolioSizePct: 20.0,
        capital: 80000.0,
        capitalPct: 0.0,
        margin: 15000.0,
        marginPct: -25.0,
      },
    ],
    chart2_pnl_breakdown: {
      portfolio: [
        { date: '2026-01-02', pnl: 0.0, pnlPct: 0.0 },
        { date: '2026-11-18', pnl: 20000.0, pnlPct: 25.0 },
      ],
      stocks: {
        '5E2.SI': [
          { date: '2026-01-02', pnl: 0.0, pnlPct: 0.0 },
          { date: '2026-11-18', pnl: 12000.0, pnlPct: 30.0 },
        ],
        'D05.SI': [
          { date: '2026-01-02', pnl: 0.0, pnlPct: 0.0 },
          { date: '2026-11-18', pnl: 8000.0, pnlPct: 20.0 },
        ],
      },
    },
    chart1_equity_vs_benchmark: [],
    chart2_cumulative_pnl: [],
    chart3_asset_allocation: [],
    chart4_daily_pnl_drawdown: [],
  };

  const mockCommentaryResponse = {
    cached: true,
    lastUpdated: '2026-11-18T12:00:00Z',
    commentaries: {
      technical: {
        title: 'Technical Posture',
        status: 'Bullish',
        content: 'Core holdings maintain steady trend support relative to moving averages.',
      },
      fundamental: {
        title: 'Fundamental Analysis',
        status: 'Favorable',
        content: 'Deployed equity capital underpins valuation health with positive return generation.',
      },
      macro: {
        title: 'Macroeconomic Context',
        status: 'Stable',
        content: 'Accounts evaluated in base currency with multi-currency coverage.',
      },
      risk: {
        title: 'Risk Management',
        status: 'Healthy',
        content: 'Margin leverage remains comfortably below liquidation ceilings.',
      },
    },
  };

  it('renders all 6 metric badges with rollover formula tooltips and currency defaults', async () => {
    vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValue(mockOverviewResponse);
    vi.spyOn(apiClient, 'getPortfolioCommentary').mockResolvedValue(mockCommentaryResponse);

    render(<PortfolioOverview />);

    // Header assertion
    expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();

    // 6 KPI badges present
    expect(screen.getByText('Realized PnL')).toBeInTheDocument();
    expect(screen.getByText('Unrealized PnL')).toBeInTheDocument();
    expect(screen.getByText('Total PnL')).toBeInTheDocument();
    expect(screen.getAllByText('Capital').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Margin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Total Portfolio').length).toBeGreaterThanOrEqual(1);

    // Rollover formula tooltip check
    const formulaBtn = screen.getByLabelText('Formula for Realized PnL');
    expect(formulaBtn).toBeInTheDocument();
    fireEvent.mouseEnter(formulaBtn);
    expect(await screen.findByText(/Cumulative realized gains from closed trades/i)).toBeInTheDocument();
  });

  it('toggles between Amount mode and Percentage mode', async () => {
    vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValue(mockOverviewResponse);
    vi.spyOn(apiClient, 'getPortfolioCommentary').mockResolvedValue(mockCommentaryResponse);

    render(<PortfolioOverview />);

    expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();

    // By default, Amount mode shows currency values
    expect(screen.getByText(/SGD 5,000.00/i)).toBeInTheDocument();

    // Switch to Percentage mode
    const pctButton = screen.getByRole('button', { name: /Percentage/i });
    fireEvent.click(pctButton);

    // Percentage value is now displayed as primary
    expect(screen.getByText('+6.25%')).toBeInTheDocument();
  });

  it('allows toggling Chart 2 individual stock lines and re-fetching commentary', async () => {
    vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValue(mockOverviewResponse);
    vi.spyOn(apiClient, 'getPortfolioCommentary').mockResolvedValue(mockCommentaryResponse);
    const refreshSpy = vi.spyOn(apiClient, 'refreshPortfolioCommentary').mockResolvedValue({
      ...mockCommentaryResponse,
      cached: false,
    });

    render(<PortfolioOverview />);

    expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();

    // Top stock pill buttons rendered
    const stockPill = await screen.findByLabelText(/Toggle 5E2.SI/i);
    expect(stockPill).toBeInTheDocument();
    fireEvent.click(stockPill); // Toggle off

    // Trigger AI commentary refresh
    const refreshAiBtn = screen.getByRole('button', { name: /Refresh AI Commentary/i });
    fireEvent.click(refreshAiBtn);

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'SGD' })
      );
    });
  });

  it('allows scrolling backward and forward in date with chevron buttons', async () => {
    const overviewSpy = vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValue(mockOverviewResponse);
    vi.spyOn(apiClient, 'getPortfolioCommentary').mockResolvedValue(mockCommentaryResponse);

    render(<PortfolioOverview />);

    expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();

    // Find Previous Day and Next Day buttons
    const prevBtn = screen.getByLabelText('Previous Day');
    const nextBtn = screen.getByLabelText('Next Day');

    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    // Step backward by 1 day
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(overviewSpy).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-11-17' })
      );
    });

    // Step forward by 1 day
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(overviewSpy).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-11-18' })
      );
    });
  });
});
