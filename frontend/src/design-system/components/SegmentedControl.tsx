import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={twMerge(
        clsx(
          'inline-flex items-center p-1 bg-surface-elevated/80 border border-subtle rounded-lg select-none',
          fullWidth && 'w-full flex',
          className
        )
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
              size === 'sm'
                ? 'px-2.5 py-1 text-xs'
                : 'px-3 py-1.5 text-xs md:text-sm min-h-[36px] md:min-h-[30px]',
              fullWidth && 'flex-1',
              isSelected
                ? 'bg-bento-card text-accent-primary font-semibold shadow border border-border-active/40'
                : 'text-secondary hover:text-primary hover:bg-surface-elevated'
            )}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span className="truncate">{option.label}</span>
            {option.badge && <span className="shrink-0">{option.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
