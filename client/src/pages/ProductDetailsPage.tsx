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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Skeleton height="h-4" width="w-48" className="mb-6" />
      <ProductDetailsSkeleton />
    </div>
  );

  if (notFound || !product) return (
    <div className="max-w-7xl mx-auto px-4">
      <ProductNotFound slug={slug ?? ''} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-ink-500 mb-6">
        <Link to="/" className="hover:text-ink-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/products" className="hover:text-ink-900 transition-colors">Products</Link>
        {categoryName && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link
              to={`/products?category=${typeof product.category === 'object' && product.category !== null ? (product.category as any).slug : ''}`}
              className="hover:text-ink-900 transition-colors"
            >
              {categoryName}
            </Link>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-ink-800 font-medium line-clamp-1 max-w-[200px]">{product.name}</span>
      </nav>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

        {/* ── LEFT: Image Gallery ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Main Image */}
          <div
            className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-sand-100 border border-sand-200 cursor-zoom-in"
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

            {/* Zoom hint icon */}
            {!zoomed && (
              <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur text-ink-500 shadow-sm pointer-events-none">
                <ZoomIn className="w-4 h-4" />
              </div>
            )}

            {/* Top badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
              {isOutOfStock ? (
                <Badge variant="out-of-stock">Out of Stock</Badge>
              ) : hasDiscount ? (
                <Badge variant="discount" className="bg-ink-950 text-white font-bold">
                  -{discountPercent}% OFF
                </Badge>
              ) : null}
            </div>

            {/* Prev / Next arrows (only if multiple images) */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm text-ink-700 hover:bg-white transition-colors z-10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm text-ink-700 hover:bg-white transition-colors z-10"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={[
                    'flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-all',
                    idx === activeImageIndex
                      ? 'border-ink-950 shadow-md scale-[1.04]'
                      : 'border-sand-200 hover:border-sand-400 opacity-70 hover:opacity-100',
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

        {/* ── RIGHT: Product Info ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Category breadcrumb tag & rating */}
          <div className="flex items-center justify-between">
            {categoryName && (
              <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                {categoryName}
              </span>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={[
                      'w-3.5 h-3.5',
                      s <= Math.round(product.ratingAvg || 0)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-ink-200 text-ink-200',
                    ].join(' ')}
                  />
                ))}
              </span>
              <span className="text-xs font-bold text-ink-800">
                {(product.ratingAvg || 0).toFixed(1)}
              </span>
              <a
                href="#reviews-section"
                className="text-xs text-ink-500 hover:text-ink-900 underline transition-colors cursor-pointer"
              >
                ({product.ratingCount || 0} reviews)
              </a>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink-950 leading-tight">
            {product.name}
          </h1>

          {/* Price Breakdown Block */}
          <div className="bg-sand-50 border border-sand-200 rounded-xl px-5 py-4 space-y-1.5">
            {hasDiscount ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl font-bold text-ink-950">
                    {formatPrice(product.discountPrice!)}
                  </span>
                  <span className="text-base text-ink-400 line-through">
                    {formatPrice(product.basePrice)}
                  </span>
                  <Badge variant="discount" className="bg-ink-950 text-white ml-1">
                    -{discountPercent}% OFF
                  </Badge>
                </div>
                <p className="text-xs text-emerald-700 font-medium">
                  You save {formatPrice(product.basePrice - product.discountPrice!)} on this item
                </p>
              </>
            ) : (
              <span className="font-display text-3xl font-bold text-ink-950">
                {formatPrice(product.basePrice)}
              </span>
            )}
          </div>

          {/* ── Color Swatches ────────────────────────────────────────────── */}
          {availableColors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Color
                </span>
                {selectedColor && (
                  <span className="text-xs font-medium text-ink-800">{selectedColor}</span>
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
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        isActive
                          ? 'bg-ink-950 text-white border-ink-950 shadow-sm'
                          : disabled
                          ? 'border-sand-200 text-ink-300 bg-sand-50 cursor-not-allowed line-through'
                          : 'border-sand-300 text-ink-700 bg-white hover:border-ink-700 hover:bg-sand-50',
                      ].join(' ')}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Size Selector ─────────────────────────────────────────────── */}
          {availableSizes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                  Size
                </span>
                {selectedSize && (
                  <span className="text-xs text-ink-400 cursor-pointer hover:underline">
                    Size Guide
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
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
                        'relative h-10 min-w-[44px] px-3 rounded-lg border text-sm font-semibold transition-all',
                        isActive
                          ? 'bg-ink-950 text-white border-ink-950 shadow-sm'
                          : disabled
                          ? 'border-sand-200 text-ink-300 bg-sand-50 cursor-not-allowed'
                          : 'border-sand-300 text-ink-700 bg-white hover:border-ink-800 hover:bg-sand-50',
                      ].join(' ')}
                    >
                      {size}
                      {/* Diagonal strikethrough for out-of-stock sizes */}
                      {disabled && !isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
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

          {/* Selected SKU & Stock Info */}
          {selectedVariant && (
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Package className="w-3.5 h-3.5" />
              {selectedVariant.stock > 0 ? (
                <>
                  <Badge className={selectedVariant.stock <= 5 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}>
                    {selectedVariant.stock <= 5 ? 'Low Stock' : 'In Stock'}
                  </Badge>
                  <span>
                    {selectedVariant.stock <= 5
                      ? `Only ${selectedVariant.stock} left`
                      : `${selectedVariant.stock} available`}{' '}
                    · SKU:{' '}
                    <span className="font-mono text-ink-700">{selectedVariant.sku}</span>
                  </span>
                </>
              ) : (
                <>
                  <Badge variant="out-of-stock" className="bg-danger/10 text-danger border-danger/20">Out of Stock</Badge>
                  <span className="text-danger font-medium">Select another size or color</span>
                </>
              )}
            </div>
          )}

          {/* ── CTA Buttons ───────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 pt-2">
            {addedFeedback ? (
              <div className="flex items-center justify-center gap-2 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Added to Cart!
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                disabled={isOutOfStock}
                loading={addingToCart}
                onClick={handleAddToCart}
                className="w-full rounded-xl text-sm"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            )}

            <Button
              variant="secondary"
              size="lg"
              onClick={handleWishlist}
              className="w-full rounded-xl text-sm"
            >
              <Heart
                className={[
                  'w-4 h-4 mr-2 transition-colors',
                  isSaved ? 'fill-danger text-danger' : '',
                ].join(' ')}
              />
              {isSaved ? 'Saved to Wishlist' : 'Add to Wishlist'}
            </Button>
          </div>

          {/* ── Product Description ─────────────────────────────────────── */}
          <div className="border-t border-sand-200 pt-5 space-y-2">
            <h2 className="text-sm font-semibold text-ink-900 uppercase tracking-wider">
              About This Product
            </h2>
            <p className="text-sm text-ink-700 leading-relaxed">{product.description}</p>
          </div>

          {/* Material from selected variant */}
          {selectedVariant?.material && (
            <div className="flex items-center gap-2 text-xs text-ink-500 border-t border-sand-200 pt-4">
              <span className="font-semibold text-ink-700">Material:</span>
              <span>{selectedVariant.material}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CUSTOMER REVIEWS & RATINGS SECTION ─────────────────────────── */}
      <div id="reviews-section" className="mt-16 pt-12 border-t border-sand-200 space-y-10 scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-xs uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Verified Community Feedback
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-ink-950">
              Customer Reviews
            </h2>
          </div>

          {/* Eligibility Call to Action */}
          <div>
            {!user ? (
              <div className="flex items-center gap-2 text-xs text-ink-500 bg-sand-50 px-4 py-2.5 rounded-xl border border-sand-200">
                <ShieldCheck className="w-4 h-4 text-ink-400" />
                <span>
                  Only customers who received this product can review.{' '}
                  <Link to={`/login?redirect=/products/${slug}`} className="font-semibold text-ink-900 underline">
                    Log in
                  </Link>
                </span>
              </div>
            ) : eligibilityLoading ? (
              <div className="text-xs text-ink-400 py-2">Checking review eligibility...</div>
            ) : eligibility?.canReview ? (
              <Button
                variant="primary"
                onClick={() => setReviewModalOpen(true)}
                className="rounded-xl text-sm shadow-sm"
              >
                <Star className="w-4 h-4 mr-1.5 fill-current" />
                Write a Review
              </Button>
            ) : eligibility?.reason === 'already_reviewed' ? (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                You have already reviewed this product
              </div>
            ) : eligibility?.reason === 'not_delivered' ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                You can review this product once your order is delivered.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-ink-500 bg-sand-50 px-3.5 py-2 rounded-xl border border-sand-200">
                <ShieldCheck className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                <span>Only customers who have received this product can review.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary & Rating Breakdown ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-sand-50 border border-sand-200 rounded-2xl p-6 lg:p-8">
          {/* Average Rating Block */}
          <div className="flex flex-col justify-center items-center lg:items-start text-center lg:text-left border-b lg:border-b-0 lg:border-r border-sand-200 pb-6 lg:pb-0 lg:pr-8">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-extrabold text-ink-950">
                {(product.ratingAvg || 0).toFixed(1)}
              </span>
              <span className="text-ink-400 font-medium text-lg">/ 5.0</span>
            </div>
            <div className="flex items-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={[
                    'w-5 h-5',
                    s <= Math.round(product.ratingAvg || 0)
                      ? 'fill-amber-400 text-amber-400'
                      : 'fill-ink-200 text-ink-200',
                  ].join(' ')}
                />
              ))}
            </div>
            <p className="text-xs text-ink-500 font-medium">
              Based on {product.ratingCount || 0} customer {product.ratingCount === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          {/* Rating Breakdown Bars (5★ -> 1★) */}
          <div className="lg:col-span-2 flex flex-col justify-center space-y-2 lg:pl-4">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviewsData?.ratingDistribution?.[star] || 0;
              const total = product.ratingCount || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-14 font-medium text-ink-700">
                    <span>{star}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="flex-1 h-2.5 bg-sand-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-ink-400 font-mono">
                    {pct}%
                  </span>
                  <span className="w-8 text-right text-ink-400 font-mono">
                    ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Photo Gallery Strip (AliExpress style) ────────────────────── */}
        {reviewsData?.photoGallery && reviewsData.photoGallery.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-600" />
                Customer Photos ({reviewsData.photoGallery.length})
              </h3>
              <span className="text-xs text-ink-400">Click to enlarge</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-sand-300">
              {reviewsData.photoGallery.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxPhoto(item.photoUrl)}
                  className="relative group shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-sand-200 bg-sand-100 hover:border-amber-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                >
                  <img
                    src={item.photoUrl}
                    alt={`Customer uploaded photo ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-bold text-amber-300 pointer-events-none">
                    <Star className="w-2.5 h-2.5 fill-amber-300" />
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

        {/* ── Filter & Sort Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-sand-200">
          {/* Photos filter toggle */}
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-700 select-none">
            <input
              type="checkbox"
              checked={reviewsWithPhotos}
              onChange={(e) => setReviewsWithPhotos(e.target.checked)}
              className="rounded border-sand-300 text-amber-600 focus:ring-amber-500"
            />
            <Camera className="w-3.5 h-3.5 text-ink-500" />
            Reviews with customer photos only
          </label>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 text-xs text-ink-600">
            <span className="font-semibold text-ink-800">Sort by:</span>
            <select
              value={reviewsSort}
              onChange={(e) => setReviewsSort(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-sand-300 rounded-lg text-xs font-medium text-ink-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="helpful">Most Helpful</option>
              <option value="newest">Newest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
          </div>
        </div>

        {/* ── Reviews Cards List ────────────────────────────────────────── */}
        {reviewsLoading ? (
          <div className="py-12 text-center text-sm text-ink-400 animate-pulse">
            Loading reviews...
          </div>
        ) : !reviewsData?.items || reviewsData.items.length === 0 ? (
          <div className="text-center py-12 px-4 bg-sand-50 rounded-2xl border border-sand-200">
            <MessageSquare className="w-10 h-10 text-sand-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-ink-900">No reviews yet</h3>
            <p className="text-xs text-ink-500 mt-1 max-w-sm mx-auto">
              {reviewsWithPhotos
                ? 'No reviews with photos match this filter.'
                : 'Be the first to review this product once your order is delivered.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviewsData.items.map((review) => {
              const authorName = review.user?.name || 'Customer';
              const initial = authorName.charAt(0).toUpperCase();

              return (
                <div
                  key={review._id}
                  className="bg-white border border-sand-200 rounded-2xl p-6 space-y-4 hover:border-sand-300 transition-all shadow-sm"
                >
                  {/* Reviewer Header */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sand-200 text-ink-800 font-bold text-sm flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink-950">{authorName}</span>
                          {review.verifiedPurchase && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Verified Purchase
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-ink-400">
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
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-ink-200 text-ink-200',
                          ].join(' ')}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Title & Comment */}
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-ink-950">{review.title}</h4>
                    <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
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
                            className="w-20 h-20 rounded-xl overflow-hidden border border-sand-200 bg-sand-100 hover:border-amber-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 group"
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
                    <div className="bg-sand-50 border border-sand-200/90 rounded-xl p-4 space-y-1.5 mt-2">
                      <div className="flex items-center justify-between text-xs text-ink-900 font-bold">
                        <span className="flex items-center gap-1.5 text-amber-700">
                          <CornerDownRight className="w-3.5 h-3.5 text-amber-600" />
                          Official Store Reply
                        </span>
                        <span className="text-ink-400 font-normal">
                          {new Date(review.adminReply.repliedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-700 leading-relaxed whitespace-pre-line pl-5">
                        {review.adminReply.text}
                      </p>
                    </div>
                  )}

                  {/* Helpful Voting Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-sand-100 text-xs text-ink-500">
                    <span className="text-[11px]">Was this review helpful to you?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVote(review._id, review.userVote, 'up')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                          review.userVote === 'up'
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white border-sand-200 text-ink-600 hover:bg-sand-50'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Helpful ({review.upvoteCount ?? review.helpfulVotes?.up?.length ?? 0})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleVote(review._id, review.userVote, 'down')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                          review.userVote === 'down'
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-white border-sand-200 text-ink-600 hover:bg-sand-50'
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
            {reviewsData.pages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-ink-500">
                  Page {reviewsPage} of {reviewsData.pages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={reviewsPage <= 1}
                    onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={reviewsPage >= reviewsData.pages}
                    onClick={() => setReviewsPage((p) => Math.min(reviewsData.pages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
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
