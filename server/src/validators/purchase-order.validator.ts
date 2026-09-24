import { z } from 'zod';

const PO_STATUS_VALUES = [
  'draft', 'submitted', 'confirmed', 'in_transit',
  'partially_received', 'received', 'cancelled',
] as const;

const POItemSchema = z.object({
  product: z.string({ required_error: 'Product ID is required' }).min(1),
  sku: z.string({ required_error: 'SKU is required' }).trim().min(1, 'SKU is required'),
  size: z.string({ required_error: 'Size is required' }).trim().min(1, 'Size is required'),
  color: z.string({ required_error: 'Color is required' }).trim().min(1, 'Color is required'),
  orderedQty: z.number({ required_error: 'Ordered quantity is required' }).int().min(1, 'Ordered quantity must be at least 1'),
  receivedQty: z.number().int().min(0, 'Received quantity cannot be negative').optional().default(0),
  unitCost: z.number({ required_error: 'Unit cost is required' }).min(0, 'Unit cost cannot be negative'),
});

export const CreatePurchaseOrderSchema = z.object({
  supplier: z.string({ required_error: 'Supplier ID is required' }).min(1, 'Supplier ID is required'),
  items: z
    .array(POItemSchema)
    .min(1, 'At least one item is required'),
  expectedDeliveryDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  notes: z.string().trim().max(2000).optional().default(''),
});

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;

export const UpdatePurchaseOrderSchema = z.object({
  supplier: z.string().min(1).optional(),
  items: z.array(POItemSchema).min(1).optional(),
  expectedDeliveryDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
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
