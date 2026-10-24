import React from 'react';
import { Link } from 'react-router-dom';

export const OrderNotFoundState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto border border-[#EFEAE2] shadow-sm space-y-4 my-12">
      <div className="w-12 h-12 rounded-full bg-neutral-100 text-[#141414] flex items-center justify-center mx-auto">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-serif font-bold text-[#141414]">Order Not Found</h2>
      <p className="text-xs text-[#7A756D]">
        We could not locate the requested order ID in your account history. It may have expired or belongs to another customer session.
      </p>
      <div className="pt-2 flex justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 text-xs font-semibold bg-[#141414] text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Try Again
          </button>
        )}
        <Link
          to="/orders"
          className="px-4 py-2 text-xs font-semibold bg-[#FAF7F2] text-[#141414] border border-[#DDD6CA] rounded-xl hover:bg-neutral-100 transition-colors"
        >
          Back to My Orders
        </Link>
      </div>
    </div>
  );
};
