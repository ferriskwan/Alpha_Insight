import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  timeframeOptions?: string[];
  selectedTimeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  timeframeOptions,
  selectedTimeframe,
  onTimeframeChange,
  headerRight,
  footer,
  isLoading = false,
  error = null,
  onRetry,
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col min-w-0 transition-shadow hover:shadow-sm ${className}`}
    >
      {/* Header Strip */}
      <div className="px-4 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 bg-slate-50/40 rounded-t-lg">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe selector pills */}
          {timeframeOptions && timeframeOptions.length > 0 && (
            <div
              role="radiogroup"
              aria-label="Chart timeframe"
              className="flex items-center gap-1 p-0.5 bg-slate-100 rounded border border-slate-200 text-xs"
            >
              {timeframeOptions.map((tf) => {
                const isSelected = selectedTimeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onTimeframeChange?.(tf)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-white text-blue-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
          )}

          {headerRight}
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className="relative flex-1 min-w-0 p-3 lg:p-4">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10 rounded-b-lg">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Updating chart data...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-center p-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-xs text-red-600 font-medium">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-1 px-3 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 font-medium transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Footer / Metric Strip */}
      {footer && <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 rounded-b-lg">{footer}</div>}
    </div>
  );
};

export default ChartContainer;
