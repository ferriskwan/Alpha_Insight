import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface FormFieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}) => {
  return (
    <div className={twMerge(clsx('flex flex-col gap-1.5', className))}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wider select-none">
            {label}
            {required && <span className="text-semantic-negative ml-1">*</span>}
          </label>
          {hint && <span className="text-[11px] text-muted">{hint}</span>}
        </div>
      )}
      {children}
      {error && <span className="text-xs text-semantic-negative mt-0.5">{error}</span>}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, icon, iconRight, className, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <span className="absolute left-3 text-muted pointer-events-none shrink-0">{icon}</span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(
              'w-full bg-surface-elevated text-primary placeholder:text-muted rounded-lg border text-base md:text-sm font-sans',
              'min-h-[44px] md:min-h-[38px] px-3 transition-colors duration-150',
              icon ? 'pl-9' : 'pl-3',
              iconRight ? 'pr-9' : 'pr-3',
              error
                ? 'border-semantic-negative focus:border-semantic-negative focus:ring-1 focus:ring-semantic-negative'
                : 'border-subtle focus:border-border-active focus:ring-1 focus:ring-border-active',
              'focus:outline-none',
              disabled && 'opacity-50 cursor-not-allowed bg-surface-elevated/40',
              className
            )
          )}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 text-muted pointer-events-none shrink-0">
            {iconRight}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className, disabled, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        className={twMerge(
          clsx(
            'w-full bg-surface-elevated text-primary rounded-lg border text-base md:text-sm font-sans',
            'min-h-[44px] md:min-h-[38px] px-3 transition-colors duration-150 cursor-pointer',
            error
              ? 'border-semantic-negative focus:border-semantic-negative'
              : 'border-subtle focus:border-border-active',
            'focus:outline-none focus:ring-1 focus:ring-border-active',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

export interface CheckboxCardProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const CheckboxCard: React.FC<CheckboxCardProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
}) => {
  return (
    <label
      className={twMerge(
        clsx(
          'flex items-start gap-3 p-3 rounded-lg border transition-all duration-150 cursor-pointer select-none',
          checked
            ? 'bg-accent-primary/10 border-border-active'
            : 'bg-surface-elevated/40 border-subtle hover:border-subtle/80 hover:bg-surface-elevated/70',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-subtle bg-surface-elevated text-accent-primary focus:ring-accent-primary focus:ring-offset-canvas cursor-pointer w-4 h-4"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-primary leading-tight">{label}</div>
        {description && <div className="text-xs text-secondary mt-0.5 leading-snug">{description}</div>}
      </div>
    </label>
  );
};
