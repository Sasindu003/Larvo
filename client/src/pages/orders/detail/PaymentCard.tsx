import React from 'react';
import { PaymentDetailsDTO } from '../../../types/order';
import { formatLKR } from '../../../utils/format';

export const PaymentCard: React.FC<{ payment: PaymentDetailsDTO }> = ({ payment }) => {
  const isApproved =
    payment.status.toLowerCase() === 'approved' ||
    payment.status.toLowerCase() === 'paid' ||
    payment.status.toLowerCase() === 'verified';

  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#141414]">Payment Details</h2>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
            isApproved
              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
              : 'bg-neutral-100 text-neutral-700 border-neutral-300'
          }`}
        >
          {payment.status}
        </span>
      </div>

      <div className="space-y-2 text-xs text-[#524D46] pt-1">
        <div className="flex items-center justify-between">
          <span>Method</span>
          <span className="font-semibold text-[#141414] capitalize">{payment.method}</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Amount</span>
          <span className="font-semibold text-[#141414]">{formatLKR(payment.amount)}</span>
        </div>
      </div>
    </div>
  );
};
