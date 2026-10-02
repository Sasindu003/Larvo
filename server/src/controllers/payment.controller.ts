import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { ReviewPaymentSchema } from '../validators/review-payment.validator';
import { paymentService } from '../services/payment.service';

/**
 * @desc    Review a submitted bank transfer payment slip
 * @route   PATCH /api/admin/payments/:paymentId/review
 * @access  Private (staff, admin, owner)
 */
export const reviewPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  let parsed;
  try {
    parsed = ReviewPaymentSchema.parse(req.body);
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new AppError('Validation failed', 422, errors);
    }
    throw err;
  }

  const { paymentId } = req.params;
  const result = await paymentService.reviewPayment(
    req.user,
    paymentId,
    parsed.decision,
    parsed.note
  );

  const message =
    parsed.decision === 'approved'
      ? 'Payment slip approved successfully'
      : 'Payment slip rejected successfully';

  res.status(200).json({
    success: true,
    data: {
      payment: result.payment,
      order: result.order,
    },
    message,
  });
});
