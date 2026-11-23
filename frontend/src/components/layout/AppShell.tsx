import React, { useState, useEffect } from 'react';
import {
  LogOut,
  Menu,
  X,
  Columns,
  Sparkles,
} from 'lucide-react';
import { UserRoleType, UserSummary } from '../../types/api';
import apiClient from '../../services/apiClient';
import DynamicSidebar from './DynamicSidebar';
import {
  BottomNavBar,
  SplitLayoutMode,
  FloatingAgentChat,
  DisplayedScreenContext,
  AgentChatTurn,
} from '../../design-system';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (route: string) => void;
  activeRole: UserRoleType;
  onRoleChange: (newRole: UserRoleType) => void;
  currentUser?: UserSummary | null;
  onLogout?: () => void;
  splitMode?: SplitLayoutMode;
  onSplitModeChange?: (mode: SplitLayoutMode) => void;
  displayedContext?: DisplayedScreenContext;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentPath,
  onNavigate,
  activeRole,
  onRoleChange,
  currentUser = null,
  onLogout,
  splitMode = 'single',
  onSplitModeChange,
  displayedContext,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [agenticAnalystOpen, setAgenticAnalystOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<AgentChatTurn[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleNavigate = (route: string) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const resolveMobileTab = (path: string): string => {
    if (path.includes('watchlist')) return 'watchlist';
    if (path.includes('analyst') || path.includes('research') || path.includes('committee')) {
      return 'analyst';
    }
    return 'overview';
  };

  const resolvedContext: DisplayedScreenContext = displayedContext || {
    symbol: 'AAPL',
    activeRoute: currentPath,
    routeTitle: currentPath,
    contextPills: [`Active Context: AAPL`, `Route: ${currentPath}`],
    data: { route: currentPath },
  };

  const activeRunId =
    resolvedContext.data && typeof resolvedContext.data.activeRunId === 'number'
      ? (resolvedContext.data.activeRunId as number)
      : null;

  // Load persisted Chat Session history tied to the active symbol and analysis run
  useEffect(() => {
    const sym = resolvedContext.symbol || 'AAPL';
    let mounted = true;
    apiClient
      .getChatHistory(sym, activeRunId)
      .then((rows) => {
        if (!mounted) return;
        if (rows && Array.isArray(rows)) {
          setChatMessages(
            rows.map((r) => ({
              role: r.role,
              content: r.content,
            }))
          );
        }
      })
      .catch(() => {
        // Keep current state if offline
      });
    return () => {
      mounted = false;
    };
  }, [resolvedContext.symbol, activeRunId]);

  const handleSendChatMessage = async (messageText: string) => {
    const nextMessages: AgentChatTurn[] = [
      ...chatMessages,
      { role: 'user', content: messageText },
    ];
    setChatMessages(nextMessages);
    setChatLoading(true);

    try {
      const res = await apiClient.sendAgentContextualChat({
        messages: nextMessages,
        symbol: resolvedContext.symbol || 'AAPL',
        run_id: activeRunId,
        active_route: resolvedContext.activeRoute || currentPath,
        displayed_context: (resolvedContext.data || {}) as Record<string, any>,
        provider: 'gemini',
        model: 'gemini-4-neon',
      });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err: unknown) {
      const fallbackMsg =
        err instanceof Error
          ? `Contextual response (${resolvedContext.symbol || 'AAPL'}): ${err.message}`
          : 'Unable to reach contextual chat service.';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: fallbackMsg }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = async () => {
    setChatMessages([]);
    try {
      await apiClient.clearChatHistory(resolvedContext.symbol || 'AAPL', activeRunId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16 lg:pb-0">
      {/* 1. Paper Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between select-none shrink-0 sticky top-0 z-30">
        {/* Left Cluster: Mobile toggle + Brand + Env Pill */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => handleNavigate('/portfolio/overview')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 rounded bg-blue-700 flex items-center justify-center text-white font-bold text-xs tracking-wider">
              AI
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-base text-slate-900 tracking-tight">Alpha</span>
              <span className="font-bold text-base text-blue-700 tracking-tight">_Insight</span>
            </div>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-50 border border-slate-300 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-700" />
            <span>DEV / 4leafclover_dev</span>
          </div>
        </div>

        {/* Center/Right Cluster: Agentic Analyst Sparkle + Top-Tier Split View + RBAC + User */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Chat Session Floating Trigger Button */}
          <button
            type="button"
            onClick={() => setAgenticAnalystOpen(!agenticAnalystOpen)}
            data-testid="toggle-agentic-analyst-btn"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs ${
              agenticAnalystOpen
                ? 'bg-blue-700 text-white'
                : 'bg-slate-50 border border-slate-300 text-blue-700 hover:bg-blue-50'
            }`}
            title="Toggle Chat Session"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat Session</span>
          </button>

          {/* Top-Tier Split View Selector (Desktop Only >= 1024px) */}
          {onSplitModeChange && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
              <Columns className="w-3.5 h-3.5 text-slate-500 ml-1" />
              <span className="text-[11px] font-semibold text-slate-600 px-1">Split View:</span>
              <select
                value={splitMode}
                onChange={(e) => onSplitModeChange(e.target.value as SplitLayoutMode)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold text-slate-800 outline-hidden cursor-pointer"
              >
                <option value="single">Single Pane (100%)</option>
                <option value="split-30-70">Split 30 / 70</option>
                <option value="split-50-50">Split 50 / 50</option>
                <option value="split-70-30">Split 70 / 30</option>
              </select>
            </div>
          )}

          {/* Real-time RBAC Switcher Pill */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-[11px] font-semibold text-slate-600 px-1 hidden md:inline">
              Role:
            </span>
            {(['user', 'analyst', 'admin'] as UserRoleType[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => onRoleChange(role)}
                className={`px-2 py-0.5 rounded font-mono uppercase text-[11px] transition-colors cursor-pointer ${
                  activeRole === role
                    ? 'bg-blue-700 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title={`Switch active test role to ${role}`}
              >
                {role}
              </button>
            ))}
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-blue-700 font-bold text-xs">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {currentUser?.name || 'Institutional Trader'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono leading-none">
                {currentUser?.email || 'admin@4leafclover.com'}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded border border-slate-200 text-slate-500 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Workspace Body: Left Dynamic Sidebar + Main Content Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Dynamic Sidebar */}
        <div className="hidden md:flex">
          <DynamicSidebar
            currentPath={currentPath}
            onNavigate={handleNavigate}
            activeRole={activeRole}
          />
        </div>

        {/* Mobile Slide-Over Menu Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 bg-white h-full shadow-xl flex flex-col z-50">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">AlphaInsight Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <DynamicSidebar
                currentPath={currentPath}
                onNavigate={handleNavigate}
                activeRole={activeRole}
                className="flex-1 border-r-0"
              />
            </div>
          </div>
        )}

        {/* Center Main Workspace */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50">
          <div className="max-w-[1700px] mx-auto h-full">{children}</div>
        </main>

        {/* Floating Contextual Chat Window (Design System Primitive) */}
        <FloatingAgentChat
          open={agenticAnalystOpen}
          onClose={() => setAgenticAnalystOpen(false)}
          model="gemini-4-neon"
          displayedContext={resolvedContext}
          messages={chatMessages}
          loading={chatLoading}
          onSendMessage={handleSendChatMessage}
          onClearChat={handleClearChat}
        />
      </div>

      {/* 3. Mobile Fixed Bottom Navigation Bar (Slide 2 Specification, viewport < 1024px) */}
      <div className="lg:hidden">
        <BottomNavBar
          activeTab={resolveMobileTab(currentPath)}
          onTabChange={(_tabId, route) => {
            if (route) handleNavigate(route);
          }}
          onOpenMenuDrawer={() => setMobileMenuOpen(true)}
        />
      </div>
    </div>
  );
};

export default AppShell;
