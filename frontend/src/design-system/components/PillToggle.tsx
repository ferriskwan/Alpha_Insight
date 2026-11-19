import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PillToggleProps {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const PillToggle: React.FC<PillToggleProps> = ({
  label,
  active,
  onClick,
  icon,
  badge,
  disabled = false,
  className,
  size = 'md',
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-all duration-150 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs min-h-[38px] md:min-h-[32px]',
          active
            ? 'bg-accent-primary text-canvas shadow-sm shadow-accent-primary/20 hover:bg-accent-primary/90'
            : 'bg-surface-elevated text-secondary hover:text-primary hover:bg-surface-elevated/80 border border-subtle',
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
          className
        )
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      {badge && <span className="ml-0.5 shrink-0">{badge}</span>}
    </button>
  );
};

export default PillToggle;
