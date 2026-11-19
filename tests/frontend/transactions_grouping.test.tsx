import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TransactionsView from '../../frontend/src/components/portfolio/TransactionsView';
import { formatTradeDate } from '../../frontend/src/lib/dateFormatter';
import apiClient from '../../frontend/src/services/apiClient';

describe('formatTradeDate utility', () => {
  it('formats ISO timestamps to DD-Mon-YYYY and omits time', () => {
    expect(formatTradeDate('2026-07-08T00:00:00')).toBe('08-Jul-2026');
    expect(formatTradeDate('2026-07-08')).toBe('08-Jul-2026');
    expect(formatTradeDate('2026-06-30T14:32:00Z')).toBe('30-Jun-2026');
    expect(formatTradeDate('2026-01-05T08:00:00')).toBe('05-Jan-2026');
    expect(formatTradeDate('2026-12-31')).toBe('31-Dec-2026');
  });

  it('formats Date objects to DD-Mon-YYYY', () => {
    const d = new Date(2026, 6, 8); // July 8, 2026
    expect(formatTradeDate(d)).toBe('08-Jul-2026');
  });

  it('handles empty or null inputs gracefully', () => {
    expect(formatTradeDate('')).toBe('—');
    expect(formatTradeDate(null)).toBe('—');
    expect(formatTradeDate(undefined)).toBe('—');
  });
});

describe('TransactionsView Grouping & Aggregation Layer', () => {
  const mockTrades = [
    {
      id: 1,
      symbol: 'GLW',
      buysell: 'S',
      price: 185.0,
      quantity: 200,
      tradedate: '2026-07-08T00:00:00',
      investment: false,
      remarks: 'Tactical unwind',
    },
    {
      id: 2,
      symbol: 'GLW',
      buysell: 'B',
      price: 180.0,
      quantity: 200,
      tradedate: '2026-07-07T00:00:00',
      investment: false,
      remarks: 'Oversold tactical',
    },
    {
      id: 3,
      symbol: 'D05.SI',
      buysell: 'B',
      price: 65.5,
      quantity: 500,
      tradedate: '2026-06-30T00:00:00',
      investment: true,
      remarks: 'Accumulate DBS',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getTrades').mockResolvedValue(mockTrades as any);
    vi.spyOn(apiClient, 'getCapital').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getPositions').mockResolvedValue([]);
  });

  it('renders "Trade Date" header and formats dates as DD-Mon-YYYY omitting time', async () => {
    render(<TransactionsView />);

    expect(await screen.findByRole('columnheader', { name: 'Trade Date' })).toBeInTheDocument();
    expect(screen.getAllByText('08-Jul-2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('07-Jul-2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('30-Jun-2026').length).toBeGreaterThanOrEqual(1);

    // Verify raw ISO string with time is not displayed
    expect(screen.queryByText('2026-07-08T00:00:00')).not.toBeInTheDocument();
  });

  it('renders default group by trade date and displays grand total footer', async () => {
    render(<TransactionsView />);

    const select = await screen.findByLabelText(/Group By/i);
    expect(select).toBeInTheDocument();
    // Default grouping state is tradedate per requirement
    expect(select).toHaveValue('tradedate');

    // Grand total footer should show total trades
    expect(await screen.findByText('Grand Total (3 trades)')).toBeInTheDocument();
    // Total buy quantity: 200 + 500 = 700; Total sell quantity: 200
    expect(screen.getAllByText('700').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('200').length).toBeGreaterThanOrEqual(1);
  });

  it('groups by Symbol with accurate subtotals and accordion toggle capability', async () => {
    render(<TransactionsView />);

    // Wait for initial render of trades
    expect(await screen.findByText('Tactical unwind')).toBeInTheDocument();

    const select = screen.getByLabelText(/Group By/i);
    fireEvent.change(select, { target: { value: 'symbol' } });

    // Group headers should appear for GLW and D05.SI
    const glwElements = await screen.findAllByText('GLW');
    expect(glwElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 trades')).toBeInTheDocument();

    // GLW Subtotal metrics in group header:
    // Buy 200 @ $180, Sell 200 @ $185 -> Bal 0, Realized: +$1,000.00
    expect(screen.getAllByText('+$1,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0 shs')).toBeInTheDocument();

    const d05Elements = screen.getAllByText('D05.SI');
    expect(d05Elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 trade')).toBeInTheDocument();

    // Verify Expand All / Collapse All button is visible
    const toggleAllBtn = screen.getByText('Collapse All');
    expect(toggleAllBtn).toBeInTheDocument();

    // Collapse All
    fireEvent.click(toggleAllBtn);
    expect(screen.getByText('Expand All')).toBeInTheDocument();
    // Detail rows should now be collapsed
    expect(screen.queryByText('Tactical unwind')).not.toBeInTheDocument();

    // Expand All again
    fireEvent.click(screen.getByText('Expand All'));
    expect(screen.getByText('Collapse All')).toBeInTheDocument();
    expect(screen.getByText('Tactical unwind')).toBeInTheDocument();
  });

  it('groups by Side (BUY / SELL) and Account correctly', async () => {
    render(<TransactionsView />);

    expect(await screen.findByText('Tactical unwind')).toBeInTheDocument();

    const select = screen.getByLabelText(/Group By/i);

    // Group by Side
    fireEvent.change(select, { target: { value: 'side' } });
    const buyElements = await screen.findAllByText('BUY');
    expect(buyElements.length).toBeGreaterThanOrEqual(1);
    const sellElements = screen.getAllByText('SELL');
    expect(sellElements.length).toBeGreaterThanOrEqual(1);

    // Group by Account
    fireEvent.change(select, { target: { value: 'account' } });
    const investElements = await screen.findAllByText('Investment');
    expect(investElements.length).toBeGreaterThanOrEqual(1);
    const leverageElements = screen.getAllByText('Leverage');
    expect(leverageElements.length).toBeGreaterThanOrEqual(1);
  });
});
