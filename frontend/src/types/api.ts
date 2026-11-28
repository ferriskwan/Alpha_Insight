/**
 * Shared TypeScript API Contracts for Alpha_Insight (Frozen Phase 1 Contract).
 * Mirrors backend/schemas/*.py.
 */

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  picture?: string | null;
  status: string;
  roles: string[];
}

export interface AuthEnvConfig {
  env: string;
  googleClientId: string;
  dbName?: string;
}

export interface WatchlistSymbolItem {
  user_id?: number;
  watchlistname: string;
  symbol: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface OhlcvValue {
  datetime: string;
  date?: string;
  timestamp?: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
}

export interface MarketDataset {
  meta: {
    symbol: string;
    interval: string;
    timezone?: string;
    currency?: string;
    start_date?: string;
    end_date?: string;
  };
  values: OhlcvValue[];
}

export interface TradeRecord {
  id?: number;
  user_id?: number;
  symbol: string;
  buysell: 'B' | 'S' | string;
  tradedate: string;
  investment: boolean;
  price: number;
  quantity: number;
  remarks?: string;
  currency?: string;
  fx_rate?: number;
}

export interface CapitalRecord {
  id?: number;
  user_id?: number;
  broker: string;
  transtype: 'D' | 'W' | 'I' | 'F' | string;
  accounttype: 'Cash' | 'Margin' | 'C' | 'M' | string;
  amount: number;
  date: string;
  currency: string;
  remarks?: string;
}

export interface SysValueRecord {
  name: string;
  type: 'STR' | 'NUM' | 'DATE' | string;
  strvalue?: string | null;
  numvalue?: number | null;
  datevalue?: string | null;
  description?: string | null;
}

export interface WatchlistDataResponse {
  symbol: string;
  eodData: MarketDataset | null;
  tickData: MarketDataset | null;
  trades: TradeRecord[];
  sysDates: {
    global_startdate?: string | null;
    global_today?: string | null;
  };
  chartScreenshot?: string | null;
}

export interface AnalysisModulesConfig {
  chartPatternRecognition: boolean;
  shortTermTechnical: boolean;
  longTermTechnical: boolean;
  fundamental: boolean;
  valuation: boolean;
}

export interface AnalyzeRequestPayload {
  symbol: string;
  provider: 'gemini' | 'kimi';
  model?: string;
  prompt?: string;
  modules?: AnalysisModulesConfig;
  chartScreenshot?: string | null;
}

export interface GroundingChunk {
  title: string;
  uri: string;
}

export interface AnalyzeResponsePayload {
  symbol: string;
  provider: string;
  model: string;
  markdown: string;
  groundingLinks: GroundingChunk[];
}

export interface PortfolioSummaryKpis {
  totalEquity: number;
  cashBalance: number;
  realizedPnL: number;
  unrealizedPnL: number;
  marginLoan: number;
  marginInterest: number;
  dailyInterest: number;
  totalPnL: number;
  pctReturn: number;
}

export interface BalanceMatrixRow {
  currency: string;
  accountType: 'Investment' | 'Leverage' | string;
  capitalInjected: number;
  marketValue: number;
  cashAvailable: number;
  marginLoan: number;
  realizedPnL: number;
  unrealizedPnL: number;
  interestAccrued: number;
  netEquity: number;
  pctReturn: number;
}

export interface PerformancePoint {
  date: string;
  totalEquity: number;
  totalCapital: number;
  totalPnL: number;
  pctPnL: number;
  currency: string;
  investment: boolean;
}

export interface PositionRecord {
  user_id?: number;
  tradedate: string;
  symbol: string;
  investment: boolean;
  avgprice: number;
  quantity: number;
  eodprice: number;
  currency?: string;
  marketValue?: number;
  unrealizedPnL?: number;
  pctPnL?: number;
}

export interface PortfolioDashboardResponse {
  summary: PortfolioSummaryKpis;
  balanceMatrix: BalanceMatrixRow[];
  performanceSeries: PerformancePoint[];
  dailySummaries: Record<string, unknown>[];
  positions: PositionRecord[];
  fxRates: Record<string, number>;
}

export interface JobExecutionLogItem {
  id: number;
  job_name: string;
  trigger_source: string;
  started_at: string;
  completed_at?: string | null;
  status: string;
  global_today?: string | null;
  details?: Record<string, unknown> | null;
  error_message?: string | null;
}

export type ChartRenderMode = 'matplotlib' | 'canvas' | 'split';

// ==========================================
// Epic 0.2: Foundational Contracts & DTOs
// ==========================================

export type UserRoleType = 'admin' | 'analyst' | 'user';

export interface UserSummary {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  roles: UserRoleType[];
  status: 'active' | 'suspended';
  created_at: string;
}

export interface SiteMapNode {
  id: number;
  parent_id: number | null;
  menu_code: string;
  label: string;
  route: string;
  icon: string | null;
  role_required: UserRoleType;
  order_index: number;
  is_active: boolean;
  children?: SiteMapNode[];
}

export interface SiteMapCreateRequest {
  parent_id?: number | null;
  menu_code: string;
  label: string;
  route: string;
  icon?: string | null;
  role_required?: UserRoleType;
  order_index?: number;
  is_active?: boolean;
}

export interface SiteMapUpdateRequest {
  parent_id?: number | null;
  label?: string;
  route?: string;
  icon?: string | null;
  role_required?: UserRoleType;
  order_index?: number;
  is_active?: boolean;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_email?: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface TransCostItem {
  id: number;
  user_id: number;
  trade_id: number | null;
  cost_type: 'commission' | 'sec_fee' | 'finra_taf' | 'platform_fee' | 'borrow_fee' | 'other';
  amount: number;
  currency: string;
  date: string;
  remarks: string | null;
  created_at: string;
}

export interface TransCostCreateRequest {
  trade_id?: number | null;
  cost_type: string;
  amount: number;
  currency?: string;
  date: string;
  remarks?: string | null;
}

export interface RefChartSettingsDTO {
  id: number;
  user_id: number | null;
  symbol: string | null;
  sma_period: number;
  ema_period: number;
  bb_period: number;
  bb_std: number;
  rsi_period: number;
  rsi_ob: number;
  rsi_os: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  fib_lookback_bars: number;
  fib_intraday_bars: number;
}

export interface RefDataSysValue {
  name: string;
  type: string;
  strvalue: string | null;
  numvalue: number | null;
  datevalue: string | null;
  description: string | null;
  updatetimestamp?: string | null;
}

export interface RefDataSysValueUpdate {
  strvalue?: string | null;
  numvalue?: number | null;
  datevalue?: string | null;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Epic 0.3 Types: Portfolio Overview, Research, and Watchlist
// ---------------------------------------------------------------------------

export interface PortfolioOverviewKPIs {
  netAssetValue: number;
  cashBalance: number;
  marginLoan: number;
  dayPnL: number;
  realizedPnL: number;
  realizedPnLPct?: number;
  unrealizedPnL: number;
  unrealizedPnLPct?: number;
  totalPnL?: number;
  totalPnLPct?: number;
  capital?: number;
  capitalPct?: number;
  margin?: number;
  marginPct?: number;
  totalPortfolio?: number;
  totalPortfolioPct?: number;
  pctReturn: number;
  currency: string;
}

export interface PortfolioCapitalMarginPoint {
  date: string;
  portfolioSize: number;
  portfolioSizePct: number;
  capital: number;
  capitalPct: number;
  margin: number;
  marginPct: number;
}

export interface PortfolioStockPnLPoint {
  date: string;
  pnl: number;
  pnlPct: number;
}

export interface PortfolioChart2Data {
  portfolio: PortfolioStockPnLPoint[];
  stocks: Record<string, PortfolioStockPnLPoint[]>;
}

export interface PortfolioOverviewParameters {
  currency: string;
  selectedDate: string;
  timeframe: string;
}

export interface PortfolioCommentaryItem {
  title: string;
  status: string;
  content: string;
}

export interface PortfolioCommentaryResponse {
  cached: boolean;
  lastUpdated: string;
  commentaries: Record<string, PortfolioCommentaryItem>;
  fallback_warning?: string | null;
}

export interface Chart1EquityVsBenchmark {
  date: string;
  equity: number;
  benchmark: number;
  totalCapital: number;
}

export interface Chart2CumulativePnL {
  date: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
}

export interface Chart3AssetAllocation {
  category: string;
  name: string;
  value: number;
  percentage: number;
  currency: string;
  symbol?: string;
  quantity?: number;
  price?: number;
}

export interface Chart4DailyPnLDrawdown {
  date: string;
  dailyPnL: number;
  drawdownPct: number;
  highWaterMark: number;
}

export interface PortfolioTradeAnnotation {
  date: string;
  symbol: string;
  buysell: string;
  quantity: number;
  price: number;
  currency: string;
  remarks: string;
}

export interface PortfolioCapitalAnnotation {
  date: string;
  transtype: string;
  amount: number;
  currency: string;
  broker: string;
  remarks: string;
}

export interface PortfolioOverviewResponse {
  parameters?: PortfolioOverviewParameters;
  kpis: PortfolioOverviewKPIs;
  chart1_portfolio_capital_margin?: PortfolioCapitalMarginPoint[];
  chart2_pnl_breakdown?: PortfolioChart2Data;
  chart1_equity_vs_benchmark?: Chart1EquityVsBenchmark[];
  chart2_cumulative_pnl?: Chart2CumulativePnL[];
  chart3_asset_allocation: Chart3AssetAllocation[];
  chart3_holdings_pie?: Chart3AssetAllocation[];
  chart4_daily_pnl_drawdown: Chart4DailyPnLDrawdown[];
  trade_annotations?: PortfolioTradeAnnotation[];
  capital_annotations?: PortfolioCapitalAnnotation[];
  fallback_warning?: string | null;
}

export interface WatchlistEnrichedItem {
  user_id: number;
  watchlistname: string;
  symbol: string;
  name: string;
  lastPrice: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  high52: number;
  low52: number;
  currency: string;
}

export interface StockAnalystSeriesPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma?: number | null;
  ema?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
}

export interface StockAnalystTradeMarker {
  id?: number;
  date: string;
  action: string;
  price: number;
  quantity: number;
  investment: boolean;
}

export interface StockAnalystResponse {
  symbol: string;
  latestPrice: number;
  dayChange: number;
  dayChangePct: number;
  timeframe: string;
  indicators: {
    smaPeriod: number;
    emaPeriod: number;
    bbPeriod: number;
    rsiPeriod: number;
  };
  series: StockAnalystSeriesPoint[];
  intradaySeries?: StockAnalystSeriesPoint[];
  trades: StockAnalystTradeMarker[];
}

export interface YieldCurvePoint {
  maturity: string;
  yield: number;
  category: string;
}

export interface MacroIndicator {
  name: string;
  value: string;
  period: string;
  status: string;
}

export interface FxCross {
  pair: string;
  rate: number;
  change: number;
  changePct: number;
}

export interface MacroeconomicsResponse {
  asOfDate: string;
  yieldCurve: YieldCurvePoint[];
  macroIndicators: MacroIndicator[];
  fxCrosses: FxCross[];
}

export interface SectorItem {
  id: string;
  label: string;
  ticker: string;
  value: number;
  weight: number;
  subtext: string;
  relativeRotation: string;
  rsScore?: number;
  rsMomentum?: number;
}

export interface SectorPerformanceResponse {
  horizon: string;
  asOfDate: string;
  benchmark: string;
  benchmarkReturn: number;
  sectors: SectorItem[];
  quadrantDefinitions?: Record<string, string>;
}

export interface SectorNewsItem {
  title: string;
  url: string;
  publisher: string;
  published_at: string;
}

export interface SectorCommitteeOutputItem {
  role: string;
  directional_bias: string;
  confidence_score: number;
  key_metrics: Record<string, any>;
  report_content: string;
  citations?: Array<{ title: string; url: string }>;
}

export interface SectorCommitteeResponse {
  run_id: number;
  symbol: string;
  sector_name: string;
  provider: string;
  model: string;
  consensus_bias: string;
  consensus_confidence: number;
  executive_summary: string;
  vote_breakdown: Record<string, any>;
  outputs: SectorCommitteeOutputItem[];
  news_sources: SectorNewsItem[];
  fallback_warning?: string | null;
  daily_quota_reached?: boolean;
  daily_quota_message?: string;
  history?: Array<{ run_id: number; created_at: string; consensus_bias: string; model: string }>;
  created_at: string;
}

// ==========================================
// Epic 0.4: 4-Analyst Committee & Investment Notes Contracts
// ==========================================

export type AnalystRoleType =
  | 'technical'
  | 'fundamental'
  | 'macro'
  | 'risk'
  | 'executive_summary'
  | 'macro_us'
  | 'macro_apac'
  | 'macro_secular';

export type DirectionalBiasType = 'Bullish' | 'Bearish' | 'Neutral';
export type TrendStatusType = 'Continuation' | 'Reversal' | 'Initiation' | 'Gap';
export type ThesisStatusType = 'In-Progress' | 'Validated' | 'Invalidated';

export interface ModelOptionItem {
  id: string;
  label: string;
  provider: 'gemini' | 'kimi';
  is_default: boolean;
}

export interface CommitteeRunRequestPayload {
  symbol: string;
  provider?: 'gemini' | 'kimi';
  model?: string;
  lookback_runs?: number;
}

export interface AgentAnalystOutputDTO {
  id: number;
  run_id: number;
  user_id: number;
  symbol: string;
  analyst_role: AnalystRoleType;
  directional_bias: DirectionalBiasType;
  confidence_score: number;
  trend_status: TrendStatusType;
  summary_headline: string;
  markdown_output: string;
  structured_metrics: Record<string, any>;
  referenced_output_ids: number[];
  created_at: string;
}

export interface CommitteeRunSummaryDTO {
  id: number;
  user_id: number;
  symbol: string;
  provider: string;
  model: string;
  consensus_bias: DirectionalBiasType;
  consensus_confidence: number;
  executive_summary: string;
  vote_breakdown: Record<string, string>;
  created_at: string;
  fallback_warning?: string | null;
}

export interface CommitteeRunDetailDTO extends CommitteeRunSummaryDTO {
  outputs: AgentAnalystOutputDTO[];
  chart_candles: StockAnalystSeriesPoint[];
  chart_trades: StockAnalystTradeMarker[];
  past_outputs: AgentAnalystOutputDTO[];
}

export interface AgentContextualChatRequestPayload {
  messages: { role: 'user' | 'assistant'; content: string }[];
  symbol?: string;
  run_id?: number | null;
  active_route?: string;
  displayed_context: Record<string, any>;
  provider?: 'gemini' | 'kimi';
  model?: string;
}

export interface AgentContextualChatResponsePayload {
  reply: string;
  provider: string;
  model: string;
  symbol?: string | null;
  run_id?: number | null;
  active_route?: string | null;
}

export interface StoredChatMessageDTO {
  id: number;
  run_id?: number | null;
  user_id: number;
  symbol: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
  created_at: string;
}

export interface InvestmentNoteCreatePayload {
  symbol: string;
  trade_id?: number | null;
  title: string;
  content_markdown: string;
  thesis_status?: ThesisStatusType;
  tags?: string[];
  analyst_output_ids?: number[];
}

export interface InvestmentNoteUpdatePayload {
  symbol?: string;
  trade_id?: number | null;
  title?: string;
  content_markdown?: string;
  thesis_status?: ThesisStatusType;
  tags?: string[];
  analyst_output_ids?: number[];
}

export interface InvestmentNoteDTO {
  id: number;
  user_id: number;
  symbol: string;
  trade_id?: number | null;
  trade_summary?: {
    id: number;
    symbol: string;
    buysell: string;
    price: number;
    quantity: number;
    tradedate: string;
  } | null;
  title: string;
  content_markdown: string;
  thesis_status: ThesisStatusType;
  tags: string[];
  analyst_output_ids: number[];
  linked_analyst_outputs: AgentAnalystOutputDTO[];
  created_at: string;
  updated_at: string;
}

export interface WatchlistIndexSnapshotItem {
  symbol: string;
  name: string;
  last_price: number;
  change: number;
  change_pct: number;
  currency: string;
}

export interface LiveFxRateItem {
  pair: string;
  rate: number;
  date: string;
}

export interface MacroWorkbenchResponseDTO {
  run: CommitteeRunSummaryDTO | null;
  fallback_warning?: string | null;
  outputs: AgentAnalystOutputDTO[];
  past_outputs: AgentAnalystOutputDTO[];
  benchmark_symbol: string;
  watchlist_symbols: string[];
  watchlist_exposure: Record<string, string[]>;
  benchmark_snapshots: WatchlistIndexSnapshotItem[];
  fx_rates: LiveFxRateItem[];
  chart_candles: StockAnalystSeriesPoint[];
  intraday_candles: StockAnalystSeriesPoint[];
}




