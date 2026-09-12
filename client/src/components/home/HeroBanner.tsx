import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, Sparkles, Truck, Undo2 } from 'lucide-react';
import { productService, Product } from '../../services/product.service';
import { Skeleton } from '../ui/Skeleton';

interface HeroSlide {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  image: string;
  badgeText?: string;
  price?: number;
}

export const HeroBanner: React.FC = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadHeroContent = async () => {
      try {
        setLoading(true);
        const res = await productService.getProducts({ limit: 4, sort: 'popular' });
        const items = res?.items || [];

        if (items.length > 0 && isMounted) {
          const mappedSlides: HeroSlide[] = items.map((product: Product, idx: number) => {
            const editorialTitles = [
              'The Tailored Silhouette',
              'Effortless Contemporary Cuts',
              'Architectural Knitwear & Layers',
              'Refined Everyday Luxury',
            ];
            const editorialSubtitles = [
              'Impeccable wool-blends and precision tailoring crafted for timeless distinction.',
              'Clean lines meet unstructured modern silhouettes, designed to elevate your routine.',
              'Sumptuous merino yarns, dense organic weaves, and nuanced tonal hues.',
              'Versatile wardrobe staples cut with modern precision and sustainable fibers.',
            ];

            return {
              id: product._id,
              tag: `Autumn/Winter Editorial 0${idx + 1}`,
              title: editorialTitles[idx % editorialTitles.length],
              subtitle: product.description || editorialSubtitles[idx % editorialSubtitles.length],
              ctaText: `Explore ${product.name}`,
              ctaLink: `/products/${product.slug}`,
              secondaryCtaText: 'View All Products',
              secondaryCtaLink: '/products',
              image:
                product.images?.[0] ||
                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1600&q=85',
              badgeText: product.discountPrice ? 'Special Curation' : 'Signature Piece',
              price: product.discountPrice || product.basePrice,
            };
          });
          setSlides(mappedSlides);
        } else if (isMounted) {
          // Fallback if no products yet
          setSlides([
            {
              id: 'fallback-1',
              tag: 'New Season Lookbook',
              title: 'The Contemporary Standard',
              subtitle: 'Tailored silhouettes, organic textiles, and thoughtful wardrobe foundations.',
              ctaText: 'Explore Collections',
              ctaLink: '/products',
              secondaryCtaText: 'Shop New In',
              secondaryCtaLink: '/products?sort=newest',
              image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=85',
              badgeText: 'New Season',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load hero banner data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHeroContent();
    return () => {
      isMounted = false;
    };
  }, []);

  const nextSlide = useCallback(() => {
    setSlides((prev) => {
      if (prev.length === 0) return prev;
      setCurrentSlide((curr) => (curr + 1) % prev.length);
      return prev;
    });
  }, []);

  const prevSlide = useCallback(() => {
    setSlides((prev) => {
      if (prev.length === 0) return prev;
      setCurrentSlide((curr) => (curr - 1 + prev.length) % prev.length);
      return prev;
    });
  }, []);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const interval = setInterval(nextSlide, 5500);
    return () => clearInterval(interval);
  }, [slides.length, isPaused, nextSlide]);

  if (loading) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-ink-100 min-h-[460px] sm:min-h-[520px] flex items-center p-8 sm:p-14">
        <div className="max-w-xl space-y-4">
          <Skeleton height="h-6" width="w-32" />
          <Skeleton height="h-14" width="w-3/4" />
          <Skeleton height="h-10" width="w-full" />
          <div className="flex gap-4 pt-4">
            <Skeleton height="h-12" width="w-36" />
            <Skeleton height="h-12" width="w-36" />
          </div>
        </div>
      </section>
    );
  }

  if (slides.length === 0) return null;

  const slide = slides[currentSlide];

  return (
    <section
      id="hero-section"
      aria-label="Featured Fashion Collections"
      className="relative overflow-hidden rounded-2xl bg-ink-950 text-white shadow-card transition-all"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image Container with Soft Dark Overlay */}
      <div className="relative min-h-[480px] sm:min-h-[540px] lg:min-h-[580px] flex items-center">
        <div className="absolute inset-0 z-0">
          <img
            key={slide.id}
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover object-center filter brightness-[0.62] contrast-[1.05] transition-all duration-700 ease-out scale-100"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-black/20" />
        </div>

        {/* Content Column */}
        <div className="relative z-10 max-w-2xl px-6 sm:px-12 lg:px-16 py-12 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold tracking-wider uppercase text-sand-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{slide.tag}</span>
            {slide.badgeText && (
              <span className="ml-1 pl-2 border-l border-white/20 text-cream-300 font-bold">
                {slide.badgeText}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            {slide.title}
          </h1>

          <p className="text-sm sm:text-base text-ink-200 font-light max-w-lg leading-relaxed line-clamp-3">
            {slide.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              to={slide.ctaLink}
              className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-md bg-white text-ink-950 font-semibold text-xs sm:text-sm tracking-wide shadow-md hover:bg-cream-100 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>{slide.ctaText}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            {slide.secondaryCtaLink && (
              <Link
                to={slide.secondaryCtaLink}
                className="inline-flex items-center justify-center h-11 sm:h-12 px-6 rounded-md bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold text-xs sm:text-sm tracking-wide hover:bg-white/20 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {slide.secondaryCtaText || 'Explore Catalog'}
              </Link>
            )}
          </div>
        </div>

        {/* Slide Controls (Previous / Next Buttons) */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 right-6 z-20 hidden sm:flex items-center gap-2">
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="p-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white hover:bg-white/30 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="p-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white hover:bg-white/30 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Brand Value Propositions Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-t border-white/10 bg-ink-950/90 text-ink-300 py-3.5 px-6 sm:px-12 text-xs">
        <div className="flex items-center gap-3 py-2 sm:py-0 justify-start sm:justify-center">
          <Truck className="w-4 h-4 text-sand-300 shrink-0" />
          <span className="font-medium text-ink-200">Express Delivery on Orders $150+</span>
        </div>
        <div className="flex items-center gap-3 py-2 sm:py-0 justify-start sm:justify-center">
          <ShieldCheck className="w-4 h-4 text-sand-300 shrink-0" />
          <span className="font-medium text-ink-200">Ethically Sourced Natural Fibers</span>
        </div>
        <div className="flex items-center gap-3 py-2 sm:py-0 justify-start sm:justify-center">
          <Undo2 className="w-4 h-4 text-sand-300 shrink-0" />
          <span className="font-medium text-ink-200">Hassle-Free 30-Day Return Policy</span>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
