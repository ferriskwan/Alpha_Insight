import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AnalystCommitteeView from '../../frontend/src/components/research/AnalystCommitteeView';
import apiClient from '../../frontend/src/services/apiClient';

describe('Epic 0.6: Stock Analysis Watchlist Sync & No-Mock Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dynamically resolves initial active symbol to first watchlist item without AAPL hardcoding', async () => {
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValue([
      {
        user_id: 1,
        watchlistname: 'Default',
        symbol: '5E2.SI',
        name: 'Seatrium Ltd.',
        lastPrice: 1.85,
        change: 0.05,
        changePct: 2.78,
        dayHigh: 1.9,
        dayLow: 1.8,
        volume: 1000000,
        high52: 2.2,
        low52: 1.4,
        currency: 'SGD',
      },
      {
        user_id: 1,
        watchlistname: 'Default',
        symbol: 'D05.SI',
        name: 'DBS Group Holdings',
        lastPrice: 35.2,
        change: -0.1,
        changePct: -0.28,
        dayHigh: 35.5,
        dayLow: 35.0,
        volume: 500000,
        high52: 38.0,
        low52: 30.0,
        currency: 'SGD',
      },
    ]);

    vi.spyOn(apiClient, 'getCommitteeModels').mockResolvedValue([
      {
        id: 'gemini-4-argon',
        label: 'Gemini 4 Argon',
        provider: 'gemini',
        is_default: true,
      },
    ]);

    vi.spyOn(apiClient, 'getStockAnalystData').mockResolvedValue({
      symbol: '5E2.SI',
      latestPrice: 1.85,
      dayChange: 0.05,
      dayChangePct: 2.78,
      timeframe: '6M',
      indicators: {
        smaPeriod: 20,
        emaPeriod: 50,
        bbPeriod: 20,
        rsiPeriod: 14,
      },
      series: [],
      intradaySeries: [],
      trades: [],
    });

    vi.spyOn(apiClient, 'getCommitteeRuns').mockResolvedValue([]);

    render(<AnalystCommitteeView />);

    // Initial symbol resolves to 5E2.SI (first watchlist item)
    const selectEl = (await screen.findByRole('combobox', { name: /Watchlist Symbol/i })) as HTMLSelectElement;
    expect(selectEl.value).toBe('5E2.SI');
    expect(screen.getByRole('option', { name: /5E2.SI/i })).toBeInTheDocument();

    // Chart header aligns with 5E2.SI, NOT AAPL
    expect(await screen.findByText(/Interactive Canvas Chart — 5E2.SI/i)).toBeInTheDocument();
  });
});
