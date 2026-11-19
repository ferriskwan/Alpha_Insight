import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BentoCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  title,
  subtitle,
  icon,
  headerRight,
  noPadding = false,
  className,
  children,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-bento-card border border-subtle rounded-xl shadow-lg transition-all duration-150 flex flex-col',
          !noPadding && 'p-3.5 md:p-5',
          className
        )
      )}
    >
      {(title || headerRight) && (
        <div className={clsx('flex items-center justify-between gap-2', !noPadding ? 'mb-3' : 'p-3.5 md:p-5 border-b border-subtle')}>
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-accent-primary shrink-0">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <div className="text-heading-md text-primary font-semibold tracking-tight truncate">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-body-sm text-secondary text-xs truncate">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {headerRight && <div className="shrink-0 flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

export default BentoCard;
