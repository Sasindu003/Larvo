import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { productService, Product } from '../../services/product.service';
import { categoryService, Category } from '../../services/category.service';
import { ProductCard } from '../product/ProductCard';
import { SkeletonCard } from '../ui/Skeleton';
import { Button } from '../ui/Button';

export const TrendingProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load top categories for filter pills
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await categoryService.getCategories();
        if (Array.isArray(cats)) {
          setCategories(cats.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load filter categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch trending products whenever active category changes
  const fetchTrending = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        sort: 'popular',
        limit: 8,
      };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }

      const res = await productService.getProducts(params);
      setProducts(res?.items || []);
    } catch (err: any) {
      console.error('Failed to load trending products:', err);
      setError(err?.message || 'Unable to load trending products at this time');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending();
  }, [selectedCategory]);

  return (
    <section id="trending-section" aria-label="Trending Products & Best Sellers" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            <span>Customer Favorites</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight">
            Trending Products & Best Sellers
          </h2>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            High-demand silhouettes, standout garments, and highest-rated wardrobe pieces.
          </p>
        </div>

        <Link
          to="/products?sort=popular"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-800 hover:text-ink-950 group"
        >
          <span>Explore All Trending</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`h-8 px-4 rounded-full text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 ${
            selectedCategory === 'all'
              ? 'bg-ink-950 text-white shadow-sm'
              : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
          }`}
        >
          All Trending
        </button>
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => setSelectedCategory(cat.slug || cat._id)}
            className={`h-8 px-4 rounded-full text-xs font-semibold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 ${
              selectedCategory === (cat.slug || cat._id)
                ? 'bg-ink-950 text-white shadow-sm'
                : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-8 rounded-xl bg-danger-light/30 border border-danger/20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-danger mx-auto" />
          <p className="text-sm font-medium text-ink-900">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchTrending} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="p-12 text-center border border-dashed border-ink-300 rounded-xl bg-ink-50 space-y-2">
          <p className="text-sm text-ink-600 font-medium">No trending items found in this category.</p>
          <button
            onClick={() => setSelectedCategory('all')}
            className="text-xs text-ink-900 underline font-semibold"
          >
            View all categories
          </button>
        </div>
      )}

      {/* Products Grid */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
};

export default TrendingProducts;
