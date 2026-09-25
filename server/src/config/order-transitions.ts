import { OrderStatus } from '../models/Order';
import { UserRole } from '../models/User';
import { AppError } from '../middleware/error.middleware';

export interface TransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  roles: UserRole[];
  ownerOnly?: boolean;
}

/**
 * Single source of truth for Order status transitions.
 * Defines allowable status pairs and authorized roles for each transition.
 */
export const ORDER_TRANSITIONS: readonly TransitionRule[] = [
  // ── Payment Phase ──────────────────────────────────────────────────────────
  // Customer submits slip (or staff uploads on their behalf)
  {
    from: 'pending_payment',
    to: 'payment_review',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },
  // Online payment / wallet reward points payment confirmed
  {
    from: 'pending_payment',
    to: 'confirmed',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },
  // Staff / admin rejects submitted bank slip, bouncing order back to pending_payment
  {
    from: 'payment_review',
    to: 'pending_payment',
    roles: ['staff', 'admin', 'owner'],
  },
  // Staff / admin approves submitted bank slip
  {
    from: 'payment_review',
    to: 'confirmed',
    roles: ['staff', 'admin', 'owner'],
  },

  // ── Fulfillment Phase ──────────────────────────────────────────────────────
  // Staff starts order packing / processing
  {
    from: 'confirmed',
    to: 'processing',
    roles: ['staff', 'admin', 'owner'],
  },
  // Order packed and ready at facility for courier pickup
  {
    from: 'processing',
    to: 'ready_for_dispatch',
    roles: ['staff', 'admin', 'owner', 'delivery_manager'],
  },

  // ── Delivery Phase ─────────────────────────────────────────────────────────
  // Courier / delivery manager picks up package
  {
    from: 'ready_for_dispatch',
    to: 'picked_up',
    roles: ['delivery_manager', 'admin', 'owner'],
  },
  // In transit between facilities / hubs
  {
    from: 'picked_up',
    to: 'in_transit',
    roles: ['delivery_manager', 'admin', 'owner'],
  },
  // Loaded for final delivery route
  {
    from: 'in_transit',
    to: 'out_for_delivery',
    roles: ['delivery_manager', 'admin', 'owner'],
  },
  // Handed over to recipient (terminal success state)
  {
    from: 'out_for_delivery',
    to: 'delivered',
    roles: ['delivery_manager', 'admin', 'owner'],
  },

  // ── Cancellation Phase ─────────────────────────────────────────────────────
  // Customer self-cancel (unpaid order) or staff cancel
  {
    from: 'pending_payment',
    to: 'cancelled',
    roles: ['customer', 'staff', 'admin', 'owner'],
    ownerOnly: true,
  },
  // Staff cancel during slip review
  {
    from: 'payment_review',
    to: 'cancelled',
    roles: ['staff', 'admin', 'owner'],
  },
  // Staff cancel confirmed order before processing
  {
    from: 'confirmed',
    to: 'cancelled',
    roles: ['staff', 'admin', 'owner'],
  },
  // Staff cancel processing order
  {
    from: 'processing',
    to: 'cancelled',
    roles: ['staff', 'admin', 'owner'],
  },
] as const;

/**
 * Find matching transition rule for a status pair, regardless of role.
 */
export function getTransitionRule(
  from: OrderStatus,
  to: OrderStatus
): TransitionRule | undefined {
  return ORDER_TRANSITIONS.find((r) => r.from === from && r.to === to);
}

/**
 * Check whether a transition is permitted for a given role (and optional ownership).
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role?: UserRole,
  isOwner?: boolean
): boolean {
  const rule = getTransitionRule(from, to);
  if (!rule) return false;
  if (!role) return true;
  if (!rule.roles.includes(role)) return false;
  if (role === 'customer' && rule.ownerOnly && !isOwner) return false;
  return true;
}

/**
 * Assert that a transition is valid and authorized.
 * Throws AppError(400) on illegal status pair.
 * Throws AppError(403) on unauthorized role or non-owner customer.
 */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: UserRole,
  isOwner: boolean = false
): TransitionRule {
  const rule = getTransitionRule(from, to);
  if (!rule) {
    throw new AppError(`Cannot transition order status from '${from}' to '${to}'`, 400);
  }

  if (!rule.roles.includes(role)) {
    throw new AppError(
      `Role '${role}' is not authorized to transition order from '${from}' to '${to}'`,
      403
    );
  }

  if (role === 'customer' && rule.ownerOnly && !isOwner) {
    throw new AppError('You do not have access to this order', 403);
  }

  return rule;
}
