import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  RefreshCw,
  TrendingUp,
  Compass,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import {
  SectorPerformanceResponse,
  SectorItem,
  SectorCommitteeResponse,
  SectorNewsItem,
  AgentAnalystOutputDTO,
} from '../../types/api';
import { DisplayedScreenContext } from '../../design-system';

interface IndustrySectorViewProps {
  onReferenceInNote?: (output: AgentAnalystOutputDTO) => void;
  onContextUpdate?: (ctx: DisplayedScreenContext) => void;
}

const GICS_SECTORS = [
  { ticker: 'XLK', name: 'Technology' },
  { ticker: 'XLF', name: 'Financials' },
  { ticker: 'XLV', name: 'Health Care' },
  { ticker: 'XLE', name: 'Energy' },
  { ticker: 'XLI', name: 'Industrials' },
  { ticker: 'XLC', name: 'Communication Services' },
  { ticker: 'XLY', name: 'Consumer Discretionary' },
  { ticker: 'XLP', name: 'Consumer Staples' },
  { ticker: 'XLB', name: 'Materials' },
  { ticker: 'XLU', name: 'Utilities' },
  { ticker: 'XLRE', name: 'Real Estate' },
];

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (gemini)', provider: 'gemini' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (gemini)', provider: 'gemini' },
];

export const IndustrySectorView: React.FC<IndustrySectorViewProps> = ({
  onReferenceInNote,
  onContextUpdate,
}) => {
  const [perfData, setPerfData] = useState<SectorPerformanceResponse | null>(null);
  const [horizon, setHorizon] = useState<string>('1D');
  const [loadingPerf, setLoadingPerf] = useState<boolean>(true);
  const [selectedTicker, setSelectedTicker] = useState<string>('XLK');

  const [committeeData, setCommitteeData] = useState<SectorCommitteeResponse | null>(null);
  const [loadingCommittee, setLoadingCommittee] = useState<boolean>(false);
  const [refreshingCommittee, setRefreshingCommittee] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [activeRoleTab, setActiveRoleTab] = useState<string>('executive_summary');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Load Sector Performance Heatmap
  const loadPerformance = useCallback(async () => {
    setLoadingPerf(true);
    try {
      const res = await apiClient.getSectorPerformance(horizon);
      setPerfData(res);
    } catch (err) {
      console.error('Failed to load sector performance:', err);
    } finally {
      setLoadingPerf(false);
    }
  }, [horizon]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  // Load Sector Committee AI outputs
  const loadCommittee = useCallback(async (ticker: string) => {
    setLoadingCommittee(true);
    try {
      const res = await apiClient.getSectorCommittee(ticker);
      setCommitteeData(res);
      if (onContextUpdate) {
        onContextUpdate({
          symbol: ticker,
          activeRoute: '/research/sectors',
          routeTitle: `Sector Research — ${ticker}`,
          contextPills: ['Sector Research', ticker, res.consensus_bias || 'Neutral'],
          data: res as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      console.error('Failed to load sector committee:', err);
    } finally {
      setLoadingCommittee(false);
    }
  }, [onContextUpdate]);

  useEffect(() => {
    loadCommittee(selectedTicker);
  }, [selectedTicker, loadCommittee]);

  const handleRefreshCommittee = async () => {
    setRefreshingCommittee(true);
    try {
      const res = await apiClient.refreshSectorCommittee(selectedTicker, 'gemini', selectedModel);
      setCommitteeData(res);
    } catch (err) {
      console.error('Failed to execute sector committee:', err);
    } finally {
      setRefreshingCommittee(false);
    }
  };

  const handleReferenceNoteClick = () => {
    if (!onReferenceInNote || !committeeData) return;

    if (activeRoleTab === 'executive_summary') {
      const dto: AgentAnalystOutputDTO = {
        id: committeeData.run_id * 100,
        run_id: committeeData.run_id,
        user_id: 1,
        symbol: committeeData.symbol,
        analyst_role: 'executive_summary' as any,
        directional_bias: (committeeData.consensus_bias || 'Neutral') as any,
        confidence_score: committeeData.consensus_confidence,
        trend_status: 'Continuation',
        summary_headline: `${committeeData.symbol} Sector Committee Executive Summary`,
        markdown_output: committeeData.executive_summary,
        structured_metrics: committeeData.vote_breakdown,
        referenced_output_ids: [],
        created_at: committeeData.created_at || new Date().toISOString(),
      };
      onReferenceInNote(dto);
      return;
    }

    const currentOutput = committeeData.outputs.find((o) => o.role === activeRoleTab);
    if (currentOutput) {
      const dto: AgentAnalystOutputDTO = {
        id: committeeData.run_id * 100 + 1,
        run_id: committeeData.run_id,
        user_id: 1,
        symbol: committeeData.symbol,
        analyst_role: currentOutput.role as any,
        directional_bias: (currentOutput.directional_bias || 'Neutral') as any,
        confidence_score: currentOutput.confidence_score,
        trend_status: 'Continuation',
        summary_headline: `${committeeData.symbol} ${currentOutput.role.toUpperCase()} Deliberation`,
        markdown_output: currentOutput.report_content,
        structured_metrics: currentOutput.key_metrics,
        referenced_output_ids: [],
        created_at: committeeData.created_at || new Date().toISOString(),
      };
      onReferenceInNote(dto);
    }
  };

  const currentSectorItem = perfData?.sectors.find((s) => s.ticker === selectedTicker) || {
    id: selectedTicker,
    label: GICS_SECTORS.find((g) => g.ticker === selectedTicker)?.name || selectedTicker,
    ticker: selectedTicker,
    value: 0.0,
    weight: 0.0,
    subtext: '',
    relativeRotation: 'Leading',
    rsScore: 1.0,
    rsMomentum: 0.0,
  };

  const benchmarkReturn = perfData?.benchmarkReturn ?? 0.0;

  // Active role output
  const activeOutput = committeeData?.outputs.find((o) => o.role === activeRoleTab);

  return (
    <div className="space-y-5">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-700" />
            By Industry / Sector Research
            <span className="sr-only">GICS Industry & Sector Heatmap</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            GICS Sector Relative Rotation, Multi-Horizon Returns, RSS Intelligence & 4-Analyst Consensus
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sector Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-semibold text-slate-500">Sector:</span>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {GICS_SECTORS.map((s) => (
                <option key={s.ticker} value={s.ticker}>
                  {s.ticker} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-semibold text-slate-500">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Execute Committee Run */}
          <button
            type="button"
            onClick={handleRefreshCommittee}
            disabled={refreshingCommittee}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingCommittee ? 'animate-spin' : ''}`} />
            {refreshingCommittee ? 'Running AI Analysis...' : 'AI Analysis'}
          </button>
        </div>
      </div>

      {/* Fallback Warning Banner if credits depleted or fallback triggered */}
      {committeeData?.fallback_warning && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">AI Provider Service Notice: </span>
            {committeeData.fallback_warning}{' '}
            <a
              href="https://ai.studio/projects"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-bold text-amber-950 underline hover:text-amber-800 ml-1"
            >
              Manage Billing & Credits <ExternalLink className="w-3 h-3" />
            </a>
            <div className="text-[11px] text-amber-800 mt-1">
              Deterministic fallback analytics applied with standard quantitative technical rules.
            </div>
          </div>
        </div>
      )}

      {/* Grid: Left Column (Rotation & Heatmap) vs Right Column (AI Committee) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 Cols): Relative Rotation & News */}
        <div className="lg:col-span-5 space-y-5">
          {/* Relative Rotation Quadrant Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">Relative Rotation Quadrant</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaModal(!showFormulaModal)}
                className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Formula
              </button>
            </div>

            {/* Quadrant Badge & Sector Title */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <div className="text-base font-bold text-slate-900">
                  {currentSectorItem.ticker} — {currentSectorItem.label}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Weight: {currentSectorItem.weight.toFixed(1)}% | Return ({horizon}):{' '}
                  <span className={currentSectorItem.value >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                    {currentSectorItem.value >= 0 ? '+' : ''}{currentSectorItem.value.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                  currentSectorItem.relativeRotation === 'Leading'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : currentSectorItem.relativeRotation === 'Improving'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : currentSectorItem.relativeRotation === 'Weakening'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {currentSectorItem.relativeRotation}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-500 font-medium">Relative Strength (RS)</div>
                <div className="text-base font-bold font-mono text-slate-900 mt-1">
                  {(currentSectorItem.rsScore ?? 1.0).toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Ratio vs SPY 1M return</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-500 font-medium">RS Momentum (5D Δ)</div>
                <div
                  className={`text-base font-bold font-mono mt-1 ${
                    (currentSectorItem.rsMomentum ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {(currentSectorItem.rsMomentum ?? 0) >= 0 ? '+' : ''}
                  {(currentSectorItem.rsMomentum ?? 0.0).toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">5-day velocity delta</div>
              </div>
            </div>

            {/* Formula Explanation Accordion / Box */}
            {showFormulaModal && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-700" />
                  Relative Rotation Graph (RRG) Methodology
                </div>
                <p className="text-[11px] leading-relaxed text-blue-900">
                  Relative Strength ($RS$) measures a sector ETF&apos;s 1-month return normalized against S&P 500 ($SPY$).
                  RS Momentum ($RS\_Mom$) calculates the 5-day delta of that ratio.
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                  <div className="p-1.5 bg-white rounded border border-blue-100">
                    <span className="font-bold text-emerald-800">Leading:</span> RS ≥ 1.0, Mom ≥ 0 (Outperforming & accelerating)
                  </div>
                  <div className="p-1.5 bg-white rounded border border-blue-100">
                    <span className="font-bold text-amber-800">Weakening:</span> RS ≥ 1.0, Mom &lt; 0 (Outperforming but slowing)
                  </div>
                  <div className="p-1.5 bg-white rounded border border-blue-100">
                    <span className="font-bold text-blue-800">Improving:</span> RS &lt; 1.0, Mom ≥ 0 (Underperforming but gaining)
                  </div>
                  <div className="p-1.5 bg-white rounded border border-blue-100">
                    <span className="font-bold text-rose-800">Lagging:</span> RS &lt; 1.0, Mom &lt; 0 (Underperforming & decelerating)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Yahoo Finance Cited RSS News Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">Cited Sector News & Feed</h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Yahoo Finance RSS</span>
            </div>

            {loadingCommittee ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading sector intelligence...</div>
            ) : committeeData?.news_sources && committeeData.news_sources.length > 0 ? (
              <div className="space-y-2.5">
                {committeeData.news_sources.map((news, idx) => (
                  <a
                    key={idx}
                    href={news.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block p-2.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors group"
                  >
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 line-clamp-2 leading-snug">
                      {news.title}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                      <span>{news.publisher}</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {news.published_at ? news.published_at.slice(0, 16) : 'Recent'}
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 italic">
                No recent RSS news retrieved for {selectedTicker}.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): 4-Analyst Sector Committee & Heatmap */}
        <div className="lg:col-span-7 space-y-5">
          {/* 4-Analyst Sector Committee Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Committee Consensus Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    Sector Committee Synthesis — {selectedTicker}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                      committeeData?.consensus_bias === 'Bullish'
                        ? 'bg-emerald-100 text-emerald-800'
                        : committeeData?.consensus_bias === 'Bearish'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {committeeData?.consensus_bias || 'Neutral'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Confidence: <span className="font-mono font-bold text-slate-700">{committeeData?.consensus_confidence ?? 50}%</span> |{' '}
                  Run #{committeeData?.run_id ?? 1}
                </div>
              </div>

              {/* Vote Breakdown Pill */}
              {committeeData?.vote_breakdown && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-700 font-bold">
                    Bullish: {committeeData.vote_breakdown.bullish ?? 0}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-600 font-bold">
                    Neutral: {committeeData.vote_breakdown.neutral ?? 0}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-rose-700 font-bold">
                    Bearish: {committeeData.vote_breakdown.bearish ?? 0}
                  </span>
                </div>
              )}
            </div>

            {/* Specialist Role Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-white px-4 pt-2 gap-2 overflow-x-auto text-xs font-semibold">
              {[
                { id: 'executive_summary', label: 'Executive Summary' },
                { id: 'technical', label: 'Technical' },
                { id: 'fundamental', label: 'Fundamental' },
                { id: 'macro', label: 'Macro' },
                { id: 'risk', label: 'Risk Mgt' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveRoleTab(tab.id)}
                  className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeRoleTab === tab.id
                      ? 'border-blue-700 text-blue-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Body Content */}
            <div className="p-5 text-xs leading-relaxed text-slate-700 min-h-[220px]">
              {loadingCommittee ? (
                <div className="py-12 text-center text-slate-400">Loading specialist deliberations...</div>
              ) : activeRoleTab === 'executive_summary' ? (
                <div className="space-y-4">
                  <div className="prose prose-xs max-w-none text-slate-800 whitespace-pre-line font-sans">
                    {committeeData?.executive_summary || 'No executive summary available for this sector run.'}
                  </div>
                </div>
              ) : activeOutput ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                      {activeOutput.role} Deliberation
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        activeOutput.directional_bias === 'Bullish'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeOutput.directional_bias === 'Bearish'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {activeOutput.directional_bias} ({activeOutput.confidence_score}%)
                    </span>
                  </div>
                  <div className="prose prose-xs max-w-none text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                    {activeOutput.report_content}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 italic">
                  No output available for {activeRoleTab}.
                </div>
              )}
            </div>

            {/* Action Toolbar */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Created: {committeeData?.created_at ? committeeData.created_at.slice(0, 16) : 'Today'}
              </span>

              {onReferenceInNote && (
                <button
                  type="button"
                  onClick={handleReferenceNoteClick}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-700" />
                  Reference in Note
                </button>
              )}
            </div>
          </div>

          {/* GICS Sector Heatmap & Multi-Horizon Returns */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  11 GICS Sectors Performance Heatmap
                  <span className="sr-only">11 GICS Sectors Relative Performance</span>
                </h2>
                <span className="text-xs font-mono text-slate-500">SPY: {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%</span>
              </div>

              {/* Horizon Selector */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                {['1D', '1W', '1M', '3M', '6M', '1Y'].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHorizon(h)}
                    className={`px-2.5 py-1 rounded-md font-mono font-semibold transition-colors cursor-pointer ${
                      horizon === h ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Heatmap Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {(perfData?.sectors || []).map((sec) => {
                const isSelected = sec.ticker === selectedTicker;
                const isPos = sec.value >= 0;
                return (
                  <div
                    key={sec.id}
                    onClick={() => setSelectedTicker(sec.ticker)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-700 ring-2 ring-blue-100 bg-blue-50/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sec.ticker}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          sec.relativeRotation === 'Leading'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sec.relativeRotation === 'Improving'
                            ? 'bg-blue-100 text-blue-800'
                            : sec.relativeRotation === 'Weakening'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sec.relativeRotation}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{sec.label}</div>
                    <div className="flex items-baseline justify-between mt-2 font-mono">
                      <span className={`text-sm font-bold ${isPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isPos ? '+' : ''}{sec.value.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-slate-400">{sec.weight.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustrySectorView;
