import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DerivedTimeline } from '../../../types/order';
import { formatDateTime } from '../../../utils/format';

export const FulfillmentTimeline: React.FC<{ timeline: DerivedTimeline; hasReturn?: boolean }> = ({
  timeline,
  hasReturn = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (timeline.isTerminal) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C867D]">
          FULFILLMENT & DELIVERY TIMELINE
        </h2>
        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 leading-relaxed">
          <p className="font-bold text-neutral-800">
            Order Status: {timeline.currentTitle}
          </p>
          <p className="mt-1">
            Fulfillment timeline is inactive because this order reached a terminal state.
          </p>
          {timeline.lastUpdatedAt && (
            <p className="mt-2 font-mono text-[11px] text-neutral-400">
              Recorded at: {formatDateTime(timeline.lastUpdatedAt)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const allStages = timeline.stages;
  const stages = hasReturn && !isExpanded ? allStages.slice(-3) : allStages;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="space-y-1 pb-4 border-b border-[#F0EBE2]">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C867D]">
          FULFILLMENT & DELIVERY TIMELINE
        </h2>
        <p className="text-xs text-[#7A756D]">
          Live status recorded by LARVO Express Logistics
        </p>
      </div>

      <ol
        className="relative space-y-6 pt-1"
        aria-label="Fulfillment and delivery timeline"
      >
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
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
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
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
                    <svg className="w-3 h-3 mr-1 text-[#8C867D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {stage.location}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {hasReturn && allStages.length > 3 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="w-full mt-4 py-2.5 px-3.5 text-xs font-semibold text-[#524D46] hover:text-[#141414] bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE4D9] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span>{isExpanded ? 'Collapse timeline' : `Show full timeline (${allStages.length} steps)`}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      )}
    </div>
  );
};
