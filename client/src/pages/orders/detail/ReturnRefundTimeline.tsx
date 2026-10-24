import React from 'react';
import { Check, AlertCircle, XCircle, Ban, HelpCircle, MessageCircle } from 'lucide-react';
import { ReturnRequestDTO } from './orderDetail.types';
import { deriveReturnTimeline, formatDateTime } from './deriveReturnTimeline';
import { ReturnPickupInfo } from './ReturnPickupInfo';
import { RefundSummary } from './RefundSummary';

interface ReturnRefundTimelineProps {
  returnRequest: ReturnRequestDTO;
  onContactConcierge?: () => void;
}

export const ReturnRefundTimeline: React.FC<ReturnRefundTimelineProps> = ({
  returnRequest,
  onContactConcierge,
}) => {
  const timeline = deriveReturnTimeline(returnRequest);
  const stages = timeline.stages;

  const isTerminal = Boolean(timeline.terminal);
  const isRejected = timeline.terminal?.key === 'REJECTED';
  const isFailed = timeline.terminal?.key === 'INSPECTION_FAILED';
  const isCancelled = timeline.terminal?.key === 'CANCELLED';

  let TerminalIcon = AlertCircle;
  let badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  let cardBg = 'bg-neutral-50 border-neutral-200';

  if (isFailed) {
    TerminalIcon = XCircle;
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (isCancelled) {
    TerminalIcon = Ban;
    badgeColor = 'bg-stone-100 text-stone-700 border-stone-200';
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="space-y-1 pb-4 border-b border-[#F0EBE2]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C867D]">
            RETURN & REFUND TIMELINE
          </h2>
          {isTerminal && timeline.terminal ? (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}
            >
              <TerminalIcon className="w-3 h-3" />
              {timeline.terminal.title}
            </span>
          ) : (
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
              {timeline.percent}%
            </span>
          )}
        </div>
        <p className="text-xs text-[#7A756D]">
          Pickup and refund status
        </p>
      </div>

      {stages.length > 0 && (
        <ol
          className="relative space-y-6 pt-1"
          aria-label="Return and refund timeline"
        >
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1 && !isTerminal;
            const isDone = stage.isCompleted;
            const isActive = stage.isActive;
            const connectorColor = isDone ? 'bg-[#059669]' : 'bg-[#EAE4D9]';

            return (
              <li
                key={stage.id}
                className="relative flex items-start gap-4"
                aria-current={isActive ? 'step' : undefined}
              >
                {!isLast && (
                  <div
                    className={`absolute top-6 bottom-[-24px] left-[17px] w-[2px] z-0 transition-colors duration-300 ${connectorColor}`}
                    aria-hidden="true"
                  />
                )}

                <div className="relative z-10 shrink-0">
                  {isDone ? (
                    <div
                      className="w-9 h-9 rounded-full bg-[#059669] text-white flex items-center justify-center shadow-xs"
                      aria-label={`Completed: Step ${stage.id}, ${stage.title}`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  ) : isActive ? (
                    <div
                      className="w-9 h-9 rounded-full bg-[#141414] text-white flex items-center justify-center ring-4 ring-emerald-200/80 shadow-md scale-105"
                      aria-label={`Current Step: ${stage.id}, ${stage.title}`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-[#34D399] motion-safe:animate-pulse"
                        aria-hidden="true"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full bg-[#FAF7F2] text-[#8C867D] border border-[#DDD6CA] flex items-center justify-center font-mono text-[11px] font-semibold"
                      aria-label={`Pending Step: ${stage.id}, ${stage.title}`}
                    >
                      {stage.id}
                    </div>
                  )}
                </div>

                <div className="flex-1 pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-bold ${
                          isActive
                            ? 'text-[#059669] text-base font-serif'
                            : isDone
                            ? 'text-[#141414]'
                            : 'text-[#8C867D]'
                        }`}
                      >
                        {stage.title}
                      </h3>
                      {isActive && (
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-[#ECFDF5] text-[#059669] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                          Current
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-mono ${
                        isActive ? 'text-[#059669] font-semibold' : 'text-[#8C867D]'
                      }`}
                    >
                      {stage.timestamp}
                    </span>
                  </div>

                  <p
                    className={`text-xs ${
                      isActive ? 'text-[#3D3A35] font-medium' : 'text-[#7A756D]'
                    } mt-1 leading-relaxed`}
                  >
                    {stage.description}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center text-[10px] font-medium text-[#6B655D] bg-[#FAF7F2] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A39D93] mr-1.5" aria-hidden="true" />
                      {stage.locationChip}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Terminal Card replacing remaining steps */}
      {isTerminal && timeline.terminal && (
        <div className={`p-4 sm:p-5 rounded-2xl border ${cardBg} space-y-3`}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-[#DDD6CA] text-[#141414] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <TerminalIcon className="w-4 h-4 text-[#7A756D]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#141414] font-serif">
                {timeline.terminal.title}
              </h3>
              <p className="text-xs text-[#524D46] leading-relaxed">
                {timeline.terminal.reason}
              </p>
              {timeline.terminal.at && (
                <p className="text-[11px] font-mono text-[#8C867D] pt-1">
                  Recorded at: {formatDateTime(timeline.terminal.at)}
                </p>
              )}
            </div>
          </div>

          {isFailed && (
            <div className="pt-3 border-t border-[#EAE4D9] flex items-center justify-between">
              <span className="text-[11px] text-[#7A756D]">
                Need help or clarification regarding this inspection?
              </span>
              <button
                type="button"
                onClick={onContactConcierge}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#2B2927] text-white transition-colors cursor-pointer shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Contact Concierge</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Embedded Pickup Details from PICKUP_SCHEDULED onward */}
      <ReturnPickupInfo
        pickup={returnRequest.pickup}
        status={returnRequest.status}
      />

      {/* Embedded Refund Summary Block (never shown on terminal states: no refund step) */}
      {!isTerminal && (
        <RefundSummary
          refundAmount={returnRequest.refundAmount}
          status={returnRequest.status}
          refundedAt={returnRequest.refundedAt}
        />
      )}
    </div>
  );
};

export default ReturnRefundTimeline;
