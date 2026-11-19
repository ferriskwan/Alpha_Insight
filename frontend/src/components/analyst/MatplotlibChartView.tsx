import React, { useState, useRef, useMemo } from 'react';
import { RotateCcw, Crosshair, Calendar, Layers } from 'lucide-react';
import { OhlcvValue, TradeRecord } from '../../types/api';
import { Button, Badge } from '../../design-system';

export interface MatplotlibChartViewProps {
  chartScreenshot?: string | null;
  values?: OhlcvValue[];
  trades?: TradeRecord[];
  onZoomChange?: (zoomStart: string, zoomEnd: string) => Promise<void>;
  isZooming?: boolean;
  className?: string;
}

export const MatplotlibChartView: React.FC<MatplotlibChartViewProps> = ({
  chartScreenshot,
  values = [],
  trades = [],
  onZoomChange,
  isZooming = false,
  className,
}) => {
  const sortedValues = useMemo(() => {
    if (!values.length) return [];
    return [...values].sort((a, b) => {
      const da = new Date(a.date || a.datetime || '').getTime();
      const db = new Date(b.date || b.datetime || '').getTime();
      return da - db;
    });
  }, [values]);

  const totalCount = sortedValues.length;

  const minDate = sortedValues[0]?.date || sortedValues[0]?.datetime || '';
  const maxDate = sortedValues[totalCount - 1]?.date || sortedValues[totalCount - 1]?.datetime || '';

  const [appliedStart, setAppliedStart] = useState<string>('');
  const [appliedEnd, setAppliedEnd] = useState<string>('');

  React.useEffect(() => {
    if (minDate && maxDate && !appliedStart) {
      const d = new Date(maxDate);
      d.setMonth(d.getMonth() - 6);
      const sixMo = d.toISOString().slice(0, 10);
      setAppliedStart(sixMo < minDate ? minDate : sixMo);
      setAppliedEnd(maxDate);
    }
  }, [minDate, maxDate, appliedStart]);

  const getIdxFromDate = (dateStr: string, fallback: number) => {
    if (!dateStr || !totalCount) return fallback;
    const idx = sortedValues.findIndex((v) => (v.date || v.datetime) === dateStr);
    if (idx !== -1) return idx;
    const gteIdx = sortedValues.findIndex((v) => (v.date || v.datetime || '') >= dateStr);
    return gteIdx !== -1 ? gteIdx : fallback;
  };

  const [startIdx, setStartIdx] = useState<number>(0);
  const [endIdx, setEndIdx] = useState<number>(0);

  React.useEffect(() => {
    if (totalCount > 0) {
      setStartIdx(getIdxFromDate(appliedStart, 0));
      setEndIdx(getIdxFromDate(appliedEnd, totalCount - 1));
    }
  }, [totalCount, appliedStart, appliedEnd]);

  // Active values in zoomed window
  const activeSlice = useMemo(() => {
    if (!sortedValues.length) return [];
    return sortedValues.filter((v) => {
      const d = v.date || v.datetime || '';
      if (appliedStart && d < appliedStart) return false;
      if (appliedEnd && d > appliedEnd) return false;
      return true;
    });
  }, [sortedValues, appliedStart, appliedEnd]);

  // Interactive Crosshair Hover
  const [hoverData, setHoverData] = useState<OhlcvValue | null>(null);
  const [hoverPos, setHoverPos] = useState<{ xPct: number; yPct: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const calculateCrosshair = (clientX: number, clientY: number) => {
    if (!imageContainerRef.current || !activeSlice.length) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const fx = x / rect.width;

    // Matplotlib plot horizontal margin range ~ 6% to 94%
    const leftMargin = 0.06;
    const rightMargin = 0.94;
    const plotWidth = rightMargin - leftMargin;

    if (fx < leftMargin || fx > rightMargin) {
      setHoverData(null);
      setHoverPos(null);
      return;
    }

    const rx = (fx - leftMargin) / plotWidth;
    const idx = Math.min(Math.floor(rx * activeSlice.length), activeSlice.length - 1);

    if (idx >= 0 && idx < activeSlice.length) {
      const item = activeSlice[idx];
      const rxSnapped = (idx + 0.5) / activeSlice.length;
      setHoverData(item);
      setHoverPos({
        xPct: (leftMargin + rxSnapped * plotWidth) * 100,
        yPct: (y / rect.height) * 100,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    calculateCrosshair(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      calculateCrosshair(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handlePointerLeave = () => {
    setHoverData(null);
    setHoverPos(null);
  };

  // Same-day trade markers on hover
  const hoveredTrades = useMemo(() => {
    if (!hoverData || !trades.length) return [];
    const dateStr = (hoverData.date || hoverData.datetime || '').slice(0, 10);
    return trades.filter((t) => t.tradedate && t.tradedate.slice(0, 10) === dateStr);
  }, [hoverData, trades]);

  // Timeline Slider Dragging (Mouse & Mobile Touch)
  const sliderBarRef = useRef<HTMLDivElement>(null);
  const draggingHandleRef = useRef<'start' | 'end' | null>(null);

  const startDrag = (type: 'start' | 'end', clientX: number) => {
    draggingHandleRef.current = type;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingHandleRef.current || !sliderBarRef.current || !totalCount) return;
      const curX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = sliderBarRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (curX - rect.left) / rect.width));
      const idx = Math.round(pct * (totalCount - 1));

      if (draggingHandleRef.current === 'start') {
        setStartIdx((prev) => Math.min(idx, endIdx));
      } else {
        setEndIdx((prev) => Math.max(idx, startIdx));
      }
    };

    const onPointerUp = () => {
      draggingHandleRef.current = null;
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      setStartIdx((finalStart) => {
        setEndIdx((finalEnd) => {
          const newStart = sortedValues[finalStart]?.date || sortedValues[finalStart]?.datetime;
          const newEnd = sortedValues[finalEnd]?.date || sortedValues[finalEnd]?.datetime;
          if (newStart && newEnd && (newStart !== appliedStart || newEnd !== appliedEnd)) {
            if (onZoomChange) {
              onZoomChange(newStart, newEnd).then(() => {
                setAppliedStart(newStart);
                setAppliedEnd(newEnd);
              });
            }
          }
          return finalEnd;
        });
        return finalStart;
      });
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  const handleResetZoom = async () => {
    if (!minDate || !maxDate) return;
    setStartIdx(0);
    setEndIdx(totalCount - 1);
    if (onZoomChange) {
      await onZoomChange(minDate, maxDate);
      setAppliedStart(minDate);
      setAppliedEnd(maxDate);
    }
  };

  const startPct = totalCount > 1 ? (startIdx / (totalCount - 1)) * 100 : 0;
  const endPct = totalCount > 1 ? (endIdx / (totalCount - 1)) * 100 : 100;
  const startDateStr = sortedValues[startIdx]?.date || sortedValues[startIdx]?.datetime || '';
  const endDateStr = sortedValues[endIdx]?.date || sortedValues[endIdx]?.datetime || '';

  return (
    <div className={`flex flex-col gap-3 select-none ${className || ''}`}>
      {/* Chart Canvas / Screenshot Display */}
      <div
        ref={imageContainerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onMouseLeave={handlePointerLeave}
        onTouchEnd={handlePointerLeave}
        className="relative bg-bento-card border border-subtle rounded-xl overflow-hidden shadow-inner flex items-center justify-center min-h-[340px] md:min-h-[460px] cursor-crosshair"
      >
        {chartScreenshot ? (
          <img
            src={chartScreenshot.startsWith('data:') ? chartScreenshot : `data:image/png;base64,${chartScreenshot}`}
            alt="Quantitative Matplotlib Chart"
            className="w-full h-auto object-contain pointer-events-none select-none max-h-[640px]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-secondary">
            <Layers className="w-8 h-8 text-muted mb-2 animate-pulse" />
            <span className="text-xs">No chart screenshot generated for this symbol</span>
          </div>
        )}

        {/* Interactive SVG Crosshair Overlay */}
        {hoverPos && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {/* Vertical crosshair line */}
            <line
              x1={`${hoverPos.xPct}%`}
              y1="0"
              x2={`${hoverPos.xPct}%`}
              y2="100%"
              stroke="var(--color-border-active)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* Horizontal crosshair line */}
            <line
              x1="0"
              y1={`${hoverPos.yPct}%`}
              x2="100%"
              y2={`${hoverPos.yPct}%`}
              stroke="var(--color-border-active)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </svg>
        )}

        {/* Crosshair Data Tooltip */}
        {hoverData && hoverPos && (
          <div
            className="absolute top-2 left-2 z-30 bg-surface-elevated/95 backdrop-blur-md border border-subtle rounded-lg p-2.5 text-xs font-mono shadow-xl max-w-xs pointer-events-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-subtle pb-1 mb-1.5">
              <span className="font-bold text-accent-primary flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5" />
                {hoverData.date || hoverData.datetime}
              </span>
              <span className="text-[10px] text-muted">Bar Data</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-secondary">Open: <strong className="text-primary font-bold">{hoverData.open}</strong></span>
              <span className="text-secondary">High: <strong className="text-semantic-positive font-bold">{hoverData.high}</strong></span>
              <span className="text-secondary">Low: <strong className="text-semantic-negative font-bold">{hoverData.low}</strong></span>
              <span className="text-secondary">Close: <strong className="text-primary font-bold">{hoverData.close}</strong></span>
              <span className="text-secondary col-span-2">Vol: <strong className="text-primary">{Number(hoverData.volume).toLocaleString()}</strong></span>
            </div>

            {hoveredTrades.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-subtle">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">
                  Trades on Date:
                </span>
                {hoveredTrades.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                    <Badge variant={t.buysell === 'B' ? 'buy' : 'sell'}>
                      {t.buysell === 'B' ? 'BUY' : 'SELL'} {t.quantity}
                    </Badge>
                    <span className="text-primary font-bold">@{t.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isZooming && (
          <div className="absolute inset-0 bg-canvas/60 backdrop-blur-xs flex items-center justify-center z-40">
            <div className="flex items-center gap-2 bg-bento-card border border-subtle px-3 py-1.5 rounded-lg shadow-lg text-xs font-semibold text-accent-primary">
              <span className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
              Recalculating Matplotlib Plot...
            </div>
          </div>
        )}
      </div>

      {/* Timeline Dual-Handle Zoom Slider */}
      {totalCount > 1 && (
        <div className="bg-bento-card border border-subtle rounded-xl p-3 md:px-5 md:py-3 shadow-md flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent-primary" />
              Zoom Window: <strong className="text-primary font-mono">{startDateStr}</strong> to <strong className="text-primary font-mono">{endDateStr}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetZoom}
              icon={<RotateCcw className="w-3 h-3" />}
            >
              Reset All
            </Button>
          </div>

          <div className="relative py-3">
            <div
              ref={sliderBarRef}
              className="relative h-2 bg-surface-elevated border border-subtle rounded-full cursor-pointer select-none"
            >
              {/* Highlight active range */}
              <div
                className="absolute top-0 h-full bg-accent-primary/60 rounded-full"
                style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
              />

              {/* Start Handle Thumb */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  startDrag('start', e.clientX);
                }}
                onTouchStart={(e) => {
                  if (e.touches.length > 0) startDrag('start', e.touches[0].clientX);
                }}
                className="absolute top-1/2 w-4 h-4 bg-primary border-2 border-accent-primary rounded-full shadow-md cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 active:scale-130 transition-transform z-10"
                style={{ left: `${startPct}%` }}
              />

              {/* End Handle Thumb */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  startDrag('end', e.clientX);
                }}
                onTouchStart={(e) => {
                  if (e.touches.length > 0) startDrag('end', e.touches[0].clientX);
                }}
                className="absolute top-1/2 w-4 h-4 bg-primary border-2 border-accent-primary rounded-full shadow-md cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 active:scale-130 transition-transform z-10"
                style={{ left: `${endPct}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatplotlibChartView;
