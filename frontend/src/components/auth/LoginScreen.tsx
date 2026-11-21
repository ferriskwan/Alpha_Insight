import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Shield, UserCheck, AlertCircle, ArrowRight, User } from 'lucide-react';
import { UserProfile, AuthEnvConfig } from '../../types/api';
import apiClient from '../../services/apiClient';

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      width?: number;
      text?: string;
      shape?: string;
    }
  ) => void;
}

interface GoogleWindow extends Window {
  google?: {
    accounts?: {
      id?: GoogleAccountsId;
    };
  };
}

export interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const GoogleGLogo: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="currentColor"
      className="text-blue-600"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      className="text-emerald-600"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      className="text-amber-500"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="currentColor"
      className="text-rose-600"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [authEnv, setAuthEnv] = useState<AuthEnvConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtherAccount, setShowOtherAccount] = useState<boolean>(false);
  const [customEmail, setCustomEmail] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const onLoginSuccessRef = useRef(onLoginSuccess);
  onLoginSuccessRef.current = onLoginSuccess;

  const isProd = (authEnv?.env || '').toUpperCase() === 'PRD';
  const dbLabel = isProd ? '4leafclover' : '4leafclover_dev';

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getAuthEnv()
      .then((cfg) => {
        if (isMounted) setAuthEnv(cfg);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to connect to backend.');
          setAuthEnv({ env: 'DEV', googleClientId: '' });
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Google Identity Services (GIS) when running in PRD with a configured Client ID
  useEffect(() => {
    if (!isProd || !authEnv?.googleClientId) return;

    const clientId = authEnv.googleClientId;
    const renderGoogleButton = () => {
      const gsi = (window as GoogleWindow).google?.accounts?.id;
      const container = googleBtnRef.current;
      if (!gsi || !container) return;

      container.innerHTML = '';
      gsi.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            setError('Google Sign-In did not return a credential token.');
            return;
          }
          setLoading(true);
          setError(null);
          try {
            const user = await apiClient.googleLogin({ credential: response.credential });
            onLoginSuccessRef.current(user);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Google authentication failed';
            setError(msg);
          } finally {
            setLoading(false);
          }
        },
      });
      gsi.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: 340,
        text: 'continue_with',
        shape: 'rectangular',
      });
    };

    if ((window as GoogleWindow).google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton);
      return () => existingScript.removeEventListener('load', renderGoogleButton);
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => setError('Failed to load Google Sign-In script.');
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [isProd, authEnv?.googleClientId]);

  const handleSignIn = async (email: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      // Development mock Single Sign-On (non-PRD environments only)
      const user = await apiClient.googleLogin({
        mock_email: email,
        mock_name: name,
      });
      onLoginSuccess(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setError('Please provide a valid email address.');
      return;
    }
    handleSignIn(customEmail.trim(), customName.trim() || customEmail.trim());
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] flex flex-col items-center justify-center p-4 font-sans text-[#0F172A]">
      <div className="w-full max-w-[420px]">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center text-blue-700 mb-3 shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Alpha<span className="text-blue-700">Insight</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quantitative Analytics, Intraday Microstructure & AI Research
          </p>
          <div className="mt-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
              [{authEnv?.env || 'DEV'}] {dbLabel}
            </span>
          </div>
        </div>

        {/* Paper Sign In Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-blue-700" />
            <h2 className="text-base font-semibold text-[#0F172A]">Single Sign-On</h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Authenticate directly with your authorized Google Account.
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isProd ? (
            /* Production: Real Google Identity Services OAuth Button */
            <div className="space-y-3">
              {authEnv?.googleClientId ? (
                <div
                  ref={googleBtnRef}
                  data-testid="google-gsi-container"
                  className="w-full flex justify-center py-1 min-h-[44px]"
                />
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  Google OAuth Client ID is not configured for this environment.
                </div>
              )}

              {loading && (
                <div className="text-center text-xs text-blue-700 font-mono py-1 animate-pulse">
                  Verifying Google credential...
                </div>
              )}
            </div>
          ) : (
            /* Development / Non-PRD: Direct Developer Mock Sign-In */
            <>
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSignIn('ferriskwan@gmail.com', 'Ferris Kwan')}
                  className="w-full flex items-center justify-between p-3.5 rounded-lg border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 bg-white transition-all shadow-xs group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <GoogleGLogo className="w-5 h-5 shrink-0" />
                    <div className="text-left">
                      <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5">
                        Continue as Ferris Kwan
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ferriskwan@gmail.com
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    Admin
                  </span>
                </button>

                {loading && (
                  <div className="text-center text-xs text-blue-700 font-mono py-1 animate-pulse">
                    Establishing authenticated session...
                  </div>
                )}
              </div>

              {/* Secondary Account Switcher */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowOtherAccount(!showOtherAccount)}
                    className="text-[11px] text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <User className="w-3 h-3" />
                    {showOtherAccount ? 'Hide account switcher' : 'Use another Google account'}
                  </button>
                </div>

                {showOtherAccount && (
                  <form
                    onSubmit={handleCustomSubmit}
                    className="mt-3.5 space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
                  >
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Google Account Email
                      </label>
                      <input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="e.g. yeow.ling.angela@gmail.com"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Display Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Angela Tan"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded transition-colors"
                    >
                      <span>Sign In Without Pop-up</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              Session secured via HttpOnly Cookie (alpha_sid)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
