import React, { useState } from 'react';
import { OrderItemDTO } from '../../../types/order';
import { formatLKR } from '../../../utils/format';

export const OrderItemsCard: React.FC<{ items: OrderItemDTO[] }> = ({ items }) => {
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const handleImageError = (sku: string) => {
    setImageErrorMap((prev) => ({ ...prev, [sku]: true }));
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-[#F0EBE2]">
        <svg className="w-4 h-4 text-[#6B655D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <h2 className="text-sm font-bold text-[#141414]">
          Order Items ({items.length})
        </h2>
      </div>

      <div className="divide-y divide-[#F0EBE2]">
        {items.map((item, idx) => {
          const itemKey = `${item.sku}-${idx}`;
          const hasError = !item.imageUrl || imageErrorMap[itemKey];

          return (
            <div key={itemKey} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-20 h-24 rounded-2xl bg-[#F6F2EB] border border-[#EAE4D9] overflow-hidden shrink-0 flex items-center justify-center relative">
                  {!hasError && item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover object-top"
                      onError={() => handleImageError(itemKey)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-[#8C867D]">
                      <svg className="w-6 h-6 stroke-[#8C867D]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span className="text-[9px] font-mono mt-1 uppercase">LARVO</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-[#141414] leading-snug">
                    {item.productName}
                  </h3>
                  <p className="text-[11px] font-mono text-[#8C867D]">
                    SKU: {item.sku}
                  </p>

                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] font-medium bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      Size: {item.size}
                    </span>
                    <span className="text-[11px] font-medium bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      Color: {item.color}
                    </span>
                    <span className="text-[11px] font-medium bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      Qty: {item.qty}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-bold font-serif text-[#141414] block">
                  {formatLKR(item.unitPrice * item.qty)}
                </span>
                <span className="text-[11px] text-[#8C867D] block">
                  {formatLKR(item.unitPrice)} each
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs text-[#166534] font-medium">
          Item verified in warehouse inventory. Securely packaged in protective garment wrap.
        </p>
      </div>
    </div>
  );
};
