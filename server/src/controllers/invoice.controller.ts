import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { invoiceService } from '../services/invoice.service';

/**
 * @desc    Get invoice by order ID
 * @route   GET /api/invoices/:orderId
 * @access  Private (Owner OR staff/admin/owner)
 */
export const getInvoiceByOrderId = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { orderId } = req.params;
  const invoice = await invoiceService.getInvoiceByOrderId(req.user, orderId);

  res.status(200).json({
    success: true,
    data: invoice,
  });
});

/**
 * @desc    Stream invoice PDF by order ID
 * @route   GET /api/invoices/:orderId/pdf
 * @access  Private (Owner OR staff/admin/owner)
 */
export const getInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?._id) {
    throw new AppError('Authentication required', 401);
  }

  const { orderId } = req.params;
  await invoiceService.streamInvoicePdf(req.user, orderId, res);
});

