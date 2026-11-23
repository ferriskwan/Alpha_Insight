import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TransactionsView } from '../../frontend/src/components/portfolio/TransactionsView';
import { PortfolioOverview } from '../../frontend/src/components/portfolio/PortfolioOverview';
import { MacroeconomicsView } from '../../frontend/src/components/research/MacroeconomicsView';
import { AnalystCommitteeView } from '../../frontend/src/components/research/AnalystCommitteeView';
import { SiteMapAdmin, buildSortedHierarchyTree } from '../../frontend/src/components/admin/SiteMapAdmin';
import apiClient from '../../frontend/src/services/apiClient';
import { SiteMapNode } from '../../frontend/src/types/api';

vi.mock('../../frontend/src/services/apiClient', () => ({
  default: {
    getTrades: vi.fn(),
    getCapital: vi.fn(),
    getTransCosts: vi.fn(),
    getPositions: vi.fn(),
    getWatchlistItems: vi.fn(),
    getPortfolioOverview: vi.fn(),
    getPortfolioCommentary: vi.fn(),
    getCommitteeModels: vi.fn(),
    getCommitteeRuns: vi.fn(),
    getCommitteeRunDetail: vi.fn(),
    getCommitteeOutputs: vi.fn(),
    getStockAnalyst: vi.fn(),
    getIntradayCandles: vi.fn(),
    getLatestMacroWorkbench: vi.fn(),
    getAdminSitemap: vi.fn(),
    updateSiteMapNode: vi.fn(),
  },
}));

vi.mock('../../frontend/src/components/analyst/InteractiveCanvasChart', () => ({
  default: () => <div data-testid="mock-canvas-chart" />,
}));

const mockApi = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('Epic 1.0.1 Frontend Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Item 1: TransactionsView renders alphabetical HKD/SGD/USD sub-totals, omits qty/avg/net-bal, and uses HK$', async () => {
    mockApi.getTrades.mockResolvedValue([
      {
        id: 1,
        symbol: 'GLW',
        buysell: 'B',
        price: 100,
        quantity: 10,
        tradedate: '2026-11-10T00:00:00',
        investment: true,
        remarks: 'USD buy',
        currency: 'USD',
        fx_rate: 1.0,
      },
      {
        id: 2,
        symbol: 'D05.SI',
        buysell: 'B',
        price: 50,
        quantity: 20,
        tradedate: '2026-11-11T00:00:00',
        investment: true,
        remarks: 'SGD buy',
        currency: 'SGD',
        fx_rate: 1.25,
      },
      {
        id: 3,
        symbol: '9988.HK',
        buysell: 'B',
        price: 100,
        quantity: 78,
        tradedate: '2026-11-12T00:00:00',
        investment: true,
        remarks: 'HKD buy',
        currency: 'HKD',
        fx_rate: 7.8,
      },
    ]);
    mockApi.getCapital.mockResolvedValue([]);
    mockApi.getTransCosts.mockResolvedValue([]);
    mockApi.getPositions.mockResolvedValue([]);
    mockApi.getWatchlistItems.mockResolvedValue([]);

    render(<TransactionsView />);

    await waitFor(() => {
      expect(screen.getByTestId('subtotal-row-HKD')).toBeTruthy();
    });

    const tfoot = screen.getByTestId('subtotal-row-HKD').closest('tfoot')!;
    const rows = within(tfoot).getAllByRole('row');
    // Alphabetical order: HKD, SGD, USD, then Grand Total
    expect(rows[0].getAttribute('data-testid')).toBe('subtotal-row-HKD');
    expect(rows[1].getAttribute('data-testid')).toBe('subtotal-row-SGD');
    expect(rows[2].getAttribute('data-testid')).toBe('subtotal-row-USD');
    expect(rows[3].getAttribute('data-testid')).toBe('grand-total-row');

    // HKD subtotal shows HK$ and omits Avg / Net Bal / share qty
    expect(rows[0].textContent).toContain('HKD Sub-Total (1 trade)');
    expect(rows[0].textContent).toContain('HK$7,800.00');
    expect(rows[0].textContent).not.toContain('Avg');
    expect(rows[0].textContent).not.toContain('Net Bal');

    // Grand Total consolidates USD (1000) + SGD (1000/1.25=800) + HKD (7800/7.8=1000) = $2,800.00
    expect(rows[3].textContent).toContain('Grand Total (3 trades)');
    expect(rows[3].textContent).toContain('$2,800.00');
    expect(rows[3].textContent).not.toContain('Net Bal');
  });

  it('Item 2: PortfolioOverview checkboxes toggle lines without altering Total and render Trade/Capital markers', async () => {
    mockApi.getPortfolioOverview.mockResolvedValue({
      parameters: { currency: 'SGD', selectedDate: '2026-11-17', timeframe: '12M' },
      kpis: {
        realizedPnL: 1000,
        realizedPnLPct: 1,
        unrealizedPnL: 2000,
        unrealizedPnLPct: 2,
        totalPnL: 3000,
        totalPnLPct: 3,
        capital: 100000,
        capitalPct: 100,
        margin: 10000,
        marginPct: 10,
        totalPortfolio: 113000,
        totalPortfolioPct: 13,
        currency: 'SGD',
      },
      chart1_portfolio_capital_margin: [
        { date: '2026-11-16', portfolioSize: 100000, portfolioSizePct: 0, capital: 80000, capitalPct: 0, margin: 10000, marginPct: 0 },
        { date: '2026-11-17', portfolioSize: 113000, portfolioSizePct: 13, capital: 100000, capitalPct: 25, margin: 10000, marginPct: 0 },
      ],
      chart2_pnl_breakdown: {
        portfolio: [
          { date: '2026-11-16', pnl: 1000, pnlPct: 1 },
          { date: '2026-11-17', pnl: 3000, pnlPct: 3 },
        ],
        stocks: {
          '9988.HK': [
            { date: '2026-11-16', pnl: 500, pnlPct: 1 },
            { date: '2026-11-17', pnl: 1200, pnlPct: 2.4 },
          ],
          GLW: [
            { date: '2026-11-16', pnl: 500, pnlPct: 1 },
            { date: '2026-11-17', pnl: 1800, pnlPct: 3.6 },
          ],
        },
      },
      chart1_equity_vs_benchmark: [],
      chart2_cumulative_pnl: [],
      chart3_asset_allocation: [],
      chart4_daily_pnl_drawdown: [],
      trade_annotations: [
        { date: '2026-11-16', symbol: '9988.HK', buysell: 'B', quantity: 100, price: 115, currency: 'HKD', remarks: 'Add' },
      ],
      capital_annotations: [
        { date: '2026-11-17', transtype: 'D', amount: 20000, currency: 'SGD', broker: 'Saxo', remarks: 'Top up' },
      ],
    });
    mockApi.getPortfolioCommentary.mockResolvedValue({ cached: true, lastUpdated: '', commentaries: {} });

    render(<PortfolioOverview />);

    await waitFor(() => {
      expect(screen.getByTestId('chart1-line-portfolio')).toBeTruthy();
      expect(screen.getByTestId('chart1-trade-marker-2026-11-16')).toBeTruthy();
      expect(screen.getByTestId('chart1-capital-marker-2026-11-17')).toBeTruthy();
      expect(screen.getByTestId('chart2-line-total')).toBeTruthy();
    });

    // Unchecking GLW does not remove Total line
    const glwCheckbox = screen.getByLabelText('Toggle GLW');
    fireEvent.click(glwCheckbox);
    expect(screen.getByTestId('chart2-line-total')).toBeTruthy();

    // Unchecking Margin hides margin polyline
    const marginCheckbox = screen.getByLabelText('Toggle Margin Loan');
    fireEvent.click(marginCheckbox);
    expect(screen.queryByTestId('chart1-line-margin')).toBeNull();
  });

  it('Item 4: MacroeconomicsView renders backdated run selector and loads selected run', async () => {
    mockApi.getCommitteeModels.mockResolvedValue([
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', provider: 'gemini', is_default: true },
      { id: 'gemini-4-neon', label: 'Gemini 4 Neon', provider: 'gemini', is_default: false },
    ]);
    mockApi.getLatestMacroWorkbench.mockResolvedValue({
      run: {
        id: 20,
        symbol: 'MACRO',
        provider: 'gemini',
        model: 'gemini-4-argon',
        consensus_bias: 'Neutral',
        consensus_confidence: 75,
        executive_summary: 'Latest macro run',
        created_at: '2026-11-23T10:00:00Z',
        outputs: [],
      },
      outputs: [
        {
          id: 201,
          run_id: 20,
          symbol: 'MACRO',
          analyst_role: 'macro_us',
          directional_bias: 'Neutral',
          confidence_score: 75,
          summary_headline: 'Latest US Macro',
          analysis_markdown: 'Latest US Macro details',
          created_at: '2026-11-23T10:00:00Z',
        },
      ],
      past_outputs: [],
      watchlist_context: { total_symbols: 10, us_symbols: [], sgx_apac_symbols: [], secular_ai_symbols: [] },
      benchmark_snapshots: [],
      fx_rates: [],
      chart_candles: [],
      intraday_candles: [],
    });
    mockApi.getCommitteeRuns.mockResolvedValue([
      { id: 20, symbol: 'MACRO', provider: 'gemini', model: 'gemini-4-argon', consensus_bias: 'Neutral', consensus_confidence: 75, created_at: '2026-11-23T10:00:00Z' },
      { id: 19, symbol: 'MACRO', provider: 'gemini', model: 'gemini-4-neon', consensus_bias: 'Bullish', consensus_confidence: 82, created_at: '2026-11-20T10:00:00Z' },
    ]);
    mockApi.getCommitteeRunDetail.mockResolvedValue({
      id: 19,
      symbol: 'MACRO',
      provider: 'gemini',
      model: 'gemini-4-neon',
      consensus_bias: 'Bullish',
      consensus_confidence: 82,
      executive_summary: 'Backdated macro run',
      created_at: '2026-11-20T10:00:00Z',
      outputs: [
        {
          id: 191,
          run_id: 19,
          symbol: 'MACRO',
          analyst_role: 'macro_us',
          directional_bias: 'Bullish',
          confidence_score: 82,
          summary_headline: 'Backdated US Macro',
          analysis_markdown: 'Backdated US Macro details',
          created_at: '2026-11-20T10:00:00Z',
        },
      ],
    });

    render(<MacroeconomicsView />);

    await waitFor(() => {
      expect(screen.getAllByText('Latest US Macro').length).toBeGreaterThan(0);
    });

    const prevBtn = screen.getByTestId('timeline-step-prev');
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(mockApi.getCommitteeRunDetail).toHaveBeenCalledWith(19);
      expect(screen.getAllByText('Backdated US Macro').length).toBeGreaterThan(0);
    });
  });

  it('Item 5: SiteMapAdmin builds nested hierarchy sorted by order_index matching sidebar', () => {
    const flat: SiteMapNode[] = [
      { id: 2, parent_id: 1, menu_code: 'p.overview', label: 'Overview', route: '/p/o', icon: null, role_required: 'user', order_index: 1, is_active: true },
      { id: 5, parent_id: 4, menu_code: 'a.users', label: 'User Admin', route: '/a/u', icon: null, role_required: 'admin', order_index: 1, is_active: true },
      { id: 3, parent_id: 1, menu_code: 'p.tx', label: 'Transactions', route: '/p/t', icon: null, role_required: 'user', order_index: 2, is_active: true },
      { id: 6, parent_id: 3, menu_code: 'p.tx.inv', label: 'Investment', route: '/p/t/i', icon: null, role_required: 'user', order_index: 1, is_active: true },
      { id: 4, parent_id: null, menu_code: 'admin', label: 'Admin', route: '/a', icon: null, role_required: 'admin', order_index: 40, is_active: true },
      { id: 1, parent_id: null, menu_code: 'portfolio', label: 'My Portfolio', route: '/p', icon: null, role_required: 'user', order_index: 10, is_active: true },
    ];

    const tree = buildSortedHierarchyTree(flat);
    expect(tree.map((n) => n.label)).toEqual(['My Portfolio', 'Admin']);
    expect(tree[0].children?.map((c) => c.label)).toEqual(['Overview', 'Transactions']);
    expect(tree[0].children?.[1].children?.map((c) => c.label)).toEqual(['Investment']);
    expect(tree[1].children?.map((c) => c.label)).toEqual(['User Admin']);
  });

  it('Item 6: AnalystCommitteeView sorts Watchlist Symbol dropdown into My Positions, Other Stocks, Indexes alphabetically', async () => {
    mockApi.getWatchlistItems.mockResolvedValue([
      { user_id: 1, watchlistname: 'Index', symbol: '^SPX', name: 'S&P 500', currency: 'USD' },
      { user_id: 1, watchlistname: 'Default', symbol: 'NVDA', name: 'NVIDIA', currency: 'USD' },
      { user_id: 1, watchlistname: 'Default', symbol: 'GLW', name: 'Corning', currency: 'USD' },
      { user_id: 1, watchlistname: 'Default', symbol: '0700.HK', name: 'Tencent', currency: 'HKD' },
      { user_id: 1, watchlistname: 'Default', symbol: 'AAPL', name: 'Apple', currency: 'USD' },
      { user_id: 1, watchlistname: 'Index', symbol: '^DJI', name: 'Dow Jones', currency: 'USD' },
    ]);
    mockApi.getPositions.mockResolvedValue([
      { user_id: 1, symbol: 'GLW', quantity: 1200, avgprice: 177, eodprice: 106, investment: true },
      { user_id: 1, symbol: '0700.HK', quantity: 600, avgprice: 466, eodprice: 400, investment: true },
    ]);
    mockApi.getCommitteeModels.mockResolvedValue([
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon', provider: 'gemini', is_default: true },
    ]);
    mockApi.getCommitteeRuns.mockResolvedValue([]);
    mockApi.getCommitteeOutputs.mockResolvedValue([]);
    mockApi.getStockAnalyst.mockResolvedValue({ candles: [], trades: [] });
    mockApi.getIntradayCandles.mockResolvedValue({ candles: [] });

    render(<AnalystCommitteeView />);

    await waitFor(() => {
      const select = screen.getByLabelText('Watchlist Symbol');
      const optgroups = select.querySelectorAll('optgroup');
      expect(optgroups.length).toBe(3);
      expect(optgroups[0].getAttribute('label')).toBe('My Positions');
      expect(optgroups[1].getAttribute('label')).toBe('Other Stocks');
      expect(optgroups[2].getAttribute('label')).toBe('Indexes');

      const posOpts = Array.from(optgroups[0].querySelectorAll('option')).map((o) => o.value);
      const otherOpts = Array.from(optgroups[1].querySelectorAll('option')).map((o) => o.value);
      const idxOpts = Array.from(optgroups[2].querySelectorAll('option')).map((o) => o.value);

      expect(posOpts).toEqual(['0700.HK', 'GLW']);
      expect(otherOpts).toEqual(['AAPL', 'NVDA']);
      expect(idxOpts).toEqual(['^DJI', '^SPX']);
    });
  });
});
