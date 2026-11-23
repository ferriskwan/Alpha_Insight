import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Landmark,
} from 'lucide-react';
import {
  ModelOptionItem,
  AgentAnalystOutputDTO,
  AnalystRoleType,
  CommitteeRunDetailDTO,
  CommitteeRunSummaryDTO,
  OhlcvValue,
  MacroWorkbenchResponseDTO,
  WatchlistIndexSnapshotItem,
  LiveFxRateItem,
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

export interface MacroeconomicsViewProps {
  onReferenceInNote?: (output: AgentAnalystOutputDTO) => void;
  onContextUpdate?: (ctx: DisplayedScreenContext) => void;
}

const MACRO_TABS: AnalystOutputTabItem[] = [
  {
    role: 'macro_us',
    label: 'Global & US Macro',
    subtitle: 'Fed Policy, US Treasury Yields, CPI/GDP & US Watchlist Transmission',
  },
  {
    role: 'macro_apac',
    label: 'SG & Asia-Pacific Macro',
    subtitle: 'SG (MAS/SORA), Hong Kong/China (PBoC/HKMA), Japan (BoJ/JPY) & APAC Watchlist Transmission',
  },
  {
    role: 'macro_secular',
    label: 'Secular & Geopolitics',
    subtitle: 'AI/Semiconductor CapEx, Optical Supply Chain, Export Controls & Tariffs',
  },
  {
    role: 'macro',
    label: 'Overview',
    subtitle: 'Consolidated Watchlist-Derived Macroeconomic Regime Synthesis',
  },
];

const DEFAULT_BENCHMARKS: { symbol: string; label: string }[] = [
  { symbol: '^SPX', label: '^SPX — S&P 500 Index' },
  { symbol: '^NDX', label: '^NDX — NASDAQ 100 Index' },
  { symbol: '^DJI', label: '^DJI — Dow Jones Industrial Average' },
  { symbol: '^STI', label: '^STI — Straits Times Index (SGX)' },
  { symbol: 'SOXX', label: 'SOXX — iShares Semiconductor ETF' },
  { symbol: 'IBIT', label: 'IBIT — iShares Bitcoin Trust ETF' },
];

export const MacroeconomicsView: React.FC<MacroeconomicsViewProps> = ({
  onReferenceInNote,
  onContextUpdate,
}) => {
  const [models, setModels] = useState<ModelOptionItem[]>([
    {
      id: 'gemini-4-argon',
      label: 'Gemini 4 Argon (Default Committee Model)',
      provider: 'gemini',
      is_default: true,
    },
  ]);

  const [benchmarkSymbol, setBenchmarkSymbol] = useState<string>('^SPX');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-argon');
  const [lookbackRuns, setLookbackRuns] = useState<number>(3);
  const [activeTab, setActiveTab] = useState<AnalystRoleType>('macro_us');
  const [chartMode, setChartMode] = useState<'multiday' | 'intraday'>('multiday');

  const [workbench, setWorkbench] = useState<MacroWorkbenchResponseDTO | null>(null);
  const [runs, setRuns] = useState<CommitteeRunSummaryDTO[]>([]);
  const [selectedRun, setSelectedRun] = useState<CommitteeRunDetailDTO | null>(null);
  const [chartCandles, setChartCandles] = useState<OhlcvValue[]>([]);
  const [intradayCandles, setIntradayCandles] = useState<OhlcvValue[]>([]);

  const [running, setRunning] = useState<boolean>(false);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .getCommitteeModels()
      .then((modelItems) => {
        if (!mounted) return;
        if (modelItems && modelItems.length > 0) {
          setModels(modelItems);
          const def = modelItems.find((m) => m.is_default) || modelItems[0];
          if (def) setSelectedModel(def.id);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const loadMacroWorkbench = async (benchSym: string) => {
    setLoadingInitial(true);
    setErrorMsg(null);
    try {
      const [data, runsData] = await Promise.all([
        apiClient.getLatestMacroWorkbench(benchSym),
        apiClient.getCommitteeRuns('MACRO', 30).catch(() => [] as CommitteeRunSummaryDTO[]),
      ]);
      setWorkbench(data);
      setRuns(runsData || []);
      setSelectedRun(null);
      setChartCandles(
        (data.chart_candles || []).map((c) => ({
          datetime: c.date,
          date: c.date,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }))
      );
      setIntradayCandles(
        (data.intraday_candles || []).map((c) => ({
          datetime: c.date,
          date: c.date,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }))
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load Macroeconomics workbench.');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadMacroWorkbench(benchmarkSymbol);
  }, [benchmarkSymbol]);

  const handleRunMacroAnalysis = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      const chosenModelObj = models.find((m) => m.id === selectedModel);
      const provider = chosenModelObj?.provider || 'gemini';
      const data = await apiClient.runMacroWorkbenchAnalysis({
        benchmark_symbol: benchmarkSymbol,
        provider,
        model: selectedModel,
        lookback_runs: lookbackRuns,
      });
      setWorkbench(data);
      setSelectedRun(null);
      apiClient
        .getCommitteeRuns('MACRO', 30)
        .then((runsData) => setRuns(runsData || []))
        .catch(() => {});
      if (data.chart_candles && data.chart_candles.length > 0) {
        setChartCandles(
          data.chart_candles.map((c) => ({
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
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to execute Macroeconomics analysis.');
    } finally {
      setRunning(false);
    }
  };

  const handleSelectRun = async (runId: number) => {
    setErrorMsg(null);
    try {
      const detail = await apiClient.getCommitteeRunDetail(runId);
      setSelectedRun(detail);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load selected Macroeconomics run.');
    }
  };

  const activeRun = selectedRun || workbench?.run || null;

  const outputsByRole = useMemo(() => {
    const map: Partial<Record<AnalystRoleType, AgentAnalystOutputDTO>> = {};
    const sourceOutputs = selectedRun?.outputs || workbench?.outputs || [];
    for (const out of sourceOutputs) {
      map[out.analyst_role] = out;
    }
    return map;
  }, [selectedRun, workbench]);

  useEffect(() => {
    if (!onContextUpdate) return;
    const pills: string[] = [`Active Context: MACRO (${benchmarkSymbol})`];
    if (activeRun) {
      pills.push(`Macro Run #${activeRun.id} (${activeRun.consensus_bias})`);
      pills.push(`Model: ${activeRun.model}`);
    } else {
      pills.push('Watchlist-Derived Macroeconomics');
    }
    onContextUpdate({
      symbol: 'MACRO',
      activeRoute: '/research/macro',
      routeTitle: 'Macroeconomics',
      contextPills: pills,
      data: {
        symbol: 'MACRO',
        benchmarkSymbol,
        model: selectedModel,
        activeTab,
        activeRunId: activeRun?.id || null,
        consensusBias: activeRun?.consensus_bias || null,
        watchlistExposure: workbench?.watchlist_exposure || {},
        fxRates: workbench?.fx_rates || [],
        benchmarkSnapshots: workbench?.benchmark_snapshots || [],
        analystOutputs: workbench?.outputs || [],
      },
    });
  }, [benchmarkSymbol, selectedModel, activeTab, workbench, onContextUpdate]);

  const fxRates: LiveFxRateItem[] = workbench?.fx_rates?.length
    ? workbench.fx_rates
    : [{ pair: 'USD/SGD', rate: 1.345, date: '2026-11-18' }];
  const benchmarkSnapshots: WatchlistIndexSnapshotItem[] = workbench?.benchmark_snapshots || [];
  const exposure = workbench?.watchlist_exposure || {};
  const allHistory = useMemo(() => {
    const current = workbench?.outputs || [];
    const past = workbench?.past_outputs || [];
    return [...current, ...past];
  }, [workbench]);

  return (
    <div className="space-y-4" data-testid="macroeconomics-view">
      {/* 1. Top Control Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-md space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-700" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Macroeconomics</h1>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Watchlist-derived macroeconomic analysis across Global &amp; US, Singapore &amp;
              Asia-Pacific, and Secular &amp; Geopolitics with mandatory Google Search citations.
            </p>
          </div>

          {/* Active Watchlist Exposure Summary Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700">
              Watchlist Symbols: {workbench?.watchlist_symbols?.length || 23}
            </span>
            <span className="px-2 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
              US ({exposure.us_equities_and_etfs?.length || 14}) • SGX/APAC (
              {exposure.sgx_and_apac?.length || 7}) • Secular/AI (
              {exposure.secular_and_thematic?.length || 9})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* Benchmark Index Selector */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="macro-benchmark-select"
              className="text-[11px] font-semibold text-slate-600"
            >
              Benchmark Index (Watchlist)
            </label>
            <select
              id="macro-benchmark-select"
              aria-label="Benchmark Index"
              value={benchmarkSymbol}
              onChange={(e) => setBenchmarkSymbol(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-semibold text-slate-900 cursor-pointer"
            >
              {DEFAULT_BENCHMARKS.map((b) => (
                <option key={b.symbol} value={b.symbol}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Model Selector */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="macro-model-select"
              className="text-[11px] font-semibold text-slate-600"
            >
              Agent Model
            </label>
            <select
              id="macro-model-select"
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
              htmlFor="macro-lookback-select"
              className="text-[11px] font-semibold text-slate-600"
            >
              Historical Lookback
            </label>
            <select
              id="macro-lookback-select"
              aria-label="Historical Lookback"
              value={lookbackRuns}
              onChange={(e) => setLookbackRuns(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900 cursor-pointer"
            >
              <option value={3}>Last 3 Runs</option>
              <option value={5}>Last 5 Runs</option>
              <option value={10}>Last 10 Runs</option>
              <option value={0}>No Historical Lookback</option>
            </select>
          </div>

          {/* Perform Analysis Button */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={handleRunMacroAnalysis}
              disabled={running}
              data-testid="run-macro-btn"
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

      {/* 2. Analytical Split: Left Benchmark Chart + Live DB Snapshot / Right Reusable AnalystOutputPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 cols (~58%): Benchmark Interactive Canvas Chart + Live FX & Watchlist Snapshot */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-md flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Benchmark Interactive Canvas Chart — {benchmarkSymbol}
                </h2>
                <span className="text-[11px] font-mono text-slate-500">
                  {chartMode === 'multiday'
                    ? 'Multi-day (6M Default View) • Benchmark EOD & Overlays'
                    : 'Intraday (5m Interval) • Benchmark Microstructure & Overlays'}
                </span>
              </div>

              <div
                role="group"
                aria-label="Macro Chart Horizon Toggle"
                className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200"
              >
                <button
                  type="button"
                  data-testid="macro-chart-mode-multiday"
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
                  data-testid="macro-chart-mode-intraday"
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
              trades={[]}
              showIndicators={true}
              chartMode={chartMode}
            />
          </div>

          {/* Live FX (public.exchange_rate) & Watchlist Benchmark Index Snapshot (public.eoddata) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live FX Crosses from public.exchange_rate */}
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-700" />
                  Live Exchange Rates (exchange_rate)
                </span>
                <span className="text-[10px] font-mono text-slate-500">Live DB</span>
              </div>
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-500">
                    <th className="py-1.5 px-3">Pair</th>
                    <th className="py-1.5 px-3 text-right">Spot Rate</th>
                    <th className="py-1.5 px-3 text-right">As Of</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fxRates.map((fx, i) => (
                    <tr key={`${fx.pair}-${i}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-900">{fx.pair}</td>
                      <td className="py-2 px-3 text-right font-bold text-blue-700">
                        {Number(fx.rate).toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">{fx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Watchlist Benchmark Index Snapshot from public.eoddata */}
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-blue-700" />
                  Watchlist Benchmarks (eoddata)
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {benchmarkSnapshots.length} Indices
                </span>
              </div>
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-500">
                    <th className="py-1.5 px-2.5">Symbol</th>
                    <th className="py-1.5 px-2.5 text-right">Last Close</th>
                    <th className="py-1.5 px-2.5 text-right">Day %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {benchmarkSnapshots.map((item) => {
                    const isPos = item.change_pct >= 0;
                    return (
                      <tr
                        key={item.symbol}
                        onClick={() => setBenchmarkSymbol(item.symbol)}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="py-1.5 px-2.5 font-bold text-slate-900">{item.symbol}</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-800">
                          {item.last_price.toFixed(2)}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-bold ${
                            isPos ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {item.change_pct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 5 cols (~42%): Reusable Componentized AnalystOutputPanel */}
        <div className="lg:col-span-5">
          <AnalystOutputPanel
            tabs={MACRO_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            outputsByRole={outputsByRole}
            activeRun={activeRun}
            runs={runs}
            onSelectRun={handleSelectRun}
            running={running}
            loadingInitial={loadingInitial}
            selectedModel={selectedModel}
            pastOutputsCount={workbench?.past_outputs?.length || 0}
            emptyTitle="No stored Macroeconomics analysis run yet."
            emptyDescription='Click "Perform Analysis" above to dispatch the Global & US, SG & Asia-Pacific, and Secular & Geopolitics macro agents with live Google Search citations.'
            onReferenceInNote={onReferenceInNote}
            ariaLabel="Macroeconomics Specialist Tabs"
          />
        </div>
      </div>

      {/* 3. Stored Macroeconomics Outputs Ledger */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-700" />
            <h2 className="text-xs font-bold font-mono uppercase text-slate-900">
              Stored Macroeconomics Outputs History — Trend &amp; Regime Ledger
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-600">
            {allHistory.length} Stored Records
          </span>
        </div>

        {allHistory.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No historical Macroeconomics outputs stored yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-600">
                  <th className="py-2 px-3">Output ID</th>
                  <th className="py-2 px-3">Run</th>
                  <th className="py-2 px-3">Macro Dimension</th>
                  <th className="py-2 px-3">Bias</th>
                  <th className="py-2 px-3">Trend Status</th>
                  <th className="py-2 px-3">Summary Headline</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allHistory.slice(0, 12).map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleSelectRun(item.run_id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    title={`Click to view Macro Run #${item.run_id}`}
                  >
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                      #{item.id}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-600">Run #{item.run_id}</td>
                    <td className="py-2 px-3 font-mono uppercase text-[11px] text-slate-800">
                      {item.analyst_role.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getAnalystBiasBadgeClasses(
                          item.directional_bias
                        )}`}
                      >
                        {item.directional_bias} ({item.confidence_score}%)
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getAnalystTrendBadgeClasses(
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

export default MacroeconomicsView;
