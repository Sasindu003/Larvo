import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, PackageOpen, SlidersHorizontal, ArrowLeft, X } from 'lucide-react';
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

function filtersFromParams(params: URLSearchParams, defaultCat: string): ActiveFilters {
  return {
    department: params.get('department') || '',
    category: defaultCat,
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    size: params.get('size') || '',
    color: params.get('color') || '',
    inStock: params.get('inStock') === 'true',
  };
}

export const CategoryPage: React.FC = () => {
  const { deptSlug, catSlug } = useParams<{ deptSlug: string; catSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const currentSort = searchParams.get('sort') || '';
  const filters = filtersFromParams(searchParams, catSlug || '');

  const [department, setDepartment] = useState<Department | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [productsData, setProductsData] = useState<PaginatedProductsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Fetch department and category info
  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      departmentService.getDepartments(),
      categoryService.getCategories(),
    ])
      .then(([depts, cats]) => {
        if (!isCurrent) return;

        const currentDept = depts.find((d) => d.slug.toLowerCase() === deptSlug?.toLowerCase());
        const currentCat = cats.find((c) => c.slug.toLowerCase() === catSlug?.toLowerCase());

        setDepartment(currentDept || null);
        setCategory(currentCat || null);
        setAllCategories(cats);
      })
      .catch((err) => {
        if (isCurrent) console.error('Failed to load category metadata:', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [deptSlug, catSlug]);

  // Fetch products for this category
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    productService
      .getProducts({
        page: currentPage,
        limit: 12,
        category: catSlug,
        sort: currentSort || undefined,
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
          setError(err.message || 'Failed to load category products');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [catSlug, currentPage, currentSort, searchParams]);

  const updateParam = useCallback(
    (key: string, value: string | boolean) => {
      const newParams = new URLSearchParams(searchParams);
      const strVal = String(value);
      if (!strVal || strVal === 'false') {
        newParams.delete(key);
      } else {
        newParams.set(key, strVal);
      }
      newParams.set('page', '1');
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (key: keyof ActiveFilters, value: string | boolean) => {
      if (key === 'category') {
        // If changing category from sidebar, we can let user browse other categories
        if (typeof value === 'string' && value && value !== catSlug) {
          // Find department for that category if any
          const targetCat = allCategories.find((c) => c.slug === value);
          const targetDeptSlug =
            typeof targetCat?.department === 'object' && targetCat?.department !== null
              ? (targetCat.department as any).slug
              : deptSlug;
          window.location.href = `/departments/${targetDeptSlug || deptSlug}/categories/${value}`;
          return;
        }
      }
      updateParam(key, value);
    },
    [updateParam, catSlug, allCategories, deptSlug]
  );

  const handleClearAll = useCallback(() => {
    const newParams = new URLSearchParams();
    const sort = searchParams.get('sort');
    if (sort) newParams.set('sort', sort);
    setSearchParams(newParams, { replace: true });
    setMobileFiltersOpen(false);
  }, [searchParams, setSearchParams]);

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

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen pb-16">
      {/* Breadcrumbs */}
      <div className="bg-white border-b border-sand-200">
        <div className="container mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-2 text-xs font-medium text-ink-500 overflow-x-auto">
          <Link to="/" className="hover:text-ink-950 transition-colors whitespace-nowrap">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-ink-300 flex-shrink-0" />
          <Link to="/products" className="hover:text-ink-950 transition-colors whitespace-nowrap">Catalog</Link>
          <ChevronRight className="w-3.5 h-3.5 text-ink-300 flex-shrink-0" />
          {department ? (
            <>
              <Link to={`/departments/${department.slug}`} className="hover:text-ink-950 transition-colors whitespace-nowrap">
                {department.name}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-ink-300 flex-shrink-0" />
            </>
          ) : null}
          <span className="text-ink-950 font-semibold whitespace-nowrap">
            {category?.name || catSlug}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8">
        {/* Page Title & Controls */}
        <div className="border-b border-sand-200 pb-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <Link
                to={department ? `/departments/${department.slug}` : '/products'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-950 transition-colors mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {department ? department.name : 'Catalog'}</span>
              </Link>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-950">
                {category?.name || catSlug}
              </h1>
              <p className="text-sm text-ink-600 mt-1.5 max-w-xl">
                Browse our active {category?.name || catSlug} collection under the {department?.name || 'catalog'} department.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto flex-shrink-0">
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

              <SortDropdown value={currentSort} onChange={handleSortChange} />
            </div>
          </div>
        </div>

        {/* Layout: Sidebar + Products */}
        <div className="flex gap-8">
          <FilterSidebar
            categories={allCategories}
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAll}
            open={mobileFiltersOpen}
            onClose={() => setMobileFiltersOpen(false)}
          />

          <div className="flex-1 min-w-0 space-y-6">
            {/* Active Status bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-ink-500 font-medium">
                {productsData && !loading ? (
                  <>
                    Showing{' '}
                    <strong className="text-ink-900">
                      {productsData.total === 0 ? 0 : (currentPage - 1) * 12 + 1}–
                      {Math.min(currentPage * 12, productsData.total)}
                    </strong>{' '}
                    of <strong className="text-ink-900">{productsData.total}</strong> products in {category?.name || catSlug}
                  </>
                ) : (
                  'Loading products...'
                )}
              </span>

              {/* Active Filter Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {filters.size && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ink-100 text-ink-800 text-[11px] font-semibold">
                      Size: {filters.size}
                      <button type="button" onClick={() => handleFilterChange('size', '')}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filters.color && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ink-100 text-ink-800 text-[11px] font-semibold">
                      Color: {filters.color}
                      <button type="button" onClick={() => handleFilterChange('color', '')}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {(filters.minPrice || filters.maxPrice) && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ink-100 text-ink-800 text-[11px] font-semibold">
                      ${filters.minPrice || '0'}–${filters.maxPrice || '∞'}
                      <button type="button" onClick={() => { handleFilterChange('minPrice', ''); handleFilterChange('maxPrice', ''); }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filters.inStock && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-ink-100 text-ink-800 text-[11px] font-semibold">
                      In Stock
                      <button type="button" onClick={() => handleFilterChange('inStock', false)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
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

            {/* Product Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3">
                <p className="text-danger font-medium text-sm">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => handlePageChange(currentPage)}>
                  Retry
                </Button>
              </div>
            ) : productsData && productsData.items.length === 0 ? (
              <div className="bg-sand-50 border border-dashed border-sand-300 rounded-2xl p-12 text-center space-y-4">
                <div className="flex justify-center">
                  <PackageOpen className="w-12 h-12 text-ink-400" />
                </div>
                <h3 className="font-display text-xl font-bold text-ink-950">No products in this category</h3>
                <p className="text-xs text-ink-600 max-w-sm mx-auto">
                  No active products match your current filters in {category?.name || catSlug}.
                </p>
                <Button variant="secondary" size="sm" onClick={handleClearAll}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div
                data-testid="category-product-grid"
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
    </div>
  );
};

export default CategoryPage;
