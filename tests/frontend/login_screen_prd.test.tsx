import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LoginScreen } from '../../frontend/src/components/auth/LoginScreen';
import apiClient from '../../frontend/src/services/apiClient';

describe('LoginScreen PRD Google OAuth & Environment Badge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).google;
  });

  it('renders [PRD] 4leafclover badge, hides dev mock buttons, and initializes Google GIS in PRD', async () => {
    let capturedCallback: ((res: { credential?: string }) => Promise<void>) | null = null;
    const initMock = vi.fn(({ callback }) => {
      capturedCallback = callback;
    });
    const renderBtnMock = vi.fn();

    (window as unknown as Record<string, unknown>).google = {
      accounts: {
        id: {
          initialize: initMock,
          renderButton: renderBtnMock,
        },
      },
    };

    vi.spyOn(apiClient, 'getAuthEnv').mockResolvedValue({
      env: 'PRD',
      googleClientId: 'test-client-id.apps.googleusercontent.com',
    });
    const loginSpy = vi.spyOn(apiClient, 'googleLogin').mockResolvedValue({
      id: 1,
      email: 'ferriskwan@gmail.com',
      name: 'Ferris Kwan',
      status: 'active',
      roles: ['admin', 'user'],
    });
    const onSuccess = vi.fn();

    render(<LoginScreen onLoginSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('[PRD] 4leafclover')).toBeTruthy();
    });

    expect(screen.queryByText('Continue as Ferris Kwan')).toBeNull();
    expect(screen.getByTestId('google-gsi-container')).toBeTruthy();
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-client-id.apps.googleusercontent.com' })
    );
    expect(renderBtnMock).toHaveBeenCalled();

    // Simulate Google GIS returning an ID token credential
    expect(capturedCallback).not.toBeNull();
    await capturedCallback!({ credential: 'real-google-jwt-token' });

    expect(loginSpy).toHaveBeenCalledWith({ credential: 'real-google-jwt-token' });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ferriskwan@gmail.com' })
    );
  });

  it('renders [DEV] 4leafclover_dev badge and retains quick dev login in DEV', async () => {
    vi.spyOn(apiClient, 'getAuthEnv').mockResolvedValue({
      env: 'DEV',
      googleClientId: '',
    });

    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('[DEV] 4leafclover_dev')).toBeTruthy();
    });
    expect(screen.getByText('Continue as Ferris Kwan')).toBeTruthy();
  });
});
