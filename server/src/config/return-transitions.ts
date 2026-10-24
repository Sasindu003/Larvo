import { ReturnStatus } from '../models/ReturnRequest';
import { UserRole } from '../models/User';
import { AppError } from '../utils/AppError';

export interface ReturnTransitionRule {
  from: ReturnStatus;
  to: ReturnStatus;
  roles: UserRole[];
  ownerOnly?: boolean;
}

/**
 * Single source of truth for ReturnRequest status transitions.
 * Defines allowable status pairs and authorized roles for each transition.
 */
export const RETURN_TRANSITIONS: readonly ReturnTransitionRule[] = [
  // ── Initial & Review Phase ──────────────────────────────────────────────────
  // Staff / admin starts review
  {
    from: 'requested',
    to: 'under_review',
    roles: ['staff', 'admin', 'owner'],
  },
  // Staff / admin approves request
  {
    from: 'requested',
    to: 'approved',
    roles: ['staff', 'admin', 'owner'],
  },
  // Direct approval to pickup_scheduled (for systems combining approval + dispatch scheduling)
  {
    from: 'requested',
    to: 'pickup_scheduled',
    roles: ['staff', 'admin', 'owner'],
  },
  // Staff / admin rejects request with reason
  {
    from: 'requested',
    to: 'rejected',
    roles: ['staff', 'admin', 'owner'],
  },
  // Customer cancels return before review/pickup
  {
    from: 'requested',
    to: 'cancelled',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },

  // ── Under Review Phase ──────────────────────────────────────────────────────
  {
    from: 'under_review',
    to: 'approved',
    roles: ['staff', 'admin', 'owner'],
  },
  {
    from: 'under_review',
    to: 'pickup_scheduled',
    roles: ['staff', 'admin', 'owner'],
  },
  {
    from: 'under_review',
    to: 'rejected',
    roles: ['staff', 'admin', 'owner'],
  },
  {
    from: 'under_review',
    to: 'cancelled',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },

  // ── Approved & Pickup Phase ─────────────────────────────────────────────────
  // Logistics or staff schedules courier pickup
  {
    from: 'approved',
    to: 'pickup_scheduled',
    roles: ['staff', 'admin', 'owner', 'delivery_manager'],
  },
  // Direct pickup if courier collects upon approval
  {
    from: 'approved',
    to: 'picked_up',
    roles: ['delivery_manager', 'staff', 'admin', 'owner'],
  },
  // Customer cancels before courier arrives
  {
    from: 'approved',
    to: 'cancelled',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },
  // Courier collects parcel
  {
    from: 'pickup_scheduled',
    to: 'picked_up',
    roles: ['delivery_manager', 'staff', 'admin', 'owner'],
  },
  // Customer cancels scheduled pickup
  {
    from: 'pickup_scheduled',
    to: 'cancelled',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },

  // ── Receiving & Inspection Phase ────────────────────────────────────────────
  // Parcel arrives at warehouse depot for inspection
  {
    from: 'picked_up',
    to: 'received',
    roles: ['delivery_manager', 'staff', 'admin', 'owner'],
  },

  // ── Refund Processing Phase ─────────────────────────────────────────────────
  // Inspection passed; refund is in finance processing
  {
    from: 'received',
    to: 'refund_processing',
    roles: ['staff', 'admin', 'owner'],
  },
  // Inspection failed at warehouse
  {
    from: 'received',
    to: 'inspection_failed',
    roles: ['staff', 'admin', 'owner'],
  },
  // Admin/owner credits wallet refund directly
  {
    from: 'received',
    to: 'refunded',
    roles: ['admin', 'owner'],
  },
  // Transition from refund_processing to refunded
  {
    from: 'refund_processing',
    to: 'refunded',
    roles: ['admin', 'owner'],
  },
  // If issue found during refund processing
  {
    from: 'refund_processing',
    to: 'inspection_failed',
    roles: ['staff', 'admin', 'owner'],
  },
] as const;

/**
 * Find matching transition rule for a return status pair, regardless of role.
 */
export function getReturnTransitionRule(
  from: ReturnStatus,
  to: ReturnStatus
): ReturnTransitionRule | undefined {
  return RETURN_TRANSITIONS.find((r) => r.from === from && r.to === to);
}

/**
 * Check whether a return transition is permitted for a given role (and optional ownership).
 */
export function canReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus,
  role?: UserRole,
  isOwner?: boolean
): boolean {
  if (role === 'customer' && !isOwner) return false;
  const rule = getReturnTransitionRule(from, to);
  if (!rule) return false;
  if (!role) return true;
  if (!rule.roles.includes(role)) return false;
  return true;
}

/**
 * Assert that a return transition is valid and authorized.
 * Throws AppError(400) on illegal status pair.
 * Throws AppError(403) on unauthorized role or non-owner customer.
 */
export function assertReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus,
  role: UserRole,
  isOwner: boolean = false
): ReturnTransitionRule {
  if (role === 'customer' && !isOwner) {
    throw new AppError('You do not have access to this return request', 403);
  }

  const rule = getReturnTransitionRule(from, to);
  if (!rule) {
    throw new AppError(`Cannot transition return status from '${from}' to '${to}'`, 400);
  }

  if (!rule.roles.includes(role)) {
    throw new AppError(
      `Role '${role}' is not authorized to transition return from '${from}' to '${to}'`,
      403
    );
  }

  return rule;
}
