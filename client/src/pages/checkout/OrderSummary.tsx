import React from 'react';
import { Tag, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Order } from '../../services/order.service';
import { Address } from '../../services/user.service';
import { AppliedCoupon, CheckoutStep } from './types';

interface OrderSummaryProps {
  createdOrder: Order | null;
  totalItems: number;
  effectiveSubtotal: number;
  appliedCoupon: AppliedCoupon | null;
  discountAmount: number;
  shippingFee: number;
  grandTotal: number;
  selectedAddress: Address | null;
  currentStep: CheckoutStep;
  setCurrentStep: (step: CheckoutStep) => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  createdOrder,
  totalItems,
  effectiveSubtotal,
  appliedCoupon,
  discountAmount,
  shippingFee,
  grandTotal,
  selectedAddress,
  currentStep,
  setCurrentStep,
}) => {
  return (
    <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
      <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-5">
        <h2 className="font-display text-lg font-bold text-ink-950 pb-3 border-b border-sand-200">
          Order Summary
        </h2>

        <div className="space-y-3 text-xs sm:text-sm">
          <div className="flex justify-between text-ink-600">
            <span>Items Subtotal ({createdOrder ? (createdOrder.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0) : totalItems})</span>
            <span className="font-semibold text-ink-950">
              Rs. {effectiveSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {(appliedCoupon || (createdOrder && (createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0) > 0)) && (
            <div className="flex justify-between text-emerald-700 text-xs sm:text-sm font-semibold">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                Promo ({createdOrder?.coupon?.code || appliedCoupon?.code || 'Applied'})
              </span>
              <span>
                -Rs. {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="flex justify-between text-ink-600">
            <span>Estimated Delivery</span>
            <span className="font-semibold text-ink-950">
              {shippingFee === 0 ? (
                <span className="text-emerald-700 font-bold">FREE (Over Rs. 1,500)</span>
              ) : (
                `Rs. ${shippingFee.toFixed(2)}`
              )}
            </span>
          </div>

          <div className="border-t border-sand-200 pt-3 flex justify-between text-base font-bold text-ink-950">
            <span>Estimated Total</span>
            <span>
              Rs. {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Selected Shipping Destination Preview */}
          {selectedAddress && (
            <div className="pt-3 border-t border-sand-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-ink-500 font-semibold uppercase tracking-wider">
                <span>Delivery Destination</span>
                {currentStep !== 2 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-ink-900 hover:underline capitalize font-bold"
                  >
                    Change
                  </button>
                )}
              </div>
              <p className="text-xs font-bold text-ink-950">
                {selectedAddress.label} — {selectedAddress.line1}
              </p>
              <p className="text-[11px] text-ink-600">
                {selectedAddress.city}, {selectedAddress.province} {selectedAddress.postalCode}
              </p>
              <p className="text-[11px] text-ink-500">{selectedAddress.country}</p>
            </div>
          )}
        </div>

        {/* Guarantees */}
        <div className="space-y-2.5 pt-2 border-t border-sand-100 text-[11px] text-ink-600">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>Real-time warehouse inventory locked upon order placement.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>Supports Bank Slip, Simulated Online, & Reward Points (P42).</span>
          </div>
        </div>
      </div>
    </div>
  );
};
