import React, { useEffect, useRef } from 'react';
import { X, Tag, DollarSign, Ruler, Palette, Package, Layers } from 'lucide-react';
import { Category } from '../../services/category.service';
import { Department } from '../../services/department.service';

export interface ActiveFilters {
  department?: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  size: string;
  color: string;
  inStock: boolean;
}

interface FilterSidebarProps {
  departments?: Department[];
  categories: Category[];
  filters: ActiveFilters;
  onFilterChange: (key: keyof ActiveFilters, value: string | boolean) => void;
  onClearAll: () => void;
  /** Mobile slide-over */
  open: boolean;
  onClose: () => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
const COLORS = [
  'Black', 'White', 'Navy', 'Grey', 'Beige', 'Cream', 'Charcoal',
  'Brown', 'Rust Brown', 'Sage Green', 'Terracotta', 'Deep Burgundy',
  'Camel', 'Ivory', 'Oatmeal',
];

// Count how many filters are active
export function countActiveFilters(f: ActiveFilters): number {
  let n = 0;
  if (f.department) n++;
  if (f.category) n++;
  if (f.minPrice) n++;
  if (f.maxPrice) n++;
  if (f.size) n++;
  if (f.color) n++;
  if (f.inStock) n++;
  return n;
}

const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-ink-500">{icon}</span>
    <span className="text-[11px] font-bold uppercase tracking-widest text-ink-500">{label}</span>
  </div>
);

const FilterSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`border-b border-sand-200 pb-5 mb-5 last:border-0 last:mb-0 ${className}`}>
    {children}
  </div>
);

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  departments = [],
  categories,
  filters,
  onFilterChange,
  onClearAll,
  open,
  onClose,
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Trap click-outside for mobile
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose]);

  const activeCount = countActiveFilters(filters);

  // Filter categories that belong to the active department
  const displayedCategories = categories.filter((cat) => {
    if (!filters.department) return true;
    const dept = cat.department;
    if (!dept) return false;
    if (typeof dept === 'object') {
      return (
        (dept as any).slug === filters.department ||
        (dept as any)._id === filters.department
      );
    }
    return dept === filters.department;
  });

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-sand-200">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-bold text-ink-950">Filters</span>
          {activeCount > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-ink-950 text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] font-semibold text-ink-500 hover:text-ink-900 underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          )}
          {/* Mobile close button */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1 rounded-full text-ink-400 hover:text-ink-900 hover:bg-sand-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0 pr-1">
        {/* ── Department ───────────────────────────────────────────────── */}
        <FilterSection>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle icon={<Layers className="w-3.5 h-3.5" />} label="Department" />
            {filters.department && (
              <button
                type="button"
                onClick={() => onFilterChange('department', '')}
                className="text-[10px] text-ink-400 hover:text-ink-700 underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="department"
                checked={!filters.department}
                onChange={() => onFilterChange('department', '')}
                className="w-3.5 h-3.5 accent-ink-900"
              />
              <span className="text-xs font-medium text-ink-800 group-hover:text-ink-950">All Departments</span>
            </label>
            {departments.map((dept) => (
              <label key={dept._id} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="department"
                  checked={filters.department === dept.slug || filters.department === dept._id}
                  onChange={() => {
                    const nextDept = dept.slug;
                    onFilterChange('department', nextDept);
                    // Reset category if currently selected category doesn't belong to this department
                    if (filters.category) {
                      const curCat = categories.find((c) => c.slug === filters.category);
                      const catDept = curCat?.department;
                      const catDeptId = typeof catDept === 'object' ? (catDept as any)?._id || (catDept as any)?.slug : catDept;
                      const catDeptSlug = typeof catDept === 'object' ? (catDept as any)?.slug : undefined;
                      const matches = catDeptId === dept._id || catDeptSlug === dept.slug || catDeptId === dept.slug;
                      if (!matches) {
                        onFilterChange('category', '');
                      }
                    }
                  }}
                  className="w-3.5 h-3.5 accent-ink-900"
                />
                <span className="text-xs font-medium text-ink-700 group-hover:text-ink-950">{dept.name}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* ── Category (narrowed by Department) ─────────────────────────── */}
        <FilterSection>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle icon={<Tag className="w-3.5 h-3.5" />} label="Category" />
            {filters.category && (
              <button
                type="button"
                onClick={() => onFilterChange('category', '')}
                className="text-[10px] text-ink-400 hover:text-ink-700 underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={!filters.category}
                onChange={() => onFilterChange('category', '')}
                className="w-3.5 h-3.5 rounded text-ink-900 accent-ink-900 focus:ring-ink-500"
              />
              <span className="text-xs font-medium text-ink-800 group-hover:text-ink-950">All Categories</span>
            </label>
            {displayedCategories.length === 0 ? (
              <p className="text-xs text-ink-400 italic py-1">No categories in this department</p>
            ) : (
              displayedCategories.map((cat) => (
                <label key={cat._id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.category === cat.slug}
                    onChange={() => onFilterChange('category', filters.category === cat.slug ? '' : cat.slug)}
                    className="w-3.5 h-3.5 rounded text-ink-900 accent-ink-900 focus:ring-ink-500"
                  />
                  <span className="text-xs font-medium text-ink-700 group-hover:text-ink-950">{cat.name}</span>
                </label>
              ))
            )}
          </div>
        </FilterSection>

        {/* ── Price Range ────────────────────────────────────────────── */}
        <FilterSection>
          <SectionTitle icon={<DollarSign className="w-3.5 h-3.5" />} label="Price Range" />
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-400 font-medium pointer-events-none">Rs.</span>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => onFilterChange('minPrice', e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 text-xs bg-sand-50 border border-sand-300 rounded-lg text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-ink-700 focus:ring-1 focus:ring-ink-200"
              />
            </div>
            <span className="text-xs text-ink-400 font-medium">–</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-ink-400 font-medium pointer-events-none">Rs.</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => onFilterChange('maxPrice', e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 text-xs bg-sand-50 border border-sand-300 rounded-lg text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-ink-700 focus:ring-1 focus:ring-ink-200"
              />
            </div>
          </div>
          {(filters.minPrice || filters.maxPrice) && (
            <button
              type="button"
              onClick={() => { onFilterChange('minPrice', ''); onFilterChange('maxPrice', ''); }}
              className="mt-2 text-[11px] text-ink-400 hover:text-ink-700 underline underline-offset-2"
            >
              Clear price range
            </button>
          )}
        </FilterSection>

        {/* ── Size ──────────────────────────────────────────────────── */}
        <FilterSection>
          <SectionTitle icon={<Ruler className="w-3.5 h-3.5" />} label="Size" />
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onFilterChange('size', filters.size === s ? '' : s)}
                aria-pressed={filters.size === s}
                className={[
                  'h-9 min-w-[36px] px-2.5 rounded-md border text-xs font-semibold transition-all',
                  filters.size === s
                    ? 'bg-ink-950 text-white border-ink-950 shadow-sm'
                    : 'bg-white border-sand-300 text-ink-700 hover:border-ink-700 hover:bg-sand-50',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* ── Color ─────────────────────────────────────────────────── */}
        <FilterSection>
          <SectionTitle icon={<Palette className="w-3.5 h-3.5" />} label="Color" />
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => {
              const isActive = filters.color.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onFilterChange('color', isActive ? '' : c)}
                  aria-pressed={isActive}
                  className={[
                    'px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all',
                    isActive
                      ? 'bg-ink-950 text-white border-ink-950 shadow-sm'
                      : 'bg-white border-sand-200 text-ink-700 hover:border-ink-500 hover:bg-sand-50',
                  ].join(' ')}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* ── Availability ──────────────────────────────────────────── */}
        <FilterSection>
          <SectionTitle icon={<Package className="w-3.5 h-3.5" />} label="Availability" />
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              role="switch"
              aria-checked={filters.inStock}
              onClick={() => onFilterChange('inStock', !filters.inStock)}
              className={[
                'relative w-9 h-5 rounded-full transition-colors cursor-pointer border',
                filters.inStock
                  ? 'bg-ink-950 border-ink-950'
                  : 'bg-sand-200 border-sand-300',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                  filters.inStock ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')}
              />
            </div>
            <span className="text-xs font-medium text-ink-700 group-hover:text-ink-950">
              In Stock Only
            </span>
          </label>
        </FilterSection>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always-visible sidebar */}
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <div className="sticky top-28 bg-white border border-sand-200 rounded-xl p-4 shadow-sm">
          {content}
        </div>
      </aside>

      {/* Mobile: slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div
            ref={sidebarRef}
            className="fixed inset-y-0 right-0 w-72 max-w-full bg-white shadow-2xl border-l border-sand-200 flex flex-col z-50 animate-fade-in"
          >
            <div className="flex-1 overflow-y-auto p-5">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilterSidebar;
