import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, Copy, Check, ArrowRight, Sparkles, Percent, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { couponService, Coupon } from '../../services/coupon.service';
import { productService, Product } from '../../services/product.service';
import { Skeleton } from '../ui/Skeleton';

export const SeasonalOffers: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [featuredProduct, setFeaturedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadOffers = async () => {
      try {
        setLoading(true);
        const [couponsRes, productsRes] = await Promise.allSettled([
          couponService.getActiveCoupons(),
          productService.getProducts({ limit: 4, sort: 'popular' }),
        ]);

        if (isMounted) {
          if (couponsRes.status === 'fulfilled' && Array.isArray(couponsRes.value)) {
            setCoupons(couponsRes.value.slice(0, 3));
          }
          if (
            productsRes.status === 'fulfilled' &&
            productsRes.value?.items &&
            productsRes.value.items.length > 0
          ) {
            // Find one with discount or first item
            const items = productsRes.value.items;
            const discounted = items.find((p) => p.discountPrice && p.discountPrice < p.basePrice);
            setFeaturedProduct(discounted || items[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load seasonal offers:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOffers();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied to clipboard!`, {
      duration: 3000,
      position: 'bottom-right',
    });
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 3000);
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === 'percentage') {
      return `${coupon.discountValue}% OFF`;
    }
    return `$${coupon.discountValue} FLAT OFF`;
  };

  const formatConditions = (coupon: Coupon) => {
    if (coupon.minOrderAmount && coupon.minOrderAmount > 0) {
      return `Orders over $${coupon.minOrderAmount}`;
    }
    return 'No minimum order';
  };

  return (
    <section id="seasonal-offers-section" aria-label="Seasonal Offers & Editorial Promos" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-500 mb-1">
            <Percent className="w-3.5 h-3.5 text-danger" />
            <span>Limited Time Curation</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight">
            Seasonal Offers & Editorial Promos
          </h2>
          <p className="text-xs sm:text-sm text-ink-500 mt-1">
            Claim verified promo codes and shop seasonal promotions before expiration.
          </p>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-800 hover:text-ink-950 group"
        >
          <span>Shop All Promos</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton height="h-64" className="lg:col-span-2 rounded-2xl" />
          <Skeleton height="h-64" className="rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Promotional Feature Card (Span 7 cols) */}
          <div className="lg:col-span-7 relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-950 to-black text-white p-8 sm:p-10 flex flex-col justify-between shadow-card">
            <div className="space-y-4 max-w-lg z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-danger/20 border border-danger/30 text-xs font-bold uppercase tracking-wider text-danger-light">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mid-Season Archival Event</span>
              </div>

              <h3 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                Up to 25% Off Tailored Staples & Knitwear
              </h3>

              <p className="text-xs sm:text-sm text-ink-300 font-light leading-relaxed">
                Refresh your capsule rotation with foundational trousers, merino layers, and outer coats
                manufactured to the highest European standards.
              </p>
            </div>

            <div className="pt-6 sm:pt-8 flex flex-wrap items-center gap-3 z-10">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md bg-white text-ink-950 font-semibold text-xs sm:text-sm shadow hover:bg-cream-100 active:scale-[0.99] transition-all"
              >
                <span>Shop Archival Event</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {featuredProduct && (
                <Link
                  to={`/products/${featuredProduct.slug}`}
                  className="inline-flex items-center justify-center h-11 px-5 rounded-md bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-all"
                >
                  Featured: {featuredProduct.name.slice(0, 24)}...
                </Link>
              )}
            </div>

            {/* Background Decorative Graphic */}
            <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-20 pointer-events-none bg-gradient-to-l from-white/20 to-transparent" />
          </div>

          {/* Active Promo Codes Column (Span 5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3 justify-between">
            {coupons.length > 0 ? (
              coupons.map((coupon) => {
                const isCopied = copiedCode === coupon.code;
                return (
                  <div
                    key={coupon._id}
                    className="p-4 sm:p-5 rounded-xl border border-ink-200 bg-white shadow-sm hover:border-ink-300 hover:shadow-card transition-all flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-amber-600" />
                        <span className="font-display font-bold text-base text-ink-950">
                          {formatDiscount(coupon)}
                        </span>
                      </div>
                      <p className="text-xs text-ink-500 font-medium">{formatConditions(coupon)}</p>
                      {coupon.validUntil && (
                        <div className="flex items-center gap-1 text-[11px] text-ink-400">
                          <Clock className="w-3 h-3" />
                          <span>Expires {new Date(coupon.validUntil).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-mono text-xs font-bold tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 ${
                        isCopied
                          ? 'bg-success text-white'
                          : 'bg-ink-100 hover:bg-ink-200 text-ink-900 border border-ink-300'
                      }`}
                      aria-label={`Copy discount code ${coupon.code}`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{coupon.code}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="h-full p-8 rounded-xl border border-dashed border-ink-200 bg-white flex flex-col items-center justify-center text-center space-y-2">
                <Tag className="w-8 h-8 text-ink-400" />
                <p className="text-sm font-semibold text-ink-800">No active discount codes right now</p>
                <p className="text-xs text-ink-500">Check back soon for upcoming holiday promotions.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default SeasonalOffers;
