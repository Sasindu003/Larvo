import React from 'react';
import {
  Tag,
  CheckCircle2,
  Trash2,
  X,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AppliedCoupon } from './types';

interface CouponStepProps {
  appliedCoupon: AppliedCoupon | null;
  promoCodeInput: string;
  setPromoCodeInput: (code: string) => void;
  validatingPromo: boolean;
  promoError: string | null;
  setPromoError: (err: string | null) => void;
  handleApplyCoupon: (e?: React.FormEvent) => Promise<void>;
  handleRemoveCoupon: () => void;
}

export const CouponStep: React.FC<CouponStepProps> = ({
  appliedCoupon,
  promoCodeInput,
  setPromoCodeInput,
  validatingPromo,
  promoError,
  setPromoError,
  handleApplyCoupon,
  handleRemoveCoupon,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
          <Tag className="w-5 h-5 text-ink-900" />
          <span>Apply Promotional Code</span>
        </h2>
        <p className="text-sm text-ink-600 mt-1">
          Have a coupon, seasonal promotion, or voucher code? Enter it below to calculate your savings.
        </p>
      </div>

      {appliedCoupon ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm sm:text-base text-emerald-950 tracking-wider bg-white px-2.5 py-0.5 rounded border border-emerald-300 shadow-2xs">
                    {appliedCoupon.code}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                    Applied
                  </span>
                </div>
                <p className="text-sm font-semibold text-emerald-900">
                  {appliedCoupon.message || 'Promo code applied successfully!'}
                </p>
                {appliedCoupon.coupon?.minOrderAmount && appliedCoupon.coupon.minOrderAmount > 0 && (
                  <p className="text-xs text-emerald-700">
                    Min. order requirement of Rs. {appliedCoupon.coupon.minOrderAmount} met
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-emerald-200/60">
              <span className="text-xs text-emerald-700 font-medium">You Save</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-800 font-display">
                -Rs. {appliedCoupon.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-emerald-200/80">
            <p className="text-xs text-emerald-800">
              To use a different code, remove the current one first.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRemoveCoupon}
              className="text-xs text-danger hover:bg-danger/10 border-danger/20 hover:border-danger/40 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Code</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={handleApplyCoupon} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                id="promoCodeInput"
                value={promoCodeInput}
                onChange={(e) => {
                  setPromoCodeInput(e.target.value);
                  if (promoError) setPromoError(null);
                }}
                disabled={validatingPromo}
                placeholder="e.g. SAVE10, WELCOME20"
                className="w-full px-4 py-3 rounded-xl border border-sand-300 bg-sand-50/50 text-ink-950 uppercase font-mono tracking-wider placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:ring-2 focus:ring-ink-900 focus:bg-white focus:border-transparent outline-none transition-all disabled:opacity-50"
              />
              {promoCodeInput && (
                <button
                  type="button"
                  onClick={() => {
                    setPromoCodeInput('');
                    setPromoError(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={validatingPromo || !promoCodeInput.trim()}
              className="px-6 py-3 justify-center inline-flex items-center gap-2 shadow-sm font-semibold"
            >
              {validatingPromo ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" />
                  <span>Apply Code</span>
                </>
              )}
            </Button>
          </form>

          {promoError && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-3.5 text-danger flex items-start gap-2.5 text-sm animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-xs uppercase tracking-wide">Invalid or Inapplicable Code</p>
                <p className="text-xs">{promoError}</p>
              </div>
            </div>
          )}

          <div className="bg-sand-50 rounded-xl p-4 border border-sand-200/80 text-xs text-ink-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-ink-900">
              <Sparkles className="w-3.5 h-3.5 text-ink-700" />
              <span>Promo Code Guidelines</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-ink-600 pl-1">
              <li>Promo codes apply exclusively to the items subtotal before delivery charges.</li>
              <li>Only one promotional code may be applied per checkout session.</li>
              <li>Promo codes are optional. If you do not have one, click <strong>Proceed to Payment</strong> below.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
