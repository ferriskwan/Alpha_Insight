import React from 'react';

export interface HeatmapItem {
  id: string;
  label: string;
  value: number; // typically percentage change e.g. 2.45 for +2.45%
  formattedValue?: string;
  subtext?: string;
  metadata?: Record<string, unknown>;
}

export interface HeatmapGridProps {
  items: HeatmapItem[];
  onItemClick?: (item: HeatmapItem) => void;
  columns?: 2 | 3 | 4 | 6;
  emptyMessage?: string;
  className?: string;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({
  items,
  onItemClick,
  columns = 4,
  emptyMessage = 'No performance data available',
  className = '',
}) => {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
        {emptyMessage}
      </div>
    );
  }

  // Calculate heat color styling based on percentage magnitude
  const getItemColorClasses = (val: number): string => {
    if (val >= 3.0) return 'bg-emerald-700 text-white border-emerald-800 shadow-xs';
    if (val >= 1.5) return 'bg-emerald-600 text-white border-emerald-700';
    if (val >= 0.5) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    if (val > 0.0) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (val === 0.0) return 'bg-slate-50 text-slate-700 border-slate-200';
    if (val > -0.5) return 'bg-red-50 text-red-800 border-red-200';
    if (val > -1.5) return 'bg-red-100 text-red-900 border-red-300';
    if (val > -3.0) return 'bg-red-600 text-white border-red-700';
    return 'bg-red-700 text-white border-red-800 shadow-xs';
  };

  const colClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
  }[columns];

  return (
    <div className={`grid ${colClasses} gap-2.5 ${className}`}>
      {items.map((item) => {
        const colorClasses = getItemColorClasses(item.value);
        const isClickable = Boolean(onItemClick);

        return (
          <div
            key={item.id}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={() => onItemClick?.(item)}
            onKeyDown={(e) => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onItemClick?.(item);
              }
            }}
            className={`p-3 rounded-lg border transition-all duration-150 flex flex-col justify-between select-none ${colorClasses} ${
              isClickable ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="font-semibold text-xs tracking-tight line-clamp-1">{item.label}</span>
              {item.subtext && <span className="text-[10px] opacity-80 shrink-0">{item.subtext}</span>}
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono font-bold text-sm tracking-tight tabular-nums">
                {item.formattedValue ?? `${item.value >= 0 ? '+' : ''}${item.value.toFixed(2)}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HeatmapGrid;
