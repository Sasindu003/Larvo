import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Removes padding — useful when card wraps an image */
  flush?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', flush = false, onClick }) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    className={[
      'bg-white border border-ink-200 rounded-lg shadow-card overflow-hidden',
      !flush && 'p-5',
      onClick && 'cursor-pointer hover:shadow-md transition-shadow',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);
