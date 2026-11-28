import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Layers,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Clock,
  HelpCircle,
  BarChart2,
  Calendar,
  Grid,
  Table as TableIcon,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import {
  SectorPerformanceResponse,
  SectorCommitteeResponse,
  AgentAnalystOutputDTO,
  WatchlistDataResponse,
} from '../../types/api';
import { DisplayedScreenContext } from '../../design-system';
import SectorComparisonChart from './SectorComparisonChart';
import ChartComparisonView from '../analyst/ChartComparisonView';

export interface IndustrySectorViewProps {
  onReferenceInNote?: (output: AgentAnalystOutputDTO) => void;
  onContextUpdate?: (ctx: DisplayedScreenContext) => void;
  isSplitView?: boolean;
}

const GICS_SECTORS = [
  { ticker: 'XLK', name: 'Technology', defaultWeight: 29.5 },
  { ticker: 'XLF', name: 'Financials', defaultWeight: 13.2 },
  { ticker: 'XLV', name: 'Health Care', defaultWeight: 12.4 },
  { ticker: 'XLY', name: 'Consumer Discretionary', defaultWeight: 10.3 },
  { ticker: 'XLC', name: 'Communication Services', defaultWeight: 9.1 },
  { ticker: 'XLI', name: 'Industrials', defaultWeight: 8.7 },
  { ticker: 'XLP', name: 'Consumer Staples', defaultWeight: 5.9 },
  { ticker: 'XLE', name: 'Energy', defaultWeight: 3.8 },
  { ticker: 'XLB', name: 'Materials', defaultWeight: 2.4 },
  { ticker: 'XLU', name: 'Utilities', defaultWeight: 2.3 },
  { ticker: 'XLRE', name: 'Real Estate', defaultWeight: 2.2 },
];

/**
 * Maps performance percentage to an institutional heatmap color class.
 */
function getHeatColorClass(val: number): { bg: string; text: string; border: string } {
  if (val >= 2.0) {
    return { bg: 'bg-emerald-700', text: 'text-white', border: 'border-emerald-800' };
  }
  if (val >= 1.0) {
    return { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-700' };
  }
  if (val >= 0.2) {
    return { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' };
  }
  if (val >= -0.2) {
    return { bg: 'bg-slate-600', text: 'text-white', border: 'border-slate-700' };
  }
  if (val > -1.0) {
    return { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' };
  }
  if (val > -2.0) {
    return { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-700' };
  }
  return { bg: 'bg-rose-700', text: 'text-white', border: 'border-rose-800' };
}

export const IndustrySectorView: React.FC<IndustrySectorViewProps> = ({
  onReferenceInNote,
  onContextUpdate,
  isSplitView = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1400);
  const [layoutMode, setLayoutMode] = useState<'auto' | '1-col' | '2-col'>('auto');

  const [perfData, setPerfData] = useState<SectorPerformanceResponse | null>(null);
  const [horizon, setHorizon] = useState<string>('1D');
  const [loadingPerf, setLoadingPerf] = useState<boolean>(true);
  const [selectedTicker, setSelectedTicker] = useState<string>('XLK');

  const [heatmapViewType, setHeatmapViewType] = useState<'treemap' | 'matrix'>('treemap');
  const [treemapSortBy, setTreemapSortBy] = useState<'quadrant' | 'weight' | 'return'>('quadrant');
  const [matrixReturns, setMatrixReturns] = useState<Record<string, Record<string, number>>>({});
  const [loadingMatrix, setLoadingMatrix] = useState<boolean>(false);

  const [committeeData, setCommitteeData] = useState<SectorCommitteeResponse | null>(null);
  const [loadingCommittee, setLoadingCommittee] = useState<boolean>(false);
  const [refreshingCommittee, setRefreshingCommittee] = useState<boolean>(false);
  const [activeRoleTab, setActiveRoleTab] = useState<string>('executive_summary');
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Charts & Technicals container state
  const [chartSubTab, setChartSubTab] = useState<'relative' | 'candlestick'>('relative');
  const [watchlistData, setWatchlistData] = useState<WatchlistDataResponse | null>(null);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);

  // Measure container width via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute whether layout should be 1-column or 2-column
  const isSingleColumn = useMemo(() => {
    if (layoutMode === '1-col') return true;
    if (layoutMode === '2-col') return false;
    // Auto mode: Split view or container width < 1100px triggers 1-column stack
    return isSplitView || containerWidth < 1100;
  }, [layoutMode, isSplitView, containerWidth]);

  // Load Sector Performance for active horizon
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

  // When matrix view is selected, fetch all horizons to display the full multi-horizon matrix
  useEffect(() => {
    if (heatmapViewType !== 'matrix') return;
    let mounted = true;
    setLoadingMatrix(true);

    const horizons = ['1D', '1W', '1M', '3M', '6M', '1Y'];
    Promise.all(horizons.map((hz) => apiClient.getSectorPerformance(hz)))
      .then((results) => {
        if (!mounted) return;
        const matrixMap: Record<string, Record<string, number>> = {};
        GICS_SECTORS.forEach((s) => {
          matrixMap[s.ticker] = {};
        });

        results.forEach((res, idx) => {
          const hz = horizons[idx];
          (res.sectors || []).forEach((sec) => {
            if (matrixMap[sec.ticker]) {
              matrixMap[sec.ticker][hz] = sec.value;
            }
          });
        });

        setMatrixReturns(matrixMap);
      })
      .catch((err) => {
        console.error('Failed to load matrix performance data:', err);
      })
      .finally(() => {
        if (mounted) setLoadingMatrix(false);
      });

    return () => {
      mounted = false;
    };
  }, [heatmapViewType]);

  // Load Sector Committee AI outputs
  const loadCommittee = useCallback(
    async (ticker: string, runId?: number) => {
      setLoadingCommittee(true);
      try {
        const res = await apiClient.getSectorCommittee(ticker, runId);
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
    },
    [onContextUpdate]
  );

  useEffect(() => {
    loadCommittee(selectedTicker);
  }, [selectedTicker, loadCommittee]);

  // Load Candlestick / Matplotlib Chart data when candlestick tab is active
  const loadChartData = useCallback(async (ticker: string, zoomStart?: string, zoomEnd?: string) => {
    setLoadingChart(true);
    try {
      const data = await apiClient.getWatchlistData(ticker, zoomStart, zoomEnd);
      setWatchlistData(data);
    } catch (err) {
      console.error('Failed to load chart data for', ticker, err);
    } finally {
      setLoadingChart(false);
    }
  }, []);

  useEffect(() => {
    if (chartSubTab === 'candlestick') {
      loadChartData(selectedTicker);
    }
  }, [chartSubTab, selectedTicker, loadChartData]);

  const handleZoomChange = async (zoomStart: string, zoomEnd: string) => {
    await loadChartData(selectedTicker, zoomStart, zoomEnd);
  };

  // Check if AI Analysis has already been executed today (1-per-day rate limit)
  const isRunToday = useMemo(() => {
    if (committeeData?.daily_quota_reached) return true;
    if (!committeeData?.created_at) return false;
    const runDate = committeeData.created_at.slice(0, 10);
    const todayDate = new Date().toISOString().slice(0, 10);
    return runDate === todayDate;
  }, [committeeData]);

  // Execute Cross-Sector Committee Run (enforcing 1 run/day limit)
  const handleRefreshCommittee = async () => {
    if (isRunToday) return;
    setRefreshingCommittee(true);
    try {
      const res = await apiClient.refreshSectorCommittee(selectedTicker, 'gemini', 'gemini-4-neon');
      setCommitteeData(res);
    } catch (err) {
      console.error('Failed to execute cross-sector committee:', err);
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
        summary_headline: `${committeeData.symbol} Cross-Sector Committee Executive Summary`,
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

  // Historical runs navigation
  const runsHistory = committeeData?.history || [];
  const currentRunIndex = runsHistory.findIndex((r) => r.run_id === committeeData?.run_id);

  const handleHistoricalRunSelect = (runId: number) => {
    loadCommittee(selectedTicker, runId);
  };

  const handlePrevRun = () => {
    if (runsHistory.length === 0) return;
    if (currentRunIndex === -1 && runsHistory.length > 1) {
      loadCommittee(selectedTicker, runsHistory[1].run_id);
    } else if (currentRunIndex >= 0 && currentRunIndex < runsHistory.length - 1) {
      loadCommittee(selectedTicker, runsHistory[currentRunIndex + 1].run_id);
    }
  };

  const handleNextRun = () => {
    if (runsHistory.length === 0) return;
    if (currentRunIndex > 0) {
      loadCommittee(selectedTicker, runsHistory[currentRunIndex - 1].run_id);
    }
  };

  const currentSectorItem = perfData?.sectors.find((s) => s.ticker === selectedTicker) || {
    id: selectedTicker,
    label: GICS_SECTORS.find((g) => g.ticker === selectedTicker)?.name || selectedTicker,
    ticker: selectedTicker,
    value: 0.0,
    weight: GICS_SECTORS.find((g) => g.ticker === selectedTicker)?.defaultWeight || 5.0,
    subtext: '',
    relativeRotation: 'Leading',
    rsScore: 1.0,
    rsMomentum: 0.0,
  };

  const benchmarkReturn = perfData?.benchmarkReturn ?? 0.0;
  const activeOutput = committeeData?.outputs.find((o) => o.role === activeRoleTab);

  // Map of 4 RRG Quadrant priority sequence (Continuous Lifecycle Flow)
  const QUADRANT_PRIORITY: Record<string, number> = {
    Leading: 1,
    Weakening: 2,
    Improving: 3,
    Lagging: 4,
  };

  // Compile all 11 GICS sectors with live metrics or defaults
  const allSectors = useMemo(() => {
    const sectorsMap: Record<string, any> = {};
    (perfData?.sectors || []).forEach((s) => {
      sectorsMap[s.ticker] = s;
    });

    return GICS_SECTORS.map((g) => {
      return (
        sectorsMap[g.ticker] || {
          id: g.ticker,
          ticker: g.ticker,
          label: g.name,
          value: 0.0,
          weight: g.defaultWeight,
          subtext: g.ticker,
          relativeRotation: 'Leading',
          rsScore: 1.0,
          rsMomentum: 0.0,
        }
      );
    });
  }, [perfData]);

  // Sort sectors based on selected sort mode:
  // 1. Quadrants (Default): Leading → Weakening → Improving → Lagging, then weight desc
  // 2. Weight: S&P 500 Market Weight descending
  // 3. Return: Horizon return descending
  const sortedSectors = useMemo(() => {
    const list = [...allSectors];
    if (treemapSortBy === 'quadrant') {
      list.sort((a, b) => {
        const orderA = QUADRANT_PRIORITY[a.relativeRotation] ?? 5;
        const orderB = QUADRANT_PRIORITY[b.relativeRotation] ?? 5;
        if (orderA !== orderB) return orderA - orderB;
        return b.weight - a.weight;
      });
    } else if (treemapSortBy === 'weight') {
      list.sort((a, b) => b.weight - a.weight);
    } else if (treemapSortBy === 'return') {
      list.sort((a, b) => b.value - a.value);
    }
    return list;
  }, [allSectors, treemapSortBy]);

  // Dynamic Treemap row partitioning (3, 4, 4) with normalized row weight calculation
  const treemapRows = useMemo(() => {
    const row1 = sortedSectors.slice(0, 3);
    const row2 = sortedSectors.slice(3, 7);
    const row3 = sortedSectors.slice(7, 11);

    const getRowWeight = (r: typeof row1) => r.reduce((sum, s) => sum + s.weight, 0);

    return [
      { rowId: 1, sectors: row1, totalWeight: getRowWeight(row1), minHeight: 'min-h-[115px]' },
      { rowId: 2, sectors: row2, totalWeight: getRowWeight(row2), minHeight: 'min-h-[105px]' },
      { rowId: 3, sectors: row3, totalWeight: getRowWeight(row3), minHeight: 'min-h-[95px]' },
    ];
  }, [sortedSectors]);

  // Count sectors in each RRG quadrant for market breadth
  const quadrantCounts = useMemo(() => {
    const counts: Record<string, number> = { Leading: 0, Weakening: 0, Improving: 0, Lagging: 0 };
    allSectors.forEach((s) => {
      const q = s.relativeRotation || 'Leading';
      if (counts[q] !== undefined) counts[q]++;
      else counts[q] = 1;
    });
    return counts;
  }, [allSectors]);

  return (
    <div ref={containerRef} className="space-y-5">
      {/* Top Header & Toolbar (Dropdowns Removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Layout Mode Toggles (Auto, 1 Col, 2 Col) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('auto')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                layoutMode === 'auto' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Automatically stack to 1 column in Split View or narrow screens"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('1-col')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                layoutMode === '1-col' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Force 1-column single stacked layout"
            >
              1 Col
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('2-col')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                layoutMode === '2-col' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Force 2-column side-by-side layout"
            >
              2 Col
            </button>
          </div>

          {/* AI Analysis Button with 1-Run-Per-Day Rate Limiting */}
          {isRunToday ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 shadow-2xs select-none"
              title={`Daily limit reached (1 analysis per day). Cross-sector run #${committeeData?.run_id || 1} completed today.`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Analyzed Today (1/day)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRefreshCommittee}
              disabled={refreshingCommittee}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              title="Execute Cross-Sector 4-Analyst Committee Analysis (Limit: 1 per day)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingCommittee ? 'animate-spin' : ''}`} />
              {refreshingCommittee ? 'Analyzing All Sectors...' : 'AI Analysis (1/day)'}
            </button>
          )}
        </div>
      </div>

      {/* Fallback Warning Banner if credits depleted */}
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

      {/* Adaptive Grid Layout:
          When isSingleColumn === true:
            Grid is 1 column (`grid-cols-1`).
            Section 1: GICS Sector Performance Heatmap (Full width)
            Section 2: Charts & Technicals (Full width)
            Section 3: Sector Committee Synthesis (Full width, reflowed below)
            Section 4: Cited Sector News & Feed (Full width, at bottom)
          When isSingleColumn === false:
            Grid is 2 columns (`lg:grid-cols-2`).
            Column 1: Heatmap + Charts & Technicals
            Column 2: Sector Committee Synthesis + Cited News Feed
      */}
      <div className={`grid ${isSingleColumn ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-5`}>
        {/* ==================================================================== */}
        {/* COLUMN 1: GICS Sector Heatmap & Charts Container                    */}
        {/* ==================================================================== */}
        <div className="space-y-5">
          {/* GICS Sector Performance Heatmap */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            {/* Heatmap Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  GICS Sector Performance Heatmap
                  <span className="sr-only">11 GICS Sectors Relative Performance</span>
                </h2>
                <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  SPY: {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Heatmap Visualization Switcher: Treemap vs Matrix Table */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setHeatmapViewType('treemap')}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      heatmapViewType === 'treemap' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Finviz-style Market Treemap sized by sector weight"
                  >
                    <Grid className="w-3 h-3" />
                    <span>Treemap</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeatmapViewType('matrix')}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                      heatmapViewType === 'matrix' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Bloomberg-style multi-horizon cross-performance matrix"
                  >
                    <TableIcon className="w-3 h-3" />
                    <span>Matrix</span>
                  </button>
                </div>

                {/* RRG Formula Help Button */}
                <button
                  type="button"
                  onClick={() => setShowFormulaModal(!showFormulaModal)}
                  className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-semibold px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                  title="View Relative Rotation Graph Formula and Methodology"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Formula
                </button>

                {/* Horizon Switcher (Active for Treemap View) */}
                {heatmapViewType === 'treemap' && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    {['1D', '1W', '1M', '3M', '6M', '1Y'].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHorizon(h)}
                        className={`px-2 py-0.5 rounded font-mono font-semibold transition-colors cursor-pointer ${
                          horizon === h ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sort Switcher (Quadrants, Weight, Return) */}
                {heatmapViewType === 'treemap' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500">Sort:</span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setTreemapSortBy('quadrant')}
                        className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          treemapSortBy === 'quadrant' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Sort by 4 RRG Quadrants (Leading → Weakening → Improving → Lagging)"
                      >
                        Quadrants
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreemapSortBy('weight')}
                        className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          treemapSortBy === 'weight' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Sort by S&P 500 Market Weight"
                      >
                        Weight
                      </button>
                      <button
                        type="button"
                        onClick={() => setTreemapSortBy('return')}
                        className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                          treemapSortBy === 'return' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Sort by Performance Return %"
                      >
                        Return
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RRG Methodology Formula Accordion */}
            {showFormulaModal && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-700" />
                  Relative Rotation Graph (RRG) Methodology
                </div>
                <p className="text-[11px] leading-relaxed text-blue-900">
                  Relative Strength (RS) measures a sector ETF&apos;s 1-month return normalized against S&P 500 (SPY).
                  RS Momentum (RS_Mom) calculates the 5-day velocity delta of that ratio.
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

            {/* Selected Sector Summary Strip */}
            <div className="flex flex-wrap items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 gap-2">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm text-slate-900">
                  {currentSectorItem.ticker} — {currentSectorItem.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
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
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500 mr-1">Weight:</span>
                  <span className="font-bold text-slate-800">{currentSectorItem.weight.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1">RS:</span>
                  <span className="font-bold text-slate-800">{(currentSectorItem.rsScore ?? 1.0).toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1">Mom:</span>
                  <span
                    className={`font-bold ${
                      (currentSectorItem.rsMomentum ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {(currentSectorItem.rsMomentum ?? 0) >= 0 ? '+' : ''}
                    {(currentSectorItem.rsMomentum ?? 0).toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1">Return:</span>
                  <span
                    className={`font-bold ${
                      currentSectorItem.value >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {currentSectorItem.value >= 0 ? '+' : ''}
                    {currentSectorItem.value.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* RRG Rotation Sequence Breadcrumb (shown in Quadrant sort mode) */}
            {heatmapViewType === 'treemap' && treemapSortBy === 'quadrant' && (
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 gap-2">
                <span className="font-semibold text-slate-700">RRG Rotation Order:</span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="flex items-center gap-1 font-bold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                    Leading ({quadrantCounts.Leading})
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="flex items-center gap-1 font-bold text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Weakening ({quadrantCounts.Weakening})
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="flex items-center gap-1 font-bold text-blue-800">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                    Improving ({quadrantCounts.Improving})
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="flex items-center gap-1 font-bold text-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                    Lagging ({quadrantCounts.Lagging})
                  </span>
                </div>
              </div>
            )}

            {/* REAL FINANCIAL HEATMAP: Treemap View (Finviz Style with Quadrant Sorting) */}
            {heatmapViewType === 'treemap' && (
              <div className="space-y-2 select-none">
                {treemapRows.map((row) => (
                  <div key={row.rowId} className={`flex gap-2 ${row.minHeight}`}>
                    {row.sectors.map((sec) => {
                      const heat = getHeatColorClass(sec.value);
                      const isSelected = sec.ticker === selectedTicker;
                      const pct = Math.max(8, Math.round((sec.weight / (row.totalWeight || 1)) * 100));
                      return (
                        <div
                          key={sec.ticker}
                          onClick={() => setSelectedTicker(sec.ticker)}
                          style={{ flexBasis: `${pct}%`, flexGrow: sec.weight }}
                          className={`p-2.5 rounded-lg flex flex-col justify-between cursor-pointer transition-all ${heat.bg} ${heat.text} ${
                            isSelected ? 'ring-4 ring-blue-600 shadow-md scale-[1.01] z-10' : 'hover:opacity-95'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <span className="font-extrabold text-sm sm:text-base tracking-tight">{sec.ticker}</span>
                              <div className="text-[10px] sm:text-[11px] opacity-90 truncate max-w-[120px] font-medium">{sec.label}</div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                                sec.relativeRotation === 'Leading'
                                  ? 'bg-emerald-950/40 text-emerald-100 border border-emerald-400/30'
                                  : sec.relativeRotation === 'Weakening'
                                  ? 'bg-amber-950/40 text-amber-100 border border-amber-400/30'
                                  : sec.relativeRotation === 'Improving'
                                  ? 'bg-blue-950/40 text-blue-100 border border-blue-400/30'
                                  : 'bg-rose-950/40 text-rose-100 border border-rose-400/30'
                              }`}
                            >
                              {sec.relativeRotation}
                            </span>
                          </div>
                          <div className="flex items-end justify-between font-mono mt-2">
                            <span className="text-base sm:text-lg font-black">
                              {sec.value >= 0 ? '+' : ''}{sec.value.toFixed(2)}%
                            </span>
                            <span className="text-[10px] sm:text-xs opacity-85 font-medium">{sec.weight.toFixed(1)}% wt</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* REAL FINANCIAL HEATMAP: Matrix View (Bloomberg Cross-Horizon Heatmap) */}
            {heatmapViewType === 'matrix' && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2 px-3">Sector</th>
                      <th className="py-2 px-2 text-right">Weight</th>
                      <th className="py-2 px-2 text-center">1D</th>
                      <th className="py-2 px-2 text-center">1W</th>
                      <th className="py-2 px-2 text-center">1M</th>
                      <th className="py-2 px-2 text-center">3M</th>
                      <th className="py-2 px-2 text-center">6M</th>
                      <th className="py-2 px-2 text-center">1Y</th>
                      <th className="py-2 px-2 text-center">RRG Quadrant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GICS_SECTORS.map((s) => {
                      const isSelected = s.ticker === selectedTicker;
                      const sectorRetMap = matrixReturns[s.ticker] || {};
                      const perfSector = (perfData?.sectors || []).find((p) => p.ticker === s.ticker);
                      const quadrant = perfSector?.relativeRotation || 'Leading';

                      return (
                        <tr
                          key={s.ticker}
                          onClick={() => setSelectedTicker(s.ticker)}
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70 font-semibold ring-1 ring-blue-500' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2 px-3">
                            <span className="font-extrabold text-slate-900 mr-1.5">{s.ticker}</span>
                            <span className="text-slate-500 text-[11px]">{s.name}</span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-600">
                            {s.defaultWeight.toFixed(1)}%
                          </td>

                          {['1D', '1W', '1M', '3M', '6M', '1Y'].map((hz) => {
                            const val = sectorRetMap[hz] ?? (hz === horizon ? perfSector?.value ?? 0 : 0);
                            const heat = getHeatColorClass(val);
                            return (
                              <td key={hz} className="py-1 px-1.5 text-center">
                                <span
                                  className={`inline-block w-full py-1 px-1 rounded text-[11px] font-mono font-bold ${heat.bg} ${heat.text}`}
                                >
                                  {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                                </span>
                              </td>
                            );
                          })}

                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                quadrant === 'Leading'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : quadrant === 'Improving'
                                  ? 'bg-blue-100 text-blue-800'
                                  : quadrant === 'Weakening'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {quadrant}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Charts & Technicals Container (Multi-Index % Comparison & Single Candlestick) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            {/* Header with Sub-tab toggles */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">Charts & Technicals</h2>
              </div>

              {/* View Switcher: Multi-Index Relative % vs Single Sector Candlestick */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setChartSubTab('relative')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    chartSubTab === 'relative' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Multi-Index Relative %
                </button>
                <button
                  type="button"
                  onClick={() => setChartSubTab('candlestick')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    chartSubTab === 'candlestick' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Sector Candlestick
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: Multi-Index Relative % Comparison */}
            {chartSubTab === 'relative' && (
              <SectorComparisonChart
                initialSymbols={[selectedTicker, 'SPY', 'XLK', 'XLF']}
                activeSector={selectedTicker}
              />
            )}

            {/* Sub-Tab 2: Single Sector Candlestick */}
            {chartSubTab === 'candlestick' && (
              <div className="space-y-3">
                <ChartComparisonView
                  chartScreenshot={watchlistData?.chartScreenshot}
                  values={watchlistData?.eodData?.values || []}
                  trades={watchlistData?.trades || []}
                  onZoomChange={handleZoomChange}
                  isZooming={loadingChart}
                />
              </div>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* COLUMN 2: Sector Committee Synthesis & Cited News Feed              */}
        {/* ==================================================================== */}
        <div className="space-y-5">
          {/* Sector Committee Synthesis Card with Historical <Date> Feature */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Committee Header with <Date> Stepper */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
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

              {/* Historical <Date> Stepper & Dropdown */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevRun}
                      disabled={runsHistory.length <= 1 || currentRunIndex === runsHistory.length - 1}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                      title="Previous historical analysis run"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                      <Calendar className="w-3 h-3 text-blue-700" />
                      <span>
                        {committeeData?.created_at ? committeeData.created_at.slice(0, 10) : 'Current'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextRun}
                      disabled={runsHistory.length <= 1 || currentRunIndex <= 0}
                      className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                      title="Next (more recent) analysis run"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dropdown for specific historical runs */}
                  {runsHistory.length > 0 && (
                    <select
                      aria-label="Historical Analysis Runs"
                      value={committeeData?.run_id ?? ''}
                      onChange={(e) => handleHistoricalRunSelect(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-700 focus:outline-none cursor-pointer"
                    >
                      {runsHistory.map((hr, idx) => (
                        <option key={hr.run_id} value={hr.run_id}>
                          {idx === 0 ? 'Latest: ' : 'Run #' + hr.run_id + ': '}
                          {hr.created_at ? hr.created_at.slice(0, 16).replace('T', ' ') : 'Run ' + hr.run_id}
                          {' ('}{hr.consensus_bias}{')'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-mono">
                  Confidence: <span className="font-bold text-slate-700">{committeeData?.consensus_confidence ?? 50}%</span> |{' '}
                  Run #{committeeData?.run_id ?? 1}
                </div>
              </div>
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
            <div className="p-4 text-xs leading-relaxed text-slate-700 min-h-[220px]">
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

          {/* Cited Sector News & Feed (Yahoo Finance RSS) */}
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
              <div className="py-6 text-center text-xs text-slate-400 italic">
                No recent RSS news retrieved for {selectedTicker}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustrySectorView;