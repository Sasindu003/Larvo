import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Button } from '../components/ui/Button';

export const CartPage: React.FC = () => {
  const { items, subtotal, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-sand-50 border border-dashed border-sand-300 rounded-3xl p-12 space-y-5 max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-full bg-sand-200/80 flex items-center justify-center mx-auto text-ink-400">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-ink-950">Your Shopping Cart is Empty</h1>
            <p className="text-sm text-ink-600">
              You don't have any items in your bag yet. Explore our luxury collection to add products.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/products')}
            className="mt-4 inline-flex items-center gap-2"
          >
            <span>Start Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-sand-200 pb-6 mb-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-500">Shopping Bag</span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-950 mt-1">
            Your Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})
          </h1>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-ink-500 hover:text-red-600 transition-colors self-start sm:self-auto underline underline-offset-4"
        >
          Clear All Items
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Line items list */}
        <div className="lg:col-span-8 space-y-4">
          <div className="divide-y divide-sand-200 border border-sand-200 rounded-2xl bg-white overflow-hidden shadow-sm">
            {items.map((item) => (
              <div key={item.variantSku} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                {/* Image */}
                <Link
                  to={`/products/${item.slug}`}
                  className="w-24 h-28 sm:w-28 sm:h-36 rounded-xl bg-sand-100 overflow-hidden flex-shrink-0 border border-sand-200"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                </Link>

                {/* Info & Quantity */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-4">
                      <Link
                        to={`/products/${item.slug}`}
                        className="font-display text-base font-bold text-ink-950 hover:text-ink-700 transition-colors line-clamp-1"
                      >
                        {item.name}
                      </Link>
                      <span className="font-bold text-ink-950 text-base whitespace-nowrap">
                        Rs. {(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium text-ink-700 bg-sand-100 px-2 py-0.5 rounded">
                        Size: {item.size}
                      </span>
                      <span className="text-xs font-medium text-ink-700 bg-sand-100 px-2 py-0.5 rounded">
                        Color: {item.color}
                      </span>
                      <span className="text-[11px] text-ink-400 font-mono">
                        SKU: {item.variantSku}
                      </span>
                    </div>

                    <p className="text-xs text-ink-500 pt-0.5">
                      Rs. {item.unitPrice.toFixed(2)} each
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-sand-100">
                    <div className="flex items-center border border-sand-300 rounded-lg bg-sand-50/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantSku, item.quantity - 1)}
                        className="p-2 hover:bg-sand-200 text-ink-700 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-4 text-xs font-bold text-ink-900 min-w-[28px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantSku, item.quantity + 1)}
                        disabled={item.stock !== undefined && item.quantity >= item.stock}
                        className="p-2 hover:bg-sand-200 text-ink-700 transition-colors disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.variantSku)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-xs font-bold text-ink-700 hover:text-ink-950 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-sand-200 rounded-2xl p-6 shadow-sm sticky top-28 space-y-6">
            <h2 className="font-display text-lg font-bold text-ink-950 border-b border-sand-200 pb-3">
              Order Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-ink-600">
                <span>Items Subtotal ({totalItems})</span>
                <span className="font-semibold text-ink-950">Rs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>Shipping</span>
                <span className="font-semibold text-ink-950">
                  {subtotal >= 1500 ? (
                    <span className="text-emerald-700 font-bold">FREE (over Rs. 1,500)</span>
                  ) : (
                    'Calculated at checkout'
                  )}
                </span>
              </div>
              <div className="border-t border-sand-200 pt-3 flex justify-between text-sm font-bold text-ink-950">
                <span>Total Amount</span>
                <span>Rs. {subtotal.toFixed(2)}</span>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full justify-center py-3 text-sm shadow-sm"
              onClick={() => navigate('/checkout')}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>

            <div className="flex items-start gap-2.5 text-[11px] text-ink-500 bg-cream-50 p-3 rounded-xl border border-sand-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Manual payment via bank transfer slip verification. Staff approval guaranteed within 24 hours.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
