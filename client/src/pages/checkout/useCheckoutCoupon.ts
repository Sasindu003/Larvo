import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { couponService } from '../../services/coupon.service';
import { AppliedCoupon } from './types';

export function useCheckoutCoupon(subtotal: number) {
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [validatingPromo, setValidatingPromo] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Re-validate applied coupon if subtotal changes
  useEffect(() => {
    if (appliedCoupon && subtotal > 0) {
      couponService
        .validateCoupon(appliedCoupon.code, subtotal)
        .then((res) => {
          if (res.valid) {
            setAppliedCoupon({
              ...appliedCoupon,
              discountAmount: res.discountAmount || 0,
            });
          } else {
            setAppliedCoupon(null);
            toast.error(`Coupon ${appliedCoupon.code} removed: ${res.message || 'No longer applicable'}`);
          }
        })
        .catch(() => {
          // silently catch
        });
    }
  }, [subtotal]);

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = promoCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError('Please enter a promo code');
      return;
    }

    setValidatingPromo(true);
    setPromoError(null);
    try {
      const res = await couponService.validateCoupon(cleanCode, subtotal);
      if (res.valid) {
        setAppliedCoupon({
          code: cleanCode,
          discountAmount: res.discountAmount || 0,
          coupon: res.coupon,
          message: res.message || 'Coupon applied successfully',
        });
        setPromoCodeInput('');
        toast.success(res.message || 'Coupon applied successfully');
      } else {
        const errorMsg = res.message || 'Invalid or inapplicable coupon code';
        setPromoError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errorObj.response?.data?.message || errorObj.message || 'Failed to validate coupon';
      setPromoError(msg);
      toast.error(msg);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setPromoError(null);
    toast.success('Promo code removed');
  };

  return {
    promoCodeInput,
    setPromoCodeInput,
    validatingPromo,
    promoError,
    setPromoError,
    appliedCoupon,
    setAppliedCoupon,
    handleApplyCoupon,
    handleRemoveCoupon,
  };
}
