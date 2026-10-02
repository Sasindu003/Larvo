import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { categoryService, Category } from '../../services/category.service';
import { Skeleton } from '../ui/Skeleton';

export const CategoryGrid: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await categoryService.getCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError(err?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <section id="categories-section" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-500 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Curated Collections</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight">
            Shop by Category
          </h2>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-800 hover:text-ink-950 group"
        >
          <span>Explore All Collections</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Loading Skeletons State */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 9 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl overflow-hidden shadow-card border border-ink-200 bg-white">
              <Skeleton height="h-64 sm:h-80" width="w-full" />
              <div className="p-4 space-y-2">
                <Skeleton height="h-5" width="w-1/2" />
                <Skeleton height="h-3" width="w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Fallback */}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-rose-800">{error}</p>
          <button
            onClick={fetchCategories}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink-900 hover:bg-ink-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Real Category Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
          {categories.map((cat, idx) => (
            <Link
              key={cat._id || cat.slug || idx}
              to={`/products?category=${cat.slug}`}
              className="group relative overflow-hidden rounded-2xl bg-ink-900 shadow-card aspect-[3/4] sm:aspect-[4/5] flex flex-col justify-end p-5 sm:p-6 transition-all duration-300 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ink-900 focus:ring-offset-2"
            >
              {/* Background Image with Zoom on Hover */}
              <img
                src={cat.image}
                alt={cat.name}
                className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-110"
                loading="lazy"
              />

              {/* Gradient Dark Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent transition-opacity duration-300 group-hover:opacity-90" />

              {/* Foreground Category Content */}
              <div className="relative z-10 space-y-1 transform transition-transform duration-300 group-hover:-translate-y-1">
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm rounded">
                  Collection
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-wide">
                  {cat.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-cream-200 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 pt-1">
                  <span>Shop Collection</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
