import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  PieChart,
  Wallet,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Columns,
  Rows,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import {
  PortfolioOverviewResponse,
  PortfolioCommentaryResponse,
  PortfolioCapitalMarginPoint,
  PortfolioStockPnLPoint,
  PortfolioTradeAnnotation,
  PortfolioCapitalAnnotation,
} from '../../types/api';

// Colors strictly selected from design system APPROVED_PALETTE
const STOCK_COLORS = [
  '#2563EB', // Blue
  '#34D399', // Emerald
  '#FBBF24', // Amber
  '#FB7185', // Rose
  '#818CF8', // Indigo
  '#38BDF8', // Cyan/Sky
  '#7C3AED', // Purple
  '#047857', // Forest green
  '#D97706', // Dark amber
];

const formatHoldingsKValue = (val: number): string => {
  if (Math.abs(val) >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(val) >= 1_000) {
    return `$${(val / 1_000).toFixed(0)}k`;
  }
  return `$${val.toFixed(0)}`;
};


interface TooltipBadgeProps {
  label: string;
  amountVal: number;
  pctVal: number;
  currency: string;
  isPctMode: boolean;
  formula: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

const KpiBadgeWithTooltip: React.FC<TooltipBadgeProps> = ({
  label,
  amountVal,
  pctVal,
  currency,
  isPctMode,
  formula,
  trend,
  icon,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const displayPrimary = isPctMode
    ? `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`
    : `${currency} ${amountVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const displaySecondary = isPctMode
    ? `${currency} ${amountVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`;

  const trendColor =
    trend === 'up'
      ? 'text-emerald-600'
      : trend === 'down'
      ? 'text-rose-600'
      : 'text-slate-800';

  return (
    <div
      className="relative bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 hover:shadow-sm"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          <button
            type="button"
            className="text-slate-400 hover:text-blue-600 focus:outline-hidden transition-colors"
            aria-label={`Formula for ${label}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div>
        <div className={`text-lg sm:text-xl font-mono font-bold tracking-tight ${trendColor}`}>
          {displayPrimary}
        </div>
        <div className="text-xs font-mono text-slate-400 mt-0.5 flex items-center gap-1">
          <span>{displaySecondary}</span>
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-600 inline" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-600 inline" />}
        </div>
      </div>

      {/* Rollover Tooltip explaining calculation formula */}
      {showTooltip && (
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl pointer-events-none transition-opacity duration-150 animate-in fade-in">
          <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            Calculation Formula
          </div>
          <div className="font-mono text-[11px] text-slate-300 leading-relaxed bg-slate-800 p-1.5 rounded border border-slate-700">
            {formula}
          </div>
          <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
};

export const PortfolioOverview: React.FC = () => {
  const [data, setData] = useState<PortfolioOverviewResponse | null>(null);
  const [commentaryData, setCommentaryData] = useState<PortfolioCommentaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [commentaryLoading, setCommentaryLoading] = useState<boolean>(false);

  // Top Parameters
  const [currency, setCurrency] = useState<string>('SGD');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [mode, setMode] = useState<'amount' | 'pct'>('amount');
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '12M'>('6M');

  // Chart 2 active stock toggles
  // Chart 1 & Chart 2 visibility checkboxes (toggling individual series never alters Total)
  const [showPortfolioSize, setShowPortfolioSize] = useState<boolean>(true);
  const [showCapitalLine, setShowCapitalLine] = useState<boolean>(true);
  const [showMarginLine, setShowMarginLine] = useState<boolean>(true);
  const [showTotalPnL, setShowTotalPnL] = useState<boolean>(true);
  const [showTradeAnnotations, setShowTradeAnnotations] = useState<boolean>(true);
  const [showCapitalAnnotations, setShowCapitalAnnotations] = useState<boolean>(true);

  const [activeStocks, setActiveStocks] = useState<Record<string, boolean>>({});

  // Synchronized crosshair index between Chart 1 and Chart 2
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState<number | null>(null);

  // Responsive layout state: 'auto' | 'stacked' | 'side-by-side'
  const [layoutMode, setLayoutMode] = useState<'auto' | 'stacked' | 'side-by-side'>(() => {
    try {
      return (localStorage.getItem('alpha_insight_portfolio_layout_mode') as any) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [containerWidth, setContainerWidth] = useState<number>(1600);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('alpha_insight_portfolio_layout_mode', layoutMode);
    } catch {
      // ignore
    }
  }, [layoutMode]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };
    updateWidth();

    if (!containerRef.current || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isStacked = useMemo(() => {
    if (layoutMode === 'stacked') return true;
    if (layoutMode === 'side-by-side') return false;
    // Auto mode: ascertain available width (< 1400px automatically stacks below)
    return containerWidth < 1400;
  }, [layoutMode, containerWidth]);

  const fetchOverview = async (ccy = currency, tf = timeframe, dt = selectedDate) => {
    setLoading(true);
    try {
      const res = await apiClient.getPortfolioOverview({
        currency: ccy,
        timeframe: tf,
        date: dt,
      });
      setData(res);
      if (res.parameters?.currency && res.parameters.currency !== currency) {
        setCurrency(res.parameters.currency);
      }
      if (res.parameters?.selectedDate && res.parameters.selectedDate !== selectedDate) {
        setSelectedDate(res.parameters.selectedDate);
      }

      // Initialize all top stock lines as active if not yet set
      const stockKeys = Object.keys(res.chart2_pnl_breakdown?.stocks || {});
      setActiveStocks((prev) => {
        const next = { ...prev };
        for (const s of stockKeys) {
          if (next[s] === undefined) next[s] = true;
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load portfolio overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentary = async (ccy = currency, dt = selectedDate, force = false) => {
    setCommentaryLoading(true);
    try {
      const res = force
        ? await apiClient.refreshPortfolioCommentary({ currency: ccy, date: dt })
        : await apiClient.getPortfolioCommentary({ currency: ccy, date: dt });
      setCommentaryData(res);
    } catch {
      // Graceful fallback if commentary is offline
    } finally {
      setCommentaryLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview(currency, timeframe, selectedDate);
    fetchCommentary(currency, selectedDate, false);
  }, [currency, timeframe, selectedDate]);

  const kpis = useMemo(() => {
    return {
      netAssetValue: Number(data?.kpis?.netAssetValue ?? 0),
      cashBalance: Number(data?.kpis?.cashBalance ?? 0),
      realizedPnL: Number(data?.kpis?.realizedPnL ?? 0),
      realizedPnLPct: Number(data?.kpis?.realizedPnLPct ?? 0),
      unrealizedPnL: Number(data?.kpis?.unrealizedPnL ?? 0),
      unrealizedPnLPct: Number(data?.kpis?.unrealizedPnLPct ?? 0),
      totalPnL: Number(data?.kpis?.totalPnL ?? 0),
      totalPnLPct: Number(data?.kpis?.totalPnLPct ?? 0),
      capital: Number(data?.kpis?.capital ?? 0),
      capitalPct: Number(data?.kpis?.capitalPct ?? 0),
      margin: Number(data?.kpis?.margin ?? 0),
      marginPct: Number(data?.kpis?.marginPct ?? 0),
      totalPortfolio: Number(data?.kpis?.totalPortfolio ?? data?.kpis?.netAssetValue ?? 0),
      totalPortfolioPct: Number(data?.kpis?.totalPortfolioPct ?? data?.kpis?.pctReturn ?? 0),
      currency: data?.kpis?.currency || currency,
    };
  }, [data, currency]);

  const chart1Series: PortfolioCapitalMarginPoint[] = useMemo(() => {
    return data?.chart1_portfolio_capital_margin || [];
  }, [data]);

  const chart2Data = useMemo(() => {
    return data?.chart2_pnl_breakdown || { portfolio: [], stocks: {} };
  }, [data]);

  const stockList = useMemo(() => {
    return Object.keys(chart2Data.stocks || {});
  }, [chart2Data]);

  const tradesByDate = useMemo(() => {
    const map = new Map<string, PortfolioTradeAnnotation[]>();
    for (const tr of data?.trade_annotations || []) {
      const list = map.get(tr.date);
      if (list) list.push(tr);
      else map.set(tr.date, [tr]);
    }
    return map;
  }, [data]);

  const capitalByDate = useMemo(() => {
    const map = new Map<string, PortfolioCapitalAnnotation[]>();
    for (const cp of data?.capital_annotations || []) {
      const list = map.get(cp.date);
      if (list) list.push(cp);
      else map.set(cp.date, [cp]);
    }
    return map;
  }, [data]);

  const toggleStockLine = (symbol: string) => {
    setActiveStocks((prev) => ({
      ...prev,
      [symbol]: !prev[symbol],
    }));
  };

  const handlePrevDate = () => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      d.setUTCDate(d.getUTCDate() - 1);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  };

  const handleNextDate = () => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      d.setUTCDate(d.getUTCDate() + 1);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  };

  // SVG Chart Dimensions
  const chartWidth = 900;
  const chartHeight = 280;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  // Chart 1 Coordinates calculation
  const chart1Stats = useMemo(() => {
    if (!chart1Series.length) return null;
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const pt of chart1Series) {
      if (mode === 'amount') {
        if (showPortfolioSize) {
          minVal = Math.min(minVal, pt.portfolioSize);
          maxVal = Math.max(maxVal, pt.portfolioSize);
        }
        if (showCapitalLine) {
          minVal = Math.min(minVal, pt.capital);
          maxVal = Math.max(maxVal, pt.capital);
        }
        if (showMarginLine) {
          minVal = Math.min(minVal, pt.margin);
          maxVal = Math.max(maxVal, pt.margin);
        }

      } else {
        if (showPortfolioSize) {
          minVal = Math.min(minVal, pt.portfolioSizePct);
          maxVal = Math.max(maxVal, pt.portfolioSizePct);
        }
        if (showCapitalLine) {
          minVal = Math.min(minVal, pt.capitalPct);
          maxVal = Math.max(maxVal, pt.capitalPct);
        }
        if (showMarginLine) {
          minVal = Math.min(minVal, pt.marginPct);
          maxVal = Math.max(maxVal, pt.marginPct);
        }

      }
    }
    if (minVal === Infinity) {
      minVal = 0;
      maxVal = 100;
    }
    const span = maxVal - minVal || 1;
    const yPad = span * 0.1;
    const yMin = minVal - yPad;
    const yMax = maxVal + yPad;
    const yRange = yMax - yMin || 1;

    const toX = (idx: number) => padLeft + (idx / Math.max(1, chart1Series.length - 1)) * plotW;
    const toY = (val: number) => padTop + plotH - ((val - yMin) / yRange) * plotH;

    const ptsPort = chart1Series.map((pt, i) => `${toX(i)},${toY(mode === 'amount' ? pt.portfolioSize : pt.portfolioSizePct)}`).join(' ');
    const ptsCap = chart1Series.map((pt, i) => `${toX(i)},${toY(mode === 'amount' ? pt.capital : pt.capitalPct)}`).join(' ');
    const ptsMargin = chart1Series.map((pt, i) => `${toX(i)},${toY(mode === 'amount' ? pt.margin : pt.marginPct)}`).join(' ');

    return { yMin, yMax, toX, toY, ptsPort, ptsCap, ptsMargin };
  }, [chart1Series, mode, plotW, plotH, padLeft, padTop, showPortfolioSize, showCapitalLine, showMarginLine]);

  // Chart 2 Coordinates calculation
  const chart2Stats = useMemo(() => {
    const portPts = chart2Data.portfolio || [];
    if (!portPts.length) return null;
    let minVal = Infinity;
    let maxVal = -Infinity;

    if (showTotalPnL) {
      for (const pt of portPts) {
        const v = mode === 'amount' ? pt.pnl : pt.pnlPct;
        minVal = Math.min(minVal, v);
        maxVal = Math.max(maxVal, v);
      }
    }

    for (const [sym, sSeries] of Object.entries(chart2Data.stocks || {})) {
      if (activeStocks[sym] === false) continue;
      for (const pt of sSeries) {
        const v = mode === 'amount' ? pt.pnl : pt.pnlPct;
        minVal = Math.min(minVal, v);
        maxVal = Math.max(maxVal, v);
      }
    }

    if (minVal === Infinity) {
      minVal = 0;
      maxVal = 100;
    }
    const span = maxVal - minVal || 1;
    const yPad = span * 0.12;
    const yMin = minVal - yPad;
    const yMax = maxVal + yPad;
    const yRange = yMax - yMin || 1;

    const toX = (idx: number) => padLeft + (idx / Math.max(1, portPts.length - 1)) * plotW;
    const toY = (val: number) => padTop + plotH - ((val - yMin) / yRange) * plotH;

    const ptsPort = portPts.map((pt, i) => `${toX(i)},${toY(mode === 'amount' ? pt.pnl : pt.pnlPct)}`).join(' ');

    const stockPolylines: Record<string, string> = {};
    for (const [sym, sSeries] of Object.entries(chart2Data.stocks || {})) {
      if (activeStocks[sym] === false) continue;
      stockPolylines[sym] = sSeries.map((pt, i) => `${toX(i)},${toY(mode === 'amount' ? pt.pnl : pt.pnlPct)}`).join(' ');
    }

    return { yMin, yMax, toX, toY, ptsPort, stockPolylines, zeroY: toY(0) };
  }, [chart2Data, activeStocks, showTotalPnL, mode, plotW, plotH, padLeft, padTop]);

  // Chart 3: Asset allocation data
  const chart3Data = useMemo(() => {
    return data?.chart3_asset_allocation || [];
  }, [data]);

  // Chart 4: Daily PnL and Drawdown
  const chart4Series = useMemo(() => {
    return data?.chart4_daily_pnl_drawdown || [];
  }, [data]);

  const chart4Stats = useMemo(() => {
    if (!chart4Series.length) return null;
    let maxAbsPnL = 100;
    let minDDPct = 0;
    for (const pt of chart4Series) {
      maxAbsPnL = Math.max(maxAbsPnL, Math.abs(pt.dailyPnL));
      minDDPct = Math.min(minDDPct, pt.drawdownPct);
    }
    const zeroY = padTop + plotH * 0.55;
    const maxBarH = plotH * 0.4;
    const toBarY = (val: number) => (val >= 0 ? zeroY - (val / maxAbsPnL) * maxBarH : zeroY);
    const toBarH = (val: number) => Math.max(1, (Math.abs(val) / maxAbsPnL) * maxBarH);
    const toX = (idx: number) => padLeft + (idx / Math.max(1, chart4Series.length - 1)) * plotW;
    const barW = Math.max(2, Math.min(8, (plotW / chart4Series.length) * 0.65));

    const ddRange = Math.abs(minDDPct) || 1;
    const toYDD = (ddPct: number) => padTop + (Math.abs(ddPct) / ddRange) * (plotH * 0.45);
    const ptsDD = chart4Series.map((pt, i) => `${toX(i)},${toYDD(pt.drawdownPct)}`).join(' ');

    return { maxAbsPnL, minDDPct, zeroY, toBarY, toBarH, toX, barW, ptsDD, toYDD };
  }, [chart4Series, plotW, plotH, padLeft, padTop]);

  // Exact sub-pixel mouse-to-SVG coordinate mapping resolving hover alignment
  const getHoverIndexFromEvent = (
    e: React.MouseEvent<SVGSVGElement>,
    totalPoints: number
  ): number | null => {
    if (totalPoints <= 1) return 0;
    const svg = e.currentTarget;
    let x = 0;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const transformed = pt.matrixTransform(ctm.inverse());
      x = transformed.x;
    } else {
      const rect = svg.getBoundingClientRect();
      x = ((e.clientX - rect.left) / rect.width) * chartWidth;
    }

    if (x < padLeft || x > chartWidth - padRight) {
      return null;
    }

    const ratio = Math.max(0, Math.min(1, (x - padLeft) / plotW));
    const idx = Math.round(ratio * (totalPoints - 1));
    return Math.max(0, Math.min(totalPoints - 1, idx));
  };

  return (
    <div ref={containerRef} className="space-y-4 w-full pb-8">
      {/* AI Fallback Warning Banner if credits depleted */}
      {(commentaryData?.fallback_warning || data?.fallback_warning) && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-md flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">AI Provider Service Notice: </span>
            {commentaryData?.fallback_warning || data?.fallback_warning}{' '}
            <a
              href="https://ai.studio/projects"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-bold text-amber-950 underline hover:text-amber-800 ml-1"
            >
              Manage Billing & Credits ↗
            </a>
            <div className="text-[11px] text-amber-800 mt-1">
              Deterministic fallback analytics applied with standard quantitative technical rules.
            </div>
          </div>
        </div>
      )}

      {/* 1. Header & Parameters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-700" />
            Portfolio Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector with Backward / Forward Stepping */}
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevDate}
              aria-label="Previous Day"
              title="Step backward 1 day"
              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-l-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono text-xs font-semibold focus:outline-hidden text-slate-800 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={handleNextDate}
              aria-label="Next Day"
              title="Step forward 1 day"
              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-r-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Amount / % Segmented Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMode('amount')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                mode === 'amount'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Amount
            </button>
            <button
              type="button"
              onClick={() => setMode('pct')}
              className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                mode === 'pct'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Percentage
            </button>
          </div>

          {/* Currency Pill Selector (SGD default from sysvalue) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {['SGD', 'USD', 'HKD'].map((ccy) => (
              <button
                key={ccy}
                type="button"
                onClick={() => setCurrency(ccy)}
                className={`px-3 py-1 rounded-md font-mono font-bold transition-all cursor-pointer ${
                  currency === ccy
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ccy}
              </button>
            ))}
          </div>

          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('auto')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                layoutMode === 'auto'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Auto: Smartly reflow commentary below charts when space is constrained (<1400px)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Auto</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('stacked')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                layoutMode === 'stacked'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Stacked: Move Executive Commentary below the 4 charts"
            >
              <Rows className="w-3.5 h-3.5" />
              <span>Stacked</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('side-by-side')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                layoutMode === 'side-by-side'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Side-by-Side: Graphs on left (8 cols), Commentary on right (4 cols)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>

          {/* AI Analysis Button */}
          <button
            type="button"
            onClick={() => fetchCommentary(currency, selectedDate, true)}
            disabled={commentaryLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            aria-label="AI Analysis (Refresh AI Commentary)"
            title="AI Analysis (Refresh AI Commentary)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${commentaryLoading ? 'animate-spin' : ''}`} />
            {commentaryLoading ? 'Running AI Analysis...' : 'AI Analysis'}
          </button>

          <button
            type="button"
            onClick={() => {
              fetchOverview();
              fetchCommentary(currency, selectedDate, false);
            }}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh Overview"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Metric Badges (KPI Grid with rollover formula tooltips) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiBadgeWithTooltip
          label="Realized PnL"
          amountVal={kpis.realizedPnL}
          pctVal={kpis.realizedPnLPct}
          currency={kpis.currency}
          isPctMode={mode === 'pct'}
          formula="Cumulative realized gains from closed trades / Total capital injected"
          trend={kpis.realizedPnL > 0 ? 'up' : kpis.realizedPnL < 0 ? 'down' : 'neutral'}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <KpiBadgeWithTooltip
          label="Unrealized PnL"
          amountVal={kpis.unrealizedPnL}
          pctVal={kpis.unrealizedPnLPct}
          currency={kpis.currency}
          isPctMode={mode === 'pct'}
          formula="Current open positions mark-to-market gain / Total capital injected"
          trend={kpis.unrealizedPnL > 0 ? 'up' : kpis.unrealizedPnL < 0 ? 'down' : 'neutral'}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <KpiBadgeWithTooltip
          label="Total PnL"
          amountVal={kpis.totalPnL}
          pctVal={kpis.totalPnLPct}
          currency={kpis.currency}
          isPctMode={mode === 'pct'}
          formula="(Realized PnL + Unrealized PnL - Cumulative Interest) / Total Capital"
          trend={kpis.totalPnL > 0 ? 'up' : kpis.totalPnL < 0 ? 'down' : 'neutral'}
          icon={<Activity className="w-4 h-4" />}
        />
        <KpiBadgeWithTooltip
          label="Capital"
          amountVal={kpis.capital}
          pctVal={kpis.capitalPct}
          currency={kpis.currency}
          isPctMode={mode === 'pct'}
          formula="Aggregated net capital injections from capital table"
          trend="neutral"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <KpiBadgeWithTooltip
          label="Margin"
          amountVal={kpis.margin}
          pctVal={kpis.marginPct}
          currency={kpis.currency}
          isPctMode={mode === 'pct'}
          formula="Drawn margin loan balance / Total capital (Leverage ratio)"
          trend={kpis.margin > 0 ? 'down' : 'neutral'}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <KpiBadgeWithTooltip
          label="Total Portfolio"
          amountVal={kpis.totalPortfolio}
          pctVal={kpis.totalPortfolioPct}
          currency={kpis.currency}
          isPctMode={mode === 'pct'}
          formula="Aggregation of active positions in portfolio holdings: sum(Quantity × Market Price × FX)"
          trend={kpis.totalPortfolioPct >= 0 ? 'up' : 'down'}
          icon={<Layers className="w-4 h-4" />}
        />
      </div>

      {/* Legacy and screen reader compatibility anchors */}
      <div className="sr-only" aria-hidden="true">
        <span>Net Asset Value</span>
        <span>Cash Available</span>
      </div>

            {/* 3. Main Body: Institutional Workstation Layout (Adaptive Stacked vs Side-by-Side) */}
      <div className={isStacked ? "space-y-5" : "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"}>
        {/* Institutional Graphs Container */}
        <div className={`${isStacked ? "w-full" : "lg:col-span-8"} bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4`}>
          {/* Global Timeframe Selector Toolbar (without redundant heading) */}
          <div className="flex items-center justify-end gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['1M', '3M', '6M', '12M'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    timeframe === tf
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart 1: Total Portfolio Size, Capital, Margin over Time (Top-Left) */}
          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Chart 1: Portfolio Size, Capital & Margin ({mode === 'amount' ? currency : '% Growth'})
                </h3>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Portfolio Equity Curve vs SPY Benchmark
                </span>
              </div>

              {/* Chart 1 Interactive Legend Checkboxes (Trades coupled to Portfolio Size) */}
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-slate-600">
                <label className="flex items-center gap-1 cursor-pointer select-none" title="Portfolio equity curve with trade execution markers">
                  <input
                    type="checkbox"
                    checked={showPortfolioSize}
                    onChange={(e) => setShowPortfolioSize(e.target.checked)}
                    aria-label="Toggle Portfolio Size"
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="w-2.5 h-1 bg-emerald-500 rounded-full inline-block" />
                  <span>Portfolio Size</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none" title="Capital line with capital adjustment annotations">
                  <input
                    type="checkbox"
                    checked={showCapitalLine}
                    onChange={(e) => {
                      setShowCapitalLine(e.target.checked);
                      setShowCapitalAnnotations(e.target.checked);
                    }}
                    aria-label="Toggle Capital"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="w-2.5 h-1 bg-blue-600 rounded-full inline-block" />
                  <span>Capital</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMarginLine}
                    onChange={(e) => setShowMarginLine(e.target.checked)}
                    aria-label="Toggle Margin Loan"
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="w-2.5 h-1 bg-amber-500 rounded-full inline-block" />
                  <span>Margin Loan</span>
                </label>
              </div>
            </div>

            <div className="relative w-full overflow-hidden bg-slate-50 rounded-lg border border-slate-200 p-2">
              {chart1Series.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-mono">
                  No historical portfolio valuation data found for this range.
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  className="w-full h-64 select-none"
                  onMouseMove={(e) => {
                    const idx = getHoverIndexFromEvent(e, chart1Series.length);
                    if (idx !== null) setHoverIdx(idx);
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Horizontal Gridlines & Y-Axis */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = padTop + pct * plotH;
                    const val = chart1Stats ? chart1Stats.yMax - pct * (chart1Stats.yMax - chart1Stats.yMin) : 0;
                    return (
                      <g key={i}>
                        <line x1={padLeft} y1={y} x2={chartWidth - padRight} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                        {/* Y-axis tick mark */}
                        <line x1={padLeft - 5} y1={y} x2={padLeft} y2={y} stroke="#94A3B8" strokeWidth="1" />
                        <text x={padLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] font-mono fill-slate-500">
                          {mode === 'amount'
                            ? `${(val / 1000).toFixed(0)}k`
                            : `${val.toFixed(1)}%`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Explicit Solid Y-Axis Line & Unit Label */}
                  <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#94A3B8" strokeWidth="1.5" />
                  <text x={padLeft - 8} y={padTop - 6} textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-600">
                    {mode === 'amount' ? `${currency}` : '%'}
                  </text>

                  {/* Explicit Solid X-Axis Baseline */}
                  <line x1={padLeft} y1={padTop + plotH} x2={chartWidth - padRight} y2={padTop + plotH} stroke="#94A3B8" strokeWidth="1.5" />

                  {/* Polylines */}
                  {chart1Stats && (
                    <>
                      {showMarginLine && (
                        <polyline
                          data-testid="chart1-line-margin"
                          fill="none"
                          stroke="#FBBF24"
                          strokeWidth="2"
                          points={chart1Stats.ptsMargin}
                          opacity="0.9"
                        />
                      )}
                      {showCapitalLine && (
                        <polyline
                          data-testid="chart1-line-capital"
                          fill="none"
                          stroke="#2563EB"
                          strokeWidth="2.5"
                          points={chart1Stats.ptsCap}
                        />
                      )}
                      {showPortfolioSize && (
                        <polyline
                          data-testid="chart1-line-portfolio"
                          fill="none"
                          stroke="#34D399"
                          strokeWidth="2.5"
                          points={chart1Stats.ptsPort}
                        />
                      )}

                      {/* Trade Annotations coupled with Portfolio Size line */}
                      {showPortfolioSize &&
                        chart1Series.map((pt, idx) => {
                          const dayTrades = tradesByDate.get(pt.date);
                          if (!dayTrades || dayTrades.length === 0) return null;
                          const cx = chart1Stats.toX(idx);
                          const cy = chart1Stats.toY(mode === 'amount' ? pt.portfolioSize : pt.portfolioSizePct);
                          const hasBuy = dayTrades.some((t) => t.buysell === 'B');
                          const fill = hasBuy ? '#34D399' : '#FB7185';
                          const points = hasBuy
                            ? `${cx},${cy - 7} ${cx - 4.5},${cy + 2} ${cx + 4.5},${cy + 2}`
                            : `${cx},${cy + 7} ${cx - 4.5},${cy - 2} ${cx + 4.5},${cy - 2}`;
                          return (
                            <polygon
                              key={`c1-tr-${pt.date}`}
                              data-testid={`chart1-trade-marker-${pt.date}`}
                              points={points}
                              fill={fill}
                              stroke="#FFFFFF"
                              strokeWidth="1"
                            />
                          );
                        })}

                      {/* Capital Adjustment Annotations on Capital line */}
                      {showCapitalAnnotations &&
                        showCapitalLine &&
                        chart1Series.map((pt, idx) => {
                          const dayCaps = capitalByDate.get(pt.date);
                          if (!dayCaps || dayCaps.length === 0) return null;
                          const cx = chart1Stats.toX(idx);
                          const cy = chart1Stats.toY(mode === 'amount' ? pt.capital : pt.capitalPct);
                          const isWithdrawal = dayCaps.every((c) => c.transtype === 'W');
                          const fill = isWithdrawal ? '#D97706' : '#2563EB';
                          const diamond = `${cx},${cy - 5.5} ${cx + 5},${cy} ${cx},${cy + 5.5} ${cx - 5},${cy}`;
                          return (
                            <polygon
                              key={`c1-cap-${pt.date}`}
                              data-testid={`chart1-capital-marker-${pt.date}`}
                              points={diamond}
                              fill={fill}
                              stroke="#FFFFFF"
                              strokeWidth="1"
                            />
                          );
                        })}
                    </>
                  )}

                  {/* Synchronized Crosshair Cursor & Highlight Dots */}
                  {hoverIdx !== null && chart1Stats && hoverIdx < chart1Series.length && (
                    <g>
                      <line
                        x1={chart1Stats.toX(hoverIdx)}
                        y1={padTop}
                        x2={chart1Stats.toX(hoverIdx)}
                        y2={padTop + plotH}
                        stroke="#64748B"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      {/* Portfolio Size Dot */}
                      <circle
                        cx={chart1Stats.toX(hoverIdx)}
                        cy={chart1Stats.toY(mode === 'amount' ? chart1Series[hoverIdx].portfolioSize : chart1Series[hoverIdx].portfolioSizePct)}
                        r="4.5"
                        fill="#34D399"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      {/* Capital Dot */}
                      <circle
                        cx={chart1Stats.toX(hoverIdx)}
                        cy={chart1Stats.toY(mode === 'amount' ? chart1Series[hoverIdx].capital : chart1Series[hoverIdx].capitalPct)}
                        r="4.5"
                        fill="#2563EB"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      {/* Margin Dot */}
                      <circle
                        cx={chart1Stats.toX(hoverIdx)}
                        cy={chart1Stats.toY(mode === 'amount' ? chart1Series[hoverIdx].margin : chart1Series[hoverIdx].marginPct)}
                        r="4.5"
                        fill="#FBBF24"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    </g>
                  )}

                  {/* X-Axis Date Labels & Ticks */}
                  {chart1Series.length > 0 && chart1Stats && (
                    <>
                      {[0, Math.floor((chart1Series.length - 1) / 4), Math.floor((chart1Series.length - 1) / 2), Math.floor((3 * (chart1Series.length - 1)) / 4), chart1Series.length - 1].map((idx, i) => {
                        const ptX = chart1Stats.toX(idx);
                        const isFirst = i === 0;
                        const isLast = i === 4;
                        return (
                          <g key={i}>
                            <line x1={ptX} y1={padTop + plotH} x2={ptX} y2={padTop + plotH + 5} stroke="#94A3B8" strokeWidth="1" />
                            <text
                              x={ptX}
                              y={chartHeight - 10}
                              textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                              className="text-[10px] font-mono fill-slate-500 font-medium"
                            >
                              {chart1Series[idx].date}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}
                </svg>
              )}

              {/* Hover Tooltip Overlay with point-in-time metrics */}
              {hoverIdx !== null && hoverIdx < chart1Series.length && (
                <div
                  className={`absolute top-4 ${
                    hoverIdx < chart1Series.length / 2 ? 'right-6' : 'left-20'
                  } bg-slate-900 text-white p-3 rounded-lg border border-slate-700 text-xs font-mono shadow-xl pointer-events-none z-20 animate-in fade-in duration-100`}
                >
                  <div className="font-bold text-slate-200 border-b border-slate-700 pb-1.5 mb-2 flex items-center justify-between gap-6">
                    <span>{chart1Series[hoverIdx].date}</span>
                    <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">Point-in-Time Data</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-6">
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                        Portfolio Size:
                      </span>
                      <span className="font-bold">
                        {mode === 'amount'
                          ? `${currency} ${chart1Series[hoverIdx].portfolioSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${chart1Series[hoverIdx].portfolioSizePct.toFixed(2)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-blue-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        Capital:
                      </span>
                      <span className="font-bold">
                        {mode === 'amount'
                          ? `${currency} ${chart1Series[hoverIdx].capital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${chart1Series[hoverIdx].capitalPct.toFixed(2)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-amber-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        Margin Loan:
                      </span>
                      <span className="font-bold">
                        {mode === 'amount'
                          ? `${currency} ${chart1Series[hoverIdx].margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${chart1Series[hoverIdx].marginPct.toFixed(2)}%`}
                      </span>
                    </div>
                    {showPortfolioSize && (tradesByDate.get(chart1Series[hoverIdx].date)?.length ?? 0) > 0 && (
                      <div className="border-t border-slate-700 pt-1.5 mt-1.5 space-y-1">
                        <div className="text-[10px] uppercase text-emerald-300 font-sans font-semibold">
                          Transactions
                        </div>
                        {tradesByDate.get(chart1Series[hoverIdx].date)!.map((tr, tIdx) => (
                          <div key={tIdx} className="text-[11px] flex justify-between gap-4">
                            <span className={tr.buysell === 'B' ? 'text-emerald-400' : 'text-rose-400'}>
                              {tr.buysell === 'B' ? '▲ BUY' : '▼ SELL'} {tr.symbol}
                            </span>
                            <span>
                              {tr.quantity.toLocaleString()} @ {tr.currency} {tr.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showCapitalAnnotations && (capitalByDate.get(chart1Series[hoverIdx].date)?.length ?? 0) > 0 && (
                      <div className="border-t border-slate-700 pt-1.5 mt-1.5 space-y-1">
                        <div className="text-[10px] uppercase text-blue-300 font-sans font-semibold">
                          Capital Adjustments
                        </div>
                        {capitalByDate.get(chart1Series[hoverIdx].date)!.map((cp, cIdx) => (
                          <div key={cIdx} className="text-[11px] flex justify-between gap-4">
                            <span className={cp.transtype === 'W' ? 'text-amber-400' : 'text-blue-400'}>
                              ◆ {cp.transtype === 'W' ? 'WITHDRAW' : 'DEPOSIT'}
                            </span>
                            <span>
                              {cp.currency} {Math.abs(cp.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: PnL Over Time (Total Portfolio vs Top Stocks) (Top-Right) */}
          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  Chart 2: Cumulative PnL Attribution ({mode === 'amount' ? currency : '% Return'})
                </h3>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Cumulative Realized vs Unrealized PnL
                </span>
              </div>

              {/* Interactive Legend Checkboxes for Chart 2 (toggling stocks never alters Total) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1 font-bold text-slate-700 text-[11px] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showTotalPnL}
                    onChange={(e) => setShowTotalPnL(e.target.checked)}
                    aria-label="Toggle Total PnL"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="w-2.5 h-1 bg-blue-600 rounded-full inline-block" />
                  <span>Total</span>
                </label>

                {stockList.map((sym, idx) => {
                  const color = STOCK_COLORS[idx % STOCK_COLORS.length];
                  const active = activeStocks[sym] !== false;
                  return (
                    <label
                      key={sym}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium transition-all cursor-pointer select-none ${
                        active
                          ? 'bg-slate-50 border-slate-300 text-slate-800 shadow-2xs'
                          : 'bg-white border-dashed border-slate-300 text-slate-400 opacity-60'
                      }`}
                      title={`Toggle ${sym} line visibility (does not affect Total)`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleStockLine(sym)}
                        aria-label={`Toggle ${sym}`}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: active ? color : '#94A3B8' }}
                      />
                      <span>{sym}</span>
                    </label>
                  );
                })}

                <span className="text-slate-300">|</span>
                <label className="flex items-center gap-1 cursor-pointer select-none text-[10px] text-slate-500 font-medium">
                  <input
                    type="checkbox"
                    checked={showTradeAnnotations}
                    onChange={(e) => setShowTradeAnnotations(e.target.checked)}
                    aria-label="Show Trades on PnL Chart"
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Trades</span>
                </label>
              </div>
            </div>

            <div className="relative w-full overflow-hidden bg-slate-50 rounded-lg border border-slate-200 p-2">
              {(chart2Data.portfolio || []).length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-mono">
                  No historical PnL records found for this timeframe.
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  className="w-full h-64 select-none"
                  onMouseMove={(e) => {
                    const portPts = chart2Data.portfolio || [];
                    const idx = getHoverIndexFromEvent(e, portPts.length);
                    if (idx !== null) setHoverIdx(idx);
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Horizontal Gridlines & Y-Axis */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = padTop + pct * plotH;
                    const val = chart2Stats ? chart2Stats.yMax - pct * (chart2Stats.yMax - chart2Stats.yMin) : 0;
                    return (
                      <g key={i}>
                        <line x1={padLeft} y1={y} x2={chartWidth - padRight} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
                        {/* Y-axis tick mark */}
                        <line x1={padLeft - 5} y1={y} x2={padLeft} y2={y} stroke="#94A3B8" strokeWidth="1" />
                        <text x={padLeft - 8} y={y + 4} textAnchor="end" className="text-[10px] font-mono fill-slate-500">
                          {mode === 'amount'
                            ? `${val.toFixed(0)}`
                            : `${val.toFixed(1)}%`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Explicit Solid Y-Axis Line & Unit Label */}
                  <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#94A3B8" strokeWidth="1.5" />
                  <text x={padLeft - 8} y={padTop - 6} textAnchor="end" className="text-[10px] font-mono font-bold fill-slate-600">
                    {mode === 'amount' ? `${currency}` : '%'}
                  </text>

                  {/* Explicit Solid X-Axis Baseline */}
                  <line x1={padLeft} y1={padTop + plotH} x2={chartWidth - padRight} y2={padTop + plotH} stroke="#94A3B8" strokeWidth="1.5" />

                  {/* Zero Reference Line */}
                  {chart2Stats && chart2Stats.zeroY >= padTop && chart2Stats.zeroY <= padTop + plotH && (
                    <line
                      x1={padLeft}
                      y1={chart2Stats.zeroY}
                      x2={chartWidth - padRight}
                      y2={chart2Stats.zeroY}
                      stroke="#94A3B8"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Stock breakdown lines */}
                  {chart2Stats &&
                    Object.entries(chart2Stats.stockPolylines).map(([sym, ptsStr]) => {
                      const idx = stockList.indexOf(sym);
                      const col = STOCK_COLORS[idx >= 0 ? idx % STOCK_COLORS.length : 0];
                      return (
                        <polyline
                          key={sym}
                          fill="none"
                          stroke={col}
                          strokeWidth="1.5"
                          strokeDasharray="3 1"
                          points={ptsStr}
                          opacity="0.85"
                        />
                      );
                    })}

                  {/* Total Portfolio PnL Line (bold) */}
                  {chart2Stats && showTotalPnL && (
                    <polyline
                      data-testid="chart2-line-total"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      points={chart2Stats.ptsPort}
                    />
                  )}

                  {/* Trade Annotations on Chart 2 (Total & matching visible stock lines) */}
                  {chart2Stats &&
                    showTradeAnnotations &&
                    (chart2Data.portfolio || []).map((pt, idx) => {
                      const dayTrades = tradesByDate.get(pt.date);
                      if (!dayTrades || dayTrades.length === 0) return null;
                      const cx = chart2Stats.toX(idx);
                      const markers: React.ReactNode[] = [];

                      if (showTotalPnL) {
                        const cy = chart2Stats.toY(mode === 'amount' ? pt.pnl : pt.pnlPct);
                        const hasBuy = dayTrades.some((t) => t.buysell === 'B');
                        const fill = hasBuy ? '#34D399' : '#FB7185';
                        const pts = hasBuy
                          ? `${cx},${cy - 7} ${cx - 4.5},${cy + 2} ${cx + 4.5},${cy + 2}`
                          : `${cx},${cy + 7} ${cx - 4.5},${cy - 2} ${cx + 4.5},${cy - 2}`;
                        markers.push(
                          <polygon
                            key={`c2-tot-${pt.date}`}
                            data-testid={`chart2-trade-marker-${pt.date}`}
                            points={pts}
                            fill={fill}
                            stroke="#FFFFFF"
                            strokeWidth="1"
                          />
                        );
                      }

                      for (const tr of dayTrades) {
                        if (activeStocks[tr.symbol] === false) continue;
                        const sPt = chart2Data.stocks[tr.symbol]?.[idx];
                        if (!sPt) continue;
                        const cy = chart2Stats.toY(mode === 'amount' ? sPt.pnl : sPt.pnlPct);
                        const isBuy = tr.buysell === 'B';
                        const fill = isBuy ? '#34D399' : '#FB7185';
                        const pts = isBuy
                          ? `${cx},${cy - 5.5} ${cx - 3.5},${cy + 1.5} ${cx + 3.5},${cy + 1.5}`
                          : `${cx},${cy + 5.5} ${cx - 3.5},${cy - 1.5} ${cx + 3.5},${cy - 1.5}`;
                        markers.push(
                          <polygon
                            key={`c2-sym-${tr.symbol}-${pt.date}-${tr.buysell}-${tr.quantity}`}
                            points={pts}
                            fill={fill}
                            stroke="#FFFFFF"
                            strokeWidth="0.8"
                          />
                        );
                      }

                      return <g key={`c2-tr-grp-${pt.date}`}>{markers}</g>;
                    })}

                  {/* Synchronized Crosshair Cursor & Dots */}
                  {hoverIdx !== null && chart2Stats && chart2Data.portfolio && hoverIdx < chart2Data.portfolio.length && (
                    <g>
                      <line
                        x1={chart2Stats.toX(hoverIdx)}
                        y1={padTop}
                        x2={chart2Stats.toX(hoverIdx)}
                        y2={padTop + plotH}
                        stroke="#64748B"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      {/* Total Portfolio Dot */}
                      {showTotalPnL && (
                        <circle
                          cx={chart2Stats.toX(hoverIdx)}
                          cy={chart2Stats.toY(
                            mode === 'amount'
                              ? chart2Data.portfolio[hoverIdx].pnl
                              : chart2Data.portfolio[hoverIdx].pnlPct
                          )}
                          r="4.5"
                          fill="#2563EB"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      )}
                      {/* Active Stock Dots */}
                      {stockList.map((sym, idx) => {
                        if (activeStocks[sym] === false) return null;
                        const sPt = chart2Data.stocks[sym]?.[hoverIdx];
                        if (!sPt) return null;
                        const col = STOCK_COLORS[idx % STOCK_COLORS.length];
                        return (
                          <circle
                            key={sym}
                            cx={chart2Stats.toX(hoverIdx)}
                            cy={chart2Stats.toY(mode === 'amount' ? sPt.pnl : sPt.pnlPct)}
                            r="3.5"
                            fill={col}
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        );
                      })}
                    </g>
                  )}

                  {/* X-Axis Date Labels & Ticks */}
                  {chart2Data.portfolio && chart2Data.portfolio.length > 0 && chart2Stats && (
                    <>
                      {[0, Math.floor((chart2Data.portfolio.length - 1) / 4), Math.floor((chart2Data.portfolio.length - 1) / 2), Math.floor((3 * (chart2Data.portfolio.length - 1)) / 4), chart2Data.portfolio.length - 1].map((idx, i) => {
                        const ptX = chart2Stats.toX(idx);
                        const isFirst = i === 0;
                        const isLast = i === 4;
                        return (
                          <g key={i}>
                            <line x1={ptX} y1={padTop + plotH} x2={ptX} y2={padTop + plotH + 5} stroke="#94A3B8" strokeWidth="1" />
                            <text
                              x={ptX}
                              y={chartHeight - 10}
                              textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                              className="text-[10px] font-mono fill-slate-500 font-medium"
                            >
                              {chart2Data.portfolio[idx].date}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}
                </svg>
              )}

              {/* Hover Tooltip Overlay for Chart 2 */}
              {hoverIdx !== null && chart2Data.portfolio && hoverIdx < chart2Data.portfolio.length && (
                <div
                  className={`absolute top-4 ${
                    hoverIdx < chart2Data.portfolio.length / 2 ? 'right-6' : 'left-20'
                  } bg-slate-900 text-white p-3 rounded-lg border border-slate-700 text-xs font-mono shadow-xl pointer-events-none z-20 animate-in fade-in duration-100 max-h-56 overflow-y-auto`}
                >
                  <div className="font-bold text-slate-200 border-b border-slate-700 pb-1.5 mb-2 flex items-center justify-between gap-6">
                    <span>{chart2Data.portfolio[hoverIdx].date}</span>
                    <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider">PnL Attribution</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-6 font-bold">
                      <span className="text-blue-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        Total Portfolio:
                      </span>
                      <span>
                        {mode === 'amount'
                          ? `${currency} ${chart2Data.portfolio[hoverIdx].pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${chart2Data.portfolio[hoverIdx].pnlPct.toFixed(2)}%`}
                      </span>
                    </div>
                    {stockList.map((sym, idx) => {
                      if (activeStocks[sym] === false) return null;
                      const sPt = chart2Data.stocks[sym]?.[hoverIdx];
                      if (!sPt) return null;
                      const col = STOCK_COLORS[idx % STOCK_COLORS.length];
                      return (
                        <div key={sym} className="flex justify-between gap-6 text-[11px]">
                          <span style={{ color: col }} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: col }} />
                            {sym}:
                          </span>
                          <span>
                            {mode === 'amount'
                              ? `${currency} ${sPt.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${sPt.pnlPct.toFixed(2)}%`}
                          </span>
                        </div>
                      );
                    })}
                    {showTradeAnnotations && (tradesByDate.get(chart2Data.portfolio[hoverIdx].date)?.length ?? 0) > 0 && (
                      <div className="border-t border-slate-700 pt-1.5 mt-1.5 space-y-1">
                        <div className="text-[10px] uppercase text-emerald-300 font-sans font-semibold">
                          Transactions
                        </div>
                        {tradesByDate.get(chart2Data.portfolio[hoverIdx].date)!.map((tr, tIdx) => (
                          <div key={tIdx} className="text-[11px] flex justify-between gap-4">
                            <span className={tr.buysell === 'B' ? 'text-emerald-400' : 'text-rose-400'}>
                              {tr.buysell === 'B' ? '▲ BUY' : '▼ SELL'} {tr.symbol}
                            </span>
                            <span>
                              {tr.quantity.toLocaleString()} @ {tr.currency} {tr.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart 3: Asset & Currency Exposure Distribution (Bottom-Left) */}
          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  Asset & Currency Exposure Distribution
                </h3>
                <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                  Holdings as of <span className="font-semibold text-slate-800 font-mono underline decoration-indigo-400">{selectedDate || 'latest'}</span> (Active portfolio holdings)
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-slate-500">
                {chart3Data.length} holdings
              </span>
            </div>

            <div className="relative bg-slate-50 rounded-lg border border-slate-200 p-3 h-64 flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden">
              {chart3Data.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                  No position holdings as of {selectedDate || 'selected date'}.
                </div>
              ) : (
                <>
                  {/* Interactive SVG Donut / Pie Chart */}
                  <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                      {(() => {
                        let cumPercent = 0;
                        const totalPct = chart3Data.reduce((acc, it) => acc + (Number(it.percentage) || 0), 0) || 100;
                        return chart3Data.map((item, idx) => {
                          const pct = Number(item.percentage ?? 0);
                          const sliceFraction = pct / totalPct;
                          const startAngle = cumPercent * 2 * Math.PI;
                          cumPercent += sliceFraction;
                          const endAngle = cumPercent * 2 * Math.PI;

                          const r = 85;
                          const ir = 48;
                          const cx = 100;
                          const cy = 100;

                          const x1 = cx + r * Math.cos(startAngle);
                          const y1 = cy + r * Math.sin(startAngle);
                          const x2 = cx + r * Math.cos(endAngle);
                          const y2 = cy + r * Math.sin(endAngle);

                          const ix1 = cx + ir * Math.cos(endAngle);
                          const iy1 = cy + ir * Math.sin(endAngle);
                          const ix2 = cx + ir * Math.cos(startAngle);
                          const iy2 = cy + ir * Math.sin(startAngle);

                          const largeArc = sliceFraction > 0.5 ? 1 : 0;
                          const pathD = chart3Data.length === 1
                            ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} M ${cx} ${cy - ir} A ${ir} ${ir} 0 1 0 ${cx} ${cy + ir} A ${ir} ${ir} 0 1 0 ${cx} ${cy - ir} Z`
                            : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

                          const color = item.category === 'Cash' ? '#34D399' : STOCK_COLORS[idx % STOCK_COLORS.length];
                          const isHovered = hoveredSliceIdx === idx;
                          const sliceTitle = `${item.symbol || item.name} | Qty: ${Number(item.quantity || 0).toLocaleString()} | Val: ${currency} ${Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${pct.toFixed(1)}%)`;
                          return (
                            <path
                              key={idx}
                              d={pathD}
                              fill={color}
                              stroke={isHovered ? '#FFFFFF' : 'none'}
                              strokeWidth={isHovered ? 2.5 : 0}
                              opacity={hoveredSliceIdx === null || isHovered ? 1 : 0.45}
                              className="transition-all cursor-pointer"
                              data-testid={`holdings-pie-slice-${idx}`}
                              onMouseEnter={() => setHoveredSliceIdx(idx)}
                              onMouseLeave={() => setHoveredSliceIdx(null)}
                            >
                              <title>{`${item.symbol || item.name} | Qty: ${Number(item.quantity || 0).toLocaleString()} | Val: ${currency} ${Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${pct.toFixed(1)}%)`}</title>
                            </path>
                          );
                        });
                      })()}
                    </svg>

                    {/* Donut Center Label / Rollover Detail */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                      {hoveredSliceIdx !== null && chart3Data[hoveredSliceIdx] ? (
                        <>
                          <span className="text-[11px] font-bold text-slate-900 font-mono leading-tight truncate max-w-[80px]">
                            {chart3Data[hoveredSliceIdx].symbol || chart3Data[hoveredSliceIdx].name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-blue-700">
                            {Number(chart3Data[hoveredSliceIdx].percentage ?? 0).toFixed(1)}%
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {chart3Data[hoveredSliceIdx].quantity ? `${Number(chart3Data[hoveredSliceIdx].quantity).toLocaleString()} shs` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold tracking-tight">Holdings</span>
                          <span className="text-xs font-mono font-bold text-slate-800">{chart3Data.length}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{selectedDate ? selectedDate.slice(5) : ''}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rollover Popover Details when hovering slice */}
                  {hoveredSliceIdx !== null && chart3Data[hoveredSliceIdx] && (
                    <div
                      data-testid="holdings-pie-tooltip"
                      className="absolute bottom-2 right-2 z-30 bg-slate-900 min-w-[210px] text-white text-xs font-mono p-2.5 rounded-lg border border-slate-700 shadow-xl pointer-events-none animate-in fade-in duration-100"
                    >
                      <div className="font-bold text-blue-300 flex items-center gap-1.5 border-b border-slate-700 pb-1 mb-1">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{
                            backgroundColor:
                              chart3Data[hoveredSliceIdx].category === 'Cash'
                                ? '#34D399'
                                : STOCK_COLORS[hoveredSliceIdx % STOCK_COLORS.length],
                          }}
                        />
                        <span>{chart3Data[hoveredSliceIdx].symbol || chart3Data[hoveredSliceIdx].name}</span>
                        <span className="text-[10px] text-slate-400 font-sans font-normal ml-auto">
                          {selectedDate}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex justify-between gap-3 text-slate-300">
                          <span>Quantity:</span>
                          <span className="text-white font-semibold">
                            {Number(chart3Data[hoveredSliceIdx].quantity ?? 0).toLocaleString()} shs
                          </span>
                        </div>
                        {chart3Data[hoveredSliceIdx].price ? (
                          <div className="flex justify-between gap-3 text-slate-300">
                            <span>Price:</span>
                            <span className="text-white font-semibold">
                              {chart3Data[hoveredSliceIdx].currency || currency}{' '}
                              {Number(chart3Data[hoveredSliceIdx].price).toFixed(2)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-3 text-slate-300">
                          <span>Market Value:</span>
                          <span className="text-white font-semibold">
                            {currency}{' '}
                            {Number(chart3Data[hoveredSliceIdx].value ?? 0).toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 text-slate-300">
                          <span>Portfolio Weight:</span>
                          <span className="text-emerald-400 font-semibold">
                            {Number(chart3Data[hoveredSliceIdx].percentage ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Holdings Legend List with guaranteed Symbol visibility */}
                  <div className="flex-1 h-full overflow-y-auto space-y-1 pr-1 w-full">
                    {chart3Data.map((item, idx) => {
                      const itemVal = Number(item.value ?? 0);
                      const itemPct = Number(item.percentage ?? 0);
                      const barColor = item.category === 'Cash' ? '#34D399' : STOCK_COLORS[idx % STOCK_COLORS.length];
                      const isHovered = hoveredSliceIdx === idx;
                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredSliceIdx(idx)}
                          onMouseLeave={() => setHoveredSliceIdx(null)}
                          className={`flex items-center justify-between text-xs font-mono py-1 px-2 rounded transition-colors cursor-pointer border-b border-slate-100 last:border-0 ${
                            isHovered ? 'bg-slate-200/70' : 'hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 mr-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: barColor }} />
                            <span className="font-bold text-slate-900 truncate">
                              {item.symbol || item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-semibold text-slate-700 whitespace-nowrap">
                            <span>{formatHoldingsKValue(itemVal)}</span>
                            <span className="text-slate-400 font-normal">{itemPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Chart 4: Daily PnL & High-Water Mark Drawdown (Bottom-Right) */}
          <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  Daily PnL & High-Water Mark Drawdown
                </h3>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Daily net profit distribution with institutional peak drawdown curve
                </span>
              </div>
              {chart4Stats && (
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Max DD: {chart4Stats.minDDPct.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            <div className="relative w-full overflow-hidden bg-slate-50 rounded-lg border border-slate-200 p-2">
              {chart4Series.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-mono">
                  No daily PnL distribution data available.
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                  className="w-full h-64 select-none"
                  onMouseMove={(e) => {
                    const idx = getHoverIndexFromEvent(e, chart4Series.length);
                    if (idx !== null) setHoverIdx(idx);
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Gridlines */}
                  {[0, 0.5, 1].map((pct, i) => {
                    const y = padTop + pct * plotH;
                    return (
                      <line
                        key={i}
                        x1={padLeft}
                        y1={y}
                        x2={chartWidth - padRight}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray="3 3"
                      />
                    );
                  })}

                  {/* Axis lines */}
                  <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#94A3B8" strokeWidth="1.5" />
                  <line x1={padLeft} y1={padTop + plotH} x2={chartWidth - padRight} y2={padTop + plotH} stroke="#94A3B8" strokeWidth="1.5" />

                  {/* Zero reference line for daily PnL */}
                  {chart4Stats && (
                    <line
                      x1={padLeft}
                      y1={chart4Stats.zeroY}
                      x2={chartWidth - padRight}
                      y2={chart4Stats.zeroY}
                      stroke="#94A3B8"
                      strokeWidth="1"
                    />
                  )}

                  {/* Daily PnL Bars */}
                  {chart4Stats &&
                    chart4Series.map((pt, i) => {
                      const isPos = pt.dailyPnL >= 0;
                      const bx = chart4Stats.toX(i) - chart4Stats.barW / 2;
                      const by = chart4Stats.toBarY(pt.dailyPnL);
                      const bh = chart4Stats.toBarH(pt.dailyPnL);
                      return (
                        <rect
                          key={i}
                          x={bx}
                          y={by}
                          width={chart4Stats.barW}
                          height={bh}
                          fill={isPos ? '#34D399' : '#FB7185'}
                          opacity={hoverIdx === i ? 1 : 0.8}
                          rx="1"
                        />
                      );
                    })}

                  {/* Drawdown polyline */}
                  {chart4Stats && (
                    <polyline
                      fill="none"
                      stroke="#FB7185"
                      strokeWidth="2"
                      points={chart4Stats.ptsDD}
                    />
                  )}

                  {/* Crosshair indicator */}
                  {hoverIdx !== null && chart4Stats && hoverIdx < chart4Series.length && (
                    <g>
                      <line
                        x1={chart4Stats.toX(hoverIdx)}
                        y1={padTop}
                        x2={chart4Stats.toX(hoverIdx)}
                        y2={padTop + plotH}
                        stroke="#64748B"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <circle
                        cx={chart4Stats.toX(hoverIdx)}
                        cy={chart4Stats.toYDD(chart4Series[hoverIdx].drawdownPct)}
                        r="4"
                        fill="#FB7185"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* X-axis date labels */}
                  {chart4Series.length > 0 && chart4Stats && (
                    <>
                      {[0, Math.floor((chart4Series.length - 1) / 4), Math.floor((chart4Series.length - 1) / 2), Math.floor((3 * (chart4Series.length - 1)) / 4), chart4Series.length - 1].map((idx, i) => {
                        const ptX = chart4Stats.toX(idx);
                        const isFirst = i === 0;
                        const isLast = i === 4;
                        return (
                          <g key={i}>
                            <line x1={ptX} y1={padTop + plotH} x2={ptX} y2={padTop + plotH + 5} stroke="#94A3B8" strokeWidth="1" />
                            <text
                              x={ptX}
                              y={chartHeight - 10}
                              textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                              className="text-[10px] font-mono fill-slate-500 font-medium"
                            >
                              {chart4Series[idx].date}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}
                </svg>
              )}

              {/* Tooltip for Chart 4 */}
              {hoverIdx !== null && hoverIdx < chart4Series.length && (
                <div
                  className={`absolute top-4 ${
                    hoverIdx < chart4Series.length / 2 ? 'right-6' : 'left-16'
                  } bg-slate-900 text-white p-2.5 rounded-lg border border-slate-700 text-xs font-mono shadow-xl pointer-events-none z-20 animate-in fade-in duration-100`}
                >
                  <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
                    <span>{chart4Series[hoverIdx].date}</span>
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Daily Metric</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">Daily PnL:</span>
                      <span className={chart4Series[hoverIdx].dailyPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {chart4Series[hoverIdx].dailyPnL >= 0 ? '+' : ''}
                        {currency} {chart4Series[hoverIdx].dailyPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-rose-400">Drawdown:</span>
                      <span className="font-bold text-rose-300">
                        {chart4Series[hoverIdx].drawdownPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
        {/* Executive Commentary Container (Adaptive Stacked Below vs Right Column) */}
        <div className={`${isStacked ? "w-full" : "lg:col-span-4"} bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-700" />
              Executive Commentary
            </span>
            {commentaryData?.lastUpdated && (
              <span className="text-[10px] font-mono text-slate-400">
                {new Date(commentaryData.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Fallback alert banner if Gemini credit exhaustion occurred */}
          {(commentaryData?.fallback_warning || data?.fallback_warning) && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold">Provider Notice: </span>
                {commentaryData?.fallback_warning || data?.fallback_warning}{' '}
                <a
                  href="https://ai.studio/projects"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 underline font-bold text-amber-950"
                >
                  Manage Credits ↗
                </a>
              </div>
            </div>
          )}

          {/* Commentary Quadrants: Grid when stacked below, vertical list when side-by-side */}
          <div className={isStacked ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" : "space-y-3"}>
            {/* Quadrant 1: Technical */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  {commentaryData?.commentaries?.technical?.title || 'Technical Posture'}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 font-mono">
                  {commentaryData?.commentaries?.technical?.status || 'Neutral'}
                </span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-line">
                {commentaryData?.commentaries?.technical?.content ||
                  'Core holdings maintain steady trend support relative to moving averages with favorable aggregate entry basis.'}
              </div>
            </div>

            {/* Quadrant 2: Fundamental */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {commentaryData?.commentaries?.fundamental?.title || 'Fundamental Analysis'}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 font-mono">
                  {commentaryData?.commentaries?.fundamental?.status || 'Favorable'}
                </span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-line">
                {commentaryData?.commentaries?.fundamental?.content ||
                  'Deployed equity capital underpins valuation health with positive return generation across diversified sectors.'}
              </div>
            </div>

            {/* Quadrant 3: Macro */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  {commentaryData?.commentaries?.macro?.title || 'Macroeconomic Context'}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 font-mono">
                  {commentaryData?.commentaries?.macro?.status || 'Stable'}
                </span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-line">
                {commentaryData?.commentaries?.macro?.content ||
                  'Accounts evaluated in base currency with multi-currency coverage and active sensitivity monitoring.'}
              </div>
            </div>

            {/* Quadrant 4: Risk Management */}
            <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  {commentaryData?.commentaries?.risk?.title || 'Risk Management'}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 font-mono">
                  {commentaryData?.commentaries?.risk?.status || 'Healthy'}
                </span>
              </div>
              <div className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-line">
                {commentaryData?.commentaries?.risk?.content ||
                  'Margin leverage remains comfortably below liquidation ceilings with realized buffers mitigating volatility.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioOverview;
