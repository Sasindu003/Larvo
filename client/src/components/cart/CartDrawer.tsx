import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { Button } from '../ui/Button';

export const CartDrawer: React.FC = () => {
  const { items, subtotal, totalItems, isDrawerOpen, closeDrawer, updateQuantity, removeItem } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const handleCheckoutClick = () => {
    closeDrawer();
    navigate('/checkout');
  };

  const handleViewCartClick = () => {
    closeDrawer();
    navigate('/cart');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-sand-200 animate-slide-in-right transform transition ease-in-out duration-300"
        >
          {/* Header */}
          <div className="p-5 border-b border-sand-200 flex items-center justify-between bg-cream-50/50">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-ink-900" />
              <h2 id="slide-over-title" className="font-display text-lg font-bold text-ink-950">
                Shopping Cart
              </h2>
              {totalItems > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-ink-900 text-white">
                  {totalItems}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="p-1.5 rounded-full text-ink-400 hover:text-ink-900 hover:bg-sand-100 transition-colors"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List or Empty State */}
          <div className="flex-1 overflow-y-auto p-5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-sand-100 flex items-center justify-center text-ink-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-ink-950">Your cart is empty</h3>
                  <p className="text-xs text-ink-600 max-w-xs">
                    Discover our collection of curated apparel and find something special.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    closeDrawer();
                    navigate('/products');
                  }}
                  className="mt-2"
                >
                  Explore Catalog
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-sand-200">
                {items.map((item) => (
                  <div key={item.variantSku} className="py-4 flex gap-4 first:pt-0 last:pb-0 group">
                    {/* Item Image */}
                    <Link
                      to={`/products/${item.slug}`}
                      onClick={closeDrawer}
                      className="w-20 h-24 rounded-lg bg-sand-100 overflow-hidden flex-shrink-0 border border-sand-200"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                    </Link>

                    {/* Details & Controls */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/products/${item.slug}`}
                            onClick={closeDrawer}
                            className="text-xs font-bold text-ink-900 hover:text-ink-700 transition-colors line-clamp-1"
                          >
                            {item.name}
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeItem(item.variantSku)}
                            className="text-ink-400 hover:text-red-600 transition-colors p-0.5"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Variant Badges */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-medium text-ink-600 bg-sand-100 px-1.5 py-0.5 rounded">
                            Size: {item.size}
                          </span>
                          <span className="text-[11px] font-medium text-ink-600 bg-sand-100 px-1.5 py-0.5 rounded">
                            Color: {item.color}
                          </span>
                        </div>

                        <div className="text-[10px] text-ink-400 font-mono mt-0.5">
                          SKU: {item.variantSku}
                        </div>
                      </div>

                      {/* Quantity Stepper & Price */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-sand-300 rounded-lg bg-sand-50/50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variantSku, item.quantity - 1)}
                            className="p-1.5 hover:bg-sand-200 text-ink-700 transition-colors disabled:opacity-40"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 text-xs font-bold text-ink-900 min-w-[24px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variantSku, item.quantity + 1)}
                            disabled={item.stock !== undefined && item.quantity >= item.stock}
                            className="p-1.5 hover:bg-sand-200 text-ink-700 transition-colors disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-ink-950">
                            Rs. {(item.unitPrice * item.quantity).toFixed(2)}
                          </span>
                          {item.quantity > 1 && (
                            <span className="block text-[10px] text-ink-500">
                              (Rs. {item.unitPrice.toFixed(2)} each)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer / Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-sand-200 bg-cream-50/40 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-ink-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-ink-950 text-sm">Rs. {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-ink-500">
                  <span>Shipping & Taxes</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="primary"
                  className="w-full justify-center py-2.5 shadow-sm"
                  onClick={handleCheckoutClick}
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center text-xs"
                  onClick={handleViewCartClick}
                >
                  View Full Cart Details
                </Button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Secure Bank Transfer & Staff Verified Orders</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
