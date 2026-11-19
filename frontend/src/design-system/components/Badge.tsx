import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'positive'
  | 'negative'
  | 'warning'
  | 'accent'
  | 'neutral'
  | 'buy'
  | 'sell'
  | 'cash'
  | 'margin'
  | 'active'
  | 'expired';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  className,
}) => {
  const variantClasses: Record<BadgeVariant, string> = {
    positive: 'bg-semantic-positive/15 text-semantic-positive border-semantic-positive/30',
    negative: 'bg-semantic-negative/15 text-semantic-negative border-semantic-negative/30',
    warning: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30',
    accent: 'bg-accent-primary/15 text-accent-primary border-accent-primary/30',
    neutral: 'bg-surface-elevated text-secondary border-subtle',
    buy: 'bg-semantic-positive/20 text-semantic-positive border-semantic-positive/40 font-bold',
    sell: 'bg-semantic-negative/20 text-semantic-negative border-semantic-negative/40 font-bold',
    cash: 'bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30',
    margin: 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30',
    active: 'bg-semantic-positive/15 text-semantic-positive border-semantic-positive/30',
    expired: 'bg-semantic-negative/15 text-semantic-negative border-semantic-negative/30',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border uppercase tracking-wider select-none shrink-0',
          variantClasses[variant],
          className
        )
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export interface EnvPillProps {
  env?: string;
  className?: string;
}

export const EnvPill: React.FC<EnvPillProps> = ({ env = 'DEV', className }) => {
  const upper = env.toUpperCase();
  const isPrd = upper.includes('PRD') || upper.includes('PROD');
  const isUat = upper.includes('UAT');

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase border select-none',
          isPrd
            ? 'bg-semantic-positive/15 text-semantic-positive border-semantic-positive/30'
            : isUat
            ? 'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30'
            : 'bg-accent-primary/15 text-accent-primary border-accent-primary/30',
          className
        )
      )}
    >
      [{upper}]
    </span>
  );
};

export default Badge;
