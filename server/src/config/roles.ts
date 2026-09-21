import type { UserRole } from '../models/User';

/**
 * Single source of truth for role groupings.
 * Reference these constants in every requireRole() call from P24 onward.
 *
 * delivery_manager is NOT included in ADMIN or STAFF groups by default —
 * it must be added explicitly per route when delivery access is required.
 */
export const ROLES = {
  /** All roles — any authenticated user. */
  ANY: ['customer', 'staff', 'admin', 'owner', 'delivery_manager'] as UserRole[],

  /** Staff and above (excludes customer and delivery_manager). */
  STAFF_AND_ABOVE: ['staff', 'admin', 'owner'] as UserRole[],

  /** Admin and above only. */
  ADMIN_AND_ABOVE: ['admin', 'owner'] as UserRole[],

  /** Owner only. */
  OWNER_ONLY: ['owner'] as UserRole[],

  /** Delivery operations — delivery_manager and above. */
  DELIVERY: ['delivery_manager', 'admin', 'owner'] as UserRole[],
} as const;
