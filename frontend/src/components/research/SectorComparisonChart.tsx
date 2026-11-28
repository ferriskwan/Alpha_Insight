import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, RefreshCw, Layers, CheckSquare, Square, Info } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { OhlcvValue } from '../../types/api';

export interface SectorComparisonChartProps {
  initialSymbols?: string[];
  activeSector?: string;
  className?: string;
}

const COMPARISON_SYMBOLS: { ticker: string; name: string; isBenchmark?: boolean }[] = [
  { ticker: 'SPY', name: 'S&P 500 Benchmark', isBenchmark: true },
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

export const SYMBOL_COLORS: Record<string, string> = {
  SPY: '#0F172A', // Slate 900
  XLK: '#2563EB', // Blue 600
  XLF: '#047857', // Emerald 700
  XLV: '#7C3AED', // Violet 600
  XLE: '#D97706', // Amber 600
  XLI: '#FBBF24', // Amber 400
  XLC: '#FB7185', // Rose 400
  XLY: '#B91C1C', // Red 700
  XLP: '#34D399', // Emerald 400
  XLB: '#818CF8', // Indigo 400
  XLU: '#0284C7', // Sky 600
  XLRE: '#1D4ED8', // Blue 700
};

export const SectorComparisonChart: React.FC<SectorComparisonChartProps> = ({
  initialSymbols = ['SPY', 'XLK'],
  activeSector,
  className = '',
}) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(initialSymbols);
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y'>('3M');
  const [cache, setCache] = useState<Record<string, OhlcvValue[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [hoverDateIdx, setHoverDateIdx] = useState<number | null>(null);

  // Sync activeSector into selectedSymbols if changed from parent
  useEffect(() => {
    if (activeSector && !selectedSymbols.includes(activeSector)) {
      setSelectedSymbols((prev) => [...prev, activeSector]);
    }
  }, [activeSector]);

  // Load EOD data for selected symbols that are missing from cache
  useEffect(() => {
    let isMounted = true;
    const missing = selectedSymbols.filter((sym) => !cache[sym]);
    if (missing.length === 0) return;

    setLoading(true);
    Promise.all(
      missing.map(async (sym) => {
        try {
          const res = await apiClient.getWatchlistData(sym);
          const vals = res?.eodData?.values || [];
          return { sym, vals };
        } catch {
          return { sym, vals: [] };
        }
      })
    )
      .then((results) => {
        if (!isMounted) return;
        setCache((prev) => {
          const next = { ...prev };
          for (const r of results) {
            next[r.sym] = r.vals;
          }
          return next;
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSymbols, cache]);

  const toggleSymbol = (ticker: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(ticker)
        ? prev.length > 1
          ? prev.filter((s) => s !== ticker)
          : prev
        : [...prev, ticker]
    );
  };

  const handleSelectAllSectors = () => {
    setSelectedSymbols(COMPARISON_SYMBOLS.map((s) => s.ticker));
  };

  const handleResetToBenchmark = () => {
    setSelectedSymbols(['SPY', activeSector || 'XLK']);
  };

  // Determine calendar cut-off date based on timeframe
  const cutoffDate = useMemo(() => {
    const d = new Date();
    if (timeframe === '1M') d.setMonth(d.getMonth() - 1);
    else if (timeframe === '3M') d.setMonth(d.getMonth() - 3);
    else if (timeframe === '6M') d.setMonth(d.getMonth() - 6);
    else if (timeframe === '1Y') d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, [timeframe]);

  // Normalize multi-symbol price series into % change from t0
  const normalizedData = useMemo(() => {
    // 1. Gather all unique dates within timeframe
    const datesSet = new Set<string>();
    const symbolSeries: Record<string, Map<string, number>> = {};

    for (const sym of selectedSymbols) {
      const vals = cache[sym] || [];
      const map = new Map<string, number>();
      for (const v of vals) {
        const dt = String(v.date || v.datetime || '').slice(0, 10);
        const cls = Number(v.close || 0);
        if (dt && dt >= cutoffDate && cls > 0) {
          datesSet.add(dt);
          map.set(dt, cls);
        }
      }
      symbolSeries[sym] = map;
    }

    const sortedDates = Array.from(datesSet).sort();
    if (sortedDates.length === 0) {
      return { dates: [], returns: {}, minPct: 0, maxPct: 0 };
    }

    // 2. Base date t0 is the earliest available date
    const returns: Record<string, { date: string; pct: number }[]> = {};
    let globalMin = 0;
    let globalMax = 0;

    for (const sym of selectedSymbols) {
      const map = symbolSeries[sym];
      // Find base price P0 as earliest valid date in sortedDates
      let p0: number | null = null;
      for (const dt of sortedDates) {
        if (map.has(dt)) {
          p0 = map.get(dt)!;
          break;
        }
      }

      if (!p0 || p0 <= 0) {
        returns[sym] = [];
        continue;
      }

      const symReturns: { date: string; pct: number }[] = [];
      let lastKnownPct = 0;

      for (const dt of sortedDates) {
        if (map.has(dt)) {
          const p = map.get(dt)!;
          const pct = ((p - p0) / p0) * 100;
          symReturns.push({ date: dt, pct });
          lastKnownPct = pct;
          if (pct < globalMin) globalMin = pct;
          if (pct > globalMax) globalMax = pct;
        } else {
          // Carry forward last known pct to prevent breaks in sparse series
          symReturns.push({ date: dt, pct: lastKnownPct });
        }
      }
      returns[sym] = symReturns;
    }

    return {
      dates: sortedDates,
      returns,
      minPct: Math.floor(globalMin - 2),
      maxPct: Math.ceil(globalMax + 2),
    };
  }, [selectedSymbols, cache, cutoffDate]);

  // SVG Chart Geometry
  const chartW = 860;
  const chartH = 290;
  const padL = 48;
  const padR = 24;
  const padT = 20;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const yRange = Math.max(10, normalizedData.maxPct - normalizedData.minPct);
  const toX = (idx: number) => {
    if (normalizedData.dates.length <= 1) return padL;
    return padL + (idx / (normalizedData.dates.length - 1)) * plotW;
  };

  const toY = (pct: number) => {
    const norm = (pct - normalizedData.minPct) / yRange;
    return padT + plotH - norm * plotH;
  };

  const zeroY = toY(0);

  // Crosshair coordinate on mouse move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (normalizedData.dates.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartW;
    if (mouseX < padL || mouseX > chartW - padR) {
      setHoverDateIdx(null);
      return;
    }
    const ratio = (mouseX - padL) / plotW;
    const idx = Math.round(ratio * (normalizedData.dates.length - 1));
    setHoverDateIdx(Math.max(0, Math.min(normalizedData.dates.length - 1, idx)));
  };

  return (
    <div className={`space-y-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs ${className}`}>
      {/* Top Header: Controls & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">Multi-Index Relative % Performance</h3>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
            Normalized percentage movement from base date (0.0% baseline)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick preset actions */}
          <button
            type="button"
            onClick={handleSelectAllSectors}
            className="text-[11px] font-semibold text-slate-600 hover:text-blue-700 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            All 11 Sectors
          </button>
          <button
            type="button"
            onClick={handleResetToBenchmark}
            className="text-[11px] font-semibold text-slate-600 hover:text-blue-700 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            SPY vs Sector
          </button>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {(['1M', '3M', '6M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-md font-mono font-bold transition-all cursor-pointer ${
                  timeframe === tf ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Index Toggle Pills Strip */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {COMPARISON_SYMBOLS.map((s) => {
          const isSelected = selectedSymbols.includes(s.ticker);
          const color = SYMBOL_COLORS[s.ticker] || '#64748B';
          return (
            <button
              key={s.ticker}
              type="button"
              onClick={() => toggleSymbol(s.ticker)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-slate-50 border-slate-400 font-bold text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 opacity-60'
              }`}
              title={`${s.ticker} — ${s.name}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: isSelected ? color : '#CBD5E1' }}
              />
              <span>{s.ticker}</span>
              {s.isBenchmark && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-sans font-semibold">
                  BM
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Chart Canvas */}
      <div className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {normalizedData.dates.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400 font-mono">
            {loading ? 'Ingesting historical sector performance...' : 'No historical data available for selected horizon.'}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-auto select-none cursor-crosshair block"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverDateIdx(null)}
          >
            {/* Grid Lines & Y-Axis Labels */}
            {[-20, -10, -5, 0, 5, 10, 20, 30].map((level) => {
              if (level < normalizedData.minPct || level > normalizedData.maxPct) return null;
              const y = toY(level);
              const isZero = level === 0;
              return (
                <g key={level}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={chartW - padR}
                    y2={y}
                    stroke={isZero ? '#475569' : '#E2E8F0'}
                    strokeWidth={isZero ? 1.5 : 1}
                    strokeDasharray={isZero ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    className={`text-[10px] font-mono ${isZero ? 'fill-slate-800 font-bold' : 'fill-slate-400'}`}
                  >
                    {level >= 0 ? `+${level}%` : `${level}%`}
                  </text>
                </g>
              );
            })}

            {/* Solid X-Axis Baseline */}
            <line x1={padL} y1={chartH - padB} x2={chartW - padR} y2={chartH - padB} stroke="#94A3B8" strokeWidth="1" />

            {/* Sector Performance Curves */}
            {selectedSymbols.map((sym) => {
              const pts = normalizedData.returns[sym];
              if (!pts || pts.length < 2) return null;
              const color = SYMBOL_COLORS[sym] || '#2563EB';
              const isBm = sym === 'SPY';
              const pathD = pts
                .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt.pct).toFixed(1)}`)
                .join(' ');

              return (
                <path
                  key={sym}
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={isBm ? 2.5 : 1.75}
                  strokeDasharray={isBm ? '4 2' : undefined}
                  opacity={0.9}
                />
              );
            })}

            {/* Interactive Crosshair & Highlight Dots */}
            {hoverDateIdx !== null && hoverDateIdx < normalizedData.dates.length && (
              <g>
                <line
                  x1={toX(hoverDateIdx)}
                  y1={padT}
                  x2={toX(hoverDateIdx)}
                  y2={chartH - padB}
                  stroke="#64748B"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {selectedSymbols.map((sym) => {
                  const pts = normalizedData.returns[sym];
                  if (!pts || hoverDateIdx >= pts.length) return null;
                  const pt = pts[hoverDateIdx];
                  const color = SYMBOL_COLORS[sym] || '#2563EB';
                  return (
                    <circle
                      key={sym}
                      cx={toX(hoverDateIdx)}
                      cy={toY(pt.pct)}
                      r="4"
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            )}

            {/* X-Axis Date Labels */}
            {normalizedData.dates.length > 0 &&
              [
                0,
                Math.floor((normalizedData.dates.length - 1) / 3),
                Math.floor((2 * (normalizedData.dates.length - 1)) / 3),
                normalizedData.dates.length - 1,
              ].map((idx, i) => {
                const dt = normalizedData.dates[idx];
                const x = toX(idx);
                const isFirst = i === 0;
                const isLast = i === 3;
                return (
                  <text
                    key={i}
                    x={x}
                    y={chartH - 12}
                    textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                    className="text-[10px] font-mono fill-slate-500"
                  >
                    {dt}
                  </text>
                );
              })}
          </svg>
        )}

        {/* Hover Crosshair Tooltip */}
        {hoverDateIdx !== null && hoverDateIdx < normalizedData.dates.length && (
          <div
            className={`absolute top-3 ${
              hoverDateIdx < normalizedData.dates.length / 2 ? 'right-4' : 'left-14'
            } bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-2xl text-xs font-mono pointer-events-none z-30 min-w-[210px]`}
          >
            <div className="font-bold text-slate-200 border-b border-slate-700 pb-1.5 mb-2 flex items-center justify-between">
              <span>{normalizedData.dates[hoverDateIdx]}</span>
              <span className="text-[10px] text-slate-400 font-sans uppercase">Relative %</span>
            </div>
            <div className="space-y-1">
              {selectedSymbols
                .map((sym) => {
                  const pts = normalizedData.returns[sym];
                  const pct = pts && hoverDateIdx < pts.length ? pts[hoverDateIdx].pct : 0;
                  return { sym, pct };
                })
                .sort((a, b) => b.pct - a.pct)
                .map(({ sym, pct }) => {
                  const color = SYMBOL_COLORS[sym] || '#94A3B8';
                  const isPos = pct >= 0;
                  return (
                    <div key={sym} className="flex items-center justify-between gap-4 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                        <span className="font-bold">{sym}:</span>
                      </span>
                      <span className={`font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPos ? '+' : ''}
                        {pct.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SectorComparisonChart;
