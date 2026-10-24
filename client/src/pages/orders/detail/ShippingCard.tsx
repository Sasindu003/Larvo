import React from 'react';
import { ShippingAddressDTO } from '../../../types/order';

export const ShippingCard: React.FC<{ address: ShippingAddressDTO }> = ({ address }) => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-3 h-full">
      <div className="flex items-center gap-2 text-sm font-bold text-[#141414]">
        <svg className="w-4 h-4 text-[#6B655D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Shipping Destination</span>
      </div>

      <div className="pt-1">
        <span className="inline-block text-[11px] font-semibold bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-full mb-2">
          {address.label}
        </span>

        <div className="text-xs text-[#47433E] leading-relaxed space-y-0.5">
          <p className="font-bold text-[#141414]">{address.line1}</p>
          <p>{address.city}</p>
          <p>{address.province}</p>
          <p>
            {address.postalCode}, {address.country}
          </p>
        </div>
      </div>
    </div>
  );
};
