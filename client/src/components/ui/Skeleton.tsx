import React from 'react';

export interface SkeletonProps {
  /** Width class (e.g. 'w-32', 'w-full') */
  width?: string;
  /** Height class (e.g. 'h-4', 'h-40') */
  height?: string;
  /** Fully round — for avatars */
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = 'w-full',
  height = 'h-4',
  circle = false,
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={[
      width,
      height,
      circle ? 'rounded-full' : 'rounded',
      'bg-gradient-to-r from-ink-100 via-ink-50 to-ink-100',
      'bg-[length:600px_100%] animate-shimmer',
      className,
    ].join(' ')}
  />
);

/** Convenience wrapper for a product card skeleton */
export const SkeletonCard: React.FC = () => (
  <div className="bg-white border border-ink-200 rounded-lg overflow-hidden shadow-card">
    <Skeleton height="h-56" />
    <div className="p-4 space-y-2">
      <Skeleton height="h-3" width="w-1/3" />
      <Skeleton height="h-5" />
      <Skeleton height="h-4" width="w-1/2" />
    </div>
  </div>
);
