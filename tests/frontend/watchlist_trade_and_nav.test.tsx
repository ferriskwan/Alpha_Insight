import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import WatchlistView from '../../frontend/src/components/portfolio/WatchlistView';
import TransactionsView from '../../frontend/src/components/portfolio/TransactionsView';
import App from '../../frontend/src/App';
import apiClient from '../../frontend/src/services/apiClient';

describe('Watchlist, Trade Modal & F5 Navigation Persistence Specs', () => {
  const mockWatchlistItems = [
    {
      user_id: 1,
      watchlistname: 'Holding',
      symbol: 'GLW',
      name: 'Corning Inc',
      lastPrice: 115.0,
      change: 2.1,
      changePct: 1.86,
      dayHigh: 116.0,
      dayLow: 114.0,
      high52: 120.0,
      low52: 80.0,
      volume: 1200000,
      currency: 'USD',
    },
    {
      user_id: 1,
      watchlistname: 'Watchlist',
      symbol: 'D05.SI',
      name: 'DBS Group Holdings',
      lastPrice: 65.5,
      change: 0.5,
      changePct: 0.77,
      dayHigh: 66.0,
      dayLow: 65.0,
      high52: 66.0,
      low52: 50.0,
      volume: 850000,
      currency: 'SGD',
    },
    {
      user_id: 1,
      watchlistname: 'Watchlist',
      symbol: '5E2.SI',
      name: 'UMS Holdings',
      lastPrice: 1.96,
      change: -0.04,
      changePct: -2.0,
      dayHigh: 2.01,
      dayLow: 1.95,
      high52: 2.5,
      low52: 1.5,
      volume: 450000,
      currency: 'SGD',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    // Mock API client calls
    vi.spyOn(apiClient, 'getAuthEnv').mockResolvedValue({ env: 'DEV', googleClientId: '' });
    vi.spyOn(apiClient, 'getMe').mockResolvedValue({
      id: 1,
      email: 'user@alphainsight.io',
      name: 'Institutional Trader',
      roles: ['admin', 'analyst', 'user'],
      status: 'active',
      is_active: true,
      role: 'admin',
    } as any);

    vi.spyOn(apiClient, 'getSitemap').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValue(mockWatchlistItems as any);
    vi.spyOn(apiClient, 'getWatchlistLists').mockResolvedValue(['All', 'Holding', 'Watchlist']);
    vi.spyOn(apiClient, 'getTrades').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCapital').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getPositions').mockResolvedValue([]);
  });

  it('WatchlistView: renders "Watchlist" header title and omits subtitle text', async () => {
    render(<WatchlistView />);

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Watchlist');
    expect(heading).not.toHaveTextContent('Active Institutional Watchlist');

    // Subtitle paragraph must be removed
    expect(
      screen.queryByText(/Real-time quotes, 52-week statistical ranges/i)
    ).not.toBeInTheDocument();
  });

  it('TransactionsView: populates Ticker Symbol select strictly from watchlist items', async () => {
    render(<TransactionsView />);

    // Click "New trade"
    const newTradeBtn = await screen.findByRole('button', { name: /New trade/i });
    fireEvent.click(newTradeBtn);

    // Modal should be open
    const modalHeading = await screen.findByText('New Trade Order Ticket');
    expect(modalHeading).toBeInTheDocument();

    // Check ticker select dropdown
    const select = screen.getByRole('combobox', { name: /Ticker Symbol/i });
    expect(select).toBeInTheDocument();

    // The options should contain the sorted unique symbols: '5E2.SI', 'D05.SI', 'GLW'
    const options = screen.getAllByRole('option');
    const optionValues = options.map((opt) => (opt as HTMLOptionElement).value);
    expect(optionValues).toContain('5E2.SI');
    expect(optionValues).toContain('D05.SI');
    expect(optionValues).toContain('GLW');

    // Selected by default to first available watchlist symbol ('5E2.SI')
    expect((select as HTMLSelectElement).value).toBe('5E2.SI');
  });

  it('TransactionsView: Execution Remarks is blank by default and required', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const createTradeMock = vi.spyOn(apiClient, 'createTrade').mockResolvedValue({} as any);

    render(<TransactionsView />);

    const newTradeBtn = await screen.findByRole('button', { name: /New trade/i });
    fireEvent.click(newTradeBtn);

    // Execution remarks input
    const remarksInput = screen.getByPlaceholderText(/Required: e.g. Tactical entry, Saxo desk/i);
    expect(remarksInput).toHaveValue('');
    expect(remarksInput).toBeRequired();

    // Attempting to submit with blank remarks should alert and NOT call createTrade
    const submitBtn = screen.getByRole('button', { name: /Submit Trade/i });
    fireEvent.click(submitBtn);

    expect(alertMock).toHaveBeenCalledWith('Execution remarks are required.');
    expect(createTradeMock).not.toHaveBeenCalled();

    // Now fill remarks and submit
    fireEvent.change(remarksInput, { target: { value: 'Discretionary rebalancing' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTradeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: '5E2.SI',
          remarks: 'Discretionary rebalancing',
        })
      );
    });
  });

  it('App.tsx: preserves and restores active navigation route from localStorage on F5/reload', async () => {
    // Simulate user previously navigated to '/portfolio/transactions' before refresh
    localStorage.setItem('alpha_insight_active_path', '/portfolio/transactions');

    render(<App />);

    // Wait for authentication and mount - Transactions view heading
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 1 });
      const hasTransactions = headings.some((h) => h.textContent?.includes('Transactions'));
      expect(hasTransactions).toBe(true);
    });

    // Verify localStorage retains the active route
    expect(localStorage.getItem('alpha_insight_active_path')).toBe('/portfolio/transactions');
  });
});
