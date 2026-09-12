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
} from 'lucide-react';
import { productService, Product, ProductVariant } from '../services/product.service';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
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
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
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
            {product.ratingAvg > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={[
                        'w-3.5 h-3.5',
                        s <= Math.round(product.ratingAvg)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-ink-200 text-ink-200',
                      ].join(' ')}
                    />
                  ))}
                </span>
                <span className="text-xs font-semibold text-ink-700">{product.ratingAvg.toFixed(1)}</span>
                <span className="text-xs text-ink-400">({product.ratingCount} reviews)</span>
              </div>
            )}
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

          {/* ── Reviews Placeholder ────────────────────────────────────── */}
          <div className="border border-dashed border-sand-300 rounded-xl p-5 text-center mt-2 bg-sand-50">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
              Customer Reviews — Coming in P30
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
