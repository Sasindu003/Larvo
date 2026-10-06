import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { categoryService, Category } from '../../services/category.service';
import { getFileUrl } from '../../services/api';
import { Skeleton } from '../ui/Skeleton';
import { FanCardCarousel, FanCardItem } from './FanCardCarousel';

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

  // Curated fallback categories if database is empty or loading
  const fallbackCategories: FanCardItem[] = [
    {
      id: 'cat-formal',
      title: 'Formal',
      subtitle: 'Tailored Suiting & Elegance',
      tag: 'SIGNATURE',
      image:
        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
      slug: 'formal',
      link: '/products?category=formal',
    },
    {
      id: 'cat-casual',
      title: 'Casual',
      subtitle: 'Effortless Modern Staples',
      tag: 'POPULAR',
      image:
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
      slug: 'casual',
      link: '/products?category=casual',
    },
    {
      id: 'cat-knitwear',
      title: 'Knitwear',
      subtitle: 'Pure Merino & Organic Blends',
      tag: 'NEW ARRIVAL',
      image:
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
      slug: 'knitwear',
      link: '/products?category=knitwear',
    },
    {
      id: 'cat-outerwear',
      title: 'Outerwear',
      subtitle: 'Structured Coats & Layers',
      tag: 'ESSENTIAL',
      image:
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
      slug: 'outerwear',
      link: '/products?category=outerwear',
    },
    {
      id: 'cat-footwear',
      title: 'Footwear',
      subtitle: 'Handcrafted Leather & Suede',
      tag: 'CURATED',
      image:
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      slug: 'footwear',
      link: '/products?category=footwear',
    },
  ];

  // Map API categories to FanCardItem format
  const fanCards: FanCardItem[] =
    categories.length > 0
      ? categories.map((cat, idx) => {
          const deptName =
            typeof cat.department === 'object' && cat.department?.name
              ? `${cat.department.name} Collection`
              : 'Curated Collection';

          const tagLabels = ['SIGNATURE', 'POPULAR', 'NEW ARRIVAL', 'ESSENTIAL', 'FEATURED'];
          const tag = tagLabels[idx % tagLabels.length];

          const resolvedImg = cat.image
            ? getFileUrl(cat.image)
            : fallbackCategories[idx % fallbackCategories.length].image;

          return {
            id: cat._id,
            title: cat.name,
            subtitle: deptName,
            tag,
            image: resolvedImg,
            slug: cat.slug,
            link: `/products?category=${cat.slug}`,
          };
        })
      : fallbackCategories;

  return (
    <section id="categories-section" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5DED4] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#B3792B] mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#B3792B]" />
            <span>Curated Collections</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1F1B16] tracking-tight">
            Shop by Category
          </h2>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F1B16] hover:text-[#786E64] group"
        >
          <span>Explore All Collections</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Loading Skeletons State */}
      {loading && (
        <div className="py-12 flex justify-center items-center">
          <div className="w-full max-w-4xl h-[460px] flex items-center justify-center">
            <div className="relative w-[340px] h-[450px]">
              <Skeleton height="h-full" width="w-full rounded-[28px]" />
            </div>
          </div>
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

      {/* Interactive FanCardCarousel */}
      {!loading && !error && (
        <div
          className="rounded-[28px] bg-white border-[5px] border-[#FAF7F2] px-1 sm:px-3 md:px-4"
          style={{ boxShadow: '0 16px 40px -12px rgba(45, 35, 25, 0.08)' }}
        >
          <FanCardCarousel
            cards={fanCards}
            cardWidth={330}
            cardHeight={450}
            fanSpread={145}
            rotationAngle={6}
            cardRadius={26}
          />
        </div>
      )}
    </section>
  );
};

export default CategoryGrid;
