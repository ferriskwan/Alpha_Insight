import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalystCommitteeView from '../../frontend/src/components/research/AnalystCommitteeView';
import MacroeconomicsView from '../../frontend/src/components/research/MacroeconomicsView';
import InvestmentNotesView from '../../frontend/src/components/notes/InvestmentNotesView';
import { FloatingAgentChat } from '../../frontend/src/design-system';
import apiClient from '../../frontend/src/services/apiClient';
import { AgentAnalystOutputDTO, CommitteeRunDetailDTO } from '../../frontend/src/types/api';

const SAMPLE_OUTPUTS: AgentAnalystOutputDTO[] = [
  {
    id: 101,
    run_id: 18,
    user_id: 1,
    symbol: 'AAPL',
    analyst_role: 'executive_summary',
    directional_bias: 'Bullish',
    confidence_score: 84,
    trend_status: 'Continuation',
    summary_headline: 'Committee consensus on AAPL is Bullish (3/4 Votes) holding Fib 61.8% support.',
    markdown_output: '### Consolidated Committee Synthesis\n- **Technical**: Holding $181.20 support.',
    structured_metrics: { votes: { technical: 'Bullish', fundamental: 'Bullish', macro: 'Neutral', risk: 'Bullish' } },
    referenced_output_ids: [91, 92],
    created_at: '2026-11-18T10:00:00Z',
  },
  {
    id: 102,
    run_id: 18,
    user_id: 1,
    symbol: 'AAPL',
    analyst_role: 'technical',
    directional_bias: 'Bullish',
    confidence_score: 82,
    trend_status: 'Continuation',
    summary_headline: 'Fib 61.8%: $181.20 | Breakout target $192.00',
    markdown_output: '### 1. Price Structure\n- Holding SMA 30.',
    structured_metrics: { latest_close: 185.0 },
    referenced_output_ids: [91],
    created_at: '2026-11-18T10:00:00Z',
  },
  {
    id: 103,
    run_id: 18,
    user_id: 1,
    symbol: 'AAPL',
    analyst_role: 'fundamental',
    directional_bias: 'Bullish',
    confidence_score: 78,
    trend_status: 'Continuation',
    summary_headline: 'Services revenue acceleration ahead of Q4 hardware catalyst.',
    markdown_output: '### 1. Catalyst Scan\n- Strong Services mix.',
    structured_metrics: {},
    referenced_output_ids: [],
    created_at: '2026-11-18T10:00:00Z',
  },
  {
    id: 104,
    run_id: 18,
    user_id: 1,
    symbol: 'AAPL',
    analyst_role: 'macro',
    directional_bias: 'Neutral',
    confidence_score: 65,
    trend_status: 'Reversal',
    summary_headline: '10Y-2Y Yield Spread +14 bps | Neutral Tech Sector Rotation',
    markdown_output: '### 1. Sovereign Yield Curve\n- Neutral rate sensitivity.',
    structured_metrics: {},
    referenced_output_ids: [],
    created_at: '2026-11-18T10:00:00Z',
  },
  {
    id: 105,
    run_id: 18,
    user_id: 1,
    symbol: 'AAPL',
    analyst_role: 'risk',
    directional_bias: 'Bullish',
    confidence_score: 84,
    trend_status: 'Continuation',
    summary_headline: 'Size: 150 shs | Bidirectional Cost Basis: $182.40 | Stop: $176.50',
    markdown_output: '### 1. Position Exposure\n- Risk within 1.25% NAV.',
    structured_metrics: {},
    referenced_output_ids: [],
    created_at: '2026-11-18T10:00:00Z',
  },
];

const SAMPLE_RUN_DETAIL: CommitteeRunDetailDTO = {
  id: 18,
  user_id: 1,
  symbol: 'AAPL',
  provider: 'gemini',
  model: 'gemini-4-argon',
  consensus_bias: 'Bullish',
  consensus_confidence: 84,
  executive_summary: 'Committee consensus is Bullish (3/4 Votes) with Fibonacci support at $181.20.',
  vote_breakdown: {
    technical: 'Bullish',
    fundamental: 'Bullish',
    macro: 'Neutral',
    risk: 'Bullish',
  },
  created_at: '2026-11-18T10:00:00Z',
  outputs: SAMPLE_OUTPUTS,
  chart_candles: [
    {
      date: '2026-11-17',
      open: 182.0,
      high: 186.0,
      low: 181.0,
      close: 185.0,
      volume: 2500000,
      sma: 180.0,
      ema: 175.0,
      bbUpper: 190.0,
      bbMiddle: 182.0,
      bbLower: 174.0,
      rsi: 55.0,
      macd: 1.2,
      macdSignal: 0.9,
      macdHist: 0.3,
    },
  ],
  chart_trades: [],
  past_outputs: SAMPLE_OUTPUTS,
};

describe('Epic 0.4 Frontend: AnalystCommitteeView, InvestmentNotesView & FloatingAgentChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders AnalystCommitteeView with gemini-4-argon default, InteractiveCanvasChart, Executive Summary, and 4 segregated analyst cards', async () => {
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValue([
      {
        user_id: 1,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        watchlistname: 'Default',
        lastPrice: 185.0,
        change: 1.4,
        changePct: 0.76,
        dayHigh: 186.5,
        dayLow: 183.2,
        volume: 2400000,
        high52: 199.62,
        low52: 164.08,
        currency: 'USD',
      },
    ]);
    vi.spyOn(apiClient, 'getCommitteeModels').mockResolvedValue([
      {
        id: 'gemini-4-neon',
        label: 'Gemini 4 Neon (Default Committee Model)',
        provider: 'gemini',
        is_default: true,
      },
    ]);
    vi.spyOn(apiClient, 'getCommitteeRuns').mockResolvedValue([SAMPLE_RUN_DETAIL]);
    vi.spyOn(apiClient, 'getCommitteeRunDetail').mockResolvedValue(SAMPLE_RUN_DETAIL);
    vi.spyOn(apiClient, 'getStoredAnalystOutputs').mockResolvedValue(SAMPLE_OUTPUTS);
    vi.spyOn(apiClient, 'getStockAnalystData').mockResolvedValue({
      symbol: 'AAPL',
      latestPrice: 185.0,
      dayChange: 1.4,
      dayChangePct: 0.76,
      timeframe: '1D',
      indicators: { smaPeriod: 30, emaPeriod: 100, bbPeriod: 20, rsiPeriod: 13 },
      series: [
        {
          date: '2026-11-17',
          open: 182.0,
          high: 186.0,
          low: 181.0,
          close: 185.0,
          volume: 2500000,
          sma: 180.0,
          ema: 175.0,
          bbUpper: 190.0,
          bbMiddle: 182.0,
          bbLower: 174.0,
          rsi: 55.0,
          macd: 1.2,
          macdSignal: 0.9,
          macdHist: 0.3,
        },
      ],
      trades: [],
    });

    const handleRefInNote = vi.fn();
    render(<AnalystCommitteeView initialSymbol="AAPL" onReferenceInNote={handleRefInNote} />);

    expect(await screen.findByText('Stock Analysis')).toBeInTheDocument();
    expect(screen.getByText('AI Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('chart-mode-multiday')).toBeInTheDocument();
    expect(screen.getByTestId('chart-mode-intraday')).toBeInTheDocument();
    expect(await screen.findByTestId('interactive-canvas-chart')).toBeInTheDocument();
    expect(await screen.findByTestId('executive-summary-card')).toBeInTheDocument();

    // Switch between Multi-day and Intraday chart modes
    fireEvent.click(screen.getByTestId('chart-mode-intraday'));
    expect(
      screen.getByText(/Intraday \(5m Interval\) • Real-Time Microstructure & Overlays/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chart-mode-multiday'));
    expect(
      screen.getByText(/Multi-day \(6M Default View\) • EOD & Technical Overlays/i)
    ).toBeInTheDocument();

    // Verify all 5 tabs render (Exec Summary, Technical, Fundamental, Macro, Risk Mgt)
    expect(screen.getByRole('tab', { name: /Exec Summary/i })).toBeInTheDocument();
    expect(screen.getByTestId('analyst-card-technical')).toBeInTheDocument();
    expect(screen.getByTestId('analyst-card-fundamental')).toBeInTheDocument();
    expect(screen.getByTestId('analyst-card-macro')).toBeInTheDocument();
    expect(screen.getByTestId('analyst-card-risk')).toBeInTheDocument();

    // Switch to Technical tab and click "Reference Technical in Note"
    fireEvent.click(screen.getByTestId('analyst-card-technical'));
    const refTechBtn = await screen.findByTestId('reference-in-note-technical');
    fireEvent.click(refTechBtn);
    expect(handleRefInNote).toHaveBeenCalledWith(SAMPLE_OUTPUTS[1]);
  });

  it('renders TimelineRunNavigator and allows navigating past committee runs via <, >, and calendar popover', async () => {
    const olderRunSummary = {
      id: 17,
      user_id: 1,
      symbol: 'AAPL',
      provider: 'gemini',
      model: 'gemini-4-argon',
      consensus_bias: 'Bearish' as const,
      consensus_confidence: 72,
      executive_summary: 'Older analysis on AAPL showing bearish divergence.',
      vote_breakdown: { technical: 'Bearish', fundamental: 'Neutral' },
      created_at: '2026-11-17T14:00:00Z',
    };
    const newerRunSummary = {
      id: 18,
      user_id: 1,
      symbol: 'AAPL',
      provider: 'gemini',
      model: 'gemini-4-argon',
      consensus_bias: 'Bullish' as const,
      consensus_confidence: 84,
      executive_summary: 'Latest analysis on AAPL with 3/4 bullish consensus.',
      vote_breakdown: { technical: 'Bullish', fundamental: 'Bullish' },
      created_at: '2026-11-18T10:00:00Z',
    };

    const olderRunDetail: CommitteeRunDetailDTO = {
      ...olderRunSummary,
      outputs: [
        {
          id: 95,
          run_id: 17,
          user_id: 1,
          symbol: 'AAPL',
          analyst_role: 'executive_summary',
          directional_bias: 'Bearish',
          confidence_score: 72,
          trend_status: 'Reversal',
          summary_headline: 'Older committee consensus: Bearish breakdown.',
          markdown_output: '### Older Run Synthesis\n- Technical breakdown below 180.',
          structured_metrics: {},
          referenced_output_ids: [],
          created_at: '2026-11-17T14:00:00Z',
        },
      ],
      chart_candles: [],
      chart_trades: [],
      past_outputs: [],
    };

    vi.spyOn(apiClient, 'getCommitteeRuns').mockResolvedValue([newerRunSummary, olderRunSummary]);
    vi.spyOn(apiClient, 'getCommitteeRunDetail').mockImplementation(async (id: number) => {
      if (id === 17) return olderRunDetail;
      return SAMPLE_RUN_DETAIL;
    });

    render(<AnalystCommitteeView initialSymbol="AAPL" />);

    // Wait for the timeline trigger button to render
    const dateTrigger = await screen.findByTestId('timeline-date-trigger');
    expect(dateTrigger).toBeInTheDocument();
    expect(screen.getByText(/Run #1 of 2/i)).toBeInTheDocument();

    // Step backward button should be enabled, forward disabled
    const stepPrevBtn = screen.getByTestId('timeline-step-prev');
    const stepNextBtn = screen.getByTestId('timeline-step-next');
    expect(stepPrevBtn).not.toBeDisabled();
    expect(stepNextBtn).toBeDisabled();

    // Click step backward (<) to go to older run
    fireEvent.click(stepPrevBtn);

    await waitFor(() => {
      expect(screen.getByText(/Run #2 of 2/i)).toBeInTheDocument();
    });
    expect(apiClient.getCommitteeRunDetail).toHaveBeenCalledWith(17);

    // Now forward is enabled, backward is disabled
    expect(stepPrevBtn).toBeDisabled();
    expect(stepNextBtn).not.toBeDisabled();

    // Click step forward (>) to return to latest run
    fireEvent.click(stepNextBtn);
    await waitFor(() => {
      expect(screen.getByText(/Run #1 of 2/i)).toBeInTheDocument();
    });

    // Click date trigger to open calendar popover
    fireEvent.click(dateTrigger);
    expect(await screen.findByTestId('timeline-calendar-popover')).toBeInTheDocument();
    expect(screen.getByText(/Completed Analyses \(2\)/i)).toBeInTheDocument();

    // Click on Run #17 in the popover list
    const run17Item = screen.getByTestId('timeline-run-item-17');
    fireEvent.click(run17Item);

    await waitFor(() => {
      expect(screen.getByText(/Run #2 of 2/i)).toBeInTheDocument();
    });
    // Popover closes after selection
    expect(screen.queryByTestId('timeline-calendar-popover')).not.toBeInTheDocument();
  });

  it('renders InvestmentNotesView with Watchlist tickers and attaches 0 to multiple (0..N) analyst outputs', async () => {
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValue([
      {
        user_id: 1,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        watchlistname: 'Default',
        lastPrice: 185.0,
        change: 1.4,
        changePct: 0.76,
        dayHigh: 186.5,
        dayLow: 183.2,
        volume: 2400000,
        high52: 199.62,
        low52: 164.08,
        currency: 'USD',
      },
    ]);
    vi.spyOn(apiClient, 'getTrades').mockResolvedValue([
      {
        id: 42,
        symbol: 'AAPL',
        buysell: 'B',
        tradedate: '2026-11-15',
        investment: true,
        price: 182.4,
        quantity: 150,
      },
    ]);
    vi.spyOn(apiClient, 'getInvestmentNotes').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getStoredAnalystOutputs').mockResolvedValue(SAMPLE_OUTPUTS);
    const createNoteSpy = vi.spyOn(apiClient, 'createInvestmentNote').mockResolvedValue({
      id: 1,
      user_id: 1,
      symbol: 'AAPL',
      trade_id: 42,
      title: 'AAPL Q4 Breakout & Margin Risk Thesis',
      content_markdown: 'Position Risk = (Entry $182.40 - Stop $176.50) * 150 = $885.00',
      thesis_status: 'In-Progress',
      tags: [],
      analyst_output_ids: [101, 102],
      linked_analyst_outputs: [SAMPLE_OUTPUTS[0], SAMPLE_OUTPUTS[1]],
      created_at: '2026-11-18T10:05:00Z',
      updated_at: '2026-11-18T10:05:00Z',
    });

    render(<InvestmentNotesView initialSymbol="AAPL" />);

    expect(await screen.findByText('Investment Notes & Thesis Journal')).toBeInTheDocument();
    expect(screen.getByText('Referenced Agent Analyst Outputs (0 Linked)')).toBeInTheDocument();

    // Open Attach 0..N Analyst Outputs modal
    fireEvent.click(screen.getByTestId('attach-analyst-outputs-btn'));
    expect(
      await screen.findByText(
        /Select 0 to multiple stored outputs from the 4 analysts or Executive Summary/i
      )
    ).toBeInTheDocument();

    // Select 2 outputs (Executive Summary #101 & Technical #102)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Done'));

    expect(await screen.findByText('Referenced Agent Analyst Outputs (2 Linked)')).toBeInTheDocument();

    // Fill title and content and save
    fireEvent.change(screen.getByLabelText('Note Title'), {
      target: { value: 'AAPL Q4 Breakout & Margin Risk Thesis' },
    });
    fireEvent.change(
      screen.getByLabelText('Core Thesis, Position Sizing Formula & Rationale (Markdown)'),
      {
        target: { value: 'Position Risk = (Entry $182.40 - Stop $176.50) * 150 = $885.00' },
      }
    );
    fireEvent.click(screen.getByTestId('save-note-btn'));

    await waitFor(() => {
      expect(createNoteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'AAPL',
          title: 'AAPL Q4 Breakout & Margin Risk Thesis',
          analyst_output_ids: [101, 102],
        })
      );
    });
  });

  it('renders FloatingAgentChat with live screen context pills and sends multi-turn questions', async () => {
    const handleSend = vi.fn();
    const handleClear = vi.fn();
    const handleClose = vi.fn();

    render(
      <FloatingAgentChat
        open={true}
        onClose={handleClose}
        model="gemini-4-neon"
        displayedContext={{
          symbol: 'AAPL',
          activeRoute: '/research/committee',
          routeTitle: 'Autonomous Analyst Committee',
          contextPills: [
            'Active Context: AAPL',
            'Committee Run #18 (4 Analysts + Exec Summary)',
            'Investment Note: Q4 Breakout Thesis',
          ],
          data: { symbol: 'AAPL', runId: 18 },
        }}
        messages={[
          {
            role: 'user',
            content: 'Why did the Macro Strategist stay Neutral while Technical voted Bullish?',
          },
          {
            role: 'assistant',
            content: 'The Macro Strategist flagged the +14 bps 10Y-2Y Treasury yield shift.',
          },
        ]}
        onSendMessage={handleSend}
        onClearChat={handleClear}
      />
    );

    expect(screen.getByTestId('floating-agent-chat')).toBeInTheDocument();
    expect(screen.getByText('Chat Session — Agentic Analyst')).toBeInTheDocument();
    expect(screen.getByTestId('chat-resize-handle')).toBeInTheDocument();
    expect(screen.getByText('gemini-4-neon')).toBeInTheDocument();
    expect(screen.getByText('Active Context: AAPL')).toBeInTheDocument();
    expect(screen.getByText('Committee Run #18 (4 Analysts + Exec Summary)')).toBeInTheDocument();
    expect(
      screen.getByText('The Macro Strategist flagged the +14 bps 10Y-2Y Treasury yield shift.')
    ).toBeInTheDocument();

    // Verify expand/restore window size toggle works
    const expandBtn = screen.getByLabelText('Toggle Chat Session size');
    fireEvent.click(expandBtn);

    const input = screen.getByLabelText('Ask a question about the displayed analysis or note');
    fireEvent.change(input, { target: { value: 'How does this affect my stop-loss?' } });
    fireEvent.click(screen.getByText('Send'));
    expect(handleSend).toHaveBeenCalledWith('How does this affect my stop-loss?');
  });

  it('renders MacroeconomicsView with reusable AnalystOutputPanel, Verified Grounding Sources & Citations, and Reference in Note', async () => {
    vi.spyOn(apiClient, 'getCommitteeModels').mockResolvedValue([
      {
        id: 'gemini-4-neon',
        label: 'Gemini 4 Neon (Default Committee Model)',
        provider: 'gemini',
        is_default: true,
      },
    ]);
    const macroUsOutput: AgentAnalystOutputDTO = {
      id: 201,
      run_id: 25,
      user_id: 1,
      symbol: 'MACRO',
      analyst_role: 'macro_us',
      directional_bias: 'Neutral',
      confidence_score: 76,
      trend_status: 'Initiation',
      summary_headline: 'Fed policy normalization anchors valuation multiples for US watchlist equities.',
      markdown_output:
        '### 1. Federal Reserve Policy\n- Treasury yield curve ([Federal Reserve H.15](https://www.federalreserve.gov/releases/h15/)).',
      structured_metrics: {
        grounding_links: [
          {
            title: 'Federal Reserve H.15 Selected Interest Rates',
            uri: 'https://www.federalreserve.gov/releases/h15/',
          },
        ],
      },
      referenced_output_ids: [],
      created_at: '2026-11-18T10:30:00Z',
    };

    vi.spyOn(apiClient, 'getLatestMacroWorkbench').mockResolvedValue({
      run: {
        id: 25,
        user_id: 1,
        symbol: 'MACRO',
        provider: 'gemini',
        model: 'gemini-4-argon',
        consensus_bias: 'Neutral',
        consensus_confidence: 76,
        executive_summary: 'Consolidated macro synthesis.',
        vote_breakdown: { macro_us: 'Neutral', macro_apac: 'Bullish', macro_secular: 'Bullish' },
        created_at: '2026-11-18T10:30:00Z',
      },
      outputs: [macroUsOutput],
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
        { symbol: '^SPX', name: 'S&P 500', last_price: 5950.0, change: 15.0, change_pct: 0.25, currency: 'USD' },
      ],
      fx_rates: [{ pair: 'USD/SGD', rate: 1.345, date: '2026-11-18' }],
      chart_candles: [],
      intraday_candles: [],
    });

    const handleRefInNote = vi.fn();
    render(<MacroeconomicsView onReferenceInNote={handleRefInNote} />);

    expect(await screen.findByText('Macroeconomics')).toBeInTheDocument();
    expect(screen.getByTestId('run-macro-btn')).toBeInTheDocument();
    expect(await screen.findByTestId('verified-grounding-sources')).toBeInTheDocument();
    expect(
      screen.getByText('Federal Reserve H.15 Selected Interest Rates')
    ).toBeInTheDocument();

    const refBtn = await screen.findByTestId('reference-in-note-macro_us');
    fireEvent.click(refBtn);
    expect(handleRefInNote).toHaveBeenCalledWith(macroUsOutput);
  });
});
