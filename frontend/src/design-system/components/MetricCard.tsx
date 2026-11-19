import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  trend?: TrendDirection;
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'positive' | 'negative' | 'warning';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  trend,
  trendValue,
  icon,
  className,
  variant = 'default',
}) => {
  const variantTextClass = {
    default: 'text-primary',
    positive: 'text-semantic-positive',
    negative: 'text-semantic-negative',
    warning: 'text-semantic-warning',
  }[variant];

  return (
    <div
      className={twMerge(
        clsx(
          'bg-bento-card border border-subtle rounded-xl p-3.5 md:p-4.5 shadow-md flex flex-col justify-between min-w-[160px]',
          className
        )
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold text-secondary uppercase tracking-wider truncate">
          {label}
        </span>
        {icon && <span className="text-muted shrink-0">{icon}</span>}
      </div>

      <div className={clsx('text-xl md:text-2xl font-extrabold font-mono tabular-nums tracking-tight', variantTextClass)}>
        {value}
      </div>

      {(subtext || trend || trendValue) && (
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          {trend === 'up' && (
            <span className="inline-flex items-center text-semantic-positive font-semibold font-mono">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              {trendValue}
            </span>
          )}
          {trend === 'down' && (
            <span className="inline-flex items-center text-semantic-negative font-semibold font-mono">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              {trendValue}
            </span>
          )}
          {trend === 'neutral' && (
            <span className="inline-flex items-center text-muted font-medium font-mono">
              <Minus className="w-3 h-3 mr-0.5" />
              {trendValue}
            </span>
          )}
          {subtext && <span className="text-secondary truncate text-[11px]">{subtext}</span>}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
