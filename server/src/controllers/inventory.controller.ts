import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { inventoryService, AvailabilityItem } from '../services/inventory.service';
import { z } from 'zod';

const validateInventorySchema = z.array(
  z.object({
    sku: z.string().min(1, 'SKU is required'),
    qty: z.number().int().min(0, 'Quantity must be non-negative'),
  })
);

export const validateInventory = asyncHandler(async (req: Request, res: Response) => {
  const result = validateInventorySchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400);
    throw new Error('Invalid input: ' + result.error.errors.map(e => e.message).join(', '));
  }
  
  const availability = await inventoryService.checkAvailability(result.data as AvailabilityItem[]);

  // SEC-01: If unauthenticated (anonymous guest), strip exact quantity fields to prevent stock scraping.
  // Returns boolean per SKU only ({ sku, ok }), preserving full availability/shortfall for authenticated users.
  const data = req.user
    ? availability
    : availability.map((item) => ({
        sku: item.sku,
        ok: item.ok,
      }));
  
  res.status(200).json({
    success: true,
    data,
    message: 'Inventory validated',
  });
});

const adjustStockSchema = z.object({
  stock: z.number().int('Stock must be an integer').min(0, 'Stock cannot be negative'),
});

/**
 * GET /api/admin/inventory
 * Flattens all product variants into paginated inventory rows with search & status filters.
 */
export const getAdminInventory = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, supplier, page, limit } = req.query;

  const validStatus =
    status === 'low_stock' || status === 'out_of_stock'
      ? (status as 'low_stock' | 'out_of_stock')
      : undefined;

  const result = await inventoryService.getAdminInventory({
    search: typeof search === 'string' ? search : undefined,
    status: validStatus,
    supplier: typeof supplier === 'string' ? supplier : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.status(200).json({
    success: true,
    data: result,
    message: 'Inventory list retrieved',
  });
});

/**
 * PATCH /api/admin/inventory/:sku/adjust
 * Adjusts variant stock level directly by SKU.
 */
export const adjustAdminInventoryStock = asyncHandler(async (req: Request, res: Response) => {
  const { sku } = req.params;
  const parseResult = adjustStockSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400);
    throw new Error('Invalid stock input: ' + parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const result = await inventoryService.adjustStockBySku(sku, parseResult.data.stock);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Stock adjusted successfully',
  });
});

