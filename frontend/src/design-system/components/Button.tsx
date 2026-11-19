import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}) => {
  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-accent-primary text-canvas font-semibold hover:bg-accent-primary/90 shadow-sm shadow-accent-primary/20 active:scale-[0.98]',
    secondary:
      'bg-surface-elevated text-primary border border-subtle hover:bg-surface-elevated/80 hover:border-text-muted/40 active:scale-[0.98]',
    danger:
      'bg-semantic-negative/15 text-semantic-negative border border-semantic-negative/30 hover:bg-semantic-negative/25 active:scale-[0.98]',
    ghost:
      'bg-transparent text-secondary hover:text-primary hover:bg-surface-elevated active:scale-[0.98]',
    ai:
      'bg-accent-ai/20 text-accent-ai border border-accent-ai/40 hover:bg-accent-ai/30 shadow-sm active:scale-[0.98]',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1 text-xs min-h-[34px] md:min-h-[30px] rounded-md gap-1.5',
    md: 'px-4 py-2 text-xs md:text-sm min-h-[44px] md:min-h-[36px] rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-sm md:text-base min-h-[48px] md:min-h-[42px] rounded-xl gap-2.5',
  };

  return (
    <button
      disabled={disabled || loading}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none active:scale-100',
          className
        )
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  'aria-label': string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...props
}) => {
  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'w-8 h-8 p-1 rounded-md',
    md: 'w-10 h-10 md:w-9 md:h-9 p-1.5 rounded-lg',
    lg: 'w-12 h-12 p-2 rounded-xl',
  };

  return (
    <Button
      variant={variant}
      size={size}
      loading={loading}
      disabled={disabled}
      className={twMerge(clsx('p-0 flex items-center justify-center shrink-0', sizeClasses[size], className))}
      {...props}
    >
      {!loading && icon}
    </Button>
  );
};

export default Button;
