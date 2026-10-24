import React from 'react';
import { RotateCcw } from 'lucide-react';
import { ReturnRequestDTO } from './orderDetail.types';
import { formatDateTime, formatLKR } from '../../../utils/format';

export const ReturnDetailsCard: React.FC<{ returnRequest: ReturnRequestDTO }> = ({ returnRequest }) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE2]">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-[#6B655D]" />
          <h2 className="text-sm font-bold text-[#141414]">
            Return Details ({returnRequest.items.length})
          </h2>
        </div>
        <span className="text-[11px] font-mono text-[#8C867D]">
          Requested {formatDateTime(returnRequest.statusHistory?.[0]?.at)}
        </span>
      </div>

      <div className="divide-y divide-[#F0EBE2]">
        {returnRequest.items.map((item, idx) => (
          <div key={`${item.sku}-${idx}`} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[#141414]">
                {item.productName}
              </h3>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8C867D]">
                <span>SKU: {item.sku}</span>
                <span>•</span>
                <span>Size: {item.size}</span>
                <span>•</span>
                <span>Qty: {item.qty}</span>
              </div>
            </div>
            <span className="text-xs font-serif font-bold text-[#141414]">
              {formatLKR(item.unitPrice * item.qty)}
            </span>
          </div>
        ))}
      </div>

      {returnRequest.reason && (
        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] text-xs text-[#524D46] space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C867D] block">
            Return Reason
          </span>
          <p className="leading-relaxed text-[#2B2927]">
            {returnRequest.reason}
          </p>
        </div>
      )}
    </div>
  );
};
