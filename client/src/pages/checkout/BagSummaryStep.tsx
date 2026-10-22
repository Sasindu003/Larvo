import React from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { CartItem } from '../../context/CartContext';
import { InventoryValidationResponse } from '../../services/inventory.service';
import { UnavailableItem } from './types';

interface BagSummaryStepProps {
  items: CartItem[];
  totalItems: number;
  validating: boolean;
  hasValidated: boolean;
  validationResults: Record<string, InventoryValidationResponse>;
  unavailableItems: UnavailableItem[];
  runValidation: () => void;
  updateQuantity: (sku: string, qty: number) => void;
  removeItem: (sku: string) => void;
}

export const BagSummaryStep: React.FC<BagSummaryStepProps> = ({
  items,
  totalItems,
  validating,
  hasValidated,
  validationResults,
  unavailableItems,
  runValidation,
  updateQuantity,
  removeItem,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sand-200">
        <div>
          <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
            <span>1. Review Your Bag Items</span>
            <span className="text-xs font-sans font-normal text-ink-500 bg-sand-100 px-2.5 py-0.5 rounded-full">
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
          </h2>
          <p className="text-xs text-ink-600 mt-0.5">
            Verify sizes, quantities, and live inventory availability before moving to delivery.
          </p>
        </div>

        <button
          type="button"
          onClick={runValidation}
          disabled={validating}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:text-ink-950 transition-colors disabled:opacity-50 self-start sm:self-auto bg-sand-50 hover:bg-sand-100 px-3 py-1.5 rounded-lg border border-sand-200"
          title="Re-check inventory stock now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`} />
          <span>{validating ? 'Checking Stock...' : 'Verify Stock'}</span>
        </button>
      </div>

      {/* Blocking Stock Shortage Alert Banner */}
      {unavailableItems.length > 0 && (
        <div
          className="bg-danger-light border-2 border-danger/30 rounded-xl p-4 sm:p-5 space-y-3 animate-fade-in"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-danger-dark">
                Inventory Shortage Detected — Cannot Proceed
              </h3>
              <p className="text-xs text-danger-dark/90 leading-relaxed">
                The following item(s) in your bag exceed current available stock in our warehouse.
                Adjust your quantities or remove unavailable items to continue checkout:
              </p>
            </div>
          </div>

          <div className="divide-y divide-danger/20 border-t border-danger/20 pt-2 text-xs">
            {unavailableItems.map(({ item, available }) => (
              <div
                key={item.variantSku}
                className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="font-medium text-ink-900">
                  <span className="font-bold text-danger-dark">{item.name}</span>{' '}
                  <span className="text-ink-600">
                    (Size: {item.size}, Color: {item.color})
                  </span>
                  <div className="text-[11px] text-danger-dark">
                    Requested: <strong className="underline">{item.quantity}</strong> | Available in Stock:{' '}
                    <strong>{available}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {available > 0 ? (
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantSku, available)}
                      className="text-xs bg-white text-ink-900 hover:bg-sand-100 font-semibold px-2.5 py-1 rounded border border-danger/40 shadow-xs transition-colors"
                    >
                      Set to {available}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantSku)}
                    className="text-xs bg-danger text-white hover:bg-danger-dark font-semibold px-2.5 py-1 rounded shadow-xs transition-colors"
                  >
                    Remove Item
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line Items List */}
      <div className="divide-y divide-sand-200 border border-sand-200 rounded-xl overflow-hidden">
        {items.map((item) => {
          const validation = validationResults[item.variantSku];
          const isOutOfStock = validation && (validation.available ?? 0) <= 0;
          const isPartialStock = validation && !validation.ok && (validation.available ?? 0) > 0;
          const isAvailable = validation && validation.ok;

          return (
            <div
              key={item.variantSku}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-4 transition-colors ${
                !isAvailable && hasValidated ? 'bg-danger-light/20' : 'bg-white hover:bg-sand-50/40'
              }`}
            >
              {/* Thumbnail */}
              <Link
                to={`/products/${item.slug}`}
                className="w-20 h-24 sm:w-24 sm:h-28 rounded-lg bg-sand-100 overflow-hidden flex-shrink-0 border border-sand-200 relative group"
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

              {/* Details */}
              <div className="flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/products/${item.slug}`}
                      className="font-display text-base font-bold text-ink-950 hover:text-ink-700 transition-colors line-clamp-1"
                    >
                      {item.name}
                    </Link>
                    <span className="font-bold text-ink-950 text-base whitespace-nowrap">
                      Rs. {(item.unitPrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
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

                  {/* Live Availability Badges */}
                  <div className="pt-1.5 flex items-center gap-2">
                    {validating ? (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Checking live inventory...
                      </span>
                    ) : isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-danger bg-danger-light px-2.5 py-0.5 rounded-full border border-danger/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Out of Stock (0 remaining)
                      </span>
                    ) : isPartialStock ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Only {validation.available} left in stock (need {item.quantity})
                      </span>
                    ) : isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        In Stock ({validation.available} available)
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">Stock pending verification</span>
                    )}
                  </div>
                </div>

                {/* Controls: Quantity & Remove */}
                <div className="flex items-center justify-between pt-2 border-t border-sand-100 text-xs text-ink-500">
                  <div className="flex items-center gap-2">
                    <span>Quantity:</span>
                    <div className="flex items-center border border-sand-300 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantSku, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-ink-600 hover:bg-sand-100 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-bold text-ink-950">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantSku, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-ink-600 hover:bg-sand-100 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-ink-400 ml-1">
                      × Rs. {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} each
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.variantSku)}
                    className="text-xs font-semibold text-ink-400 hover:text-danger transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
