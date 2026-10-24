import React from 'react';

export const OrderDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading order details">
      <div className="bg-white rounded-3xl p-7 border border-[#EFEAE2] h-28 flex items-center justify-between">
        <div className="space-y-2">
          <div className="w-48 h-7 bg-neutral-200 rounded-md" />
          <div className="w-36 h-4 bg-neutral-100 rounded-md" />
        </div>
        <div className="w-32 h-10 bg-neutral-200 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 2xl:col-span-8 space-y-6">
          <div className="h-64 bg-neutral-200 rounded-3xl" />
          <div className="h-56 bg-neutral-200 rounded-3xl" />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="h-44 bg-neutral-200 rounded-3xl" />
            <div className="h-44 bg-neutral-200 rounded-3xl" />
            <div className="h-44 bg-neutral-200 rounded-3xl" />
          </div>
        </div>
        <div className="lg:col-span-5 2xl:col-span-4 h-96 bg-neutral-200 rounded-3xl" />
      </div>
    </div>
  );
};
