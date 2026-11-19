import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import TransactionsView from '../../frontend/src/components/portfolio/TransactionsView';
import apiClient from '../../frontend/src/services/apiClient';

describe('TransactionsView Capital & Costs CRUD Actions', () => {
  const mockCapital = [
    {
      id: 101,
      user_id: 1,
      broker: 'Saxo',
      transtype: 'D',
      accounttype: 'M',
      amount: 30000.0,
      currency: 'SGD',
      date: '2026-07-07T00:00:00',
      remarks: 'Capital injection to pare down cost',
    },
    {
      id: 102,
      user_id: 1,
      broker: 'Kim Eng',
      transtype: 'W',
      accounttype: 'C',
      amount: -15000.0,
      currency: 'USD',
      date: '2026-07-03T00:00:00',
      remarks: 'Withdrawal for rebalancing',
    },
  ];

  const mockCosts = [
    {
      id: 201,
      user_id: 1,
      trade_id: 12,
      cost_type: 'commission',
      amount: 15.5,
      currency: 'SGD',
      date: '2026-07-07T00:00:00',
      remarks: 'Broker execution fee',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getTrades').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getCapital').mockResolvedValue(mockCapital as any);
    vi.spyOn(apiClient, 'getTransCosts').mockResolvedValue(mockCosts as any);
    vi.spyOn(apiClient, 'getPositions').mockResolvedValue([]);
    vi.spyOn(apiClient, 'getWatchlistItems').mockResolvedValue([]);
  });

  it('renders Capital Actions column, opens Edit modal and submits update', async () => {
    const updateSpy = vi.spyOn(apiClient, 'updateTransaction').mockResolvedValue({ success: true } as any);

    render(<TransactionsView />);

    // Switch to Capital tab
    const capitalTabBtn = await screen.findByRole('button', { name: /^Capital/i });
    fireEvent.click(capitalTabBtn);

    // Verify Capital table is displayed
    expect(await screen.findByText('Capital injection to pare down cost')).toBeInTheDocument();

    // Click Edit button on the first capital row
    const editBtns = screen.getAllByRole('button', { name: /Edit capital entry/i });
    expect(editBtns.length).toBe(2);
    fireEvent.click(editBtns[0]);

    // Edit modal should open prefilled
    expect(await screen.findByText('Edit Capital Entry')).toBeInTheDocument();
    const remarksInput = screen.getByLabelText(/Edit Capital Remarks/i);
    expect(remarksInput).toHaveValue('Capital injection to pare down cost');

    // Change remarks
    fireEvent.change(remarksInput, { target: { value: 'Updated injection remarks' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Verify updateTransaction called with capital payload
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('capital', expect.objectContaining({
        id: 101,
        broker: 'Saxo',
        remarks: 'Updated injection remarks',
      }));
    });
  });

  it('confirms and calls deleteTransaction on Capital entry deletion', async () => {
    const deleteSpy = vi.spyOn(apiClient, 'deleteTransaction').mockResolvedValue({ ok: true } as any);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<TransactionsView />);

    // Switch to Capital tab
    const capitalTabBtn = await screen.findByRole('button', { name: /^Capital/i });
    fireEvent.click(capitalTabBtn);

    const deleteBtns = await screen.findAllByRole('button', { name: /Delete capital entry/i });
    fireEvent.click(deleteBtns[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalledWith('capital', { id: 101 });
  });

  it('renders Costs Actions column, opens Edit modal and submits updateTransCost', async () => {
    const updateCostSpy = vi.spyOn(apiClient, 'updateTransCost').mockResolvedValue({ id: 201 } as any);

    render(<TransactionsView />);

    // Switch to Costs tab
    const costsTabBtn = await screen.findByRole('button', { name: /^Costs/i });
    fireEvent.click(costsTabBtn);

    // Verify Cost table is displayed
    expect(await screen.findByText('Broker execution fee')).toBeInTheDocument();

    // Click Edit button on the cost row
    const editCostBtn = screen.getByRole('button', { name: /Edit cost entry/i });
    fireEvent.click(editCostBtn);

    // Edit modal should open
    expect(await screen.findByText('Edit Transaction Cost Entry')).toBeInTheDocument();
    const remarksInput = screen.getByLabelText(/Edit Cost Remarks/i);
    expect(remarksInput).toHaveValue('Broker execution fee');

    // Change remarks
    fireEvent.change(remarksInput, { target: { value: 'Custodian fee revised' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Verify updateTransCost called with payload
    await waitFor(() => {
      expect(updateCostSpy).toHaveBeenCalledWith(201, expect.objectContaining({
        cost_type: 'commission',
        remarks: 'Custodian fee revised',
      }));
    });
  });

  it('confirms and calls deleteTransCost on Cost entry deletion', async () => {
    const deleteCostSpy = vi.spyOn(apiClient, 'deleteTransCost').mockResolvedValue({ ok: true } as any);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<TransactionsView />);

    // Switch to Costs tab
    const costsTabBtn = await screen.findByRole('button', { name: /^Costs/i });
    fireEvent.click(costsTabBtn);

    const deleteCostBtn = await screen.findByRole('button', { name: /Delete cost entry/i });
    fireEvent.click(deleteCostBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteCostSpy).toHaveBeenCalledWith(201);
  });

  it('renders Adjust Capital modal with title "Adjust Capital" and submit button "Save"', async () => {
    const createCapSpy = vi.spyOn(apiClient, 'createCapital').mockResolvedValue({ status: 'success', id: 999 } as any);

    render(<TransactionsView />);

    // Switch to Capital tab
    const capitalTabBtn = await screen.findByRole('button', { name: /^Capital/i });
    fireEvent.click(capitalTabBtn);

    // Open Adjust Capital modal
    const adjustCapBtn = await screen.findByRole('button', { name: /Adjust capital/i });
    fireEvent.click(adjustCapBtn);

    // Verify modal title is "Adjust Capital"
    expect(await screen.findByText('Adjust Capital')).toBeInTheDocument();

    // Verify submit button is "Save"
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(createCapSpy).toHaveBeenCalled();
    });
  });

  it('renders Record Cost modal with submit button "Save"', async () => {
    const createCostSpy = vi.spyOn(apiClient, 'createTransCost').mockResolvedValue({ id: 888 } as any);

    render(<TransactionsView />);

    // Switch to Costs tab
    const costsTabBtn = await screen.findByRole('button', { name: /^Costs/i });
    fireEvent.click(costsTabBtn);

    // Open New cost modal
    const newCostBtn = await screen.findByRole('button', { name: /New cost/i });
    fireEvent.click(newCostBtn);

    // Verify modal title is "Record Transaction Cost"
    expect(await screen.findByText('Record Transaction Cost')).toBeInTheDocument();

    // Verify submit button is "Save"
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(createCostSpy).toHaveBeenCalled();
    });
  });
});
