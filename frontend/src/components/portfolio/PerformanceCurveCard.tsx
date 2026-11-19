import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { PerformancePoint } from '../../types/api';
import { BentoCard } from '../../design-system';

export interface PerformanceCurveCardProps {
  points: PerformancePoint[];
  className?: string;
}

export const PerformanceCurveCard: React.FC<PerformanceCurveCardProps> = ({ points, className }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sortedPoints = useMemo(() => {
    if (!points.length) return [];
    return [...points].sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [points]);

  const { minVal, maxVal, width, height, padding } = useMemo(() => {
    const w = 800;
    const h = 260;
    const pad = 36;
    if (!sortedPoints.length) return { minVal: 0, maxVal: 100, width: w, height: h, padding: pad };

    const vals = sortedPoints.flatMap((p) => [p.totalEquity, p.totalCapital]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const margin = (max - min) * 0.1 || 10;
    return { minVal: min - margin, maxVal: max + margin, width: w, height: h, padding: pad };
  }, [sortedPoints]);

  const getY = (val: number) => {
    if (maxVal === minVal) return height / 2;
    return height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);
  };

  const getX = (idx: number) => {
    if (sortedPoints.length <= 1) return padding;
    return padding + (idx / (sortedPoints.length - 1)) * (width - 2 * padding);
  };

  // Generate SVG path strings
  const equityPath = useMemo(() => {
    if (!sortedPoints.length) return '';
    return sortedPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.totalEquity)}`).join(' ');
  }, [sortedPoints, minVal, maxVal]);

  const capitalPath = useMemo(() => {
    if (!sortedPoints.length) return '';
    return sortedPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.totalCapital)}`).join(' ');
  }, [sortedPoints, minVal, maxVal]);

  const hoveredPoint = hoveredIndex !== null && sortedPoints[hoveredIndex] ? sortedPoints[hoveredIndex] : null;

  return (
    <BentoCard
      title="Historical Performance & Equity Trajectory"
      subtitle="Total Asset Value vs Total Injected Capital (Mark-to-Market Time Series)"
      icon={<TrendingUp className="w-4 h-4 text-accent-primary" />}
      className={className}
    >
      {sortedPoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted">
          <TrendingUp className="w-8 h-8 text-muted/40 mb-2" />
          <span className="text-xs">No historical performance time series calculated yet.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* SVG Canvas Area */}
          <div className="relative w-full overflow-hidden bg-surface-elevated/40 border border-subtle rounded-xl p-2 select-none">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, (mouseX - padding) / (rect.width - 2 * padding)));
                const idx = Math.round(ratio * (sortedPoints.length - 1));
                setHoveredIndex(idx);
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Horizontal Grid Guides */}
              <line
                x1={padding}
                y1={getY(minVal)}
                x2={width - padding}
                y2={getY(minVal)}
                stroke="var(--color-border-subtle)"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={getY((minVal + maxVal) / 2)}
                x2={width - padding}
                y2={getY((minVal + maxVal) / 2)}
                stroke="var(--color-border-subtle)"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={getY(maxVal)}
                x2={width - padding}
                y2={getY(maxVal)}
                stroke="var(--color-border-subtle)"
                strokeDasharray="4 4"
              />

              {/* Capital Injected Curve (Muted Dashed) */}
              <path
                d={capitalPath}
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />

              {/* Total Equity Curve (Accent Primary) */}
              <path
                d={equityPath}
                fill="none"
                stroke="var(--color-accent-primary)"
                strokeWidth="2.5"
              />

              {/* Hover Indicator */}
              {hoveredIndex !== null && (
                <>
                  <line
                    x1={getX(hoveredIndex)}
                    y1={padding}
                    x2={getX(hoveredIndex)}
                    y2={height - padding}
                    stroke="var(--color-border-active)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={getX(hoveredIndex)}
                    cy={getY(sortedPoints[hoveredIndex].totalEquity)}
                    r="4"
                    fill="var(--color-accent-primary)"
                    stroke="var(--color-bento-card)"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div className="absolute top-3 right-3 bg-surface-elevated/95 border border-subtle rounded-lg p-2.5 text-xs font-mono shadow-xl pointer-events-none">
                <div className="flex items-center gap-1.5 text-accent-primary font-bold mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{hoveredPoint.date}</span>
                </div>
                <div className="space-y-0.5 text-[11px]">
                  <div>
                    <span className="text-secondary">Equity: </span>
                    <strong className="text-primary font-bold">
                      ${Number(hoveredPoint.totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-secondary">Capital: </span>
                    <strong className="text-muted">
                      ${Number(hoveredPoint.totalCapital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-secondary">Total PnL: </span>
                    <strong
                      className={
                        hoveredPoint.totalPnL >= 0 ? 'text-semantic-positive' : 'text-semantic-negative'
                      }
                    >
                      {hoveredPoint.totalPnL >= 0 ? '+' : ''}$
                      {Number(hoveredPoint.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })} (
                      {hoveredPoint.pctPnL >= 0 ? '+' : ''}
                      {hoveredPoint.pctPnL.toFixed(2)}%)
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-accent-primary" />
              <span className="text-primary">Total Net Equity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-text-muted" />
              <span className="text-muted">Capital Injected</span>
            </div>
          </div>
        </div>
      )}
    </BentoCard>
  );
};

export default PerformanceCurveCard;
