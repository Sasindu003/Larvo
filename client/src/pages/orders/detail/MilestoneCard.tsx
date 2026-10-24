import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Ban, CheckCircle2, Coins, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { OrderDTO, DerivedTimeline } from '../../../types/order';
import { TIMELINE_STAGES, formatDateRange } from './orderTimeline';
import { deriveReturnTimeline } from './deriveReturnTimeline';
import { RETURN_STAGES } from './returnTimeline.config';
import { formatDateTime, formatLKR } from '../../../utils/format';

export const MilestoneCard: React.FC<{
  order: OrderDTO;
  timeline: DerivedTimeline;
  copiedTracking?: boolean;
  onCopyTracking?: (tracking: string) => void;
}> = ({ order, timeline, copiedTracking, onCopyTracking }) => {
  const returnReq = order.returnRequest;

  // ── Return Mode ─────────────────────────────────────────────────────────────
  if (returnReq) {
    const isRefunded = returnReq.status === 'refunded';
    const isRejectedOrFailed =
      returnReq.status === 'rejected' || returnReq.status === 'inspection_failed';
    const isCancelled = returnReq.status === 'cancelled';

    // Terminal branch: REJECTED or INSPECTION_FAILED
    if (isRejectedOrFailed) {
      const isFailed = returnReq.status === 'inspection_failed';
      const title = isFailed ? 'Return Inspection Failed' : 'Return Not Approved';
      const reason =
        returnReq.rejectionReason ||
        (isFailed
          ? 'The returned item did not meet condition guidelines during warehouse inspection.'
          : 'Staff reviewed and rejected this return request.');
      const lastEntry = returnReq.statusHistory?.slice(-1)[0];

      return (
        <div className="bg-[#FAF7F2] text-[#141414] rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EAE4D9]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7A756D] bg-[#EFEAE2] border border-[#DDD6CA] px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#8C867D]" />
              {title}
            </span>
            {lastEntry?.at && (
              <span className="text-xs font-mono text-[#8C867D]">
                {formatDateTime(lastEntry.at)}
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#141414] tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#524D46] leading-relaxed mt-2">
            {reason}
          </p>
          {isFailed && (
            <div className="mt-4 pt-3 border-t border-[#EAE4D9] flex items-center justify-between">
              <span className="text-xs text-[#7A756D]">
                Have questions regarding this inspection result?
              </span>
              <a
                href="#concierge"
                onClick={(e) => {
                  e.preventDefault();
                  toast('Our concierge team has been notified and will assist you shortly.', { icon: '💬' });
                }}
                className="text-xs font-semibold text-[#141414] hover:text-[#524D46] underline transition-colors cursor-pointer"
              >
                Contact Concierge
              </a>
            </div>
          )}
        </div>
      );
    }

    // Terminal branch: CANCELLED
    if (isCancelled) {
      const lastEntry = returnReq.statusHistory?.slice(-1)[0];

      return (
        <div className="bg-[#FAF7F2] text-[#141414] rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EAE4D9]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7A756D] bg-[#EFEAE2] border border-[#DDD6CA] px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-[#8C867D]" />
              Return Cancelled
            </span>
            {lastEntry?.at && (
              <span className="text-xs font-mono text-[#8C867D]">
                {formatDateTime(lastEntry.at)}
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#141414] tracking-tight">
            Return Cancelled
          </h3>
          <p className="text-xs sm:text-sm text-[#524D46] leading-relaxed mt-2">
            {returnReq.rejectionReason || 'Return request was cancelled by the customer.'}
          </p>
        </div>
      );
    }

    // Completed state: REFUNDED
    if (isRefunded) {
      const refundAmount = returnReq.refundAmount ?? order.total;

      return (
        <div className="bg-gradient-to-br from-[#064E3B] to-[#022C22] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] relative overflow-hidden border border-emerald-800">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Refund Completed
            </span>
            <span className="text-xs font-mono text-emerald-200">
              100% Completed
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
              Refund Completed
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
              Refund of {formatLKR(refundAmount)} has been credited to your Store Wallet.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-emerald-800/80 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/80 block">
                Refunded On
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block">
                {formatDateTime(returnReq.refundedAt ?? undefined)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/80 block">
                Refund Amount
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block">
                {formatLKR(refundAmount)}
              </span>
            </div>
          </div>

          <div className="mt-5" aria-label="Progress: 100%" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
            <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full w-full" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[11px] text-emerald-200">
            <span className="inline-flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              Credited to Store Wallet
            </span>
            <Link to="/wallet" className="text-emerald-300 hover:text-white underline font-semibold transition-colors">
              View Wallet
            </Link>
          </div>
        </div>
      );
    }

    // Active Return in Progress Mode
    const returnTimeline = deriveReturnTimeline(returnReq);
    const totalStages = RETURN_STAGES.length;
    const currentStepNum = returnTimeline.activeIndex + 1;
    const pickupData = returnReq.pickup;
    const courierName = pickupData?.courier?.trim() || 'Courier to be assigned';
    const waybill = pickupData?.waybill?.trim();
    const pickupAddress = pickupData?.address || `${order.shippingAddress.line1}, ${order.shippingAddress.city}`;

    const isPickupScheduled = returnReq.status === 'pickup_scheduled';
    const isPickedUpOrLater = ['picked_up', 'received', 'refund_processing'].includes(returnReq.status);

    let leftGridLabel = 'Pickup';
    let leftGridValue = 'Scheduling pickup';

    if (isPickupScheduled) {
      leftGridLabel = 'Pickup';
      leftGridValue = pickupData?.scheduledDate
        ? `${formatDateTime(pickupData.scheduledDate)}${pickupData.timeWindow ? ` (${pickupData.timeWindow})` : ''}`
        : 'Pickup scheduled';
    } else if (returnReq.status === 'picked_up') {
      leftGridLabel = 'Picked Up On';
      const pickedUpHist = returnReq.statusHistory?.find((h) => h.status === 'picked_up');
      leftGridValue = formatDateTime(pickedUpHist?.at);
    } else if (returnReq.status === 'received' || returnReq.status === 'refund_processing') {
      leftGridLabel = 'Refund Expected';
      leftGridValue =
        returnReq.status === 'received'
          ? 'Pending inspection approval'
          : 'Finance processing';
    }

    const rightGridLabel = isPickedUpOrLater ? 'Refund Amount' : 'Pickup Address';
    const rightGridValue = isPickedUpOrLater
      ? (returnReq.refundAmount != null ? formatLKR(returnReq.refundAmount) : 'Pending')
      : pickupAddress;

    return (
      <div className="bg-gradient-to-br from-[#1C1B19] to-[#2C2925] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] relative overflow-hidden">
        {/* Soft amber glow background */}
        <div
          className="absolute -right-10 -bottom-10 w-44 h-44 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-400 bg-amber-950/70 border border-amber-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 motion-safe:animate-ping" aria-hidden="true" />
            Return in Progress
          </span>
          <span className="text-xs font-mono text-neutral-300">
            {returnTimeline.percent}% Completed ({currentStepNum}/{totalStages})
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
            {returnTimeline.currentTitle}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            {returnTimeline.currentDescription}
          </p>
        </div>

        {/* 2-col Return Details grid */}
        <div className="mt-6 pt-5 border-t border-neutral-700/60 grid grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
              {leftGridLabel}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block truncate" title={leftGridValue}>
              {leftGridValue}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
              {rightGridLabel}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block truncate" title={rightGridValue}>
              {rightGridValue}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5" aria-label={`Return Progress: ${returnTimeline.percent}%`} role="progressbar" aria-valuenow={returnTimeline.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${returnTimeline.percent}%` }}
            />
          </div>
        </div>

        {/* Courier & Waybill footer row */}
        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            {courierName}
          </span>
          {waybill && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-neutral-300">
                Waybill #{waybill}
              </span>
              {onCopyTracking && (
                <button
                  type="button"
                  onClick={() => onCopyTracking(waybill)}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy Waybill"
                >
                  {copiedTracking ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── No Return: Standard Fulfillment Milestone Card ──────────────────────────
  const isTerminal = timeline.isTerminal;

  if (isTerminal) {
    return (
      <div className="bg-gradient-to-br from-[#27272A] to-[#3F3F46] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] border border-neutral-700">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-300 bg-rose-950/70 border border-rose-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            Terminal State
          </span>
          <span className="text-xs font-mono text-neutral-300">
            {formatDateTime(timeline.terminalAt)}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
          {timeline.currentTitle}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mt-1">
          {timeline.terminalNote}
        </p>
      </div>
    );
  }

  const destinationSummary = `${order.shippingAddress.line1}, ${order.shippingAddress.city}`;
  const totalStages = TIMELINE_STAGES.length;
  const currentStepNum = timeline.activeIndex + 1;
  const hasCourierDetails = Boolean(order.delivery?.courier || order.delivery?.waybill);

  return (
    <div className="bg-gradient-to-br from-[#1C1B19] to-[#2C2925] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] relative overflow-hidden">
      {/* Soft emerald glow background */}
      <div
        className="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 motion-safe:animate-ping" aria-hidden="true" />
          Active Milestone
        </span>
        <span className="text-xs font-mono text-neutral-300">
          {timeline.percent}% Completed ({currentStepNum}/{totalStages})
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
          {timeline.currentTitle}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
          {timeline.currentDescription}
        </p>
      </div>

      {/* 2-col Estimated Arrival / Destination grid */}
      <div className="mt-6 pt-5 border-t border-neutral-700/60 grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
            Estimated Arrival
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block">
            {formatDateRange(order.delivery?.estimatedFrom, order.delivery?.estimatedTo)}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
            Destination
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block truncate" title={destinationSummary}>
            {destinationSummary}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-5" aria-label={`Progress: ${timeline.percent}%`} role="progressbar" aria-valuenow={timeline.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${timeline.percent}%` }}
          />
        </div>
      </div>

      {/* Courier & Waybill footer row */}
      {hasCourierDetails && (
        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            {order.delivery?.courier || 'Designated Courier'}
          </span>
          {order.delivery?.waybill && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-neutral-300">
                Waybill #{order.delivery.waybill}
              </span>
              {onCopyTracking && (
                <button
                  type="button"
                  onClick={() => onCopyTracking(order.delivery!.waybill!)}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy Waybill / Tracking number"
                >
                  {copiedTracking ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
