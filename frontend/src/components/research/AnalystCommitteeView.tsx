import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  WatchlistEnrichedItem,
  ModelOptionItem,
  CommitteeRunDetailDTO,
  CommitteeRunSummaryDTO,
  AgentAnalystOutputDTO,
  AnalystRoleType,
  OhlcvValue,
  TradeRecord,
} from '../../types/api';
import apiClient from '../../services/apiClient';
import InteractiveCanvasChart from '../analyst/InteractiveCanvasChart';
import {
  DisplayedScreenContext,
  AnalystOutputPanel,
  AnalystOutputTabItem,
  getAnalystBiasBadgeClasses,
  getAnalystTrendBadgeClasses,
} from '../../design-system';

export interface AnalystCommitteeViewProps {
  initialSymbol?: string;
  onReferenceInNote?: (output: AgentAnalystOutputDTO) => void;
  onContextUpdate?: (ctx: DisplayedScreenContext) => void;
}

const ANALYSIS_TABS: AnalystOutputTabItem[] = [
  {
    role: 'executive_summary',
    label: 'Exec Summary',
    subtitle: 'Consolidated synthesis of all 4 segregated analysts',
  },
  {
    role: 'technical',
    label: 'Technical',
    subtitle: '5m ATR, VWAP, Candlesticks, SMA/EMA/BB/RSI/MACD & Fib Levels',
  },
  {
    role: 'fundamental',
    label: 'Fundamental',
    subtitle: '7-Day Catalyst Scan, Valuation Multiples & Solvency',
  },
  {
    role: 'macro',
    label: 'Macro',
    subtitle: 'US Treasury Yield Curve, FX Crosses & 11 GICS Sector Rotation',
  },
  {
    role: 'risk',
    label: 'Risk Mgt',
    subtitle: 'Bidirectional Cost Basis, Margin Accrual & Stop-Loss Sizing',
  },
];

export const AnalystCommitteeView: React.FC<AnalystCommitteeViewProps> = ({
  initialSymbol = '',
  onReferenceInNote,
  onContextUpdate,
}) => {
  const [watchlist, setWatchlist] = useState<WatchlistEnrichedItem[]>([]);
  const [models, setModels] = useState<ModelOptionItem[]>([
    {
      id: 'gemini-4-argon',
      label: 'Gemini 4 Argon (Default Committee Model)',
      provider: 'gemini',
      is_default: true,
    },
  ]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol || '');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-argon');
  const [lookbackRuns, setLookbackRuns] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<AnalystRoleType>('executive_summary');
  const [chartMode, setChartMode] = useState<'multiday' | 'intraday'>('multiday');

  const [activeRun, setActiveRun] = useState<CommitteeRunDetailDTO | null>(null);
  const [runs, setRuns] = useState<CommitteeRunSummaryDTO[]>([]);
  const [pastOutputs, setPastOutputs] = useState<AgentAnalystOutputDTO[]>([]);
  const [chartCandles, setChartCandles] = useState<OhlcvValue[]>([]);
  const [intradayCandles, setIntradayCandles] = useState<OhlcvValue[]>([]);
  const [chartTrades, setChartTrades] = useState<TradeRecord[]>([]);

  const [running, setRunning] = useState<boolean>(false);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialSymbol && initialSymbol !== selectedSymbol) {
      setSelectedSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.getWatchlistItems('All').catch(() => []),
      apiClient.getCommitteeModels().catch(() => []),
    ]).then(([wlItems, modelItems]) => {
      if (!mounted) return;
      if (wlItems && wlItems.length > 0) {
        setWatchlist(wlItems);
        // Automatically default to the first real watchlist symbol if selectedSymbol is empty or not in watchlist
        const symSet = new Set(wlItems.map((w) => w.symbol));
        if (!selectedSymbol || !symSet.has(selectedSymbol)) {
          setSelectedSymbol(wlItems[0].symbol);
        }
      } else {
        setWatchlist([]);
        if (!selectedSymbol) {
          setLoadingInitial(false);
        }
      }

      if (modelItems && modelItems.length > 0) {
        setModels(modelItems);
        const def = modelItems.find((m) => m.is_default) || modelItems[0];
        if (def) setSelectedModel(def.id);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const loadSymbolDataAndLatestRun = async (sym: string) => {
    setLoadingInitial(true);
    setErrorMsg(null);
    try {
      const [runsData, storedOutputs, analystData, intradayData] = await Promise.all([
        apiClient.getCommitteeRuns(sym, 30).catch(() => []),
        apiClient.getStoredAnalystOutputs({ symbol: sym, limit: 30 }).catch(() => []),
        apiClient.getStockAnalystData(sym, { timeframe: '1D' }).catch(() => null),
        apiClient.getStockAnalystData(sym, { timeframe: '5m' }).catch(() => null),
      ]);

      setRuns(runsData || []);
      setPastOutputs(storedOutputs || []);

      if (analystData && analystData.series) {
        setChartCandles(
          analystData.series.map((s) => ({
            datetime: s.date,
            date: s.date,
            open: s.open,
            high: s.high,
            low: s.low,
            close: s.close,
            volume: s.volume,
          }))
        );
        setChartTrades(
          (analystData.trades || []).map((t) => ({
            id: t.id,
            symbol: sym,
            buysell: t.action.startsWith('B') ? 'B' : 'S',
            tradedate: t.date,
            investment: t.investment,
            price: t.price,
            quantity: t.quantity,
          }))
        );
      }

      if (intradayData && intradayData.series) {
        setIntradayCandles(
          intradayData.series.map((s) => ({
            datetime: s.date,
            date: s.date,
            open: s.open,
            high: s.high,
            low: s.low,
            close: s.close,
            volume: s.volume,
          }))
        );
      } else {
        setIntradayCandles([]);
      }

      if (runsData && runsData.length > 0) {
        const detail = await apiClient.getCommitteeRunDetail(runsData[0].id);
        setActiveRun(detail);
      } else {
        setActiveRun(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load stock analysis history.');
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSelectRun = async (runId: number) => {
    try {
      const detail = await apiClient.getCommitteeRunDetail(runId);
      if (detail) {
        setActiveRun(detail);
        if (detail.chart_candles && detail.chart_candles.length > 0) {
          setChartCandles(
            detail.chart_candles.map((c) => ({
              datetime: c.date,
              date: c.date,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            }))
          );
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to switch analysis run.');
    }
  };

  useEffect(() => {
    if (selectedSymbol) {
      loadSymbolDataAndLatestRun(selectedSymbol);
    } else {
      setChartCandles([]);
      setIntradayCandles([]);
      setChartTrades([]);
      setRuns([]);
      setPastOutputs([]);
      setActiveRun(null);
      setLoadingInitial(false);
    }
  }, [selectedSymbol]);

  const handleRunCommittee = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      const chosenModelObj = models.find((m) => m.id === selectedModel);
      const provider = chosenModelObj?.provider || 'gemini';
      const detail = await apiClient.runCommitteeAnalysis({
        symbol: selectedSymbol,
        provider,
        model: selectedModel,
        lookback_runs: lookbackRuns,
      });
      setActiveRun(detail);
      const newRunSummary: CommitteeRunSummaryDTO = {
        id: detail.id,
        user_id: detail.user_id,
        symbol: detail.symbol,
        provider: detail.provider,
        model: detail.model,
        consensus_bias: detail.consensus_bias,
        consensus_confidence: detail.consensus_confidence,
        executive_summary: detail.executive_summary,
        vote_breakdown: detail.vote_breakdown,
        created_at: detail.created_at,
      };
      setRuns((prev) => [newRunSummary, ...prev.filter((r) => r.id !== detail.id)]);

      if (detail.chart_candles && detail.chart_candles.length > 0) {
        setChartCandles(
          detail.chart_candles.map((c) => ({
            datetime: c.date,
            date: c.date,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }))
        );
      }
      const updatedOutputs = await apiClient
        .getStoredAnalystOutputs({ symbol: selectedSymbol, limit: 30 })
        .catch(() => detail.outputs || []);
      setPastOutputs(updatedOutputs);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to run 4-Analyst Committee.');
    } finally {
      setRunning(false);
    }
  };

  const outputsByRole = useMemo(() => {
    const map: Partial<Record<AnalystRoleType, AgentAnalystOutputDTO>> = {};
    if (activeRun && activeRun.outputs) {
      for (const out of activeRun.outputs) {
        map[out.analyst_role] = out;
      }
    }
    return map;
  }, [activeRun]);

  // Publish live displayed context for the Floating [Agentic Analyst] Chat Window
  useEffect(() => {
    if (!onContextUpdate) return;
    const pills: string[] = [`Active Context: ${selectedSymbol}`];
    if (activeRun) {
      pills.push(`Committee Run #${activeRun.id} (${activeRun.consensus_bias})`);
      pills.push(`Model: ${activeRun.model}`);
    } else {
      pills.push('Stock Analysis Workspace');
    }
    onContextUpdate({
      symbol: selectedSymbol,
      activeRoute: '/research/committee',
      routeTitle: 'Stock Analysis',
      contextPills: pills,
      data: {
        symbol: selectedSymbol,
        model: selectedModel,
        activeTab,
        activeRunId: activeRun?.id || null,
        consensusBias: activeRun?.consensus_bias || null,
        consensusConfidence: activeRun?.consensus_confidence || null,
        executiveSummary: activeRun?.executive_summary || null,
        voteBreakdown: activeRun?.vote_breakdown || {},
        analystOutputs: activeRun?.outputs || [],
        pastHistoricalOutputsCount: pastOutputs.length,
      },
    });
  }, [selectedSymbol, selectedModel, activeTab, activeRun, pastOutputs, onContextUpdate]);

  const getBiasBadgeClasses = getAnalystBiasBadgeClasses;
  const getTrendBadgeClasses = getAnalystTrendBadgeClasses;

  const distinctWatchlistSymbols = useMemo(() => {
    const seen = new Set<string>();
    const list: WatchlistEnrichedItem[] = [];
    for (const item of watchlist) {
      if (!seen.has(item.symbol)) {
        seen.add(item.symbol);
        list.push(item);
      }
    }
    return list;
  }, [watchlist]);

  return (
    <div className="space-y-4" data-testid="analyst-committee-view">
      {/* 1. Top Control Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Stock Analysis</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              4 segregated specialist agents (Technical, Fundamental, Macro, Risk Mgt) with
              historical output memory and consolidated Executive Summary.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* Watchlist Symbol Selector */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="committee-symbol-select"
              className="text-[11px] font-semibold text-slate-600"
            >
              Watchlist Symbol
            </label>
            <select
              id="committee-symbol-select"
              aria-label="Watchlist Symbol"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-semibold text-slate-900 cursor-pointer"
            >
              {distinctWatchlistSymbols.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} — {item.name || item.symbol}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="committee-model-select"
              className="text-[11px] font-semibold text-slate-600"
            >
              Agent Model
            </label>
            <select
              id="committee-model-select"
              aria-label="Agent Model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-semibold text-slate-900 cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.provider})
                </option>
              ))}
            </select>
          </div>

          {/* Historical Lookback Selector */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="committee-lookback-select"
              className="text-[11px] font-semibold text-slate-600"
            >
              Historical Lookback
            </label>
            <select
              id="committee-lookback-select"
              aria-label="Historical Lookback"
              value={lookbackRuns}
              onChange={(e) => setLookbackRuns(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900 cursor-pointer"
            >
              <option value={3}>Last 3 Runs (15 Outputs)</option>
              <option value={5}>Last 5 Runs (25 Outputs)</option>
              <option value={10}>Last 10 Runs (50 Outputs)</option>
              <option value={0}>No Historical Lookback</option>
            </select>
          </div>

          {/* Run Action Button */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={handleRunCommittee}
              disabled={running}
              data-testid="run-committee-btn"
              className="w-full py-2 px-3 rounded bg-blue-700 text-white font-semibold text-xs hover:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{running ? 'Performing Analysis...' : 'Perform Analysis'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Analytical Split: Left Interactive Canvas Chart / Right 5-Tabbed Analysis Display */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 cols (~58%): Interactive Canvas Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-4 rounded-md flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Interactive Canvas Chart — {selectedSymbol}
              </h2>
              <span className="text-[11px] font-mono text-slate-500">
                {chartMode === 'multiday'
                  ? 'Multi-day (6M Default View) • EOD & Technical Overlays'
                  : 'Intraday (5m Interval) • Real-Time Microstructure & Overlays'}
              </span>
            </div>

            {/* Multi-day vs Intraday Toggle */}
            <div
              role="group"
              aria-label="Chart Horizon Toggle"
              className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200"
            >
              <button
                type="button"
                data-testid="chart-mode-multiday"
                onClick={() => setChartMode('multiday')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  chartMode === 'multiday'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Multi-day
              </button>
              <button
                type="button"
                data-testid="chart-mode-intraday"
                onClick={() => setChartMode('intraday')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  chartMode === 'intraday'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Intraday
              </button>
            </div>
          </div>
          <InteractiveCanvasChart
            values={chartMode === 'intraday' ? intradayCandles : chartCandles}
            trades={chartTrades}
            showIndicators={true}
            chartMode={chartMode}
          />
        </div>

        {/* Right 5 cols (~42%): Reusable 5-Tabbed AnalystOutputPanel */}
        <div className="lg:col-span-5">
          <AnalystOutputPanel
            tabs={ANALYSIS_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            outputsByRole={outputsByRole}
            activeRun={activeRun}
            runs={runs}
            onSelectRun={handleSelectRun}
            selectedSymbol={selectedSymbol}
            running={running}
            loadingInitial={loadingInitial}
            selectedModel={selectedModel}
            pastOutputsCount={pastOutputs.length}
            emptyTitle={`No stored analysis run for ${selectedSymbol} yet.`}
            emptyDescription='Click "Perform Analysis" above to dispatch the 4 segregated analysts and generate the consolidated Executive Summary.'
            onReferenceInNote={onReferenceInNote}
            ariaLabel="Stock Analysis Specialist Tabs"
          />
        </div>
      </div>

      {/* 3. Historical Analyst Output Ledger (Spotting Trends, Reversals & Gaps) */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-700" />
            <h2 className="text-xs font-bold font-mono uppercase text-slate-900">
              Stored Analyst Outputs History ({selectedSymbol}) — Trend & Reversal Ledger
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-600">
            {pastOutputs.length} Stored Records
          </span>
        </div>

        {pastOutputs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No historical analyst outputs stored for {selectedSymbol} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-600">
                  <th className="py-2 px-3">Output ID</th>
                  <th className="py-2 px-3">Run</th>
                  <th className="py-2 px-3">Analyst Role</th>
                  <th className="py-2 px-3">Bias</th>
                  <th className="py-2 px-3">Trend Status</th>
                  <th className="py-2 px-3">Summary Headline</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastOutputs.slice(0, 15).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                      #{item.id}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">Run #{item.run_id}</td>
                    <td className="py-2 px-3 font-mono uppercase text-[11px] text-slate-800">
                      {item.analyst_role.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getBiasBadgeClasses(
                          item.directional_bias
                        )}`}
                      >
                        {item.directional_bias} ({item.confidence_score}%)
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getTrendBadgeClasses(
                          item.trend_status
                        )}`}
                      >
                        {item.trend_status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700 max-w-md truncate">
                      {item.summary_headline}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {onReferenceInNote && (
                        <button
                          type="button"
                          onClick={() => onReferenceInNote(item)}
                          className="px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Link to Note</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalystCommitteeView;
