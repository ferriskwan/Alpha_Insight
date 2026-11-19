import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TransactionsView from '../../frontend/src/components/portfolio/TransactionsView';
import apiClient from '../../frontend/src/services/apiClient';

describe('TransactionsView List/Group Mode Toggle, Interactive Sorting & CRUD Actions', () => {
  const mockTrades = [
    {
      id: 1,
      symbol: '5E2.SI',
      buysell: 'B',
      price: 2.0,
      quantity: 10000,
      tradedate: '2026-06-25T00:00:00',
      investment: true,
      remarks: 'Initial buy long',
    },
    {
      id: 2,
      symbol: 'GLW',
      buysell: 'S',
      price: 220.0,
      quantity: 200,
      tradedate: '2026-06-26T00:00:00',
      investment: false,
      remarks: 'Tactical short unwind',
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

  const mockPositions = [
    {
      symbol: '5E2.SI',
      eodprice: 2.5,
      quantity: 10000,
      avgprice: 2.0,
      tradedate: '2026-06-25',
      investment: true,
    },
    {
      symbol: 'GLW',
      eodprice: 215.0,
      quantity: -200,
      avgprice: 220.0,
      tradedate: '2026-06-26',
      investment: false,
    },
  ];

  const mockWatchlist = [
    { symbol: '5E2.SI', group: 'Tech' },
    { symbol: 'GLW', group: 'US Tech' },
    { symbol: 'D05.SI', group: 'Finance' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(apiClient, 'getTrades').mockResolvedValue(mockTrades as any);
    vi.spyOn(apiClient, 'getCapital').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getPositions').mockResolvedValue(mockPositions as any);
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValue(mockWatchlist as any);
  });

  it('renders View Mode segmented toggle and switches between Grouped and List mode', async () => {
    render(<TransactionsView />);

    // Default mode should be grouped
    const groupToggleBtn = await screen.findByRole('button', { name: /Grouped Mode/i });
    const listToggleBtn = screen.getByRole('button', { name: /List Mode/i });
    expect(groupToggleBtn).toBeInTheDocument();
    expect(listToggleBtn).toBeInTheDocument();

    // Verify grouping toolbar is initially visible
    expect(screen.getByTestId('group-chips-container')).toBeInTheDocument();

    // Switch to List mode
    fireEvent.click(listToggleBtn);

    // List mode indicator should appear and localStorage should be updated
    expect(await screen.findByText(/Clean List Mode/i)).toBeInTheDocument();
    expect(localStorage.getItem('alpha_insight_transactions_view_mode')).toBe('list');

    // Switch back to Grouped mode
    fireEvent.click(groupToggleBtn);
    expect(await screen.findByTestId('group-chips-container')).toBeInTheDocument();
    expect(localStorage.getItem('alpha_insight_transactions_view_mode')).toBe('group');
  });

  it('supports interactive column sorting in List Mode', async () => {
    localStorage.setItem('alpha_insight_transactions_view_mode', 'list');
    render(<TransactionsView />);

    // In list mode, all three trades should be displayed
    expect(await screen.findByText('Initial buy long')).toBeInTheDocument();
    expect(screen.getByText('Tactical short unwind')).toBeInTheDocument();
    expect(screen.getByText('Accumulate DBS')).toBeInTheDocument();

    // Find and click Symbol column header to sort ascending
    const symbolHeader = screen.getByTitle('Sort by Symbol');
    fireEvent.click(symbolHeader);

    // Click again to sort descending
    fireEvent.click(symbolHeader);

    // Find Price sort header and click
    const priceHeaders = screen.getAllByTitle('Sort by Price');
    expect(priceHeaders.length).toBeGreaterThan(0);
    fireEvent.click(priceHeaders[0]);
  });

  it('opens Edit modal pre-filled and invokes apiClient.updateTransaction upon submit', async () => {
    localStorage.setItem('alpha_insight_transactions_view_mode', 'list');
    const updateSpy = vi.spyOn(apiClient, 'updateTransaction').mockResolvedValue({ success: true } as any);

    render(<TransactionsView />);

    // Wait for trade rows to appear
    const editBtns = await screen.findAllByRole('button', { name: /Edit trade 5E2\.SI/i });
    expect(editBtns.length).toBeGreaterThan(0);

    // Click edit button on the first trade
    fireEvent.click(editBtns[0]);

    // Modal should appear
    expect(await screen.findByText('Edit Trade Order Ticket')).toBeInTheDocument();

    // Check remarks field is populated
    const remarksInput = screen.getByLabelText(/Edit Execution Remarks/i);
    expect(remarksInput).toHaveValue('Initial buy long');

    // Update remarks
    fireEvent.change(remarksInput, { target: { value: 'Modified buy allocation' } });

    // Click Save Changes button
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Verify apiClient.updateTransaction was called with updated payload
    expect(updateSpy).toHaveBeenCalledWith('trade', expect.objectContaining({
      id: 1,
      symbol: '5E2.SI',
      remarks: 'Modified buy allocation',
      buysell: 'B',
      price: 2.0,
      quantity: 10000,
    }));
  });

  it('prompts confirmation and invokes apiClient.deleteTransaction when delete is clicked', async () => {
    localStorage.setItem('alpha_insight_transactions_view_mode', 'list');
    const deleteSpy = vi.spyOn(apiClient, 'deleteTransaction').mockResolvedValue({ success: true } as any);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<TransactionsView />);

    // Wait for delete buttons
    const deleteBtns = await screen.findAllByRole('button', { name: /Delete trade 5E2\.SI/i });
    expect(deleteBtns.length).toBeGreaterThan(0);

    // Click delete
    fireEvent.click(deleteBtns[0]);

    // Confirmation must be prompted
    expect(confirmSpy).toHaveBeenCalled();

    // Delete API must be invoked with trade id
    expect(deleteSpy).toHaveBeenCalledWith('trade', { id: 1 });
  });
});
