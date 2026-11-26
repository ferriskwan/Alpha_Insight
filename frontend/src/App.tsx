import React, { useState, useEffect, useCallback } from 'react';
import {
  UserProfile,
  UserRoleType,
  UserSummary,
  AuthEnvConfig,
  AgentAnalystOutputDTO,
} from './types/api';
import apiClient from './services/apiClient';
import AppShell from './components/layout/AppShell';
import LoginScreen from './components/auth/LoginScreen';
import UserAdmin from './components/admin/UserAdmin';
import SiteMapAdmin from './components/admin/SiteMapAdmin';
import RefDataEditor from './components/admin/RefDataEditor';
import AuditLogsViewer from './components/admin/AuditLogsViewer';
import InvestmentNotesView from './components/notes/InvestmentNotesView';
import PortfolioOverview from './components/portfolio/PortfolioOverview';
import TransactionsView from './components/portfolio/TransactionsView';
import WatchlistView from './components/portfolio/WatchlistView';
import StockAnalystView from './components/research/StockAnalystView';
import MacroeconomicsView from './components/research/MacroeconomicsView';
import AnalystCommitteeView from './components/research/AnalystCommitteeView';
import {
  SplitPaneLayout,
  SplitLayoutMode,
  PaneId,
  DisplayedScreenContext,
} from './design-system';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [authEnv, setAuthEnv] = useState<AuthEnvConfig | null>(null);
  const [activeRole, setActiveRole] = useState<UserRoleType>('admin');

  // Workstation routing and split-screen state with localStorage persistence
  const [currentPath, setCurrentPath] = useState<string>(() => {
    try {
      return localStorage.getItem('alpha_insight_active_path') || '/portfolio/overview';
    } catch {
      return '/portfolio/overview';
    }
  });
  const [rightPath, setRightPath] = useState<string>(() => {
    try {
      return localStorage.getItem('alpha_insight_right_path') || '/research/analyst';
    } catch {
      return '/research/analyst';
    }
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    try {
      return localStorage.getItem('alpha_insight_selected_symbol') || '';
    } catch {
      return '';
    }
  });
  const [splitMode, setSplitMode] = useState<SplitLayoutMode>(() => {
    try {
      const saved = localStorage.getItem('alpha_insight_split_mode');
      if (saved === 'single' || saved === 'split-50-50' || saved === 'split-60-40' || saved === 'split-40-60') {
        return saved as SplitLayoutMode;
      }
      return 'single';
    } catch {
      return 'single';
    }
  });
  const [activePane, setActivePane] = useState<PaneId>('left');
  const [pendingLinkedOutput, setPendingLinkedOutput] = useState<AgentAnalystOutputDTO | null>(null);
  const [displayedContext, setDisplayedContext] = useState<DisplayedScreenContext>({
    symbol: '',
    activeRoute: '/portfolio/overview',
    routeTitle: 'Portfolio Overview',
    contextPills: ['Portfolio Overview'],
    data: {},
  });

  const handleContextUpdate = useCallback((ctx: DisplayedScreenContext) => {
    setDisplayedContext(ctx);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('alpha_insight_active_path', currentPath);
    } catch {
      // ignore
    }
  }, [currentPath]);

  useEffect(() => {
    try {
      localStorage.setItem('alpha_insight_right_path', rightPath);
    } catch {
      // ignore
    }
  }, [rightPath]);

  useEffect(() => {
    try {
      localStorage.setItem('alpha_insight_selected_symbol', selectedSymbol);
    } catch {
      // ignore
    }
  }, [selectedSymbol]);

  useEffect(() => {
    try {
      localStorage.setItem('alpha_insight_split_mode', splitMode);
    } catch {
      // ignore
    }
  }, [splitMode]);

  useEffect(() => {
    // 1. Fetch Auth Env Config
    apiClient
      .getAuthEnv()
      .then((cfg) => setAuthEnv(cfg))
      .catch(() => setAuthEnv({ env: 'DEV', googleClientId: '' }));

    // 2. Check Active Session
    apiClient
      .getMe()
      .then((profile) => {
        setUser(profile);
        if (profile.roles && profile.roles.length > 0) {
          if (profile.roles.includes('admin')) setActiveRole('admin');
          else if (profile.roles.includes('analyst')) setActiveRole('analyst');
          else setActiveRole('user');
        }
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    if (loggedInUser.roles && loggedInUser.roles.length > 0) {
      if (loggedInUser.roles.includes('admin')) setActiveRole('admin');
      else if (loggedInUser.roles.includes('analyst')) setActiveRole('analyst');
      else setActiveRole('user');
    }
  };

  const getRouteTitle = (path: string): string => {
    if (path.includes('overview')) return 'Portfolio Overview';
    if (path.includes('transactions')) return 'Transactions';
    if (path.includes('watchlist')) return 'Watchlist';
    if (path.includes('committee') || path.includes('analyst') || path.includes('stock_analyst')) {
      return 'Stock Analysis';
    }
    if (path.includes('macro')) return 'Macroeconomics';
    if (path.includes('users')) return 'User Administration';
    if (path.includes('sitemap')) return 'Site Map Admin';
    if (path.includes('ref-data')) return 'Reference Data Editor';
    if (path.includes('audit-logs')) return 'Audit Logs';
    if (path.includes('notes')) return 'Investment Notes & Thesis Journal';
    return 'Workstation Canvas';
  };

  const handleDropOnPane = (pane: PaneId, _menuCode: string, route: string) => {
    if (pane === 'left') {
      setCurrentPath(route);
    } else {
      setRightPath(route);
      if (splitMode === 'single') {
        setSplitMode('split-50-50');
      }
    }
  };

  const handleSwapPanes = () => {
    const temp = currentPath;
    setCurrentPath(rightPath);
    setRightPath(temp);
  };

  const handleCloseRightPane = () => {
    setSplitMode('single');
  };

  const handleReferenceInNote = (output: AgentAnalystOutputDTO) => {
    if (output.symbol && output.symbol !== 'MACRO') {
      setSelectedSymbol(output.symbol);
    }
    setPendingLinkedOutput(output);
    if (splitMode !== 'single') {
      setRightPath('/notes');
    } else {
      setCurrentPath('/notes');
    }
  };

  const renderSubApp = (route: string) => {
    if (route === '/admin/users') return <UserAdmin />;
    if (route === '/admin/sitemap') return <SiteMapAdmin />;
    if (route === '/admin/ref-data') return <RefDataEditor />;
    if (route === '/admin/audit-logs') return <AuditLogsViewer />;
    if (route === '/portfolio/overview') return <PortfolioOverview />;
    if (route.startsWith('/portfolio/transactions')) return <TransactionsView />;
    if (route === '/portfolio/watchlist') {
      return (
        <WatchlistView
          onSelectSymbol={(sym) => {
            setSelectedSymbol(sym);
            setRightPath('/research/committee');
            if (splitMode === 'single') setSplitMode('split-50-50');
          }}
        />
      );
    }
    if (route.includes('committee') || route.includes('analyst')) {
      return (
        <AnalystCommitteeView
          initialSymbol={selectedSymbol}
          onReferenceInNote={handleReferenceInNote}
          onContextUpdate={handleContextUpdate}
        />
      );
    }
    if (route.includes('macro')) {
      return (
        <MacroeconomicsView
          onReferenceInNote={handleReferenceInNote}
          onContextUpdate={handleContextUpdate}
        />
      );
    }
    if (route.startsWith('/notes')) {
      return (
        <InvestmentNotesView
          initialSymbol={selectedSymbol}
          initialLinkedOutput={pendingLinkedOutput}
          onClearInitialLinkedOutput={() => setPendingLinkedOutput(null)}
          onContextUpdate={handleContextUpdate}
        />
      );
    }

    return <PortfolioOverview />;
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-mono text-xs">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-700 animate-ping mr-2.5" />
        Initializing AlphaInsight Workstation...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const userSummary: UserSummary = {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture || null,
    roles: (user.roles as UserRoleType[]) || ['admin'],
    status: user.status === 'active' ? 'active' : 'suspended',
    created_at: new Date().toISOString(),
  };

  return (
    <AppShell
      currentPath={currentPath}
      authEnv={authEnv}
      onNavigate={(newRoute) => {
        if (activePane === 'right' && splitMode !== 'single') {
          setRightPath(newRoute);
        } else {
          setCurrentPath(newRoute);
        }
      }}
      activeRole={activeRole}
      onRoleChange={setActiveRole}
      currentUser={userSummary}
      onLogout={handleLogout}
      splitMode={splitMode}
      onSplitModeChange={setSplitMode}
      displayedContext={displayedContext}
    >
      <SplitPaneLayout
        layoutMode={splitMode}
        activeFocusPane={activePane}
        onFocusPaneChange={setActivePane}
        onDropOnPane={handleDropOnPane}
        leftTitle={getRouteTitle(currentPath)}
        rightTitle={getRouteTitle(rightPath)}
        leftPane={renderSubApp(currentPath)}
        rightPane={renderSubApp(rightPath)}
        onSwapPanes={handleSwapPanes}
        onCloseRightPane={handleCloseRightPane}
      />
    </AppShell>
  );
};

export default App;
