import { ReturnStageConfig } from './orderDetail.types';

export const RETURN_STAGES: readonly ReturnStageConfig[] = [
  {
    key: 'REQUESTED',
    backendStatus: 'requested',
    title: 'Return Requested',
    description: 'Return request submitted with reason.',
    locationChip: 'Customer Portal',
  },
  {
    key: 'UNDER_REVIEW',
    backendStatus: 'under_review',
    title: 'Under Review',
    description: 'Staff is reviewing your return request.',
    locationChip: 'Resolution Desk',
  },
  {
    key: 'APPROVED',
    backendStatus: 'approved',
    title: 'Return Approved',
    description: 'Return approved. Pickup is being scheduled.',
    locationChip: 'Logistics Queue',
  },
  {
    key: 'PICKUP_SCHEDULED',
    backendStatus: 'pickup_scheduled',
    title: 'Pickup Scheduled',
    description: 'Courier assigned for pickup on the scheduled date.',
    locationChip: 'Courier Dispatch',
  },
  {
    key: 'PICKED_UP',
    backendStatus: 'picked_up',
    title: 'Picked Up',
    description: 'Courier collected the item from your address.',
    locationChip: 'Transit to Hub',
  },
  {
    key: 'RECEIVED_INSPECTING',
    backendStatus: 'received',
    title: 'Received & Inspecting',
    description: 'Item arrived at the warehouse and is being inspected.',
    locationChip: 'Depot Inspection Bay',
  },
  {
    key: 'REFUND_PROCESSING',
    backendStatus: 'refund_processing',
    title: 'Refund Processing',
    description: 'Inspection passed. Refund is being processed.',
    locationChip: 'Finance Operations',
  },
  {
    key: 'REFUNDED',
    backendStatus: 'refunded',
    title: 'Refunded',
    description: 'Refund credited to your destination.',
    locationChip: 'Store Wallet Ledger',
  },
] as const;

export const RETURN_STAGE_INDEX_MAP: Record<string, number> = {
  requested: 0,
  under_review: 1,
  approved: 2,
  pickup_scheduled: 3,
  picked_up: 4,
  received: 5,
  refund_processing: 6,
  refunded: 7,
};

export const TERMINAL_RETURN_STATUSES = new Set<string>([
  'rejected',
  'inspection_failed',
  'cancelled',
]);
