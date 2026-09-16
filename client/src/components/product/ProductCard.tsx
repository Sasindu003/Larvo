import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { Product } from '../../services/product.service';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

export interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, className = '' }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { isWishlisted: checkWishlisted, toggleWishlist } = useWishlist();
  const isSaved = checkWishlisted(product._id);

  // Determine stock availability
  const isOutOfStock =
    product.inStock === false ||
    (Array.isArray(product.variants) &&
      product.variants.length > 0 &&
      product.variants.every((v) => v.stock <= 0));

  // Determine discount percentage if discountPrice is set
  const hasDiscount =
    product.discountPrice !== null &&
    product.discountPrice !== undefined &&
    product.discountPrice < product.basePrice;

  const discountPercent = hasDiscount
    ? Math.round(((product.basePrice - (product.discountPrice as number)) / product.basePrice) * 100)
    : 0;

  // Category label helper
  const categoryName =
    typeof product.category === 'object' && product.category !== null
      ? product.category.name
      : typeof product.category === 'string'
      ? product.category
      : null;

  const primaryImage =
    product.images && product.images.length > 0
      ? product.images[0]
      : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';

  const { addItem } = useCart();

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;

    // Pick first available in-stock variant
    const variant =
      product.variants.find((v) => v.stock > 0) || product.variants[0];

    if (!variant) return;

    setIsAdding(true);

    addItem(
      {
        productId: product._id,
        slug: product.slug,
        name: product.name,
        image: primaryImage,
        variantSku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPrice:
          product.discountPrice !== null &&
          product.discountPrice !== undefined &&
          product.discountPrice < product.basePrice
            ? product.discountPrice
            : product.basePrice,
        stock: variant.stock,
      },
      1
    );

    setTimeout(() => {
      setIsAdding(false);
    }, 400);
  };

  return (
    <div
      data-testid="product-card"
      className={[
        'group relative flex flex-col bg-white border border-sand-300 rounded-xl overflow-hidden shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-sand-400',
        className,
      ].join(' ')}
    >
      {/* ── Image & Badges Container ──────────────────────────────────────── */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-sand-100">
        <Link to={`/products/${product.slug}`} className="block h-full w-full">
          <img
            src={primaryImage}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            onError={(e) => {
              // Fallback placeholder on image load failure
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
            }}
          />
        </Link>

        {/* Top Badges (Discount / Out of Stock) */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
          {isOutOfStock ? (
            <Badge variant="out-of-stock" className="shadow-sm">
              Out of Stock
            </Badge>
          ) : hasDiscount ? (
            <Badge variant="discount" className="bg-ink-950 text-white shadow-sm font-bold">
              -{discountPercent}%
            </Badge>
          ) : null}
        </div>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 backdrop-blur-md text-ink-700 shadow-sm transition-all duration-200 hover:bg-white hover:text-danger hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-700"
        >
          <Heart
            className={[
              'h-4 w-4 transition-colors',
              isSaved ? 'fill-danger text-danger' : 'stroke-[2]',
            ].join(' ')}
          />
        </button>

        {/* Quick Add Overlay on Desktop Hover */}
        <div className="absolute inset-x-3 bottom-3 z-10 hidden sm:block opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <Button
            variant={isOutOfStock ? 'secondary' : 'primary'}
            size="sm"
            disabled={isOutOfStock}
            loading={isAdding}
            onClick={handleQuickAdd}
            className="w-full shadow-md text-xs font-semibold py-2.5"
          >
            <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
            {isOutOfStock ? 'Out of Stock' : 'Quick Add'}
          </Button>
        </div>
      </div>

      {/* ── Product Info & Content ────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category & Rating */}
        <div className="flex items-center justify-between text-xs text-ink-500 mb-1">
          {categoryName && (
            <span className="uppercase tracking-wider font-semibold text-[10px] text-ink-400">
              {categoryName}
            </span>
          )}
          {product.ratingAvg > 0 && (
            <div className="flex items-center gap-1 ml-auto text-ink-700 font-medium">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{product.ratingAvg.toFixed(1)}</span>
              {product.ratingCount > 0 && (
                <span className="text-ink-400 text-[11px]">({product.ratingCount})</span>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <Link
          to={`/products/${product.slug}`}
          className="font-medium text-sm text-ink-950 line-clamp-2 hover:text-ink-700 transition-colors mb-2"
        >
          {product.name}
        </Link>

        {/* Price & Mobile Quick Add Button */}
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-sand-200">
          <div className="flex items-baseline gap-2">
            {hasDiscount ? (
              <>
                <span className="text-base font-bold text-ink-950 font-display">
                  Rs. {product.discountPrice}
                </span>
                <span className="text-xs text-ink-400 line-through">
                  Rs. {product.basePrice}
                </span>
              </>
            ) : (
              <span className="text-base font-bold text-ink-950 font-display">
                Rs. {product.basePrice}
              </span>
            )}
          </div>

          {/* Mobile Quick Add Icon Button */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleQuickAdd}
            aria-label={isOutOfStock ? 'Out of Stock' : 'Quick Add to Cart'}
            className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-ink-950 text-white disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
