import React from 'react';
import { Link } from 'react-router-dom';
import { Coins, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { formatDateTime, formatLKR } from './deriveReturnTimeline';

interface RefundSummaryProps {
  refundAmount?: number | null;
  status: string;
  refundedAt?: string | null;
}

export const RefundSummary: React.FC<RefundSummaryProps> = ({
  refundAmount,
  status,
  refundedAt,
}) => {
  const isRefunded = status === 'refunded';
  const isProcessing = status === 'refund_processing';

  let statusLabel = 'Pending';
  let statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
  let StatusIcon = Clock;

  if (isRefunded) {
    statusLabel = 'Credited';
    statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    StatusIcon = CheckCircle2;
  } else if (isProcessing) {
    statusLabel = 'Processing';
    statusBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    StatusIcon = Clock;
  }

  const displayAmount = refundAmount != null ? formatLKR(refundAmount) : 'Pending inspection';

  return (
    <div className="bg-[#FAF7F2] rounded-2xl p-4 sm:p-5 border border-[#EAE4D9] space-y-3 mt-5">
      <div className="flex items-center justify-between gap-3 border-b border-[#EAE4D9] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
            <Coins className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C867D] block">
              Refund Settlement
            </span>
            <span className="text-xs font-semibold text-[#141414]">
              Refund to: Store Wallet
            </span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadgeClass}`}
        >
          <StatusIcon className="w-3 h-3" />
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        <div>
          <span className="text-[10px] uppercase font-semibold text-[#8C867D] block">
            Refund Amount
          </span>
          <span className="text-base sm:text-lg font-serif font-bold text-[#141414]">
            {displayAmount}
          </span>
          {isRefunded && refundedAt && (
            <span className="text-[10px] text-[#7A756D] block font-mono mt-0.5">
              Credited {formatDateTime(refundedAt)}
            </span>
          )}
        </div>

        {isRefunded && (
          <Link
            to="/wallet"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#2B2927] text-white transition-colors cursor-pointer shadow-xs"
          >
            <span>View Wallet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default RefundSummary;
