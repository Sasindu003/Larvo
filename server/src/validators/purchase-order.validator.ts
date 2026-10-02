import { z } from 'zod';

const PO_STATUS_VALUES = [
  'requested',
  'quoted',
  'declined',
  'admin_approved',
  'admin_rejected',
  'payment_submitted',
  'payment_rejected',
  'confirmed',
  'in_transit',
  'partially_received',
  'received',
  'cancelled',
] as const;

const POItemSchema = z.object({
  product: z.string({ required_error: 'Product ID is required' }).min(1),
  sku: z.string({ required_error: 'SKU is required' }).trim().min(1, 'SKU is required'),
  size: z.string({ required_error: 'Size is required' }).trim().min(1, 'Size is required'),
  color: z.string({ required_error: 'Color is required' }).trim().min(1, 'Color is required'),
  orderedQty: z.number({ required_error: 'Ordered quantity is required' }).int().min(1, 'Ordered quantity must be at least 1'),
  receivedQty: z.number().int().min(0, 'Received quantity cannot be negative').optional().default(0),
  unitCost: z.number().min(0, 'Unit cost cannot be negative').optional().default(0),
});

export const CreatePurchaseOrderSchema = z.object({
  supplier: z.string({ required_error: 'Supplier ID is required' }).min(1, 'Supplier ID is required'),
  items: z
    .array(POItemSchema)
    .min(1, 'At least one item is required'),
  status: z.enum(PO_STATUS_VALUES).optional().default('requested'),
  estimatedDeliveryDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  paymentSlipUrl: z.string().optional().nullable(),
  paymentReviewNote: z.string().trim().max(2000).optional().nullable(),
  declineReason: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().default(''),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;

export const UpdatePurchaseOrderSchema = z.object({
  supplier: z.string().min(1).optional(),
  items: z.array(POItemSchema).min(1).optional(),
  estimatedDeliveryDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  paymentSlipUrl: z.string().optional().nullable(),
  paymentReviewNote: z.string().trim().max(2000).optional().nullable(),
  declineReason: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
}).refine(
  (data) => Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined),
  { message: 'At least one field must be provided for update' }
);

export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;

export const AdvancePOStatusSchema = z.object({
  status: z.enum(PO_STATUS_VALUES, { required_error: 'Status is required' }),
});

export type AdvancePOStatusInput = z.infer<typeof AdvancePOStatusSchema>;

export const ReceivePOSchema = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string({ required_error: 'SKU is required' }).trim().min(1, 'SKU is required'),
        receivedQtyDelta: z
          .number({ required_error: 'receivedQtyDelta is required' })
          .int('receivedQtyDelta must be an integer')
          .min(1, 'receivedQtyDelta must be at least 1'),
      })
    )
    .min(1, 'At least one receive line is required'),
});

export type ReceivePOInput = z.infer<typeof ReceivePOSchema>;

export const GetPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['all', ...PO_STATUS_VALUES]).optional().default('all'),
  supplier: z.string().optional(),
  search: z.string().trim().optional(),
});

export type GetPurchaseOrdersQuery = z.infer<typeof GetPurchaseOrdersQuerySchema>;

const SubmitQuoteLineSchema = z.object({
  sku: z.string({ required_error: 'SKU is required' }).trim().min(1, 'SKU is required'),
  quotedQty: z
    .number({ required_error: 'quotedQty is required' })
    .int('quotedQty must be an integer')
    .min(0, 'quotedQty cannot be negative'),
  quotedUnitCost: z
    .number({ required_error: 'quotedUnitCost is required' })
    .min(0, 'quotedUnitCost cannot be negative'),
});

export const SubmitQuoteSchema = z.object({
  lines: z
    .array(SubmitQuoteLineSchema)
    .min(1, 'At least one quote line is required'),
  estimatedDeliveryDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
});

export type SubmitQuoteInput = z.infer<typeof SubmitQuoteSchema>;

export const DeclinePOSchema = z.object({
  declineReason: z
    .string({ required_error: 'Decline reason is required' })
    .trim()
    .min(1, 'Decline reason is required')
    .max(2000, 'Decline reason cannot exceed 2000 characters'),
});

export type DeclinePOInput = z.infer<typeof DeclinePOSchema>;

export const DecideQuoteSchema = z.object({
  decision: z.enum(['approve', 'reject'], {
    required_error: 'decision is required',
    invalid_type_error: 'decision must be "approve" or "reject"',
  }),
});

export type DecideQuoteInput = z.infer<typeof DecideQuoteSchema>;

export const ReviewPaymentSchema = z.object({
  decision: z.enum(['approve', 'reject'], {
    required_error: 'decision is required',
    invalid_type_error: 'decision must be "approve" or "reject"',
  }),
  note: z.string().trim().max(2000, 'Note cannot exceed 2000 characters').optional(),
});

export type ReviewPaymentInput = z.infer<typeof ReviewPaymentSchema>;
