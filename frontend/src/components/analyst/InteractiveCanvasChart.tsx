import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import { OhlcvValue, TradeRecord } from '../../types/api';
import { DESIGN_TOKENS } from '../../design-system/tokens';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateFibonacciLevels,
  PricePoint,
} from '../../lib/indicators';
import { Layers, Activity } from 'lucide-react';

export interface InteractiveCanvasChartProps {
  values?: OhlcvValue[];
  trades?: TradeRecord[];
  className?: string;
  showIndicators?: boolean;
  chartMode?: 'multiday' | 'intraday';
  fibLookbackBars?: number;
}

const FIFTY_TWO_WEEKS_TRADING_BARS = 252;
const SIX_MONTHS_TRADING_BARS = 126;
const INTRADAY_DEFAULT_BARS = 78;

export const InteractiveCanvasChart: React.FC<InteractiveCanvasChartProps> = ({
  values = [],
  trades = [],
  className,
  showIndicators = true,
  chartMode = 'multiday',
  fibLookbackBars,
}) => {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Normalize and sort OHLCV price points (supporting Multi-day YYYY-MM-DD and Intraday Unix seconds)
  const pricePoints: PricePoint[] = useMemo(() => {
    if (!values.length) return [];
    const seen = new Map<string, PricePoint>();
    for (const v of values) {
      const rawTime = String(v.date || v.datetime || v.timestamp || '').trim();
      if (!rawTime) continue;

      let timeKey = '';
      if (chartMode === 'intraday' || rawTime.includes('T') || rawTime.includes(':')) {
        const normalizedIso = rawTime.includes('T') ? rawTime : rawTime.replace(' ', 'T');
        const withTz = normalizedIso.endsWith('Z') ? normalizedIso : `${normalizedIso}Z`;
        const epochSec = Math.floor(Date.parse(withTz) / 1000);
        if (!Number.isFinite(epochSec) || epochSec <= 0) continue;
        timeKey = String(epochSec);
      } else {
        timeKey = rawTime.slice(0, 10);
      }

      const closeVal = Number(v.close);
      if (!Number.isFinite(closeVal) || closeVal <= 0) continue;
      const openVal = Number(v.open) > 0 ? Number(v.open) : closeVal;
      const highVal = Number(v.high) > 0 ? Number(v.high) : Math.max(openVal, closeVal);
      const lowVal = Number(v.low) > 0 ? Number(v.low) : Math.min(openVal, closeVal);
      if (lowVal <= 0) continue;

      seen.set(timeKey, {
        time: timeKey,
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
        volume: Number(v.volume) || 0,
      });
    }

    const list = Array.from(seen.values());
    list.sort((a, b) => {
      if (chartMode === 'intraday' || (/^\d+$/.test(a.time) && /^\d+$/.test(b.time))) {
        return Number(a.time) - Number(b.time);
      }
      return a.time > b.time ? 1 : -1;
    });
    return list;
  }, [values, chartMode]);

  const toChartTime = (t: string): Time => {
    if (chartMode === 'intraday' || /^\d+$/.test(t)) {
      return Number(t) as Time;
    }
    return t as Time;
  };

  useEffect(() => {
    if (
      !mainRef.current ||
      !rsiRef.current ||
      !macdRef.current ||
      !volumeRef.current ||
      pricePoints.length === 0
    ) {
      return;
    }

    // JSDOM / Test environment canvas guard
    if (typeof window === 'undefined' || !window.HTMLCanvasElement) {
      setRenderError('Canvas rendering unsupported in this environment.');
      return;
    }

    try {
      const mainContainer = mainRef.current;
      const rsiContainer = rsiRef.current;
      const macdContainer = macdRef.current;
      const volContainer = volumeRef.current;

      mainContainer.innerHTML = '';
      rsiContainer.innerHTML = '';
      macdContainer.innerHTML = '';
      volContainer.innerHTML = '';

      const initialWidth = mainContainer.clientWidth || 800;

      const makeChartOptions = (height: number, showTimeScale: boolean) => ({
        width: initialWidth,
        height,
        layout: {
          background: { color: DESIGN_TOKENS.chartHighContrast.background },
          textColor: DESIGN_TOKENS.chartHighContrast.textColor,
          fontFamily: DESIGN_TOKENS.typography.fontMono,
        },
        grid: {
          vertLines: { color: DESIGN_TOKENS.chartHighContrast.gridColor },
          horzLines: { color: DESIGN_TOKENS.chartHighContrast.gridColor },
        },
        crosshair: {
          vertLine: { color: DESIGN_TOKENS.chartHighContrast.crosshairColor },
          horzLine: { color: DESIGN_TOKENS.chartHighContrast.crosshairColor },
        },
        rightPriceScale: {
          borderColor: DESIGN_TOKENS.chartHighContrast.gridColor,
          minimumWidth: 72,
        },
        timeScale: {
          borderColor: DESIGN_TOKENS.chartHighContrast.gridColor,
          visible: showTimeScale,
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const mainChart = createChart(mainContainer, makeChartOptions(380, true));
      const rsiChart = createChart(rsiContainer, makeChartOptions(130, false));
      const macdChart = createChart(macdContainer, makeChartOptions(140, false));
      const volChart = createChart(volContainer, makeChartOptions(130, true));

      const charts: IChartApi[] = [mainChart, rsiChart, macdChart, volChart];

      // -----------------------------------------------------------------------
      // SUBPLOT I: Candlesticks, SMA 30, EMA 100, Bollinger Bands & Fibonacci
      // -----------------------------------------------------------------------
      const candleSeries = mainChart.addCandlestickSeries({
        upColor: DESIGN_TOKENS.chartHighContrast.upColor,
        downColor: DESIGN_TOKENS.chartHighContrast.downColor,
        borderUpColor: DESIGN_TOKENS.chartHighContrast.upColor,
        borderDownColor: DESIGN_TOKENS.chartHighContrast.downColor,
        wickUpColor: DESIGN_TOKENS.chartHighContrast.wickUpColor,
        wickDownColor: DESIGN_TOKENS.chartHighContrast.wickDownColor,
      });

      const candleData: CandlestickData<Time>[] = pricePoints.map((p) => ({
        time: toChartTime(p.time),
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
      }));
      candleSeries.setData(candleData);

      // Buy/Sell Trade Markers (Multi-day mode)
      if (trades.length > 0 && chartMode === 'multiday') {
        const markers: SeriesMarker<Time>[] = [];
        trades.forEach((trade) => {
          const tDate = (trade.tradedate || '').slice(0, 10);
          const exists = pricePoints.some((p) => p.time === tDate);
          if (exists) {
            const isBuy = trade.buysell === 'B';
            markers.push({
              time: toChartTime(tDate),
              position: isBuy ? 'belowBar' : 'aboveBar',
              color: isBuy ? DESIGN_TOKENS.chartHighContrast.upColor : DESIGN_TOKENS.chartHighContrast.downColor,
              shape: isBuy ? 'arrowUp' : 'arrowDown',
              text: `${trade.buysell === 'B' ? 'BUY' : 'SELL'} ${trade.quantity}@${trade.price}`,
            });
          }
        });
        markers.sort((a, b) => (String(a.time) > String(b.time) ? 1 : -1));
        candleSeries.setMarkers(markers);
      }

      if (showIndicators) {
        // SMA 30
        const smaData = calculateSMA(pricePoints, 30);
        if (smaData.length > 0) {
          const smaSeries = mainChart.addLineSeries({
            color: DESIGN_TOKENS.chartHighContrast.sma30,
            lineWidth: 2,
            title: 'SMA 30',
          });
          smaSeries.setData(smaData.map((d) => ({ time: toChartTime(d.time), value: d.value })));
        }

        // EMA 100
        const emaData = calculateEMA(pricePoints, 100);
        if (emaData.length > 0) {
          const emaSeries = mainChart.addLineSeries({
            color: DESIGN_TOKENS.chartHighContrast.benchmark,
            lineWidth: 2,
            title: 'EMA 100',
          });
          emaSeries.setData(emaData.map((d) => ({ time: toChartTime(d.time), value: d.value })));
        }

        // Bollinger Bands (30, 2) — High-impact 2px lines
        const bbData = calculateBollingerBands(pricePoints, 30, 2);
        if (bbData.length > 0) {
          const bbUpper = mainChart.addLineSeries({
            color: DESIGN_TOKENS.chartHighContrast.ema100,
            lineWidth: 2,
            lineStyle: 2,
            title: 'BB Upper',
          });
          bbUpper.setData(bbData.map((d) => ({ time: toChartTime(d.time), value: d.upper })));

          const bbLower = mainChart.addLineSeries({
            color: DESIGN_TOKENS.chartHighContrast.ema100,
            lineWidth: 2,
            lineStyle: 2,
            title: 'BB Lower',
          });
          bbLower.setData(bbData.map((d) => ({ time: toChartTime(d.time), value: d.lower })));
        }

        // Fibonacci price lines computed over the 52-week cycle window (252 bars for multi-day, 78 for intraday)
        if (pricePoints.length > 10) {
          const windowSize =
            fibLookbackBars || (chartMode === 'intraday' ? INTRADAY_DEFAULT_BARS : FIFTY_TWO_WEEKS_TRADING_BARS);
          const fibSlice = pricePoints.slice(-windowSize);
          const highs = fibSlice.map((p) => p.high);
          const lows = fibSlice.map((p) => p.low);
          const maxHigh = Math.max(...highs);
          const minLow = Math.min(...lows);
          const fibs = calculateFibonacciLevels(maxHigh, minLow);

          fibs.forEach((f) => {
            candleSeries.createPriceLine({
              price: f.price,
              color: DESIGN_TOKENS.paper.textMuted,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `Fib ${f.label}`,
            });
          });
        }
      }

      // -----------------------------------------------------------------------
      // SUBPLOT II: RSI (13) with High-Impact 70 Overbought / 30 Oversold Lines
      // -----------------------------------------------------------------------
      const rsiSeries = rsiChart.addLineSeries({
        color: DESIGN_TOKENS.chartHighContrast.ema100,
        lineWidth: 3,
        title: 'RSI (13)',
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: 0,
            maxValue: 100,
          },
        }),
      });
      const rsiPoints = calculateRSI(pricePoints, 13);
      const rsiMap = new Map(rsiPoints.map((r) => [r.time, r.value]));
      const rsiSeriesData: (LineData<Time> | { time: Time })[] = pricePoints.map((p) => {
        const val = rsiMap.get(p.time);
        return val !== undefined
          ? { time: toChartTime(p.time), value: val }
          : { time: toChartTime(p.time) };
      });
      rsiSeries.setData(rsiSeriesData as LineData<Time>[]);

      rsiSeries.createPriceLine({
        price: 70,
        color: DESIGN_TOKENS.chartHighContrast.downColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'OB 70',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: DESIGN_TOKENS.chartHighContrast.upColor,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'OS 30',
      });

      // -----------------------------------------------------------------------
      // SUBPLOT III: MACD (12, 26, 9) Histogram, MACD Line & Signal Line
      // -----------------------------------------------------------------------
      const macdHistSeries = macdChart.addHistogramSeries({
        title: 'Hist',
      });
      const macdLineSeries = macdChart.addLineSeries({
        color: DESIGN_TOKENS.chartHighContrast.sma30,
        lineWidth: 3,
        title: 'MACD (12,26)',
      });
      const macdSignalSeries = macdChart.addLineSeries({
        color: DESIGN_TOKENS.chartHighContrast.benchmark,
        lineWidth: 3,
        title: 'Signal (9)',
      });

      const macdPoints = calculateMACD(pricePoints, 12, 26, 9);
      const macdMap = new Map(macdPoints.map((m) => [m.time, m]));

      const macdHistData = pricePoints.map((p) => {
        const m = macdMap.get(p.time);
        if (!m) return { time: toChartTime(p.time) };
        return {
          time: toChartTime(p.time),
          value: m.histogram,
          color:
            m.histogram >= 0
              ? DESIGN_TOKENS.chartHighContrast.upColor
              : DESIGN_TOKENS.chartHighContrast.downColor,
        };
      });
      const macdLineData = pricePoints.map((p) => {
        const m = macdMap.get(p.time);
        return m ? { time: toChartTime(p.time), value: m.macd } : { time: toChartTime(p.time) };
      });
      const macdSigData = pricePoints.map((p) => {
        const m = macdMap.get(p.time);
        return m ? { time: toChartTime(p.time), value: m.signal } : { time: toChartTime(p.time) };
      });

      macdHistSeries.setData(macdHistData as HistogramData<Time>[]);
      macdLineSeries.setData(macdLineData as LineData<Time>[]);
      macdSignalSeries.setData(macdSigData as LineData<Time>[]);

      // -----------------------------------------------------------------------
      // SUBPLOT IV: Volume Histogram
      // -----------------------------------------------------------------------
      const volumeSeries = volChart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        title: 'Volume',
      });
      const volumeData: HistogramData<Time>[] = pricePoints.map((p) => {
        const isUp = p.close >= p.open;
        return {
          time: toChartTime(p.time),
          value: p.volume,
          color: isUp
            ? DESIGN_TOKENS.chartHighContrast.volumeUp
            : DESIGN_TOKENS.chartHighContrast.volumeDown,
        };
      });
      volumeSeries.setData(volumeData);

      // -----------------------------------------------------------------------
      // Synchronize Logical Visible Time Range (Zoom & Pan) Across All 4 Panes
      // -----------------------------------------------------------------------
      let isSyncingRange = false;
      charts.forEach((sourceChart, sourceIdx) => {
        sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
          if (isSyncingRange || !range) return;
          isSyncingRange = true;
          charts.forEach((targetChart, targetIdx) => {
            if (sourceIdx !== targetIdx) {
              targetChart.timeScale().setVisibleLogicalRange(range);
            }
          });
          isSyncingRange = false;
        });
      });

      // Default initial zoom: 6 months (126 trading days) for Multi-day; 90 5m bars for Intraday
      const defaultBars = chartMode === 'intraday' ? INTRADAY_DEFAULT_BARS : SIX_MONTHS_TRADING_BARS;
      if (pricePoints.length > defaultBars) {
        const defaultRange = {
          from: pricePoints.length - defaultBars,
          to: pricePoints.length - 1,
        };
        charts.forEach((c) => c.timeScale().setVisibleLogicalRange(defaultRange));
      } else {
        charts.forEach((c) => c.timeScale().fitContent());
      }

      // Resize observer across all 4 panes
      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const newWidth = entries[0].contentRect.width;
        if (newWidth > 0) {
          charts.forEach((c) => c.applyOptions({ width: newWidth }));
        }
      });
      resizeObserver.observe(mainContainer);

      return () => {
        resizeObserver.disconnect();
        charts.forEach((c) => c.remove());
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize chart canvas';
      setRenderError(msg);
    }
  }, [pricePoints, trades, showIndicators, chartMode]);

  if (renderError) {
    return (
      <div
        data-testid="interactive-canvas-chart"
        className={`bg-white border border-slate-200 rounded-md p-6 flex flex-col items-center justify-center text-slate-700 min-h-[320px] ${className || ''}`}
      >
        <Activity className="w-7 h-7 text-blue-700 mb-2" />
        <span className="text-xs font-bold text-slate-900">Interactive Canvas Chart (lightweight-charts)</span>
        <span className="text-[11px] text-slate-500 mt-1">{renderError}</span>
        <div className="mt-3 px-3 py-1.5 rounded bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800">
          <span>{pricePoints.length} OHLCV bars loaded (SMA 30, EMA 100, BB 30, RSI 13, MACD 12/26/9).</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="interactive-canvas-chart"
      className={`relative bg-white border border-slate-200 rounded-md overflow-hidden ${className || ''}`}
    >
      {pricePoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-600 min-h-[360px]">
          <Layers className="w-8 h-8 text-slate-400 mb-2 animate-pulse" />
          <span className="text-xs">No price series data available for Canvas Chart</span>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-200">
          {/* Subplot I: Price, SMA 30, EMA 100, Bollinger Bands, Fibonacci */}
          <div className="relative">
            <div className="absolute top-2 left-3 z-10 pointer-events-none flex flex-wrap items-center gap-3 text-[11px] font-mono">
              <span className="font-bold text-slate-900">Price & Overlays</span>
              <span className="text-blue-700">SMA 30</span>
              <span className="text-violet-600">EMA 100</span>
              <span className="text-sky-600">BB (30, 2)</span>
              <span className="text-slate-600">Fibonacci</span>
            </div>
            <div ref={mainRef} className="w-full h-[380px]" />
          </div>

          {/* Subplot II: RSI (13) */}
          <div className="relative">
            <div className="absolute top-1.5 left-3 z-10 pointer-events-none flex items-center gap-3 text-[11px] font-mono">
              <span className="font-bold text-violet-600">RSI (13)</span>
              <span className="text-slate-500 text-[10px]">Overbought 70 / Oversold 30</span>
            </div>
            <div ref={rsiRef} className="w-full h-[130px]" />
          </div>

          {/* Subplot III: MACD (12, 26, 9) */}
          <div className="relative">
            <div className="absolute top-1.5 left-3 z-10 pointer-events-none flex items-center gap-3 text-[11px] font-mono">
              <span className="font-bold text-slate-900">MACD (12, 26, 9)</span>
              <span className="text-blue-700">MACD</span>
              <span className="text-amber-600">Signal</span>
              <span className="text-emerald-700">Histogram</span>
            </div>
            <div ref={macdRef} className="w-full h-[140px]" />
          </div>

          {/* Subplot IV: Volume */}
          <div className="relative">
            <div className="absolute top-1.5 left-3 z-10 pointer-events-none flex items-center gap-2 text-[11px] font-mono">
              <span className="font-bold text-slate-700">Volume</span>
            </div>
            <div ref={volumeRef} className="w-full h-[130px]" />
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveCanvasChart;
