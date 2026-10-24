import React from 'react';
import { RotateCcw } from 'lucide-react';
import { OrderDTO, OrderStatus } from '../../../types/order';
import { TERMINAL_STATUSES } from './orderTimeline';
import { formatDateTime, formatLKR } from '../../../utils/format';

export const OrderSummaryBar: React.FC<{ order: OrderDTO; onOpenInvoice: () => void }> = ({
  order,
  onOpenInvoice,
}) => {
  const shortId = order.id.slice(-8).toUpperCase();
  const isTerminal = TERMINAL_STATUSES.has(order.status);
  const isConfirmed = order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.DELIVERED;

  let badgeColor = 'bg-[#FAF7F2] text-[#141414] border-[#DDD6CA]';
  if (isConfirmed) {
    badgeColor = 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
  } else if (isTerminal) {
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else {
    badgeColor = 'bg-neutral-900 text-white border-neutral-800';
  }

  const statusLabel = order.status.replace(/_/g, ' ');

  const returnReq = order.returnRequest;
  const isFullyRefunded = returnReq?.status === 'refunded';
  const isReturnOpen =
    returnReq &&
    !['refunded', 'rejected', 'inspection_failed', 'cancelled'].includes(returnReq.status);

  const returnStatusLabels: Record<string, string> = {
    requested: 'Return Requested',
    under_review: 'Under Review',
    approved: 'Return Approved',
    pickup_scheduled: 'Pickup Scheduled',
    picked_up: 'Picked Up',
    received: 'Return Inspecting',
    refund_processing: 'Refund Processing',
    refunded: 'Refunded',
    rejected: 'Return Rejected',
    inspection_failed: 'Inspection Failed',
    cancelled: 'Return Cancelled',
  };

  const returnLabel = returnReq
    ? returnReq.status === 'refunded'
      ? 'Refunded'
      : `Return: ${returnStatusLabels[returnReq.status] || returnReq.status.replace(/_/g, ' ')}`
    : '';

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
      <div className="space-y-1.5">
        <div className="flex items-center flex-wrap gap-3">
          <h1 className="text-2xl sm:text-3xl font-serif text-[#141414] tracking-tight">
            Order <span className="font-normal text-[#1F1E1B]">#{shortId}</span>
          </h1>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}
          >
            {isConfirmed && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isTerminal && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="capitalize">{statusLabel.toLowerCase()}</span>
          </span>

          {/* Return & Refund Header Badge when return is open */}
          {isReturnOpen && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-900 border-amber-200">
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Return & Refund</span>
            </span>
          )}

          {returnReq && returnLabel && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isFullyRefunded
                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                  : 'bg-[#FAF7F2] text-[#524D46] border-[#DDD6CA]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{returnLabel}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#7A756D]">
          <svg className="w-3.5 h-3.5 text-[#9E988F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Placed on {formatDateTime(order.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-start md:items-end flex-col gap-2">
        <div className="text-left md:text-right">
          <span className="text-[11px] font-semibold text-[#8C867D] uppercase tracking-wider block">
            Total Amount
          </span>
          <div className="text-2xl sm:text-3xl font-serif font-bold text-[#141414] leading-tight">
            {formatLKR(order.total)}
          </div>
          {isFullyRefunded && (
            <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
              Refunded {formatLKR(returnReq?.refundAmount ?? order.total)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenInvoice}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#22211F] border border-[#E2DBD0] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer shadow-xs"
        >
          <svg className="w-3.5 h-3.5 text-[#6B655D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>View Invoice</span>
        </button>
      </div>
    </div>
  );
};
