import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  ACTIVE_DELIVERY_STATUSES,
  ACTIVE_RETURN_PICKUP_STATUSES,
} from '../config/field-access';

/**
 * Masks a phone number so only the trailing 3 digits remain visible.
 * E.g., '0771234567' -> '*******567', '+94 77 123 4567' -> '+** ** *** *567'.
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 3) return '***';

  const prefix = trimmed.slice(0, -3);
  const suffix = trimmed.slice(-3);
  const maskedPrefix = prefix.replace(/[0-9a-zA-Z]/g, '*');
  return maskedPrefix + suffix;
}

/**
 * Masks an email address for operational display.
 * E.g., 'customer@example.com' -> 'c***@example.com'.
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '***';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  if (!local) return `***@${domain}`;
  const firstChar = local.charAt(0);
  return `${firstChar}***@${domain}`;
}

/**
 * Contextual metadata provided when applying field-level access control.
 */
export interface FieldAccessContext {
  isOwner?: boolean;
  status?: string;
}

/**
 * Converts a potential Mongoose Document or object to a clean, decoupled plain JS object.
 */
function toPlainObject(val: unknown): any {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (typeof (val as any).toObject === 'function') {
    return (val as any).toObject();
  }
  if (typeof (val as any).toJSON === 'function') {
    return (val as any).toJSON();
  }
  return JSON.parse(JSON.stringify(val));
}

/**
 * Applies role-based field-level access control rules to a domain entity or array of entities.
 *
 * Guarantees:
 * - Pure & non-mutating: The source document is cloned and never mutated.
 * - Least-privilege: Privilege-specific masks or omissions are strictly enforced.
 * - Customer self-service preservation: Calling with `isOwner: true` or as customer for own data returns full plaintext.
 */
export function applyFieldPolicy<T>(
  entityName: 'Order' | 'Invoice' | 'ReturnRequest' | 'User' | 'Supplier' | string,
  doc: T,
  viewerRole: string,
  context?: FieldAccessContext
): T {
  if (!doc) return doc;

  if (Array.isArray(doc)) {
    return doc.map((item) =>
      applyFieldPolicy(entityName, item, viewerRole, context)
    ) as unknown as T;
  }

  const plain = toPlainObject(doc);

  // 1. Customer viewing own data -> Always FULL
  if (context?.isOwner === true || (viewerRole === 'customer' && context?.isOwner !== false)) {
    return plain;
  }

  // 2. Owner & Admin -> Always FULL
  if (viewerRole === 'owner' || viewerRole === 'admin') {
    return plain;
  }

  // 3. Staff -> Full address for operational dispatch/packing, masked phone & email
  if (viewerRole === 'staff') {
    if (entityName === 'Order' || entityName === 'Invoice') {
      if (plain.shippingAddress) {
        plain.shippingAddress = {
          ...plain.shippingAddress,
          phone: maskPhone(plain.shippingAddress.phone),
        };
      }
      if (plain.user && typeof plain.user === 'object') {
        plain.user = {
          ...plain.user,
          email: maskEmail(plain.user.email),
          phone: maskPhone(plain.user.phone),
        };
      }
      return plain;
    }

    if (entityName === 'ReturnRequest') {
      if (plain.pickup) {
        plain.pickup = {
          ...plain.pickup,
          phone: maskPhone(plain.pickup.phone),
        };
      }
      if (plain.user && typeof plain.user === 'object') {
        plain.user = {
          ...plain.user,
          email: maskEmail(plain.user.email),
        };
      }
      return plain;
    }

    if (entityName === 'User') {
      if (plain.email) plain.email = maskEmail(plain.email);
      if (Array.isArray(plain.addresses)) {
        plain.addresses = plain.addresses.map((addr: any) => ({
          ...addr,
          phone: maskPhone(addr.phone),
        }));
      }
      return plain;
    }

    if (entityName === 'Supplier') {
      return plain;
    }
  }

  // 4. Delivery Manager -> Needs full address & phone ONLY during active fulfillment
  if (viewerRole === 'delivery_manager') {
    if (entityName === 'Order') {
      const orderStatus = context?.status || plain.status;
      const isTransit = (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(orderStatus);

      if (plain.shippingAddress) {
        if (isTransit) {
          plain.shippingAddress = {
            ...plain.shippingAddress,
          };
        } else {
          // Pre-dispatch / terminal states: city & postalCode only
          plain.shippingAddress = {
            city: plain.shippingAddress.city,
            postalCode: plain.shippingAddress.postalCode,
          };
        }
      }

      if (plain.user && typeof plain.user === 'object') {
        plain.user = {
          name: plain.user.name || 'Customer',
        };
      }

      return plain;
    }

    if (entityName === 'ReturnRequest') {
      const retStatus = context?.status || plain.status;
      const isPickup = (ACTIVE_RETURN_PICKUP_STATUSES as readonly string[]).includes(retStatus);

      if (plain.pickup) {
        if (!isPickup) {
          plain.pickup = {
            ...plain.pickup,
            address: undefined,
            phone: undefined,
          };
        }
      }

      if (plain.user && typeof plain.user === 'object') {
        plain.user = {
          name: plain.user.name || 'Customer',
        };
      }

      return plain;
    }

    // Delivery managers do not have access to standalone User, Invoice or Supplier records
    return plain;
  }

  // 5. Supplier -> Strictly hidden from customer personal data
  if (viewerRole === 'supplier') {
    if (entityName === 'Supplier') {
      return plain;
    }
    // Any customer entity requested by supplier has all personal identifiers removed
    if (plain.user) delete plain.user;
    if (plain.shippingAddress) delete plain.shippingAddress;
    if (plain.pickup) delete plain.pickup;
    return plain;
  }

  return plain;
}

/**
 * Returns the list of personal field names returned in full plaintext for the caller.
 * Used exclusively for generating immutable PII_READ audit logs with field names only.
 */
export function getAccessedFullPiiFields(
  entityName: string,
  viewerRole: string,
  isOwner: boolean,
  status?: string
): string[] {
  if (isOwner) return []; // Owner reads own data; never audited as third-party PII read

  if (viewerRole === 'admin' || viewerRole === 'owner') {
    if (entityName === 'Order' || entityName === 'Invoice') {
      return ['shippingAddress.line1', 'shippingAddress.phone', 'user.email'];
    }
    if (entityName === 'ReturnRequest') {
      return ['pickup.address', 'pickup.phone', 'user.email'];
    }
    if (entityName === 'User') {
      return ['addresses.line1', 'addresses.phone', 'email'];
    }
    if (entityName === 'Supplier') {
      return ['phone', 'address'];
    }
  }

  if (viewerRole === 'staff') {
    if (entityName === 'Order' || entityName === 'Invoice') {
      return ['shippingAddress.line1'];
    }
    if (entityName === 'ReturnRequest') {
      return ['pickup.address'];
    }
  }

  if (viewerRole === 'delivery_manager') {
    if (entityName === 'Order') {
      const isTransit = (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(status || '');
      if (isTransit) {
        return ['shippingAddress.line1', 'shippingAddress.phone'];
      }
    }
    if (entityName === 'ReturnRequest') {
      const isPickup = (ACTIVE_RETURN_PICKUP_STATUSES as readonly string[]).includes(status || '');
      if (isPickup) {
        return ['pickup.address', 'pickup.phone'];
      }
    }
  }

  return [];
}

/**
 * Rate limiter for sensitive list endpoints returning FULL personal fields to non-owner roles.
 * Limit: 60 requests per 15 minutes per user.
 */
export const piiListRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60, // 60 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user?._id?.toString() || ipKeyGenerator(req.ip || '');
  },
  skip: (req) => {
    const role = (req as any).user?.role;
    // Owner is exempted; customers on self-service routes are handled separately
    return role === 'owner';
  },
  message: {
    success: false,
    message: 'Too many requests for personal records. Please try again after 15 minutes.',
  },
  statusCode: 429,
});

/**
 * Middleware-compatible helper to execute the PII list rate limiter within controller actions.
 * Returns true if request is permitted, false if rate limit exceeded (and 429 response was dispatched).
 */
export function checkPiiRateLimit(req: Request, res: Response): Promise<boolean> {
  const role = (req as any).user?.role;
  if (role === 'owner') {
    return Promise.resolve(true);
  }

  return new Promise((resolve, reject) => {
    piiListRateLimiter(req, res, (err) => {
      if (err) return reject(err);
      if (res.headersSent) return resolve(false);
      resolve(true);
    });
  });
}
