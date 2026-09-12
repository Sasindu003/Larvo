import { Types } from 'mongoose';
import User, { IUser, UserRole } from '../models/User';
import { AppError } from '../middleware/error.middleware';
import {
  CreateStaffInput,
  UpdateStaffInput,
  ListStaffQuery,
} from '../validators/staff.validator';

export interface PaginatedResult<T> {
  results: T[];
  total: number;
  page: number;
  pages: number;
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class StaffService {
  /**
   * List staff members (all non-customer accounts)
   */
  async listStaff(query: ListStaffQuery): Promise<PaginatedResult<IUser>> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const filter: Record<string, any> = {
      role: query.role ? query.role : { $ne: 'customer' },
    };

    if (query.search && query.search.trim()) {
      const sanitized = escapeRegex(query.search.trim());
      filter.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { email: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const results = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      results,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Create a new staff account directly (never 'owner')
   */
  async createStaff(
    input: CreateStaffInput,
    callerRole: UserRole
  ): Promise<IUser> {
    if (input.role === 'admin' && callerRole !== 'owner') {
      throw new AppError('Only owners can grant the admin role', 403);
    }

    const email = input.email.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    const user = await User.create({
      name: input.name.trim(),
      email,
      passwordHash: input.password,
      role: input.role,
      active: true,
      authProvider: 'local',
    });

    const userDoc = user.toJSON();
    return userDoc as unknown as IUser;
  }

  /**
   * Update a staff account (name, active, role)
   * Enforces asymmetric RBAC rules and self-modification protection
   */
  async updateStaff(
    callerId: string | Types.ObjectId,
    callerRole: UserRole,
    targetId: string,
    input: UpdateStaffInput
  ): Promise<IUser> {
    // 1. Self-modification Protection
    if (callerId.toString() === targetId.toString()) {
      throw new AppError('Cannot modify your own account via staff management', 400);
    }

    // 2. Target existence check
    const target = await User.findById(targetId);
    if (!target || target.role === 'customer') {
      throw new AppError('Staff member not found', 404);
    }

    // 3. Asymmetric Role Rules
    if (callerRole === 'admin') {
      // Admins cannot modify admin or owner accounts
      if (target.role === 'admin' || target.role === 'owner') {
        throw new AppError('Admins cannot modify admin or owner accounts', 403);
      }

      // Admins cannot promote or grant admin or owner role
      if (input.role && (input.role === 'admin' || input.role === 'owner')) {
        throw new AppError('Admins cannot grant admin or owner roles', 403);
      }
    }

    // 4. Last Active Owner Protection (for owner caller modifying an owner)
    if (target.role === 'owner') {
      const isDeactivating = input.active === false;
      const isDemoting = input.role !== undefined && input.role !== 'owner';

      if (isDeactivating || isDemoting) {
        const activeOwnerCount = await User.countDocuments({
          role: 'owner',
          active: true,
        });

        if (activeOwnerCount <= 1) {
          throw new AppError('Cannot deactivate or demote the last active owner', 400);
        }
      }
    }

    // 5. Apply valid updates
    if (input.name !== undefined) {
      target.name = input.name.trim();
    }
    if (input.active !== undefined) {
      target.active = input.active;
    }
    if (input.role !== undefined) {
      target.role = input.role;
    }

    await target.save();
    return target;
  }
}

export const staffService = new StaffService();
