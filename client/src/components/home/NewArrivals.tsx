import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Flame } from 'lucide-react';
import { productService, Product } from '../../services/product.service';
import { ProductCard } from '../product/ProductCard';
import { SkeletonCard } from '../ui/Skeleton';
import { Button } from '../ui/Button';

export const NewArrivals: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchNewArrivals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await productService.getProducts({ sort: 'newest', limit: 8 });
      setProducts(res?.items || []);
    } catch (err: any) {
      console.error('Failed to load new arrivals:', err);
      setError(err?.message || 'Unable to load new arrivals at this time');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewArrivals();
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section id="new-arrivals-section" aria-label="New Season Arrivals" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-500 mb-1">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>Freshly Curated</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight">
            New Season Arrivals
          </h2>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            Discover the latest additions to our contemporary wardrobe collection.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Scroll Navigation Arrows */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              aria-label="Scroll new arrivals left"
              className="p-2 rounded-md border border-ink-300 text-ink-700 hover:bg-ink-100 active:bg-ink-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              aria-label="Scroll new arrivals right"
              className="p-2 rounded-md border border-ink-300 text-ink-700 hover:bg-ink-100 active:bg-ink-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/products?sort=newest"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-800 hover:text-ink-950 group"
          >
            <span>View All New In</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      )}

      {/* Error Fallback */}
      {!loading && error && (
        <div className="p-8 rounded-xl bg-danger-light/30 border border-danger/20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-danger mx-auto" />
          <p className="text-sm font-medium text-ink-900">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchNewArrivals} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="p-12 text-center border border-dashed border-ink-300 rounded-xl bg-ink-50 space-y-2">
          <p className="text-sm text-ink-600 font-medium">No new arrivals available right now.</p>
          <Link to="/products" className="text-xs text-ink-900 underline font-semibold">
            Browse all products
          </Link>
        </div>
      )}

      {/* Products Carousel / Horizontal Grid */}
      {!loading && !error && products.length > 0 && (
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-ink-200 hover:scrollbar-thumb-ink-300 scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {products.map((product) => (
            <div
              key={product._id}
              className="w-[240px] sm:w-[280px] shrink-0 snap-start transition-transform hover:-translate-y-1"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default NewArrivals;
