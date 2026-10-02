import React from 'react';
import { ArrowUpDown } from 'lucide-react';

export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'popular';

interface SortDropdownProps {
  value: string;
  onChange: (value: SortOption | '') => void;
  className?: string;
}

export const SORT_OPTIONS: { label: string; value: SortOption | '' }[] = [
  { label: 'Newest Arrivals', value: '' }, // default / newest
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Most Popular', value: 'popular' },
];

export const SortDropdown: React.FC<SortDropdownProps> = ({
  value,
  onChange,
  className = '',
}) => {
  // Normalize value for backwards compatibility (e.g. price-asc -> price_asc, rating -> popular)
  const normalizedValue =
    value === 'price-asc'
      ? 'price_asc'
      : value === 'price-desc'
      ? 'price_desc'
      : value === 'rating'
      ? 'popular'
      : value === 'newest'
      ? ''
      : value;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ArrowUpDown className="w-3.5 h-3.5 text-ink-500 hidden sm:block" />
      <span className="text-xs font-medium text-ink-600 hidden sm:block">Sort by:</span>
      <select
        id="sort-select"
        aria-label="Sort products"
        value={normalizedValue}
        onChange={(e) => onChange(e.target.value as SortOption | '')}
        className="bg-white border border-sand-300 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm focus:outline-none focus:border-ink-700 focus:ring-1 focus:ring-ink-200 cursor-pointer"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SortDropdown;
