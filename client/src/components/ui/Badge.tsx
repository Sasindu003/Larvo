import React from 'react';

export type BadgeVariant = 'discount' | 'new' | 'out-of-stock' | 'default';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  discount:    'bg-ink-900 text-white',
  new:         'bg-cream-300 text-ink-900 border border-cream-400',
  'out-of-stock': 'bg-ink-100 text-ink-500 border border-ink-200',
  default:     'bg-sand-200 text-ink-800',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => (
  <span
    className={[
      'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase',
      styles[variant],
      className,
    ].join(' ')}
  >
    {children}
  </span>
);
