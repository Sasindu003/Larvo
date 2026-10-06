import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Star,
  Package,
  AlertCircle,
  CheckCircle,
  ZoomIn,
  ThumbsUp,
  ThumbsDown,
  Camera,
  X,
  MessageSquare,
  ShieldCheck,
  Check,
  Clock,
  UploadCloud,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productService, Product, ProductVariant } from '../services/product.service';
import {
  reviewService,
  Review,
  ReviewListResponse,
  EligibilityResponse,
} from '../services/review.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { inventoryService } from '../services/inventory.service';

// ── Skeleton Layout ────────────────────────────────────────────────────────────
const ProductDetailsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 py-8 animate-pulse">
    <div className="flex flex-col gap-3">
      <Skeleton height="h-[480px]" className="rounded-xl" />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} height="h-20" width="w-20" className="rounded-lg" />
        ))}
      </div>
    </div>
    <div className="space-y-5 pt-2">
      <Skeleton height="h-4" width="w-28" />
      <Skeleton height="h-9" />
      <Skeleton height="h-4" width="w-1/2" />
      <div className="space-y-2 pt-4">
        <Skeleton height="h-3" width="w-16" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} height="h-10" width="w-16" className="rounded-lg" />)}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton height="h-3" width="w-20" />
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} height="h-8" width="w-8" className="rounded-full" />)}
        </div>
      </div>
      <Skeleton height="h-24" className="rounded-xl" />
      <Skeleton height="h-12" className="rounded-xl" />
      <Skeleton height="h-12" className="rounded-xl" />
    </div>
  </div>
);

// ── Not-Found State ────────────────────────────────────────────────────────────
const ProductNotFound: React.FC<{ slug: string }> = ({ slug }) => (
  <div className="min-h-[60vh] flex items-center justify-center py-12">
    <div className="text-center space-y-5 max-w-md">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-sand-100 border border-sand-300 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-ink-400" />
        </div>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950 mb-2">Product Not Found</h1>
        <p className="text-sm text-ink-500">
          We couldn't find a product with the identifier <span className="font-mono text-ink-800 bg-sand-100 px-1 rounded">"{slug}"</span>.
          It may have been removed or the link is incorrect.
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <Link to="/products">
          <Button variant="primary" size="sm">Browse Catalog</Button>
        </Link>
        <Link to="/">
          <Button variant="ghost" size="sm">Return Home</Button>
        </Link>
      </div>
    </div>
  </div>
);

// ── Helpers ────────────────────────────────────────────────────────────────────
const SIZES: ProductVariant['size'][] = ['XS', 'S', 'M', 'L', 'XL'];

function uniqueSizes(variants: ProductVariant[]): ProductVariant['size'][] {
  const seen = new Set<string>();
  return SIZES.filter((s) => {
    const exists = variants.some((v) => v.size === s);
    if (exists && !seen.has(s)) { seen.add(s); return true; }
    return false;
  });
}

function uniqueColors(variants: ProductVariant[]): string[] {
  return [...new Set(variants.map((v) => v.color))];
}

function formatPrice(price: number): string {
  return `Rs. ${price.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

const COLOR_GLOW_MAP: Record<string, string> = {
  black:    'rgba(30, 25, 20, 0.22)',
  white:    'rgba(220, 215, 205, 0.35)',
  navy:     'rgba(30, 50, 100, 0.25)',
  blue:     'rgba(60, 90, 200, 0.22)',
  red:      'rgba(190, 50, 40, 0.22)',
  green:    'rgba(50, 120, 70, 0.22)',
  sage:     'rgba(98, 117, 93, 0.28)',
  olive:    'rgba(98, 117, 70, 0.28)',
  brown:    'rgba(130, 90, 55, 0.25)',
  camel:    'rgba(190, 145, 90, 0.25)',
  beige:    'rgba(200, 185, 160, 0.30)',
  grey:     'rgba(110, 110, 110, 0.22)',
  gray:     'rgba(110, 110, 110, 0.22)',
  pink:     'rgba(210, 130, 150, 0.22)',
  lavender: 'rgba(150, 120, 200, 0.22)',
};

function getGlowColor(colorName: string | null): string {
  if (!colorName) return 'rgba(98, 117, 93, 0.28)';
  const key = colorName.toLowerCase();
  for (const [k, v] of Object.entries(COLOR_GLOW_MAP)) {
    if (key.includes(k)) return v;
  }
  return 'rgba(98, 117, 93, 0.28)';
}

// ── Main Component ─────────────────────────────────────────────────────────────
export const ProductDetailsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  // Variant selection state
  const [selectedSize, setSelectedSize] = useState<ProductVariant['size'] | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const { user } = useAuth();

  // ── Customer Reviews & Eligibility State ──────────────────────────────────
  const [reviewsData, setReviewsData] = useState<ReviewListResponse | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsSort, setReviewsSort] = useState<'helpful' | 'newest' | 'highest' | 'lowest'>('helpful');
  const [reviewsWithPhotos, setReviewsWithPhotos] = useState(false);

  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Review modal & form
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Reviews filter pills
  const [reviewsRatingFilter, setReviewsRatingFilter] = useState<number | null>(null);
  const [reviewsColorFilter, setReviewsColorFilter] = useState<string | null>(null);
  const [activeFilterPill, setActiveFilterPill] = useState<'all' | 'photos' | '5star' | 'color'>('all');

  // Fetch reviews for current product
  const fetchReviews = useCallback(async (productId: string) => {
    setReviewsLoading(true);
    try {
      const data = await reviewService.getProductReviews(productId, {
        page: reviewsPage,
        limit: 10,
        sort: reviewsSort,
        withPhotos: reviewsWithPhotos,
      });
      setReviewsData(data);
    } catch {
      // Non-blocking
    } finally {
      setReviewsLoading(false);
    }
  }, [reviewsPage, reviewsSort, reviewsWithPhotos]);

  // Fetch eligibility if user logged in
  const fetchEligibility = useCallback(async (productId: string) => {
    if (!user) {
      setEligibility(null);
      return;
    }
    setEligibilityLoading(true);
    try {
      const el = await reviewService.checkEligibility(productId);
      setEligibility(el);
    } catch {
      setEligibility(null);
    } finally {
      setEligibilityLoading(false);
    }
  }, [user]);

  // Handle review photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    if (selectedPhotos.length + filesArray.length > 5) {
      toast.error('You can upload up to 5 photos only');
      return;
    }

    const newFiles = [...selectedPhotos, ...filesArray].slice(0, 5);
    setSelectedPhotos(newFiles);

    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(previews);
  };

  const handleRemovePhoto = (idx: number) => {
    const updatedFiles = selectedPhotos.filter((_, i) => i !== idx);
    setSelectedPhotos(updatedFiles);
    const updatedPreviews = photoPreviews.filter((_, i) => i !== idx);
    setPhotoPreviews(updatedPreviews);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?._id) return;
    if (formRating < 1 || formRating > 5) {
      toast.error('Please select a rating between 1 and 5 stars');
      return;
    }
    if (formTitle.trim().length < 3) {
      toast.error('Review headline must be at least 3 characters');
      return;
    }
    if (formComment.trim().length < 5) {
      toast.error('Review comments must be at least 5 characters');
      return;
    }

    setSubmittingReview(true);
    try {
      let photoIds: string[] = [];
      if (selectedPhotos.length > 0) {
        photoIds = await reviewService.uploadPhotos(selectedPhotos);
      }

      await reviewService.createReview(product._id, {
        rating: formRating,
        title: formTitle.trim(),
        comment: formComment.trim(),
        photos: photoIds,
      });

      toast.success('Thank you! Your review has been published.');
      setReviewModalOpen(false);
      setFormRating(5);
      setFormTitle('');
      setFormComment('');
      setSelectedPhotos([]);
      setPhotoPreviews([]);

      // Refresh reviews & eligibility
      fetchReviews(product._id);
      fetchEligibility(product._id);

      // Refresh product stats
      if (slug) {
        productService.getProductBySlug(slug).then((p) => {
          setProduct((prev) => (prev ? { ...prev, ratingAvg: p.ratingAvg, ratingCount: p.ratingCount } : prev));
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleVote = async (
    reviewId: string,
    currentVote: 'up' | 'down' | null | undefined,
    targetVote: 'up' | 'down'
  ) => {
    if (!user) {
      toast.error('Please log in to vote on reviews');
      return;
    }

    const nextVote = currentVote === targetVote ? 'remove' : targetVote;

    // Optimistic UI update
    setReviewsData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((r) => {
          if (r._id !== reviewId) return r;
          const upCount = r.upvoteCount || 0;
          const downCount = r.downvoteCount || 0;
          let newUp = upCount;
          let newDown = downCount;

          if (currentVote === 'up') newUp = Math.max(0, upCount - 1);
          if (currentVote === 'down') newDown = Math.max(0, downCount - 1);

          if (nextVote === 'up') newUp += 1;
          if (nextVote === 'down') newDown += 1;

          return {
            ...r,
            userVote: nextVote === 'remove' ? null : nextVote,
            upvoteCount: newUp,
            downvoteCount: newDown,
            helpfulScore: newUp - newDown,
          };
        }),
      };
    });

    try {
      await reviewService.voteReview(reviewId, nextVote);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record vote');
      if (product?._id) fetchReviews(product._id);
    }
  };

  // Re-fetch reviews when sorting or pagination or photo filter changes
  useEffect(() => {
    if (product?._id) {
      fetchReviews(product._id);
    }
  }, [product?._id, fetchReviews]);

  // Check eligibility on product or user change
  useEffect(() => {
    if (product?._id) {
      fetchEligibility(product._id);
    }
  }, [product?._id, user, fetchEligibility]);

  // Fetch product
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    setActiveImageIndex(0);

    productService
      .getProductBySlug(slug)
      .then(async (data) => {
        setProduct(data);
        // Auto-select the first available size/color
        if (data.variants.length > 0) {
          const sizes = uniqueSizes(data.variants);
          const colors = uniqueColors(data.variants);
          setSelectedSize(sizes[0] ?? null);
          setSelectedColor(colors[0] ?? null);

          // Fetch live inventory
          try {
            const reqs = data.variants.map((v) => ({ sku: v.sku, qty: 1 }));
            const validations = await inventoryService.validate(reqs);
            const stockMap = new Map(validations.map((v) => [v.sku, v.available]));
            setProduct((prev) => {
              if (!prev) return prev;
              const updatedVariants = prev.variants.map((v) => ({
                ...v,
                stock: stockMap.get(v.sku) ?? v.stock,
              }));
              return { ...prev, variants: updatedVariants };
            });
          } catch (err) {
            console.error('Failed to load live inventory:', err);
          }
        }
        setLoading(false);
      })
      .catch((err: any) => {
        if (err.status === 404) {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [slug]);

  // Derived: selected variant match
  const selectedVariant = useMemo<ProductVariant | null>(() => {
    if (!product) return null;
    if (!selectedSize && !selectedColor) return product.variants[0] ?? null;
    return (
      product.variants.find(
        (v) =>
          (!selectedSize || v.size === selectedSize) &&
          (!selectedColor || v.color === selectedColor)
      ) ?? null
    );
  }, [product, selectedSize, selectedColor]);

  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;
  const availableSizes = useMemo(() => (product ? uniqueSizes(product.variants) : []), [product]);
  const availableColors = useMemo(() => (product ? uniqueColors(product.variants) : []), [product]);

  // Derived: reviews filtered by rating or color pill
  const displayedReviews = useMemo(() => {
    if (!reviewsData?.items) return [];
    let list = reviewsData.items;
    if (reviewsRatingFilter) {
      list = list.filter((r) => r.rating === reviewsRatingFilter);
    }
    if (reviewsColorFilter) {
      list = list.filter((r) =>
        (r.title + ' ' + r.comment).toLowerCase().includes(reviewsColorFilter.toLowerCase())
      );
    }
    return list;
  }, [reviewsData?.items, reviewsRatingFilter, reviewsColorFilter]);

  // Size disabled: completely out of stock across all variants for this product
  const isSizeDisabled = useCallback(
    (size: ProductVariant['size']) => {
      if (!product) return false;
      const sizeVariants = product.variants.filter((v) => v.size === size);
      return sizeVariants.length === 0 || sizeVariants.every((v) => v.stock <= 0);
    },
    [product]
  );

  // Color disabled: completely out of stock across all variants for this product
  const isColorDisabled = useCallback(
    (color: string) => {
      if (!product) return false;
      const colorVariants = product.variants.filter((v) => v.color === color);
      return colorVariants.length === 0 || colorVariants.every((v) => v.stock <= 0);
    },
    [product]
  );

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    if (product) {
      const match = product.variants.find(
        (v) => v.color === color && v.size === selectedSize && v.stock > 0
      );
      if (!match) {
        const firstInStock = product.variants.find((v) => v.color === color && v.stock > 0);
        if (firstInStock) {
          setSelectedSize(firstInStock.size);
        } else {
          const firstAny = product.variants.find((v) => v.color === color);
          if (firstAny) setSelectedSize(firstAny.size);
        }
      }
    }
  };

  const handleSizeSelect = (size: ProductVariant['size']) => {
    setSelectedSize(size);
    if (product) {
      const match = product.variants.find(
        (v) => v.size === size && v.color === selectedColor && v.stock > 0
      );
      if (!match) {
        const firstInStock = product.variants.find((v) => v.size === size && v.stock > 0);
        if (firstInStock) {
          setSelectedColor(firstInStock.color);
        } else {
          const firstAny = product.variants.find((v) => v.size === size);
          if (firstAny) setSelectedColor(firstAny.color);
        }
      }
    }
  };

  // Gallery helpers
  const images = product?.images ?? [];
  const handlePrevImage = () =>
    setActiveImageIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const handleNextImage = () =>
    setActiveImageIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }, []);

  const { addItem } = useCart();

  const handleAddToCart = () => {
    if (isOutOfStock || !selectedVariant || !product) return;
    setAddingToCart(true);
    
    addItem(
      {
        productId: product._id,
        slug: product.slug,
        name: product.name,
        image: product.images[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
        variantSku: selectedVariant.sku,
        size: selectedVariant.size,
        color: selectedVariant.color,
        unitPrice: product.discountPrice !== null && product.discountPrice !== undefined && product.discountPrice < product.basePrice
          ? product.discountPrice
          : product.basePrice,
        stock: selectedVariant.stock,
      },
      1
    );

    setTimeout(() => {
      setAddingToCart(false);
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2500);
    }, 300);
  };

  const { isWishlisted: checkWishlist, toggleWishlist } = useWishlist();
  const isSaved = product ? checkWishlist(product._id) : false;

  const handleWishlist = () => {
    if (!product) return;
    toggleWishlist(product);
  };

  // Discount calculation
  const hasDiscount =
    product?.discountPrice !== null &&
    product?.discountPrice !== undefined &&
    product!.discountPrice! < product!.basePrice;
  const discountPercent = hasDiscount
    ? Math.round(((product!.basePrice - product!.discountPrice!) / product!.basePrice) * 100)
    : 0;

  const categoryName =
    typeof product?.category === 'object' && product?.category !== null
      ? product.category.name
      : undefined;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="-mx-4 sm:-mx-6 -my-8 px-4 sm:px-6 lg:px-8 py-8 min-h-screen" style={{ background: '#F6F0E8' }}>
      <div className="max-w-7xl mx-auto">
        <Skeleton height="h-4" width="w-48" className="mb-6" />
        <ProductDetailsSkeleton />
      </div>
    </div>
  );

  if (notFound || !product) return (
    <div className="-mx-4 sm:-mx-6 -my-8 px-4 sm:px-6 lg:px-8 py-8 min-h-screen" style={{ background: '#F6F0E8' }}>
      <div className="max-w-7xl mx-auto">
        <ProductNotFound slug={slug ?? ''} />
      </div>
    </div>
  );

  return (
    <div className="-mx-4 sm:-mx-6 -my-8 px-4 sm:px-6 lg:px-8 py-8 min-h-screen" style={{ background: '#F6F0E8' }}>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#8A8175] tracking-wide mb-8">
          <Link to="/" className="hover:text-[#1F1B16] transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3 text-[#A89F91]" />
          <Link to="/products" className="hover:text-[#1F1B16] transition-colors">Products</Link>
          {categoryName && (
            <>
              <ChevronRight className="w-3 h-3 text-[#A89F91]" />
              <Link
                to={`/products?category=${typeof product.category === 'object' && product.category !== null ? (product.category as any).slug : ''}`}
                className="hover:text-[#1F1B16] transition-colors"
              >
                {categoryName}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3 text-[#A89F91]" />
          <span className="text-[#1F1B16] font-medium line-clamp-1 max-w-[200px]">{product.name}</span>
        </nav>

        {/* Main 12-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* ── LEFT: Image Gallery (5 cols) ──────────────────────────────── */}
          <div className="lg:col-span-5 flex flex-col gap-4 relative">
            {/* Ambient Aura Glow behind image card */}
            <div
              className="absolute inset-[-7.5%] pointer-events-none z-0"
              style={{
                background: `radial-gradient(circle, ${getGlowColor(selectedColor)} 0%, rgba(246, 240, 232, 0) 70%)`,
                filter: 'blur(70px)',
                borderRadius: '28px',
              }}
            />

            {/* Editorial Image Frame */}
            <div
              className="relative aspect-[3/4] w-full overflow-hidden z-10 cursor-zoom-in"
              style={{
                borderRadius: '28px',
                border: '6px solid #FAF7F2',
                boxShadow: '0 20px 45px -15px rgba(45, 35, 25, 0.12)',
                background: '#FFFFFF',
              }}
              onMouseEnter={() => setZoomed(true)}
              onMouseLeave={() => setZoomed(false)}
              onMouseMove={handleMouseMove}
            >
              <img
                src={images[activeImageIndex] ?? ''}
                alt={`${product.name} — image ${activeImageIndex + 1}`}
                className={[
                  'h-full w-full object-cover object-center transition-transform duration-200',
                  zoomed ? 'scale-150' : 'scale-100',
                ].join(' ')}
                style={zoomed ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` } : undefined}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                }}
              />

              {/* Top badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none z-20">
                {isOutOfStock ? (
                  <Badge variant="out-of-stock">Out of Stock</Badge>
                ) : hasDiscount ? (
                  <Badge variant="discount" className="bg-[#161513] text-white font-bold">
                    -{discountPercent}% OFF
                  </Badge>
                ) : null}
              </div>

              {/* Interactive Zoom hint button top-right */}
              <button
                type="button"
                aria-label="Zoom image"
                onClick={() => setZoomed((z) => !z)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/95 shadow-sm border border-black/5 flex items-center justify-center text-[#1F1B16] hover:bg-white transition-all z-20 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Floating Color Token Pill bottom-left */}
              {selectedColor && !zoomed && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/85 backdrop-blur-md text-white text-xs px-3.5 py-1.5 rounded-full z-20 pointer-events-none shadow-sm">
                  <span
                    className="w-2 h-2 rounded-full border border-white/30 shrink-0"
                    style={{ backgroundColor: getGlowColor(selectedColor).replace(/,\s*[\d.]+\)$/, ', 1)') }}
                  />
                  <span className="font-medium tracking-wide">{selectedColor}</span>
                </div>
              )}

              {/* Prev / Next arrows (only if multiple images) */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur shadow-sm text-[#1F1B16] hover:bg-white transition-colors z-20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur shadow-sm text-[#1F1B16] hover:bg-white transition-colors z-20"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 z-10">
                {images.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`View image ${idx + 1}`}
                    className={[
                      'flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden border-2 transition-all',
                      idx === activeImageIndex
                        ? 'border-[#1F1B16] shadow-md scale-[1.03]'
                        : 'border-[#E5DED4] hover:border-[#786E64] opacity-75 hover:opacity-100',
                    ].join(' ')}
                  >
                    <img
                      src={src}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover object-center"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Product Info (7 cols) ──────────────────────────────── */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* Category tag & rating row */}
            <div className="flex items-center justify-between">
              {categoryName ? (
                <span className="text-xs text-[#8A8175] tracking-wide font-medium uppercase">
                  {categoryName}
                </span>
              ) : <span />}
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={[
                        'w-3.5 h-3.5',
                        s <= Math.round(product.ratingAvg || 0)
                          ? 'fill-[#D99538] text-[#D99538]'
                          : 'fill-[#E8DFD3] text-[#E8DFD3]',
                      ].join(' ')}
                    />
                  ))}
                </span>
                <span className="text-xs font-semibold text-[#786E64]">
                  {(product.ratingAvg || 0).toFixed(1)}
                </span>
                <a
                  href="#reviews-section"
                  className="text-xs text-[#786E64] hover:text-[#1F1B16] underline transition-colors cursor-pointer"
                >
                  ({product.ratingCount || 0} reviews)
                </a>
              </div>
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-[#1F1B16] leading-tight tracking-tight">
              {product.name}
            </h1>

            {/* Material subtitle underneath H1 */}
            {selectedVariant?.material && (
              <p className="text-sm text-[#786E64] font-normal -mt-3 mb-1">{selectedVariant.material}</p>
            )}

            {/* Floating Price Container Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#ECE5DB] flex justify-between items-center">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-[#9E9488] uppercase mb-1">
                  Retail Price
                </p>
                {hasDiscount ? (
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-2xl md:text-3xl font-bold text-[#1F1B16]">
                      {formatPrice(product.discountPrice!)}
                    </span>
                    <span className="text-sm text-[#9E9488] line-through">
                      {formatPrice(product.basePrice)}
                    </span>
                    <span className="text-xs font-bold text-[#1E7E55] bg-[#E9F7F1] px-2 py-0.5 rounded-full border border-[#D1EFE2]">
                      -{discountPercent}%
                    </span>
                  </div>
                ) : (
                  <span className="font-display text-2xl md:text-3xl font-bold text-[#1F1B16]">
                    {formatPrice(product.basePrice)}
                  </span>
                )}
              </div>
              <span className="bg-[#E9F7F1] text-[#1E7E55] text-xs font-medium px-3.5 py-1.5 rounded-full border border-[#D1EFE2] shrink-0">
                Free Shipping
              </span>
            </div>

            {/* ── Color Selector (Capsule Pills) ──────────────────────────── */}
            {availableColors.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#786E64]">
                    Color
                  </span>
                  {selectedColor && (
                    <span className="text-xs font-medium text-[#1F1B16]">{selectedColor}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const disabled = isColorDisabled(color);
                    const isActive = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleColorSelect(color)}
                        aria-label={`Color: ${color}${disabled ? ' (unavailable)' : ''}`}
                        aria-pressed={isActive}
                        className={[
                          'rounded-full px-5 py-2 text-xs font-medium border transition-all',
                          isActive
                            ? 'bg-[#1A1715] text-white border-[#1A1715] ring-2 ring-[#1A1715] ring-offset-2 ring-offset-[#F6F0E8] shadow-sm'
                            : disabled
                            ? 'border-[#E5DED4] text-[#C4BEB7] bg-[#F9F6F1] cursor-not-allowed line-through'
                            : 'border-[#E2DBD1] text-[#3E3832] bg-white hover:bg-[#F5EFEB] hover:border-[#786E64]',
                        ].join(' ')}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Size Selector (Rounded Squares) ─────────────────────────── */}
            {availableSizes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#786E64]">
                    Size
                  </span>
                  {selectedSize && (
                    <span className="text-xs text-[#8A8175] cursor-pointer hover:underline hover:text-[#1F1B16]">
                      Size Guide
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {availableSizes.map((size) => {
                    const disabled = isSizeDisabled(size);
                    const isActive = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleSizeSelect(size)}
                        aria-label={`Size: ${size}${disabled ? ' (out of stock)' : ''}`}
                        aria-pressed={isActive}
                        className={[
                          'relative w-11 h-11 rounded-xl border text-sm font-semibold flex items-center justify-center transition-all',
                          isActive
                            ? 'bg-[#1A1715] text-white border-[#1A1715] ring-2 ring-black ring-offset-2 ring-offset-[#F6F0E8] shadow-sm'
                            : disabled
                            ? 'border-[#E5DED4] text-[#C4BEB7] bg-[#F9F6F1] cursor-not-allowed'
                            : 'border-[#E5DED4] text-[#3E3832] bg-white hover:border-[#786E64] hover:bg-[#F9F6F1]',
                        ].join(' ')}
                      >
                        {size}
                        {disabled && !isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
                            style={{
                              background:
                                'repeating-linear-gradient(-45deg, transparent, transparent 4px, #e8e2dc 4px, #e8e2dc 5px)',
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock Status Strip */}
            {selectedVariant && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#786E64] py-1">
                {selectedVariant.stock > 0 ? (
                  <span className="inline-flex items-center gap-1.5 bg-[#E9F7F1] text-[#1E7E55] border border-[#D1EFE2] px-3 py-1 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E55] animate-pulse-dot" />
                    IN STOCK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full font-medium">
                    OUT OF STOCK
                  </span>
                )}
                <span>
                  {selectedVariant.stock > 0
                    ? `${selectedVariant.stock} units available`
                    : 'Select another option'}
                  {' · SKU: '}
                  <span className="font-mono text-[#1F1B16] font-medium">{selectedVariant.sku}</span>
                </span>
              </div>
            )}

            {/* ── CTAs: Obsidian Add to Cart & White Wishlist ──────────────── */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                disabled={isOutOfStock || addingToCart}
                onClick={handleAddToCart}
                className="w-full h-14 rounded-full bg-[#161513] hover:bg-[#282623] disabled:bg-[#C4BEB7] disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] shadow-sm"
              >
                {addingToCart ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : addedFeedback ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <ShoppingBag className="w-4 h-4" />
                )}
                {isOutOfStock
                  ? 'Out of Stock'
                  : addedFeedback
                  ? 'Added to Cart!'
                  : addingToCart
                  ? 'Adding…'
                  : 'Add to Cart'}
              </button>

              <button
                type="button"
                onClick={handleWishlist}
                className="w-full h-12 rounded-full bg-white/70 hover:bg-white text-[#1F1B16] text-xs font-medium border border-[#E0D8CC] flex items-center justify-center gap-2 transition-all duration-200 shadow-sm"
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    isSaved ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                />
                {isSaved ? 'Saved to Wishlist' : 'Add to Wishlist'}
              </button>
            </div>

            {/* ── Product Description ─────────────────────────────────────── */}
            <div className="border-t border-[#E5DED4] pt-5 space-y-2">
              <h2 className="text-xs font-semibold text-[#1F1B16] uppercase tracking-wider">
                About This Product
              </h2>
              <p className="text-sm text-[#786E64] leading-relaxed">{product.description}</p>
            </div>
          </div>
        </div>

      {/* ── CUSTOMER REVIEWS & RATINGS SECTION ─────────────────────────── */}
      <div id="reviews-section" className="mt-16 pt-12 border-t border-[#E5DED4] space-y-10 scroll-mt-20">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[#B3792B] font-semibold text-xs tracking-wider mb-2">
            <span>✦</span>
            <span>VERIFIED COMMUNITY FEEDBACK</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#1F1B16]">
            Customer Reviews
          </h2>
        </div>

        {/* ── Rating Scorecard (3-col ivory bezel card) ──────────────────── */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '5px solid #FAF7F2',
            borderRadius: '28px',
            boxShadow: '0 16px 40px -12px rgba(45,35,25,0.08)',
          }}
        >
          {/* Col 1: Editorial score */}
          <div className="flex flex-col justify-center items-center p-8 border-b md:border-b-0 md:border-r border-[#F0E9DF] text-center">
            <span
              className="font-display font-extrabold text-[#1F1B16] leading-none"
              style={{ fontSize: '56px' }}
            >
              {(product.ratingAvg || 0).toFixed(1)}
            </span>
            <div className="flex items-center gap-1 my-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-5 h-5 ${
                    s <= Math.round(product.ratingAvg || 0)
                      ? 'fill-[#D99538] text-[#D99538]'
                      : 'fill-[#EFE9E0] text-[#EFE9E0]'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-[#786E64] mb-4">
              Synthesized from {product.ratingCount || 0} verified purchases
            </p>
            {/* Decorative micro-tags per spec */}
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-[11px] font-medium text-[#786E64] bg-[#F5EFEB] border border-[#E5DED4] px-3 py-1 rounded-full">
                98% True to Size
              </span>
              <span className="text-[11px] font-medium text-[#786E64] bg-[#F5EFEB] border border-[#E5DED4] px-3 py-1 rounded-full">
                100% Belgian Flax
              </span>
            </div>
          </div>

          {/* Col 2: Pill progress bars */}
          <div className="flex flex-col justify-center p-8 gap-3 border-b md:border-b-0 md:border-r border-[#F0E9DF]">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviewsData?.ratingDistribution?.[star] || 0;
              const total = product.ratingCount || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#786E64] w-3 text-right">{star}</span>
                  <Star className="w-3 h-3 fill-[#D99538] text-[#D99538] shrink-0" />
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#EFE9E0' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: pct > 50 ? '#1F1B16' : pct > 15 ? '#786E64' : '#C4BEB7',
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-[#786E64] w-7 text-right">{pct}%</span>
                  <span className="text-[11px] font-mono text-[#9E9488] w-5 text-right">({count})</span>
                </div>
              );
            })}
          </div>

          {/* Col 3: Submit CTA */}
          <div className="flex flex-col justify-center items-center p-8 gap-4 text-center">
            {!user ? (
              <>
                <p className="text-sm text-[#786E64] leading-relaxed max-w-[200px]">
                  Share your firsthand experience with this garment.
                </p>
                <Link
                  to={`/login?redirect=/products/${slug}`}
                  className="w-full h-11 rounded-full bg-[#161513] hover:bg-[#2F2C27] text-white text-sm font-medium flex items-center justify-center transition-all shadow-sm"
                >
                  Sign In to Review
                </Link>
              </>
            ) : eligibilityLoading ? (
              <div className="text-xs text-[#786E64]">Checking eligibility…</div>
            ) : eligibility?.canReview ? (
              <>
                <p className="text-sm text-[#786E64] leading-relaxed max-w-[200px]">
                  Your feedback shapes future ateliers.
                </p>
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(true)}
                  className="w-full h-11 rounded-full bg-[#161513] hover:bg-[#2F2C27] text-white text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Submit an Evaluation
                </button>
                <p className="text-[11px] text-[#9E9488]">Earn 250 Atelier Points on submission</p>
              </>
            ) : eligibility?.reason === 'already_reviewed' ? (
              <div className="flex flex-col items-center gap-2">
                <Check className="w-6 h-6 text-[#1E7E55]" />
                <p className="text-sm font-medium text-[#1F1B16]">Review Submitted</p>
                <p className="text-xs text-[#786E64]">Thank you for your evaluation</p>
              </div>
            ) : eligibility?.reason === 'not_delivered' ? (
              <div className="flex flex-col items-center gap-2">
                <Clock className="w-6 h-6 text-[#D99538]" />
                <p className="text-sm text-[#786E64] text-center leading-relaxed max-w-[180px]">
                  Your evaluation unlocks once your shipment arrives.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-[#786E64]" />
                <p className="text-xs text-[#786E64] text-center">
                  Only verified patrons may submit evaluations.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Photo Gallery Strip ────────────────────────────────────────── */}
        {reviewsData?.photoGallery && reviewsData.photoGallery.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1F1B16] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#D99538]" />
                Customer Photos ({reviewsData.photoGallery.length})
              </h3>
              <span className="text-xs text-[#8A8175]">Click to enlarge</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-1">
              {reviewsData.photoGallery.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxPhoto(item.photoUrl)}
                  className="relative group shrink-0 w-24 h-24 sm:w-28 sm:h-28 overflow-hidden transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#786E64] shadow-sm"
                  style={{ borderRadius: '14px', border: '3px solid #FAF7F2', background: '#F5EFEB' }}
                >
                  <img
                    src={item.photoUrl}
                    alt={`Customer uploaded photo ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-bold text-[#F0C070] pointer-events-none">
                    <Star className="w-2.5 h-2.5 fill-[#F0C070]" />
                    <span>{item.rating}</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white truncate px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.userName}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter & Sort Bar (Pills + Dropdown) ────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {/* All Feedback */}
            <button
              type="button"
              onClick={() => {
                setActiveFilterPill('all');
                setReviewsWithPhotos(false);
                setReviewsRatingFilter(null);
                setReviewsColorFilter(null);
                setReviewsPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeFilterPill === 'all'
                  ? 'bg-[#1F1B16] text-white border-[#1F1B16]'
                  : 'bg-white text-[#3E3832] border-[#E5DDD2] hover:bg-[#F5EFEB]'
              }`}
            >
              All Feedback ({product.ratingCount || 0})
            </button>

            {/* With Photos */}
            <button
              type="button"
              onClick={() => {
                setActiveFilterPill('photos');
                setReviewsWithPhotos(true);
                setReviewsRatingFilter(null);
                setReviewsColorFilter(null);
                setReviewsPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeFilterPill === 'photos'
                  ? 'bg-[#1F1B16] text-white border-[#1F1B16]'
                  : 'bg-white text-[#3E3832] border-[#E5DDD2] hover:bg-[#F5EFEB]'
              }`}
            >
              With Photos ({reviewsData?.photoGallery?.length ?? 0})
            </button>

            {/* 5 Stars */}
            <button
              type="button"
              onClick={() => {
                setActiveFilterPill('5star');
                setReviewsWithPhotos(false);
                setReviewsRatingFilter(5);
                setReviewsColorFilter(null);
                setReviewsPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeFilterPill === '5star'
                  ? 'bg-[#1F1B16] text-white border-[#1F1B16]'
                  : 'bg-white text-[#3E3832] border-[#E5DDD2] hover:bg-[#F5EFEB]'
              }`}
            >
              5 Stars ({reviewsData?.ratingDistribution?.[5] ?? 0})
            </button>

            {/* Color filter — only when color selected */}
            {selectedColor && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilterPill('color');
                  setReviewsWithPhotos(false);
                  setReviewsRatingFilter(null);
                  setReviewsColorFilter(selectedColor);
                  setReviewsPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  activeFilterPill === 'color'
                    ? 'bg-[#1F1B16] text-white border-[#1F1B16]'
                    : 'bg-white text-[#3E3832] border-[#E5DDD2] hover:bg-[#F5EFEB]'
                }`}
              >
                {selectedColor} (
                {
                  (reviewsData?.items ?? []).filter((r) =>
                    (r.title + ' ' + r.comment).toLowerCase().includes(selectedColor.toLowerCase())
                  ).length
                }
                )
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={reviewsSort}
            onChange={(e) => {
              setReviewsSort(e.target.value as any);
              setReviewsPage(1);
            }}
            className="px-4 py-2 rounded-full border border-[#E5DDD2] bg-white text-xs font-semibold text-[#3E3832] focus:outline-none focus:ring-2 focus:ring-[#786E64]/30 cursor-pointer shadow-sm"
          >
            <option value="helpful">Most Helpful</option>
            <option value="newest">Newest First</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
        </div>

        {/* ── Reviews Cards List / Concierge Empty State ────────────────── */}
        {reviewsLoading ? (
          <div className="py-12 text-center text-sm text-[#786E64] animate-pulse">
            Loading reviews...
          </div>
        ) : displayedReviews.length === 0 ? (
          <div
            className="flex flex-col items-center text-center py-16 px-6"
            style={{
              background: '#FFFFFF',
              border: '5px solid #FAF7F2',
              borderRadius: '28px',
              boxShadow: '0 16px 40px -12px rgba(45,35,25,0.08)',
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{
                background: 'linear-gradient(135deg, #F5EFEB 0%, #EFE9E0 100%)',
                border: '2px solid #DDD3C4',
              }}
            >
              <Star className="w-9 h-9 fill-[#D99538] text-[#D99538]" />
            </div>
            <h3 className="font-display text-xl font-bold text-[#1F1B16] mb-3 max-w-xs">
              {reviewsWithPhotos
                ? 'No photo reviews match this filter'
                : reviewsRatingFilter
                ? `No ${reviewsRatingFilter}-star reviews found`
                : reviewsColorFilter
                ? `No reviews found for "${reviewsColorFilter}"`
                : 'Be the First to Chronicle This Garment'}
            </h3>
            {!reviewsWithPhotos && !reviewsRatingFilter && !reviewsColorFilter && (
              <p className="text-sm text-[#786E64] leading-relaxed max-w-sm mb-6">
                Every LARVO creation is shaped by patron feedback. Once your shipment arrives,
                your firsthand impressions will guide future ateliers.
              </p>
            )}
            {eligibility?.canReview && (
              <button
                type="button"
                onClick={() => setReviewModalOpen(true)}
                className="h-11 px-8 rounded-full bg-[#161513] hover:bg-[#2F2C27] text-white text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                Share Your Editorial Experience
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {displayedReviews.map((review) => {
              const authorName = review.user?.name || 'Customer';
              const initial = authorName.charAt(0).toUpperCase();

              return (
                <div
                  key={review._id}
                  className="space-y-4"
                  style={{
                    background: '#FFFFFF',
                    border: '4px solid #FAF7F2',
                    borderRadius: '24px',
                    padding: '1.5rem 1.75rem',
                    boxShadow: '0 8px 24px -8px rgba(45,35,25,0.07)',
                  }}
                >
                  {/* Reviewer Header */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-[#1F1B16]"
                        style={{ background: '#ECE5DA', border: '1px solid #DDD3C4' }}
                      >
                        {initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#1F1B16]">{authorName}</span>
                          {review.verifiedPurchase && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1E7E55] bg-[#E9F7F1] px-2.5 py-0.5 rounded-full border border-[#D1EFE2]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E55]" />
                              Verified Patron
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#8A8175]">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={[
                            'w-3.5 h-3.5',
                            s <= review.rating
                              ? 'fill-[#D99538] text-[#D99538]'
                              : 'fill-[#EFE9E0] text-[#EFE9E0]',
                          ].join(' ')}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Title & Comment */}
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-[#1F1B16]">{review.title}</h4>
                    <p className="text-sm text-[#786E64] leading-relaxed whitespace-pre-line">
                      {review.comment}
                    </p>
                  </div>

                  {/* Photos attached to this review */}
                  {review.photos && review.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {review.photos.map((photoId, idx) => {
                        const photoSrc =
                          photoId.startsWith('http') || photoId.startsWith('/api/files/')
                            ? photoId
                            : `/api/files/${photoId}`;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightboxPhoto(photoSrc)}
                            className="w-20 h-24 overflow-hidden transition-all hover:opacity-90 group"
                            style={{ borderRadius: '14px', border: '3px solid #FAF7F2' }}
                          >
                            <img
                              src={photoSrc}
                              alt={`Customer photo ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Official Store Reply */}
                  {review.adminReply?.text && (
                    <div
                      className="rounded-xl p-4 space-y-1.5 mt-2"
                      style={{ background: '#F9F6F1', border: '1px solid #ECE3D7' }}
                    >
                      <div className="flex items-center justify-between text-xs text-[#1F1B16] font-bold">
                        <span className="flex items-center gap-1.5 text-[#B3792B]">
                          <CornerDownRight className="w-3.5 h-3.5 text-[#B3792B]" />
                          Official Store Reply
                        </span>
                        <span className="text-[#8A8175] font-normal">
                          {new Date(review.adminReply.repliedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#786E64] leading-relaxed whitespace-pre-line pl-5">
                        {review.adminReply.text}
                      </p>
                    </div>
                  )}

                  {/* Helpful Voting Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#F0E9DF] text-xs text-[#8A8175]">
                    <span className="text-[11px]">Was this review helpful to you?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVote(review._id, review.userVote, 'up')}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                          review.userVote === 'up'
                            ? 'bg-[#F5EFEB] border-[#D9C9B5] text-[#786E64]'
                            : 'bg-white border-[#E5DDD2] text-[#786E64] hover:bg-[#F5EFEB]'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Helpful ({review.upvoteCount ?? review.helpfulVotes?.up?.length ?? 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleVote(review._id, review.userVote, 'down')}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                          review.userVote === 'down'
                            ? 'bg-[#F5EFEB] border-[#D9C9B5] text-[#786E64]'
                            : 'bg-white border-[#E5DDD2] text-[#786E64] hover:bg-[#F5EFEB]'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        ({review.downvoteCount ?? review.helpfulVotes?.down?.length ?? 0})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Reviews Pagination */}
            {reviewsData && reviewsData.pages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-[#8A8175]">
                  Page {reviewsPage} of {reviewsData.pages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={reviewsPage <= 1}
                    onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                    className="rounded-full px-4 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={reviewsPage >= reviewsData.pages}
                    onClick={() => setReviewsPage((p) => Math.min(reviewsData.pages, p + 1))}
                    className="rounded-full px-4 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* ── WRITE A REVIEW MODAL ────────────────────────────────────────── */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-sand-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-sand-200">
              <div>
                <h3 className="text-base font-bold text-ink-950">Write a Review</h3>
                <p className="text-xs text-ink-500">Share your experience with {product.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="text-ink-400 hover:text-ink-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Star Rating Picker */}
              <div className="space-y-1.5 text-center">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-600 block">
                  Overall Rating
                </label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setFormRating(s)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={[
                          'w-8 h-8 transition-colors',
                          s <= (hoverRating || formRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-sand-200 text-sand-200',
                        ].join(' ')}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-amber-700">
                  {['Terrible', 'Poor', 'Average', 'Good', 'Excellent'][(hoverRating || formRating) - 1]}
                </span>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Headline / Summary *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Perfect fit, highly recommended!"
                  required
                  minLength={3}
                  maxLength={120}
                  className="w-full px-3.5 py-2 text-sm bg-sand-50 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>

              {/* Comment Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-700">
                  Detailed Review *
                </label>
                <textarea
                  rows={4}
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="What did you like or dislike? How does the fabric feel, and is sizing accurate?"
                  required
                  minLength={5}
                  maxLength={2000}
                  className="w-full px-3.5 py-2 text-sm bg-sand-50 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Photo Upload Strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-700">
                    Product Photos (Optional)
                  </label>
                  <span className="text-[11px] text-ink-400">{selectedPhotos.length} / 5 photos</span>
                </div>

                {photoPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 mb-2">
                    {photoPreviews.map((src, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-sand-300">
                        <img src={src} alt="Upload preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPhotos.length < 5 && (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-sand-300 hover:border-amber-400 rounded-xl cursor-pointer bg-sand-50 hover:bg-sand-100/60 transition-all">
                    <div className="flex flex-col items-center justify-center pt-2 pb-2 text-center px-4">
                      <UploadCloud className="w-6 h-6 text-sand-500 mb-1" />
                      <p className="text-xs text-ink-600 font-medium">
                        Upload photos of your received item
                      </p>
                      <p className="text-[10px] text-ink-400">JPEG, PNG, WebP up to 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submission buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-sand-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setReviewModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submittingReview}
                  disabled={submittingReview || formRating < 1 || !formTitle.trim() || !formComment.trim()}
                >
                  Submit Review
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PHOTO LIGHTBOX OVERLAY ──────────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-zoom-out animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden cursor-default"
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhoto}
              alt="Enlarged review attachment"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetailsPage;
