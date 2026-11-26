import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppShell } from '../../frontend/src/components/layout/AppShell';
import apiClient from '../../frontend/src/services/apiClient';

vi.mock('../../frontend/src/services/apiClient', () => ({
  default: {
    getAuthEnv: vi.fn(),
    logout: vi.fn(),
    sendAgentChatMessage: vi.fn(),
    getChatHistory: vi.fn().mockResolvedValue([]),
    getAgentChatHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../frontend/src/components/layout/DynamicSidebar', () => ({
  default: () => <div data-testid="mock-dynamic-sidebar" />,
}));

const mockApi = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('AppShell Runtime Environment & Database Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getChatHistory.mockResolvedValue([]);
  });

  it('renders PRD / 4leafclover when authEnv prop is PRD', () => {
    render(
      <AppShell
        currentPath="/portfolio/overview"
        onNavigate={vi.fn()}
        activeRole="admin"
        onRoleChange={vi.fn()}
        authEnv={{ env: 'PRD', googleClientId: 'g-client-123', dbName: '4leafclover' }}
      >
        <div>Content</div>
      </AppShell>
    );

    const badge = screen.getByTestId('runtime-env-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('PRD / 4leafclover');
  });

  it('renders DEV / 4leafclover_dev when authEnv prop is DEV', () => {
    render(
      <AppShell
        currentPath="/portfolio/overview"
        onNavigate={vi.fn()}
        activeRole="admin"
        onRoleChange={vi.fn()}
        authEnv={{ env: 'DEV', googleClientId: 'g-client-dev', dbName: '4leafclover_dev' }}
      >
        <div>Content</div>
      </AppShell>
    );

    const badge = screen.getByTestId('runtime-env-badge');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('DEV / 4leafclover_dev');
  });

  it('fetches authEnv dynamically via apiClient when prop is not supplied', async () => {
    mockApi.getAuthEnv.mockResolvedValueOnce({
      env: 'PRD',
      googleClientId: 'prod-client',
      dbName: '4leafclover',
    });

    render(
      <AppShell
        currentPath="/portfolio/overview"
        onNavigate={vi.fn()}
        activeRole="admin"
        onRoleChange={vi.fn()}
      >
        <div>Content</div>
      </AppShell>
    );

    await waitFor(() => {
      const badge = screen.getByTestId('runtime-env-badge');
      expect(badge.textContent).toContain('PRD / 4leafclover');
    });
    expect(mockApi.getAuthEnv).toHaveBeenCalled();
  });
});
