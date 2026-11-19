import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import TransactionsView from '../../frontend/src/components/portfolio/TransactionsView';
import apiClient from '../../frontend/src/services/apiClient';

describe('TransactionsView Dual Ledger & Drag-and-Drop Grouping (UAT Specification)', () => {
  const mockTrades = [
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
    {
      id: 3,
      symbol: 'SHORTCO',
      buysell: 'S',
      price: 50.0,
      quantity: 1000,
      tradedate: '2026-06-24T00:00:00',
      investment: false,
      remarks: 'Naked short initiation',
    },
  ];

  const mockPositions = [
    {
      symbol: '5E2.SI',
      eodprice: 2.8,
      quantity: 6000,
      avgprice: 2.0,
      tradedate: '2026-06-25',
      investment: false,
    },
    {
      symbol: 'SHORTCO',
      eodprice: 45.0, // Market price dropped from short sale price 50 -> short profit of (50 - 45) * 1000 = +5000
      quantity: -1000,
      avgprice: 50.0,
      tradedate: '2026-06-24',
      investment: false,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getTrades').mockResolvedValue(mockTrades as any);
    vi.spyOn(apiClient, 'getCapital').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getPositions').mockResolvedValue(mockPositions as any);
  });

  it('renders title as "Transactions" and omits any subtitle paragraph', async () => {
    render(<TransactionsView />);

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Transactions');

    // Subtitle should be removed
    expect(
      screen.queryByText(/Audit-trailed trade execution, capital injections/i)
    ).not.toBeInTheDocument();
  });

  it('initializes grouping state to Trade Date by default', async () => {
    render(<TransactionsView />);

    // Should show active Trade Date chip
    const chipsContainer = await screen.findByTestId('group-chips-container');
    expect(within(chipsContainer).getByText('Trade Date')).toBeInTheDocument();

    // Available pills should show Symbol, Side, Account
    expect(screen.getByRole('button', { name: /Symbol/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Side/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Account/i })).toBeInTheDocument();
  });

  it('renders dual ledger separated BUY and SELL headers without "(Action)" label', async () => {
    render(<TransactionsView />);

    // Verify BUY and SELL column headers are present
    const buyHeader = await screen.findByRole('columnheader', { name: 'BUY' });
    const sellHeader = screen.getByRole('columnheader', { name: 'SELL' });
    expect(buyHeader).toBeInTheDocument();
    expect(sellHeader).toBeInTheDocument();

    // Verify "(Action)" does not appear
    expect(screen.queryByText(/BUY \(Action\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SELL \(Action\)/i)).not.toBeInTheDocument();

    // Sub-headers for Price, Quantity, Consideration
    expect(screen.getAllByRole('columnheader', { name: 'Price' }).length).toBe(2);
    expect(screen.getAllByRole('columnheader', { name: 'Quantity' }).length).toBe(2);
    expect(screen.getAllByRole('columnheader', { name: 'Consideration' }).length).toBe(2);
  });

  it('populates distinct BUY and SELL columns for respective trades with dash placeholders', async () => {
    render(<TransactionsView />);

    // Wait for trade rows
    expect(await screen.findByText('Tactical buy long')).toBeInTheDocument();

    // Dash placeholders are displayed for empty BUY or SELL side
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);

    // Trade 1 BUY qty 10,000 and consideration $20,000.00
    expect(screen.getAllByText('10,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$20,000.00').length).toBeGreaterThanOrEqual(1);

    // Trade 2 SELL qty 4,000 and consideration $10,000.00
    expect(screen.getAllByText('4,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$10,000.00').length).toBeGreaterThanOrEqual(1);
  });

  it('computes sub-aggregation PnL for Long position (5E2.SI)', async () => {
    render(<TransactionsView />);

    // Remove Trade Date and add Symbol
    const removeTradeDateBtn = await screen.findByRole('button', { name: /Remove Trade Date/i });
    fireEvent.click(removeTradeDateBtn);

    const symbolBtn = screen.getByRole('button', { name: /Symbol/i });
    fireEvent.click(symbolBtn);

    // 5E2.SI:
    // Buy 10,000 @ $2.00 ($20,000)
    // Sell 4,000 @ $2.50 ($10,000)
    // Balance: +6,000 shs
    // Closed Qty = 4,000; Realized PnL = 4,000 * ($2.50 - $2.00) = +$2,000.00
    // Unrealized PnL = 6,000 * ($2.80 - $2.00) = 6,000 * $0.80 = +$4,800.00
    expect(await screen.findByText('+6,000 shs')).toBeInTheDocument();
    expect(screen.getAllByText('+$2,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+$4,800.00')).toBeInTheDocument();
  });

  it('computes bidirectional sub-aggregation PnL for Short position (SHORTCO)', async () => {
    render(<TransactionsView />);

    // Remove Trade Date and add Symbol
    const removeTradeDateBtn = await screen.findByRole('button', { name: /Remove Trade Date/i });
    fireEvent.click(removeTradeDateBtn);

    const symbolBtn = screen.getByRole('button', { name: /Symbol/i });
    fireEvent.click(symbolBtn);

    // SHORTCO:
    // Sell 1,000 @ $50.00
    // Buy 0
    // Balance: -1,000 shs (short position)
    // Avg Sell Price: $50.00
    // EOD Price in mockPositions: $45.00
    // Short Unrealized PnL = |-1000| * ($50.00 - $45.00) = 1,000 * $5.00 = +$5,000.00
    expect(await screen.findByText('-1,000 shs')).toBeInTheDocument();
    expect(screen.getByText('+$5,000.00')).toBeInTheDocument();
  });

  it('allows removing all groups to display flat list with reset button restoring Trade Date', async () => {
    render(<TransactionsView />);

    const removeTradeDateBtn = await screen.findByRole('button', { name: /Remove Trade Date/i });
    fireEvent.click(removeTradeDateBtn);

    // Should show flat list indicator
    expect(screen.getAllByText('None (Flat List)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('(flat list)')).toBeInTheDocument();

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    // Trade Date restored
    const chipsContainer = screen.getByTestId('group-chips-container');
    expect(within(chipsContainer).getByText('Trade Date')).toBeInTheDocument();
  });

  it('swaps the order of Trade Date and Side using click-and-drag', async () => {
    render(<TransactionsView />);

    // Add Side so we have both Trade Date and Side
    const sideBtn = await screen.findByRole('button', { name: /Side/i });
    fireEvent.click(sideBtn);

    const chipsContainer = screen.getByTestId('group-chips-container');
    const chipsBefore = within(chipsContainer).getAllByText(/Trade Date|Side/);
    expect(chipsBefore[0]).toHaveTextContent('Trade Date');
    expect(chipsBefore[1]).toHaveTextContent('Side');

    // Drag Trade Date and drop it onto Side to swap order
    const tradeDateChip = within(chipsContainer).getByText('Trade Date').closest('div[draggable="true"]')!;
    const sideChip = within(chipsContainer).getByText('Side').closest('div[draggable="true"]')!;

    // Initiate drag on Trade Date
    fireEvent.dragStart(tradeDateChip, {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: 'move',
      },
    });

    // Drag over Side (right half to insert after)
    const rect = {
      left: 100,
      width: 100,
      right: 200,
      top: 0,
      bottom: 30,
      height: 30,
    };
    sideChip.getBoundingClientRect = () => rect as DOMRect;

    fireEvent.dragOver(sideChip, {
      clientX: 180, // right half
      dataTransfer: { dropEffect: 'move' },
    });

    // Drop onto Side
    fireEvent.drop(sideChip, {
      clientX: 180,
      dataTransfer: {
        getData: vi.fn(() => 'tradedate'),
      },
    });

    // Verify order is swapped to [Side, Trade Date]
    const chipsAfter = within(chipsContainer).getAllByText(/Trade Date|Side/);
    expect(chipsAfter[0]).toHaveTextContent('Side');
    expect(chipsAfter[1]).toHaveTextContent('Trade Date');
  });

  it('swaps the order of Trade Date and Side using quick reorder arrows', async () => {
    render(<TransactionsView />);

    // Add Side
    const sideBtn = await screen.findByRole('button', { name: /Side/i });
    fireEvent.click(sideBtn);

    const chipsContainer = screen.getByTestId('group-chips-container');

    // Click move right button on Trade Date
    const moveRightBtn = screen.getByRole('button', { name: /Move Trade Date right/i });
    fireEvent.click(moveRightBtn);

    // Verify order swapped: Side is now first, Trade Date is second
    const chipsAfter = within(chipsContainer).getAllByText(/Trade Date|Side/);
    expect(chipsAfter[0]).toHaveTextContent('Side');
    expect(chipsAfter[1]).toHaveTextContent('Trade Date');
  });

  it('updates table column header ordering dynamically to match group by ordering (Symbol > Account > Trade Date)', async () => {
    render(<TransactionsView />);

    // Initial default: Trade Date, Symbol, Account
    const initialHeaders = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(initialHeaders.slice(0, 3)).toEqual(['Trade Date', 'Symbol', 'Account']);

    // Remove Trade Date
    const removeTradeDateBtn = await screen.findByRole('button', { name: /Remove Trade Date/i });
    fireEvent.click(removeTradeDateBtn);

    // Add Symbol, Account, Trade Date
    const symbolBtn = screen.getByRole('button', { name: /Symbol/i });
    fireEvent.click(symbolBtn);

    const accountBtn = screen.getByRole('button', { name: /Account/i });
    fireEvent.click(accountBtn);

    const tradeDateBtn = screen.getByRole('button', { name: /Trade Date/i });
    fireEvent.click(tradeDateBtn);

    // Verify table headers now reflect exact group by ordering: [Symbol, Account, Trade Date]
    const updatedHeaders = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(updatedHeaders.slice(0, 3)).toEqual(['Symbol', 'Account', 'Trade Date']);
  });

  it('hides sub-aggregation metrics strip when not grouped primarily by Symbol, and reveals it when grouped by Symbol', async () => {
    render(<TransactionsView />);

    // Default grouping is Trade Date -> sub-aggregation strip must not be rendered
    await screen.findByText('Tactical buy long');
    expect(screen.queryByTestId('sub-aggregation-strip')).not.toBeInTheDocument();
    expect(screen.queryByText('Avg Buy')).not.toBeInTheDocument();

    // Now switch grouping to Symbol
    const removeTradeDateBtn = screen.getByRole('button', { name: /Remove Trade Date/i });
    fireEvent.click(removeTradeDateBtn);

    const symbolBtn = screen.getByRole('button', { name: /Symbol/i });
    fireEvent.click(symbolBtn);

    // Sub-aggregation strip should now be visible
    expect(await screen.findAllByTestId('sub-aggregation-strip')).toHaveLength(2);
    expect(screen.getAllByText('Avg Buy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Avg Sell').length).toBeGreaterThanOrEqual(1);
  });
});
