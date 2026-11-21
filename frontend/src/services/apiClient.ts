/**
 * Centralized API Client for Alpha_Insight.
 * Adheres strictly to api_contract.md and frontend/src/types/api.ts.
 * Zero hardcoded localhost URLs.
 */

import {
  UserProfile,
  AuthEnvConfig,
  WatchlistSymbolItem,
  WatchlistDataResponse,
  AnalyzeRequestPayload,
  AnalyzeResponsePayload,
  PortfolioDashboardResponse,
  PositionRecord,
  TradeRecord,
  CapitalRecord,
  SysValueRecord,
  JobExecutionLogItem,
  UserSummary,
  SiteMapNode,
  SiteMapCreateRequest,
  SiteMapUpdateRequest,
  AuditLogEntry,
  TransCostItem,
  TransCostCreateRequest,
  RefChartSettingsDTO,
  RefDataSysValue,
  RefDataSysValueUpdate,
  PortfolioOverviewResponse,
  PortfolioCommentaryResponse,
  WatchlistEnrichedItem,
  StockAnalystResponse,
  MacroeconomicsResponse,
  SectorPerformanceResponse,
  ModelOptionItem,
  CommitteeRunRequestPayload,
  CommitteeRunSummaryDTO,
  CommitteeRunDetailDTO,
  AgentAnalystOutputDTO,
  AgentContextualChatRequestPayload,
  AgentContextualChatResponsePayload,
  StoredChatMessageDTO,
  InvestmentNoteCreatePayload,
  InvestmentNoteUpdatePayload,
  InvestmentNoteDTO,
  MacroWorkbenchResponseDTO,
} from '../types/api';

const API_BASE = '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorJson.error || errorDetail;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  // Auth
  async getAuthEnv(): Promise<AuthEnvConfig> {
    return fetchJson<AuthEnvConfig>('/api/auth/env');
  },

  async googleLogin(payload: { credential?: string; mock_email?: string; mock_name?: string }): Promise<UserProfile> {
    return fetchJson<UserProfile>('/api/auth/google-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMe(): Promise<UserProfile> {
    return fetchJson<UserProfile>('/api/auth/me');
  },

  async logout(): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },

  // Watchlist & Charting
  async getWatchlistSymbols(): Promise<WatchlistSymbolItem[]> {
    return fetchJson<WatchlistSymbolItem[]>('/api/watchlist/symbols');
  },

  async getWatchlistData(symbol: string, zoomStart?: string, zoomEnd?: string): Promise<WatchlistDataResponse> {
    let url = `/api/watchlist/data?symbol=${encodeURIComponent(symbol)}`;
    if (zoomStart) url += `&zoom_start=${encodeURIComponent(zoomStart)}`;
    if (zoomEnd) url += `&zoom_end=${encodeURIComponent(zoomEnd)}`;
    return fetchJson<WatchlistDataResponse>(url);
  },

  // Stock Analysis
  async analyzeStock(payload: AnalyzeRequestPayload): Promise<AnalyzeResponsePayload> {
    return fetchJson<AnalyzeResponsePayload>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Portfolio
  async getPortfolioDashboard(currency: string = 'USD', account: string = 'All'): Promise<PortfolioDashboardResponse> {
    const url = `/api/portfolio/dashboard?currency=${encodeURIComponent(currency)}&account=${encodeURIComponent(account)}`;
    return fetchJson<PortfolioDashboardResponse>(url);
  },

  async getPositions(): Promise<PositionRecord[]> {
    return fetchJson<PositionRecord[]>('/api/portfolio/positions');
  },

  async getTrades(symbol?: string): Promise<TradeRecord[]> {
    const url = symbol ? `/api/portfolio/trades?symbol=${encodeURIComponent(symbol)}` : '/api/portfolio/trades';
    return fetchJson<TradeRecord[]>(url);
  },

  async getCapital(): Promise<CapitalRecord[]> {
    return this.getTransactions<CapitalRecord>('capital');
  },

  async createTrade(data: Partial<TradeRecord>): Promise<TradeRecord> {
    return this.createTransaction<TradeRecord>('trade', data);
  },

  async createCapital(data: Partial<CapitalRecord>): Promise<CapitalRecord> {
    return this.createTransaction<CapitalRecord>('capital', data);
  },


  // Transaction Editor CRUD
  async getTransactions<T = Record<string, unknown>>(entity: 'watchlist' | 'trade' | 'capital' | 'sysvalue'): Promise<T[]> {
    return fetchJson<T[]>(`/api/transactions/${entity}`);
  },

  async createTransaction<T = Record<string, unknown>>(entity: 'watchlist' | 'trade' | 'capital' | 'sysvalue', data: unknown): Promise<T> {
    return fetchJson<T>(`/api/transactions/${entity}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTransaction<T = Record<string, unknown>>(entity: 'watchlist' | 'trade' | 'capital' | 'sysvalue', data: unknown): Promise<T> {
    return fetchJson<T>(`/api/transactions/${entity}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTransaction(entity: 'watchlist' | 'trade' | 'capital' | 'sysvalue', payload: unknown): Promise<{ ok: boolean }> {
    const rec = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const params = new URLSearchParams();
    if (entity === 'watchlist') {
      if (rec.symbol) params.set('symbol', String(rec.symbol));
      if (rec.watchlistname) params.set('watchlistname', String(rec.watchlistname));
    } else if (entity === 'trade' || entity === 'capital') {
      if (rec.id !== undefined && rec.id !== null) params.set('id', String(rec.id));
    } else if (entity === 'sysvalue') {
      if (rec.name) params.set('name', String(rec.name));
    }
    const qs = params.toString();
    const url = `/api/transactions/${entity}${qs ? `?${qs}` : ''}`;
    return fetchJson<{ ok: boolean }>(url, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  },

  // Admin & Job Execution
  async getAdminUsers(): Promise<UserProfile[]> {
    return fetchJson<UserProfile[]>('/api/admin/users');
  },

  async updateAdminUserStatus(userId: number, status: 'active' | 'expired'): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>('/api/admin/users/status', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, status }),
    });
  },

  async updateAdminUserRoles(userId: number, role: string, action: 'add' | 'remove'): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>('/api/admin/users/roles', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role, action }),
    });
  },

  async getAdminJobs(): Promise<JobExecutionLogItem[]> {
    return fetchJson<JobExecutionLogItem[]>('/api/admin/jobs');
  },

  async triggerAdminJob(jobName: string = 'daily_pipeline'): Promise<{ ok: boolean; job_id: number; status: string }> {
    return fetchJson<{ ok: boolean; job_id: number; status: string }>('/api/admin/jobs/run', {
      method: 'POST',
      body: JSON.stringify({ job_name: jobName }),
    });
  },

  // ==========================================
  // Epic 0.2: Dynamic Sitemap & Navigation
  // ==========================================
  async getSitemap(role?: string): Promise<SiteMapNode[]> {
    const url = role ? `/api/v1/sitemap?role=${encodeURIComponent(role)}` : '/api/v1/sitemap';
    return fetchJson<SiteMapNode[]>(url);
  },

  async getAdminSitemap(): Promise<SiteMapNode[]> {
    return fetchJson<SiteMapNode[]>('/api/v1/admin/sitemap');
  },

  async createSiteMapNode(data: SiteMapCreateRequest): Promise<SiteMapNode> {
    return fetchJson<SiteMapNode>('/api/v1/admin/sitemap', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSiteMapNode(id: number, data: SiteMapUpdateRequest): Promise<SiteMapNode> {
    return fetchJson<SiteMapNode>(`/api/v1/admin/sitemap/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteSiteMapNode(id: number): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>(`/api/v1/admin/sitemap/${id}`, {
      method: 'DELETE',
    });
  },

  // ==========================================
  // Epic 0.2: User Management & RBAC
  // ==========================================
  async getUsers(): Promise<UserSummary[]> {
    try {
      return await fetchJson<UserSummary[]>('/api/v1/admin/users');
    } catch {
      return fetchJson<UserSummary[]>('/api/admin/users');
    }
  },

  async updateUserRole(id: number, role: string, action: 'add' | 'remove' = 'add'): Promise<{ ok: boolean }> {
    try {
      return await fetchJson<{ ok: boolean }>('/api/v1/admin/users/roles', {
        method: 'POST',
        body: JSON.stringify({ user_id: id, role, action }),
      });
    } catch {
      return fetchJson<{ ok: boolean }>('/api/admin/users/roles', {
        method: 'POST',
        body: JSON.stringify({ user_id: id, role, action }),
      });
    }
  },

  async updateUserStatus(id: number, status: 'active' | 'suspended' | 'expired'): Promise<{ ok: boolean }> {
    try {
      return await fetchJson<{ ok: boolean }>('/api/v1/admin/users/status', {
        method: 'POST',
        body: JSON.stringify({ user_id: id, status }),
      });
    } catch {
      return fetchJson<{ ok: boolean }>('/api/admin/users/status', {
        method: 'POST',
        body: JSON.stringify({ user_id: id, status }),
      });
    }
  },

  // ==========================================
  // Epic 0.2: Reference Data Editor
  // ==========================================
  async getSysValues(): Promise<RefDataSysValue[]> {
    try {
      return await fetchJson<RefDataSysValue[]>('/api/v1/admin/ref-data/sysvalue');
    } catch {
      return fetchJson<RefDataSysValue[]>('/api/transactions/sysvalue');
    }
  },

  async updateSysValue(name: string, data: RefDataSysValueUpdate | Record<string, unknown>): Promise<RefDataSysValue> {
    return fetchJson<RefDataSysValue>(`/api/v1/admin/ref-data/sysvalue/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getChartSettings(): Promise<RefChartSettingsDTO> {
    const res = await fetchJson<RefChartSettingsDTO | RefChartSettingsDTO[]>('/api/v1/admin/ref-data/chart-settings');
    if (Array.isArray(res)) {
      return res[0] || ({} as RefChartSettingsDTO);
    }
    return res;
  },

  async updateChartSettings(data: Partial<RefChartSettingsDTO>): Promise<RefChartSettingsDTO> {
    return fetchJson<RefChartSettingsDTO>('/api/v1/admin/ref-data/chart-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ==========================================
  // Epic 0.2: Audit Logs
  // ==========================================
  async getAuditLogs(params?: { entity?: string; action?: string; limit?: number }): Promise<AuditLogEntry[]> {
    const qs = new URLSearchParams();
    if (params?.entity && params.entity !== 'all') qs.set('entity', params.entity);
    if (params?.action && params.action !== 'all') qs.set('action', params.action);
    if (params?.limit) qs.set('limit', String(params.limit));
    const url = `/api/v1/admin/audit-logs${qs.toString() ? `?${qs.toString()}` : ''}`;
    return fetchJson<AuditLogEntry[]>(url);
  },

  // ==========================================
  // Epic 0.2: Transaction Costs
  // ==========================================
  async getTransCosts(): Promise<TransCostItem[]> {
    return fetchJson<TransCostItem[]>('/api/v1/transactions/trans-cost');
  },

  async createTransCost(data: TransCostCreateRequest): Promise<TransCostItem> {
    return fetchJson<TransCostItem>('/api/v1/transactions/trans-cost', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTransCost(id: number, data: TransCostCreateRequest): Promise<TransCostItem> {
    return fetchJson<TransCostItem>(`/api/v1/transactions/trans-cost/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteTransCost(id: number): Promise<{ ok: boolean }> {
    return fetchJson<{ ok: boolean }>(`/api/v1/transactions/trans-cost/${id}`, {
      method: 'DELETE',
    });
  },

  // ==========================================
  // Epic 0.3: Portfolio Overview & Research
  // ==========================================
  async getPortfolioOverview(params?: {
    currency?: string;
    startDate?: string;
    endDate?: string;
    date?: string;
    timeframe?: string;
  }): Promise<PortfolioOverviewResponse> {
    const qs = new URLSearchParams();
    if (params?.currency) qs.set('currency', params.currency);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.date) qs.set('date', params.date);
    if (params?.timeframe) qs.set('timeframe', params.timeframe);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<PortfolioOverviewResponse>(`/api/v1/portfolio/overview${query}`);
  },

  async getPortfolioCommentary(params?: {
    currency?: string;
    date?: string;
  }): Promise<PortfolioCommentaryResponse> {
    const qs = new URLSearchParams();
    if (params?.currency) qs.set('currency', params.currency);
    if (params?.date) qs.set('date', params.date);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<PortfolioCommentaryResponse>(`/api/v1/portfolio/overview/commentary${query}`);
  },

  async refreshPortfolioCommentary(params?: {
    currency?: string;
    date?: string;
  }): Promise<PortfolioCommentaryResponse> {
    const qs = new URLSearchParams();
    if (params?.currency) qs.set('currency', params.currency);
    if (params?.date) qs.set('date', params.date);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<PortfolioCommentaryResponse>(`/api/v1/portfolio/overview/commentary/refresh${query}`, {
      method: 'POST',
    });
  },

  async getWatchlistLists(): Promise<string[]> {
    return fetchJson<string[]>('/api/v1/watchlist/lists');
  },

  async getWatchlistItems(watchlistName?: string): Promise<WatchlistEnrichedItem[]> {
    const query = watchlistName && watchlistName !== 'All' ? `?watchlistName=${encodeURIComponent(watchlistName)}` : '';
    return fetchJson<WatchlistEnrichedItem[]>(`/api/v1/watchlist/items${query}`);
  },

  async addWatchlistItem(payload: {
    symbol: string;
    name?: string;
    watchlistname?: string;
  }): Promise<{ status: string; item: any }> {
    return fetchJson<{ status: string; item: any }>('/api/v1/watchlist/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async removeWatchlistItem(symbol: string, watchlistName: string = 'Default'): Promise<{ status: string; symbol: string }> {
    return fetchJson<{ status: string; symbol: string }>(
      `/api/v1/watchlist/items/${encodeURIComponent(symbol)}?watchlistName=${encodeURIComponent(watchlistName)}`,
      { method: 'DELETE' }
    );
  },

  async getStockAnalystData(
    symbol: string,
    params?: {
      timeframe?: string;
      sma?: number;
      ema?: number;
      bb?: number;
      bb_std?: number;
      rsi?: number;
      macd_fast?: number;
      macd_slow?: number;
      macd_signal?: number;
    }
  ): Promise<StockAnalystResponse> {
    const qs = new URLSearchParams();
    if (params?.timeframe) qs.set('timeframe', params.timeframe);
    if (params?.sma) qs.set('sma', String(params.sma));
    if (params?.ema) qs.set('ema', String(params.ema));
    if (params?.bb) qs.set('bb', String(params.bb));
    if (params?.bb_std) qs.set('bb_std', String(params.bb_std));
    if (params?.rsi) qs.set('rsi', String(params.rsi));
    if (params?.macd_fast) qs.set('macd_fast', String(params.macd_fast));
    if (params?.macd_slow) qs.set('macd_slow', String(params.macd_slow));
    if (params?.macd_signal) qs.set('macd_signal', String(params.macd_signal));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<StockAnalystResponse>(`/api/v1/research/stock-analyst/${encodeURIComponent(symbol)}${query}`);
  },

  async getMacroeconomics(): Promise<MacroeconomicsResponse> {
    return fetchJson<MacroeconomicsResponse>('/api/v1/research/macroeconomics');
  },

  async getSectorPerformance(horizon: string = '1D'): Promise<SectorPerformanceResponse> {
    return fetchJson<SectorPerformanceResponse>(`/api/v1/research/sectors?horizon=${encodeURIComponent(horizon)}`);
  },

  // ==========================================
  // Epic 0.4: 4-Analyst Committee & Contextual Chat
  // ==========================================
  async getCommitteeModels(): Promise<ModelOptionItem[]> {
    return fetchJson<ModelOptionItem[]>('/api/v1/committee/models');
  },

  async runCommitteeAnalysis(payload: CommitteeRunRequestPayload): Promise<CommitteeRunDetailDTO> {
    return fetchJson<CommitteeRunDetailDTO>('/api/v1/committee/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCommitteeRuns(symbol?: string, limit: number = 20): Promise<CommitteeRunSummaryDTO[]> {
    const qs = new URLSearchParams();
    if (symbol) qs.set('symbol', symbol);
    qs.set('limit', String(limit));
    return fetchJson<CommitteeRunSummaryDTO[]>(`/api/v1/committee/runs?${qs.toString()}`);
  },

  async getCommitteeRunDetail(runId: number): Promise<CommitteeRunDetailDTO> {
    return fetchJson<CommitteeRunDetailDTO>(`/api/v1/committee/runs/${runId}`);
  },

  async getStoredAnalystOutputs(params?: {
    symbol?: string;
    analyst_role?: string;
    trend_status?: string;
    limit?: number;
  }): Promise<AgentAnalystOutputDTO[]> {
    const qs = new URLSearchParams();
    if (params?.symbol && params.symbol !== 'All') qs.set('symbol', params.symbol);
    if (params?.analyst_role && params.analyst_role !== 'All') qs.set('analyst_role', params.analyst_role);
    if (params?.trend_status && params.trend_status !== 'All') qs.set('trend_status', params.trend_status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<AgentAnalystOutputDTO[]>(`/api/v1/committee/outputs${query}`);
  },

  async sendAgentContextualChat(payload: AgentContextualChatRequestPayload): Promise<AgentContextualChatResponsePayload> {
    return fetchJson<AgentContextualChatResponsePayload>('/api/v1/committee/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getChatHistory(symbol: string, runId?: number | null): Promise<StoredChatMessageDTO[]> {
    const qs = new URLSearchParams();
    qs.set('symbol', symbol);
    if (runId !== undefined && runId !== null) qs.set('run_id', String(runId));
    return fetchJson<StoredChatMessageDTO[]>(`/api/v1/committee/chat/history?${qs.toString()}`);
  },

  async clearChatHistory(symbol: string, runId?: number | null): Promise<{ deleted: number }> {
    const qs = new URLSearchParams();
    qs.set('symbol', symbol);
    if (runId !== undefined && runId !== null) qs.set('run_id', String(runId));
    return fetchJson<{ deleted: number }>(`/api/v1/committee/chat/history?${qs.toString()}`, {
      method: 'DELETE',
    });
  },

  async getLatestMacroWorkbench(benchmarkSymbol: string = '^SPX'): Promise<MacroWorkbenchResponseDTO> {
    const qs = new URLSearchParams();
    qs.set('benchmark_symbol', benchmarkSymbol);
    return fetchJson<MacroWorkbenchResponseDTO>(`/api/v1/committee/macro/latest?${qs.toString()}`);
  },

  async runMacroWorkbenchAnalysis(payload: {
    benchmark_symbol: string;
    provider?: 'gemini' | 'kimi';
    model?: string;
    lookback_runs?: number;
  }): Promise<MacroWorkbenchResponseDTO> {
    return fetchJson<MacroWorkbenchResponseDTO>('/api/v1/committee/macro/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ==========================================
  // Epic 0.4: Investment Notes & 0..N Analyst Output Linking
  // ==========================================
  async getInvestmentNotes(params?: {
    symbol?: string;
    thesis_status?: string;
    search?: string;
    limit?: number;
  }): Promise<InvestmentNoteDTO[]> {
    const qs = new URLSearchParams();
    if (params?.symbol && params.symbol !== 'All') qs.set('symbol', params.symbol);
    if (params?.thesis_status && params.thesis_status !== 'All') qs.set('thesis_status', params.thesis_status);
    if (params?.search) qs.set('search', params.search);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<InvestmentNoteDTO[]>(`/api/v1/notes${query}`);
  },

  async createInvestmentNote(payload: InvestmentNoteCreatePayload): Promise<InvestmentNoteDTO> {
    return fetchJson<InvestmentNoteDTO>('/api/v1/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateInvestmentNote(noteId: number, payload: InvestmentNoteUpdatePayload): Promise<InvestmentNoteDTO> {
    return fetchJson<InvestmentNoteDTO>(`/api/v1/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteInvestmentNote(noteId: number): Promise<{ deleted: boolean }> {
    return fetchJson<{ deleted: boolean }>(`/api/v1/notes/${noteId}`, {
      method: 'DELETE',
    });
  },
};

export default apiClient;
