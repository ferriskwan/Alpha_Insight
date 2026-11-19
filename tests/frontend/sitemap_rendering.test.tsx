/**
 * UAT / Frontend Tests for Dynamic SiteMap Navigation Tree & Role-Based Rendering.
 *
 * Covers:
 * - DynamicSidebar rendering navigation nodes from mock sitemap data
 * - Active route item highlighting
 * - Navigation click triggers onNavigate callback
 * - Role badges (ADM, ANA) for privileged routes
 * - Collapsible nested section toggling
 */

import './setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DynamicSidebar } from '../../frontend/src/components/layout/DynamicSidebar';
import apiClient from '../../frontend/src/services/apiClient';
import { SiteMapNode } from '../../frontend/src/types/api';

const MOCK_SITEMAP_TREE: SiteMapNode[] = [
  {
    id: 100,
    parent_id: null,
    menu_code: 'portfolio',
    label: 'My Portfolio',
    route: '/portfolio/overview',
    icon: 'Briefcase',
    role_required: 'user',
    order_index: 10,
    is_active: true,
    children: [
      {
        id: 101,
        parent_id: 100,
        menu_code: 'portfolio.overview',
        label: 'Portfolio Overview',
        route: '/portfolio/overview',
        icon: 'PieChart',
        role_required: 'user',
        order_index: 1,
        is_active: true,
      },
      {
        id: 102,
        parent_id: 100,
        menu_code: 'portfolio.transactions',
        label: 'Transactions',
        route: '/portfolio/transactions',
        icon: 'DollarSign',
        role_required: 'user',
        order_index: 2,
        is_active: true,
      },
    ],
  },
  {
    id: 200,
    parent_id: null,
    menu_code: 'research',
    label: 'Research Hub',
    route: '/research/stock_analyst',
    icon: 'TrendingUp',
    role_required: 'analyst',
    order_index: 20,
    is_active: true,
    children: [
      {
        id: 201,
        parent_id: 200,
        menu_code: 'research.macro',
        label: 'Macroeconomics',
        route: '/research/macro',
        icon: 'Globe',
        role_required: 'analyst',
        order_index: 1,
        is_active: true,
      },
    ],
  },
  {
    id: 300,
    parent_id: null,
    menu_code: 'admin',
    label: 'Administration',
    route: '/admin/users',
    icon: 'Shield',
    role_required: 'admin',
    order_index: 30,
    is_active: true,
    children: [
      {
        id: 301,
        parent_id: 300,
        menu_code: 'admin.users',
        label: 'User Directory',
        route: '/admin/users',
        icon: 'Users',
        role_required: 'admin',
        order_index: 1,
        is_active: true,
      },
    ],
  },
];

describe('Dynamic SiteMap Navigation Tree Rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders navigation tree nodes returned from apiClient.getSitemap', async () => {
    vi.spyOn(apiClient, 'getSitemap').mockResolvedValue(MOCK_SITEMAP_TREE);
    const mockNavigate = vi.fn();

    render(
      <DynamicSidebar
        currentPath="/portfolio/overview"
        onNavigate={mockNavigate}
        activeRole="admin"
      />
    );

    // Verify root items render
    expect(await screen.findByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Research Hub')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();

    // Verify child items render
    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('User Directory')).toBeInTheDocument();
  });

  it('highlights the active item matching currentPath', async () => {
    vi.spyOn(apiClient, 'getSitemap').mockResolvedValue(MOCK_SITEMAP_TREE);
    const mockNavigate = vi.fn();

    render(
      <DynamicSidebar
        currentPath="/portfolio/overview"
        onNavigate={mockNavigate}
        activeRole="user"
      />
    );

    await screen.findByText('Portfolio Overview');

    const activeNodeElement = screen.getByTitle('Portfolio Overview');
    // Active style includes blue highlight and font-semibold
    expect(activeNodeElement.className).toContain('font-semibold');
    expect(activeNodeElement.className).toMatch(/text-blue-700|text-\[#1D4ED8\]/);
    expect(activeNodeElement.className).toMatch(/border-blue-700|border-\[#1D4ED8\]/);

    const inactiveNodeElement = screen.getByTitle('Transactions');
    expect(inactiveNodeElement.className).not.toContain('font-semibold');
  });

  it('triggers onNavigate callback when an item is clicked', async () => {
    vi.spyOn(apiClient, 'getSitemap').mockResolvedValue(MOCK_SITEMAP_TREE);
    const mockNavigate = vi.fn();

    render(
      <DynamicSidebar
        currentPath="/portfolio/overview"
        onNavigate={mockNavigate}
        activeRole="user"
      />
    );

    const transactionsItem = await screen.findByText('Transactions');
    fireEvent.click(transactionsItem);

    expect(mockNavigate).toHaveBeenCalledWith('/portfolio/transactions');
  });

  it('displays role requirement badges (ADM, ANA) for privileged items', async () => {
    vi.spyOn(apiClient, 'getSitemap').mockResolvedValue(MOCK_SITEMAP_TREE);
    const mockNavigate = vi.fn();

    render(
      <DynamicSidebar
        currentPath="/portfolio/overview"
        onNavigate={mockNavigate}
        activeRole="admin"
      />
    );

    expect(await screen.findByText('Administration')).toBeInTheDocument();

    // Admin nodes have the 'ADM' badge
    const adminBadges = screen.getAllByText('ADM');
    expect(adminBadges.length).toBeGreaterThan(0);

    // Analyst nodes have the 'ANA' badge
    const analystBadges = screen.getAllByText('ANA');
    expect(analystBadges.length).toBeGreaterThan(0);
  });

  it('collapses and expands child nodes when toggle button is clicked', async () => {
    vi.spyOn(apiClient, 'getSitemap').mockResolvedValue(MOCK_SITEMAP_TREE);
    const mockNavigate = vi.fn();

    render(
      <DynamicSidebar
        currentPath="/portfolio/overview"
        onNavigate={mockNavigate}
        activeRole="admin"
      />
    );

    await screen.findByText('Portfolio Overview');

    // Find collapse button for My Portfolio
    const collapseButtons = screen.getAllByLabelText('Collapse');
    expect(collapseButtons.length).toBeGreaterThan(0);

    // Click collapse on the first parent
    fireEvent.click(collapseButtons[0]);

    // Children of My Portfolio should now be hidden
    await waitFor(() => {
      expect(screen.queryByText('Portfolio Overview')).not.toBeInTheDocument();
    });

    // Toggle button should now show 'Expand'
    const expandButton = screen.getByLabelText('Expand');
    fireEvent.click(expandButton);

    // Children should reappear
    expect(await screen.findByText('Portfolio Overview')).toBeInTheDocument();
  });
});
