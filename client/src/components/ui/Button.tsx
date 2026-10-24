import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center font-medium tracking-wide rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 focus-visible:ring-ink-700',
  secondary:
    'border border-ink-300 bg-white text-ink-900 hover:bg-ink-50 active:bg-ink-100 focus-visible:ring-ink-400',
  ghost:
    'bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200 focus-visible:ring-ink-400',
  danger:
    'bg-danger text-white hover:bg-danger-dark active:opacity-90 focus-visible:ring-danger',
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8  px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <svg className={`${s} animate-spin`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, children, className = '', disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={size} />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
