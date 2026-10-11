import {
  ReturnRequestDTO,
  DerivedReturnTimeline,
  DerivedReturnStage,
} from './orderDetail.types';
import {
  RETURN_STAGES,
  RETURN_STAGE_INDEX_MAP,
  TERMINAL_RETURN_STATUSES,
} from './returnTimeline.config';

export const formatDateTime = (isoString?: string): string => {
  if (!isoString) return 'Pending';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Pending';
    return new Intl.DateTimeFormat('en-LK', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return 'Pending';
  }
};

export const formatLKR = (amount: number): string => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace('LKR', 'Rs.')
    .trim();
};

/**
 * Pure function deriving timeline steps, active index, progress percentage,
 * and terminal state for an order return request.
 */
export function deriveReturnTimeline(returnRequest: ReturnRequestDTO): DerivedReturnTimeline {
  const isTerminal = TERMINAL_RETURN_STATUSES.has(returnRequest.status);
  const historyMap = new Map<string, { status: string; at: string; note?: string }>();

  (returnRequest.statusHistory || []).forEach((item) => {
    historyMap.set(item.status, item);
  });

  if (isTerminal) {
    const terminalEntry = [...(returnRequest.statusHistory || [])]
      .reverse()
      .find((h) => h.status === returnRequest.status);

    let terminalKey: 'REJECTED' | 'INSPECTION_FAILED' | 'CANCELLED' = 'REJECTED';
    let terminalTitle = 'Return Not Approved';
    let defaultReason = 'Staff reviewed and rejected this return request.';

    if (returnRequest.status === 'inspection_failed') {
      terminalKey = 'INSPECTION_FAILED';
      terminalTitle = 'Return Inspection Failed';
      defaultReason = 'The returned item did not pass quality inspection at the warehouse depot.';
    } else if (returnRequest.status === 'cancelled') {
      terminalKey = 'CANCELLED';
      terminalTitle = 'Return Cancelled';
      defaultReason = 'Return request was cancelled by the customer prior to pickup.';
    }

    const terminalReason =
      returnRequest.rejectionReason ||
      terminalEntry?.note ||
      defaultReason;

    // Find the highest stage index completed prior to terminal event
    let maxCompletedIdx = 0;
    (returnRequest.statusHistory || []).forEach((h) => {
      const idx = RETURN_STAGE_INDEX_MAP[h.status];
      if (idx !== undefined && idx > maxCompletedIdx) {
        maxCompletedIdx = idx;
      }
    });

    if (returnRequest.status === 'inspection_failed' && maxCompletedIdx < 5) {
      maxCompletedIdx = 5; // Received & Inspecting
    }

    const stages: DerivedReturnStage[] = RETURN_STAGES.slice(0, maxCompletedIdx + 1).map(
      (stageDef, idx) => {
        const historyEntry = historyMap.get(stageDef.backendStatus);
        return {
          id: idx + 1,
          key: stageDef.key,
          title: stageDef.title,
          description: historyEntry?.note || stageDef.description,
          timestamp: historyEntry?.at ? formatDateTime(historyEntry.at) : 'Completed',
          isCompleted: true,
          isActive: false,
          isPending: false,
          locationChip: stageDef.locationChip,
        };
      }
    );

    const percent = Math.min(100, Math.round(((maxCompletedIdx + 1) / RETURN_STAGES.length) * 100));

    return {
      stages,
      activeIndex: maxCompletedIdx,
      percent,
      terminal: {
        key: terminalKey,
        title: terminalTitle,
        reason: terminalReason,
        at: terminalEntry?.at,
      },
      isTerminal: true,
      terminalKey,
      terminalTitle,
      terminalReason,
      terminalAt: terminalEntry?.at,
      currentTitle: terminalTitle,
      currentDescription: terminalReason,
    };
  }

  const activeIndex = RETURN_STAGE_INDEX_MAP[returnRequest.status] ?? 0;

  const stages: DerivedReturnStage[] = RETURN_STAGES.map((stageDef, idx) => {
    const isCompleted = idx < activeIndex;
    const isActive = idx === activeIndex;
    const isPending = idx > activeIndex;

    const historyEntry = historyMap.get(stageDef.backendStatus);

    return {
      id: idx + 1,
      key: stageDef.key,
      title: stageDef.title,
      description: historyEntry?.note || stageDef.description,
      timestamp: historyEntry?.at ? formatDateTime(historyEntry.at) : 'Pending',
      isCompleted,
      isActive,
      isPending,
      locationChip: stageDef.locationChip,
    };
  });

  const percent =
    returnRequest.status === 'refunded'
      ? 100
      : Math.min(100, Math.round(((activeIndex + 1) / RETURN_STAGES.length) * 100));

  const activeStage = stages[activeIndex] || stages[0];

  return {
    stages,
    activeIndex,
    percent,
    terminal: null,
    isTerminal: false,
    currentTitle: activeStage.title,
    currentDescription: activeStage.description,
  };
}
