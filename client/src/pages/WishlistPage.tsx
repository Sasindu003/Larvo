import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/Skeleton';

export const WishlistPage: React.FC = () => {
  const { items, totalWishlist, loading, removeFromWishlist } = useWishlist();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const handleMoveToCart = (product: any) => {
    // Pick the first available in-stock variant
    const variant =
      product.variants?.find((v: any) => v.stock > 0) || product.variants?.[0];

    if (!variant || (product.variants && product.variants.every((v: any) => v.stock <= 0))) {
      return;
    }

    const price =
      product.discountPrice !== null &&
      product.discountPrice !== undefined &&
      product.discountPrice < product.basePrice
        ? product.discountPrice
        : product.basePrice;

    const primaryImg =
      product.images?.[0] ||
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';

    addItem(
      {
        productId: product._id,
        slug: product.slug,
        name: product.name,
        image: primaryImg,
        variantSku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPrice: price,
        stock: variant.stock,
      },
      1
    );

    // Remove from wishlist when moved to cart
    removeFromWishlist(product._id);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="border-b border-sand-200 pb-6 mb-8">
          <div className="h-4 w-32 bg-sand-200 rounded animate-pulse mb-2" />
          <div className="h-8 w-64 bg-sand-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-sand-50 border border-dashed border-sand-300 rounded-3xl p-12 space-y-5 max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-full bg-sand-200/80 flex items-center justify-center mx-auto text-ink-400">
            <Heart className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-ink-950">Your Wishlist is Empty</h1>
            <p className="text-sm text-ink-600">
              Save pieces you love by tapping the heart icon on any product in our collections.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/products')}
            className="mt-4 inline-flex items-center gap-2"
          >
            <span>Explore Collection</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-sand-200 pb-6 mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Saved Curations
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950 mt-1">
            My Wishlist ({totalWishlist} {totalWishlist === 1 ? 'item' : 'items'})
          </h1>
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-xs font-bold text-ink-700 hover:text-ink-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>
      </div>

      {/* Grid of Wishlist items */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {items.map((product) => {
          const isOutOfStock =
            product.inStock === false ||
            (Array.isArray(product.variants) &&
              product.variants.length > 0 &&
              product.variants.every((v: any) => v.stock <= 0));

          const hasDiscount =
            product.discountPrice !== null &&
            product.discountPrice !== undefined &&
            product.discountPrice < product.basePrice;

          const discountPercent = hasDiscount
            ? Math.round(
                ((product.basePrice - (product.discountPrice as number)) / product.basePrice) * 100
              )
            : 0;

          const primaryImage =
            product.images && product.images.length > 0
              ? product.images[0]
              : 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';

          return (
            <div
              key={product._id}
              className="group flex flex-col bg-white border border-sand-300 rounded-xl overflow-hidden shadow-card transition-all duration-300 hover:shadow-card-hover"
            >
              {/* Image Container */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-sand-100">
                <Link to={`/products/${product.slug}`} className="block h-full w-full">
                  <img
                    src={primaryImage}
                    alt={product.name}
                    className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                </Link>

                {/* Badges */}
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

                {/* Remove button overlay */}
                <button
                  type="button"
                  onClick={() => removeFromWishlist(product._id)}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-ink-600 hover:text-red-600 hover:bg-white shadow-sm transition-all z-20"
                  title="Remove from wishlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Product Info */}
              <div className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
                <div>
                  {product.category && (
                    <span className="text-[10px] font-bold tracking-widest text-ink-400 uppercase">
                      {typeof product.category === 'object' ? product.category.name : product.category}
                    </span>
                  )}
                  <Link
                    to={`/products/${product.slug}`}
                    className="block font-display text-sm font-bold text-ink-900 group-hover:text-ink-700 transition-colors line-clamp-1 mt-0.5"
                  >
                    {product.name}
                  </Link>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-sm sm:text-base font-bold text-ink-950">
                      Rs. {hasDiscount ? product.discountPrice : product.basePrice}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-ink-400 line-through">
                        Rs. {product.basePrice}
                      </span>
                    )}
                  </div>
                </div>

                {/* Move to Cart Action Button */}
                <div className="pt-2 border-t border-sand-100 flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isOutOfStock}
                    onClick={() => handleMoveToCart(product)}
                    className="w-full justify-center text-xs py-2 shadow-none"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                    <span>{isOutOfStock ? 'Out of Stock' : 'Move to Cart'}</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WishlistPage;
