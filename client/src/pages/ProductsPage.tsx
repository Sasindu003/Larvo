import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PackageOpen, Search, X, SlidersHorizontal } from 'lucide-react';
import { productService, Product, PaginatedProductsResponse } from '../services/product.service';
import { categoryService, Category } from '../services/category.service';
import { departmentService, Department } from '../services/department.service';
import { ProductCard } from '../components/product/ProductCard';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import {
  FilterSidebar,
  ActiveFilters,
  countActiveFilters,
} from '../components/product/FilterSidebar';
import { SortDropdown } from '../components/product/SortDropdown';

const EMPTY_FILTERS: ActiveFilters = {
  department: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  size: '',
  color: '',
  inStock: false,
};

function filtersFromParams(params: URLSearchParams): ActiveFilters {
  return {
    department: params.get('department') || '',
    category: params.get('category') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    size: params.get('size') || '',
    color: params.get('color') || '',
    inStock: params.get('inStock') === 'true',
  };
}

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const currentSort = searchParams.get('sort') || '';
  const currentQuery = searchParams.get('q') || '';
  const filters = filtersFromParams(searchParams);

  const [productsData, setProductsData] = useState<PaginatedProductsResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Fetch departments and categories once for filter sidebar
  useEffect(() => {
    Promise.all([
      departmentService.getDepartments().catch(() => [] as Department[]),
      categoryService.getCategories().catch(() => [] as Category[]),
    ]).then(([depts, cats]) => {
      setDepartments(depts);
      setCategories(cats);
    });
  }, []);

  // Fetch products whenever URL params change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    productService
      .getProducts({
        page: currentPage,
        limit: 12,
        department: filters.department || undefined,
        category: filters.category || undefined,
        sort: currentSort || undefined,
        q: currentQuery || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        size: filters.size || undefined,
        color: filters.color || undefined,
        inStock: filters.inStock ? 'true' : undefined,
      })
      .then((data) => {
        if (isMounted) {
          setProductsData(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Failed to load products');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [searchParams]); // re-run on any URL param change

  // ── URL update helpers ────────────────────────────────────────────────────
  const updateParam = useCallback(
    (key: string, value: string | boolean) => {
      const newParams = new URLSearchParams(searchParams);
      const strVal = String(value);
      if (!strVal || strVal === 'false') {
        newParams.delete(key);
      } else {
        newParams.set(key, strVal);
      }
      newParams.set('page', '1'); // reset page on filter change
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (key: keyof ActiveFilters, value: string | boolean) => {
      updateParam(key, value);
    },
    [updateParam]
  );

  const handleClearAll = useCallback(() => {
    const newParams = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) newParams.set('q', q);
    const sort = searchParams.get('sort');
    if (sort) newParams.set('sort', sort);
    setSearchParams(newParams, { replace: true });
    setMobileFiltersOpen(false);
  }, [searchParams, setSearchParams]);

  const handleClearSearch = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('q');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleSortChange = (sortVal: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (sortVal) newParams.set('sort', sortVal);
    else newParams.delete('sort');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    if (!productsData || newPage < 1 || newPage > productsData.pages) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeDepartmentObj = departments.find(
    (d) => d.slug === filters.department || d._id === filters.department
  );
  const activeCategoryObj = categories.find((c) => c.slug === filters.category);
  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen py-8">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-sand-200 pb-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              {currentQuery ? 'Search Catalog' : 'Catalog Collection'}
            </span>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-950 mt-1 flex flex-wrap items-center gap-3">
              {currentQuery ? (
                <>
                  <span>Results for "{currentQuery}"</span>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-sand-200 text-ink-700 hover:bg-sand-300 rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear Search
                  </button>
                </>
              ) : activeCategoryObj ? (
                activeCategoryObj.name
              ) : activeDepartmentObj ? (
                `${activeDepartmentObj.name}'s Collection`
              ) : (
                'All Products'
              )}
            </h1>
            <p className="text-sm text-ink-600 mt-1.5 max-w-xl">
              {currentQuery
                ? `Fashion products matching '${currentQuery}'.`
                : activeDepartmentObj
                ? `Discover curated luxury apparel and accessories for ${activeDepartmentObj.name}.`
                : 'Discover curated luxury apparel, tailored silhouettes, and versatile wardrobe essentials.'}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-shrink-0">
            {/* Mobile: Filters trigger */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 border border-sand-300 rounded-lg text-xs font-semibold text-ink-800 hover:bg-sand-100 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-ink-950 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Selector */}
            <SortDropdown value={currentSort} onChange={handleSortChange} />
          </div>
        </div>
      </div>

      {/* ── Main Layout: Sidebar + Grid ──────────────────────────────────── */}
      <div className="flex gap-8">

        {/* Filter Sidebar (desktop always visible, mobile slide-over) */}
        <FilterSidebar
          departments={departments}
          categories={categories}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
        />

        {/* Right: Product Grid Area */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Stats + active filter tags row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-ink-500 font-medium">
              {productsData && !loading ? (
                <>
                  Showing{' '}
                  <strong className="text-ink-900">
                    {productsData.total === 0 ? 0 : (currentPage - 1) * 12 + 1}–
                    {Math.min(currentPage * 12, productsData.total)}
                  </strong>{' '}
                  of <strong className="text-ink-900">{productsData.total}</strong> products
                </>
              ) : (
                'Loading catalog products...'
              )}
            </span>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {filters.department && (
                  <FilterChip
                    label={`Dept: ${activeDepartmentObj?.name || filters.department}`}
                    onRemove={() => handleFilterChange('department', '')}
                  />
                )}
                {filters.category && (
                  <FilterChip
                    label={activeCategoryObj?.name || filters.category}
                    onRemove={() => handleFilterChange('category', '')}
                  />
                )}
                {filters.size && (
                  <FilterChip label={`Size: ${filters.size}`} onRemove={() => handleFilterChange('size', '')} />
                )}
                {filters.color && (
                  <FilterChip label={`Color: ${filters.color}`} onRemove={() => handleFilterChange('color', '')} />
                )}
                {(filters.minPrice || filters.maxPrice) && (
                  <FilterChip
                    label={`$${filters.minPrice || '0'}–$${filters.maxPrice || '∞'}`}
                    onRemove={() => {
                      handleFilterChange('minPrice', '');
                      handleFilterChange('maxPrice', '');
                    }}
                  />
                )}
                {filters.inStock && (
                  <FilterChip label="In Stock" onRemove={() => handleFilterChange('inStock', false)} />
                )}
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-ink-400 hover:text-ink-700 underline underline-offset-2 ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Grid / Loading / Empty */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3">
              <p className="text-danger font-medium text-sm">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => handlePageChange(currentPage)}>
                Retry Loading
              </Button>
            </div>
          ) : productsData && productsData.items.length === 0 ? (
            <div className="bg-sand-50 border border-dashed border-sand-300 rounded-2xl p-12 text-center space-y-4">
              <div className="flex justify-center">
                {currentQuery
                  ? <Search className="w-12 h-12 text-ink-400" />
                  : <PackageOpen className="w-12 h-12 text-ink-400" />
                }
              </div>
              <h3 className="font-display text-xl font-bold text-ink-950">
                {currentQuery ? `No products found matching "${currentQuery}"` : 'No products found'}
              </h3>
              <p className="text-xs text-ink-600 max-w-sm mx-auto">
                {currentQuery
                  ? 'Try checking your spelling, using broader terms, or explore our categories.'
                  : 'No products match the selected filters. Try adjusting or clearing your filters.'}
              </p>
              <div className="flex justify-center gap-2">
                {currentQuery && (
                  <Button variant="primary" size="sm" onClick={handleClearSearch}>Clear Search</Button>
                )}
                <Button variant="secondary" size="sm" onClick={handleClearAll}>
                  Clear Filters
                </Button>
              </div>
            </div>
          ) : (
            <div
              data-testid="product-grid"
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5"
            >
              {productsData?.items.map((prod: Product) => (
                <ProductCard key={prod._id} product={prod} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {productsData && productsData.pages > 1 && (
            <div className="pt-8 border-t border-sand-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1 || loading}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: productsData.pages }).map((_, i) => {
                  const pageNum = i + 1;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={[
                        'h-9 w-9 rounded-lg text-xs font-semibold transition-colors',
                        isActive
                          ? 'bg-ink-950 text-white shadow-sm'
                          : 'bg-white border border-sand-300 text-ink-700 hover:bg-sand-100',
                      ].join(' ')}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= productsData.pages || loading}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Helper component ──────────────────────────────────────────────────────────
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ink-100 text-ink-800 text-[11px] font-semibold">
    {label}
    <button
      type="button"
      onClick={onRemove}
      className="text-ink-500 hover:text-ink-900 ml-0.5 transition-colors"
    >
      <X className="w-3 h-3" />
    </button>
  </span>
);

export default ProductsPage;
