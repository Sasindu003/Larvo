import React from 'react';
import { formatLKR } from '../../../utils/format';

export const CostBreakdownCard: React.FC<{
  subtotal: number;
  shippingFee: number;
  discount?: number;
  total: number;
}> = ({ subtotal, shippingFee, discount, total }) => {
  const hasDiscount = typeof discount === 'number' && discount > 0;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-3.5 h-full">
      <h2 className="text-sm font-bold text-[#141414]">Cost Breakdown</h2>

      <div className="space-y-2 text-xs text-[#524D46]">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span className="font-medium text-[#141414]">{formatLKR(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Shipping Fee</span>
          <span className="font-medium text-[#141414]">{formatLKR(shippingFee)}</span>
        </div>

        {hasDiscount && (
          <div className="flex items-center justify-between text-emerald-700">
            <span>Special Discount</span>
            <span className="font-medium">-{formatLKR(discount!)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-[#F0EBE2] flex items-center justify-between text-sm font-bold text-[#141414]">
          <span>Total</span>
          <span className="font-serif text-base text-[#141414]">{formatLKR(total)}</span>
        </div>
      </div>
    </div>
  );
};
