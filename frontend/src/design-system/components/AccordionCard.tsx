import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface AccordionCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  summaryBadge?: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const AccordionCard: React.FC<AccordionCardProps> = ({
  title,
  subtitle,
  icon,
  summaryBadge,
  defaultExpanded = true,
  className,
  headerRight,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={twMerge(
        clsx(
          'bg-bento-card border border-subtle rounded-xl shadow-lg transition-all duration-200 overflow-hidden',
          className
        )
      )}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full text-left p-3.5 md:p-5 flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-accent-primary shrink-0">{icon}</span>}
          <div className="min-w-0">
            <div className="text-heading-md text-primary font-semibold truncate">{title}</div>
            {subtitle && <div className="text-xs text-secondary truncate">{subtitle}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {summaryBadge && !isExpanded && (
            <div className="hidden sm:block">{summaryBadge}</div>
          )}
          {headerRight && <div onClick={(e) => e.stopPropagation()}>{headerRight}</div>}
          <ChevronDown
            className={clsx(
              'w-4 h-4 text-muted transition-transform duration-200',
              isExpanded && 'transform rotate-180'
            )}
          />
        </div>
      </button>

      {/* Content drawer */}
      <div
        className={clsx(
          'transition-[max-height,opacity] duration-200 ease-in-out',
          isExpanded ? 'max-h-[3000px] opacity-100 p-3.5 md:p-5 pt-0 border-t border-subtle/50' : 'max-h-0 opacity-0 overflow-hidden'
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default AccordionCard;
