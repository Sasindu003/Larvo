import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Truck, ShieldCheck, Undo2 } from 'lucide-react';
import { productService, Product } from '../../services/product.service';
import { getFileUrl } from '../../services/api';
import { Skeleton } from '../ui/Skeleton';
import { ShowcaseSlideshow, ShowcaseSlide } from './ShowcaseSlideshow';

interface HeroEditorialSlide {
  id: string;
  tag: string;
  titlePrefix: string;
  titleHighlight: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  image: string;
  label: string;
  badgeText?: string;
  price?: number;
}

export const HeroBanner: React.FC = () => {
  const [slides, setSlides] = useState<HeroEditorialSlide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHeroContent = async () => {
      try {
        setLoading(true);
        const res = await productService.getProducts({ limit: 4, sort: 'popular' });
        const items = res?.items || [];

        if (items.length > 0 && isMounted) {
          const editorialHeadlines = [
            { prefix: 'Build Wardrobe,', highlight: 'Remarkable.' },
            { prefix: 'Tailored Form,', highlight: 'Modern Precision.' },
            { prefix: 'Effortless Cuts,', highlight: 'Quiet Luxury.' },
            { prefix: 'Seasonal Texture,', highlight: 'Timeless Appeal.' },
          ];

          const editorialSubtitles = [
            'A premium starting point for your seasonal wardrobe. Precision tailoring, sustainable natural fibers, and silhouettes that stand apart in minutes.',
            'Clean lines meet unstructured modern silhouettes, meticulously designed to elevate your everyday routine.',
            'Sumptuous organic merino yarns, dense weaves, and nuanced tonal hues crafted for distinction.',
            'Versatile wardrobe foundations cut with architectural precision and ethically sourced textiles.',
          ];

          const mapped: HeroEditorialSlide[] = items.map((product: Product, idx: number) => {
            const headline = editorialHeadlines[idx % editorialHeadlines.length];
            const rawImg = product.images?.[0];
            const resolvedImg = rawImg
              ? getFileUrl(rawImg)
              : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=85';

            return {
              id: product._id,
              tag: `Autumn/Winter Editorial 0${idx + 1}`,
              titlePrefix: headline.prefix,
              titleHighlight: headline.highlight,
              subtitle: product.description || editorialSubtitles[idx % editorialSubtitles.length],
              ctaText: `Explore ${product.name}`,
              ctaLink: `/products/${product.slug}`,
              secondaryCtaText: 'View Lookbook',
              secondaryCtaLink: '/products',
              image: resolvedImg,
              label: product.name,
              badgeText: product.discountPrice ? 'Special Curation' : 'Signature Piece',
              price: product.discountPrice || product.basePrice,
            };
          });

          setSlides(mapped);
        } else if (isMounted) {
          // Fallback if catalog is initially empty
          setSlides([
            {
              id: 'fallback-1',
              tag: 'New Season Lookbook',
              titlePrefix: 'Build Wardrobe,',
              titleHighlight: 'Remarkable.',
              subtitle:
                'A premium starting point for your seasonal wardrobe. Swap the copy, drop in your images, and launch something that stands out in minutes.',
              ctaText: 'Explore Collections',
              ctaLink: '/products',
              secondaryCtaText: 'View Lookbook',
              secondaryCtaLink: '/products?sort=newest',
              image:
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=85',
              label: 'Textured Wool Overcoat',
              badgeText: 'New Season',
            },
            {
              id: 'fallback-2',
              tag: 'Studio Edition',
              titlePrefix: 'Tailored Form,',
              titleHighlight: 'Modern Precision.',
              subtitle:
                'Clean lines meet unstructured modern silhouettes, meticulously designed to elevate your everyday routine.',
              ctaText: 'Shop New Arrivals',
              ctaLink: '/products?sort=newest',
              secondaryCtaText: 'Browse Catalog',
              secondaryCtaLink: '/products',
              image:
                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1400&q=85',
              label: 'Double-Breasted Blazer',
              badgeText: 'Signature',
            },
            {
              id: 'fallback-3',
              tag: 'Capsule Curation',
              titlePrefix: 'Effortless Cuts,',
              titleHighlight: 'Quiet Luxury.',
              subtitle:
                'Sumptuous organic merino yarns, dense weaves, and nuanced tonal hues crafted for timeless distinction.',
              ctaText: 'Discover Knitwear',
              ctaLink: '/products',
              secondaryCtaText: 'Explore Lookbook',
              secondaryCtaLink: '/products',
              image:
                'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
              label: 'Merino Ribbed Knit',
              badgeText: 'Limited Run',
            },
            {
              id: 'fallback-4',
              tag: 'Architectural Layers',
              titlePrefix: 'Seasonal Texture,',
              titleHighlight: 'Timeless Appeal.',
              subtitle:
                'Versatile wardrobe foundations cut with modern precision, sustainably crafted from certified natural fibers.',
              ctaText: 'Explore Foundations',
              ctaLink: '/products',
              secondaryCtaText: 'All Products',
              secondaryCtaLink: '/products',
              image:
                'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=85',
              label: 'Structured Trench',
              badgeText: 'Restocked',
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

  if (loading) {
    return (
      <section className="relative overflow-hidden rounded-[24px] bg-ink-950 p-6 sm:p-10 lg:p-12 min-h-[540px] flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <Skeleton height="h-7" width="w-40" />
            <Skeleton height="h-16" width="w-4/5" />
            <Skeleton height="h-12" width="w-full" />
            <div className="flex gap-4 pt-3">
              <Skeleton height="h-12" width="w-40" />
              <Skeleton height="h-12" width="w-36" />
            </div>
          </div>
          <div className="lg:col-span-5">
            <Skeleton height="h-[360px] sm:h-[420px]" width="w-full rounded-[22px]" />
          </div>
        </div>
      </section>
    );
  }

  if (slides.length === 0) return null;

  const currentSlide = slides[activeIndex] || slides[0];

  // Map to ShowcaseSlideshow format
  const showcaseSlides: ShowcaseSlide[] = slides.map((s) => ({
    image: s.image,
    label: s.label,
    title: `${s.titlePrefix} ${s.titleHighlight}`,
    link: s.ctaLink,
    tag: s.tag,
  }));

  return (
    <section
      id="hero-section"
      aria-label="Hero Fashion Showcase"
      className="relative overflow-hidden rounded-[24px] bg-gradient-to-b from-ink-900 to-ink-950 text-white border border-white/10 shadow-2xl transition-all"
    >
      {/* Background ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-cream-500/10 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-sand-400/10 rounded-full blur-3xl"
      />

      {/* Main Split Grid Layout */}
      <div className="relative z-10 p-6 sm:p-10 lg:p-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Editorial Content & Actions */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-7">
            {/* Editorial Tag Pill */}
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-semibold tracking-wider uppercase text-sand-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentSlide.tag}</span>
                {currentSlide.badgeText && (
                  <span className="ml-1 pl-2 border-l border-white/20 text-cream-300 font-bold">
                    {currentSlide.badgeText}
                  </span>
                )}
              </span>
            </div>

            {/* Headline with Framer Metallic Gradient */}
            <div className="space-y-1">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
                <div>{currentSlide.titlePrefix}</div>
                <span className="inline-block bg-gradient-to-r from-white via-white/95 to-white/60 bg-clip-text text-transparent">
                  {currentSlide.titleHighlight}
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-ink-300 font-light max-w-xl leading-relaxed">
              {currentSlide.subtitle}
            </p>

            {/* Call To Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                to={currentSlide.ctaLink}
                className="group inline-flex items-center justify-center gap-2 h-12 px-7 rounded-lg bg-white text-ink-950 font-semibold text-xs sm:text-sm tracking-wide shadow-lg hover:bg-cream-100 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>{currentSlide.ctaText}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              {currentSlide.secondaryCtaLink && (
                <Link
                  to={currentSlide.secondaryCtaLink}
                  className="inline-flex items-center justify-center h-12 px-7 rounded-lg bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/25 hover:border-white/40 text-white font-semibold text-xs sm:text-sm tracking-wide active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {currentSlide.secondaryCtaText || 'Book a demo'}
                </Link>
              )}
            </div>
          </div>

          {/* Right Column: ShowcaseSlideshow Component */}
          <div className="lg:col-span-6 xl:col-span-5 flex justify-center">
            <div className="w-full max-w-[560px] aspect-[4/3] sm:aspect-[16/11] lg:aspect-[1/1] max-h-[520px]">
              <ShowcaseSlideshow
                slides={showcaseSlides}
                intervalSec={5}
                radius={22}
                overlay={true}
                showLabel={true}
                showCounter={true}
                ringColor="rgba(255, 255, 255, 0.9)"
                ringTrackColor="rgba(255, 255, 255, 0.15)"
                ringThickness={1.5}
                textColor="rgba(255, 255, 255, 0.95)"
                placeholderColor="#141414"
                className="w-full h-full border border-white/10"
                onSlideChange={(newIdx) => setActiveIndex(newIdx)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Brand Value Propositions Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-t border-white/10 bg-ink-950/80 backdrop-blur-sm text-ink-300 py-3.5 px-6 sm:px-12 text-xs">
        <div className="flex items-center gap-3 py-2 sm:py-0 justify-start sm:justify-center">
          <Truck className="w-4 h-4 text-sand-300 shrink-0" />
          <span className="font-medium text-ink-200">Express Delivery on Orders Rs. 1,500+</span>
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
