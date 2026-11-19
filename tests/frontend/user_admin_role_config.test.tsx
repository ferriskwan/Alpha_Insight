import './setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import UserAdmin from '../../frontend/src/components/admin/UserAdmin';
import apiClient from '../../frontend/src/services/apiClient';

describe('UserAdmin Role Configuration Modal (Revoke Admin & Minimum Role Invariant)', () => {
  const mockUsers = [
    {
      id: 1,
      email: 'ferriskwan@gmail.com',
      name: 'Ferris Kwan',
      picture: null,
      roles: ['admin', 'analyst', 'user'],
      status: 'active',
      created_at: '2026-06-18T08:30:00Z',
    },
    {
      id: 2,
      email: 'angela.tan@4leafclover.com',
      name: 'Angela Tan',
      picture: null,
      roles: ['admin', 'analyst', 'user'],
      status: 'active',
      created_at: '2026-07-15T09:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getUsers').mockResolvedValue(mockUsers as any);
  });

  it('renders user table with Configure Roles buttons for each user', async () => {
    render(<UserAdmin />);

    expect(await screen.findByText('Angela Tan')).toBeInTheDocument();
    expect(screen.getByText('Ferris Kwan')).toBeInTheDocument();

    const configureBtns = screen.getAllByRole('button', { name: /Configure roles for/i });
    expect(configureBtns.length).toBe(2);
  });

  it('protects root super-admin Ferris Kwan permanent admin role inside modal', async () => {
    render(<UserAdmin />);

    const superAdminBtn = await screen.findByRole('button', { name: /Configure roles for Ferris Kwan/i });
    fireEvent.click(superAdminBtn);

    expect(await screen.findByText('Configure Roles: Ferris Kwan')).toBeInTheDocument();

    // Admin checkbox should be disabled for superadmin
    const adminCheckbox = screen.getByLabelText(/^Admin/i);
    expect(adminCheckbox).toBeDisabled();
    expect(adminCheckbox).toBeChecked();

    // Base user checkbox should also be disabled per minimum role invariant
    const userCheckbox = screen.getByLabelText(/^User/i);
    expect(userCheckbox).toBeDisabled();
    expect(userCheckbox).toBeChecked();
  });

  it('allows removing Admin role from Angela Tan while preserving minimum User role', async () => {
    const updateRoleSpy = vi.spyOn(apiClient, 'updateUserRole').mockResolvedValue({ ok: true });

    render(<UserAdmin />);

    const angelaBtn = await screen.findByRole('button', { name: /Configure roles for Angela Tan/i });
    fireEvent.click(angelaBtn);

    // Modal dialog opens
    expect(await screen.findByText('Configure Roles: Angela Tan')).toBeInTheDocument();

    // Admin checkbox should be enabled and checked for Angela Tan
    const adminCheckbox = screen.getByLabelText(/^Admin/i);
    expect(adminCheckbox).toBeEnabled();
    expect(adminCheckbox).toBeChecked();

    // User checkbox must be disabled and checked (minimum role invariant)
    const userCheckbox = screen.getByLabelText(/^User/i);
    expect(userCheckbox).toBeDisabled();
    expect(userCheckbox).toBeChecked();

    // Uncheck Admin role
    fireEvent.click(adminCheckbox);
    expect(adminCheckbox).not.toBeChecked();

    // Click Save Roles button
    const saveBtn = screen.getByRole('button', { name: /Save Roles/i });
    fireEvent.click(saveBtn);

    // Expect updateUserRole to be called with action 'remove' for 'admin'
    await waitFor(() => {
      expect(updateRoleSpy).toHaveBeenCalledWith(2, 'admin', 'remove');
    });

    // Toast notification should appear
    expect(await screen.findByText(/Roles updated for Angela Tan/i)).toBeInTheDocument();
  });
});
