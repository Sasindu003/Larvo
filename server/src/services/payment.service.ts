import { Types } from 'mongoose';
import { Payment, IPayment } from '../models/Payment';
import { IOrder } from '../models/Order';
import { IUser } from '../models/User';
import { orderService } from './order.service';
import { AppError } from '../middleware/error.middleware';

export const paymentService = {
  /**
   * Review a submitted manual bank transfer payment slip.
   * Only staff/admin/owner can call this.
   * Enforces that simulated_online and reward_points payments are already auto-resolved (400 already_resolved).
   * Enforces that already reviewed payments cannot be re-reviewed (409).
   * Delegates to orderService.transitionStatus to enforce P46 transition rules and maintain atomic consistency.
   */
  async reviewPayment(
    staffUser: IUser,
    paymentId: string,
    decision: 'approved' | 'rejected',
    note?: string | null
  ): Promise<{ payment: IPayment; order: IOrder }> {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new AppError('Invalid payment ID', 400);
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // simulated_online and reward_points are auto-resolved at creation
    if (payment.method !== 'bank_transfer') {
      throw new AppError('Payment is already automatically resolved', 400, {
        code: 'already_resolved',
      });
    }

    // Must be in submitted status
    if (payment.status !== 'submitted') {
      throw new AppError(`Payment has already been ${payment.status}`, 409);
    }

    const targetOrderStatus = decision === 'approved' ? 'confirmed' : 'pending_payment';
    const trimmedNote = note ? note.trim() : null;

    // Transition order status and update payment atomically
    const updatedOrder = await orderService.transitionStatus(
      staffUser,
      payment.order.toString(),
      targetOrderStatus,
      { reviewNote: trimmedNote }
    );

    const updatedPayment = await Payment.findById(paymentId);
    if (!updatedPayment) {
      throw new AppError('Payment not found after update', 404);
    }

    return {
      payment: updatedPayment,
      order: updatedOrder,
    };
  },
};
