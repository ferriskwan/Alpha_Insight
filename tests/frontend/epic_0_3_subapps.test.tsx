import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortfolioOverview from '../../frontend/src/components/portfolio/PortfolioOverview';
import TransactionsView from '../../frontend/src/components/portfolio/TransactionsView';
import WatchlistView from '../../frontend/src/components/portfolio/WatchlistView';
import StockAnalystView from '../../frontend/src/components/research/StockAnalystView';
import MacroeconomicsView from '../../frontend/src/components/research/MacroeconomicsView';
import IndustrySectorView from '../../frontend/src/components/research/IndustrySectorView';
import apiClient from '../../frontend/src/services/apiClient';

describe('Epic 0.3 Frontend Sub-Applications Unit & Interaction Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders PortfolioOverview with 4 synchronized charts and KPI metric cards', async () => {
    vi.spyOn(apiClient, 'getPortfolioOverview').mockResolvedValueOnce({
      kpis: {
        netAssetValue: 125000.0,
        cashBalance: 25000.0,
        marginLoan: 0.0,
        dayPnL: 1250.0,
        realizedPnL: 5000.0,
        unrealizedPnL: 15000.0,
        pctReturn: 20.0,
        currency: 'USD',
      },
      chart1_equity_vs_benchmark: [
        { date: '2026-03-01', equity: 100000.0, benchmark: 100000.0, totalCapital: 100000.0 },
        { date: '2026-03-31', equity: 125000.0, benchmark: 110000.0, totalCapital: 100000.0 },
      ],
      chart2_cumulative_pnl: [
        { date: '2026-03-01', realizedPnL: 0.0, unrealizedPnL: 0.0, totalPnL: 0.0 },
        { date: '2026-03-31', realizedPnL: 5000.0, unrealizedPnL: 15000.0, totalPnL: 20000.0 },
      ],
      chart3_asset_allocation: [
        { category: 'Equities', name: 'AAPL', value: 100000.0, percentage: 80.0, currency: 'USD' },
        { category: 'Cash', name: 'Cash (USD)', value: 25000.0, percentage: 20.0, currency: 'USD' },
      ],
      chart4_daily_pnl_drawdown: [
        { date: '2026-03-01', dailyPnL: 500.0, drawdownPct: 0.0, highWaterMark: 100000.0 },
        { date: '2026-03-31', dailyPnL: 1250.0, drawdownPct: -1.2, highWaterMark: 126000.0 },
      ],
    });

    render(<PortfolioOverview />);

    // Check title and KPI cards
    expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();
    expect(screen.getByText('Net Asset Value')).toBeInTheDocument();
    expect(screen.getByText('Cash Available')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Equity Curve vs SPY Benchmark')).toBeInTheDocument();
    expect(screen.getByText('Cumulative Realized vs Unrealized PnL')).toBeInTheDocument();
    expect(screen.getByText('Asset & Currency Exposure Distribution')).toBeInTheDocument();
    expect(screen.getByText('Daily PnL & High-Water Mark Drawdown')).toBeInTheDocument();
  });

  it('renders TransactionsView with 3-tab ledger and order ticket modal', async () => {
    vi.spyOn(apiClient, 'getTrades').mockResolvedValueOnce([
      {
        id: 1,
        symbol: 'NVDA',
        buysell: 'B',
        tradedate: '2026-03-15',
        investment: true,
        price: 850.0,
        quantity: 10,
        remarks: 'Institutional Core',
      },
    ]);
    vi.spyOn(apiClient, 'getCapital').mockResolvedValueOnce([]);
    vi.spyOn(apiClient, 'getTransCosts').mockResolvedValueOnce([]);

    render(<TransactionsView />);

    expect(await screen.findByRole('heading', { level: 1, name: /Transactions/i })).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();

    // Open Modal
    const newTicketBtn = screen.getByText('New trade');
    fireEvent.click(newTicketBtn);

    expect(screen.getByText('New Trade Order Ticket')).toBeInTheDocument();
    expect(screen.getByText('Submit Trade')).toBeInTheDocument();
  });

  it('renders WatchlistView with market quotes and add symbol modal', async () => {
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValueOnce([
      {
        user_id: 1,
        watchlistname: 'Default',
        symbol: 'MSFT',
        name: 'Microsoft Corp',
        lastPrice: 420.5,
        change: 3.25,
        changePct: 0.78,
        dayHigh: 422.0,
        dayLow: 418.0,
        volume: 18500000,
        high52: 430.0,
        low52: 320.0,
        currency: 'USD',
      },
    ]);

    render(<WatchlistView />);

    expect(await screen.findByRole('heading', { level: 1, name: /Watchlist/i })).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('$420.50')).toBeInTheDocument();
    expect(screen.getByText('+0.78%')).toBeInTheDocument();
  });

  it('renders StockAnalystView with 2-way mode toggle [Interactive Canvas | Matplotlib]', async () => {
    vi.spyOn(apiClient, 'getStockAnalystData').mockResolvedValue({
      symbol: 'AAPL',
      latestPrice: 185.0,
      dayChange: 1.45,
      dayChangePct: 0.79,
      timeframe: '1Y',
      indicators: { smaPeriod: 20, emaPeriod: 50, bbPeriod: 20, rsiPeriod: 14 },
      series: [
        {
          date: '2026-03-31',
          open: 184.0,
          high: 186.0,
          low: 183.5,
          close: 185.0,
          volume: 2500000,
          sma: 182.4,
          ema: 179.8,
          bbUpper: 190.2,
          bbMiddle: 182.4,
          bbLower: 174.6,
          rsi: 58.2,
          macd: 1.25,
          macdSignal: 0.95,
          macdHist: 0.3,
        },
      ],
      trades: [
        { id: 1, date: '2026-03-15', action: 'B', price: 175.0, quantity: 100, investment: true },
      ],
    });

    render(<StockAnalystView initialSymbol="AAPL" />);

    expect(await screen.findByText('AAPL Candlestick & Technical Research')).toBeInTheDocument();
    expect(screen.getByText('Interactive Canvas')).toBeInTheDocument();
    expect(screen.getByText('Matplotlib (charting.py)')).toBeInTheDocument();

    // Toggle to Matplotlib
    const matplotlibToggle = screen.getByText('Matplotlib (charting.py)');
    fireEvent.click(matplotlibToggle);

    // Verify static snapshot subtitle and mode rendered
    expect(
      screen.getByText(/Institutional Matplotlib \(charting\.py\) server-side rendered vector screenshot/i)
    ).toBeInTheDocument();
  });

  it('renders MacroeconomicsView with Watchlist-derived benchmark chart, FX crosses, and specialist tabs', async () => {
    vi.spyOn(apiClient, 'getCommitteeModels').mockResolvedValueOnce([
      {
        id: 'gemini-4-argon',
        label: 'Gemini 4 Argon',
        provider: 'gemini',
        is_default: true,
      },
    ]);
    vi.spyOn(apiClient, 'getLatestMacroWorkbench').mockResolvedValueOnce({
      run: null,
      outputs: [],
      past_outputs: [],
      benchmark_symbol: '^SPX',
      watchlist_symbols: ['^SPX', 'NVDA', 'D05.SI'],
      watchlist_exposure: {
        us_equities_and_etfs: ['NVDA'],
        sgx_and_apac: ['D05.SI'],
        secular_and_thematic: ['NVDA'],
        benchmarks: ['^SPX'],
      },
      benchmark_snapshots: [
        { symbol: '^SPX', name: 'S&P 500 Index', last_price: 5950.25, change: 24.5, change_pct: 0.41, currency: 'USD' },
      ],
      fx_rates: [{ pair: 'USD/SGD', rate: 1.345, date: '2026-11-18' }],
      chart_candles: [],
      intraday_candles: [],
    });

    render(<MacroeconomicsView />);

    expect(await screen.findByText('Macroeconomics')).toBeInTheDocument();
    expect(screen.getAllByText('Global & US Macro')[0]).toBeInTheDocument();
    expect(screen.getByText('SG & Asia-Pacific Macro')).toBeInTheDocument();
    expect(screen.getByText('Secular & Geopolitics')).toBeInTheDocument();
    expect(screen.getByText('USD/SGD')).toBeInTheDocument();
  });

  it('renders IndustrySectorView with 11 GICS sector performance heatmap', async () => {
    vi.spyOn(apiClient, 'getSectorPerformance').mockResolvedValueOnce({
      horizon: '1D',
      asOfDate: '2026-03-31',
      benchmark: 'SPY',
      benchmarkReturn: 0.75,
      sectors: [
        { id: 'XLK', label: 'Information Technology', ticker: 'XLK', value: 1.45, weight: 29.5, subtext: 'XLK', relativeRotation: 'Leading' },
        { id: 'XLF', label: 'Financials', ticker: 'XLF', value: 0.82, weight: 13.2, subtext: 'XLF', relativeRotation: 'Improving' },
        { id: 'XLE', label: 'Energy', ticker: 'XLE', value: -1.15, weight: 3.8, subtext: 'XLE', relativeRotation: 'Lagging' },
      ],
    });

    render(<IndustrySectorView />);

    expect(await screen.findByText('GICS Industry & Sector Heatmap')).toBeInTheDocument();
    expect(screen.getByText('11 GICS Sectors Relative Performance')).toBeInTheDocument();
    expect(screen.getAllByText('Information Technology')[0]).toBeInTheDocument();
    expect(screen.getAllByText('+1.45%')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Leading')[0]).toBeInTheDocument();
  });
});
