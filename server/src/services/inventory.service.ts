import mongoose, { ClientSession, Types } from 'mongoose';
import { Product, IProduct, IVariant } from '../models/Product';
import { AppError } from '../middleware/error.middleware';

/**
 * Low stock threshold constant:
 * stock === 0 -> 'out_of_stock'
 * stock <= LOW_STOCK_THRESHOLD (1..5) -> 'low_stock'
 * stock > LOW_STOCK_THRESHOLD -> 'in_stock'
 */
export const LOW_STOCK_THRESHOLD = 5;

export type StockStatus = 'out_of_stock' | 'low_stock' | 'in_stock';

export interface AvailabilityItem {
  sku: string;
  qty: number;
}

export interface AvailabilityResult {
  sku: string;
  ok: boolean;
  available: number;
  shortfall: number;
}

export interface AdjustStockOptions {
  session?: ClientSession;
}

export const inventoryService = {
  /**
   * Determine stock status using the LOW_STOCK_THRESHOLD constant.
   * 0 -> 'out_of_stock'
   * <= 5 -> 'low_stock'
   * else -> 'in_stock'
   */
  getStockStatus(stock: number): StockStatus {
    if (stock <= 0) {
      return 'out_of_stock';
    }
    if (stock <= LOW_STOCK_THRESHOLD) {
      return 'low_stock';
    }
    return 'in_stock';
  },

  /**
   * Adjust stock atomically with a floor guard preventing negative stock.
   * Decrements fail with 409 if available stock < required delta.
   * Supports optional mongoose ClientSession.
   */
  async adjustStock(
    productId: string | Types.ObjectId,
    sku: string,
    delta: number,
    options?: AdjustStockOptions
  ): Promise<IProduct> {
    const session = options?.session;
    const normalizedSku = sku.trim();

    if (delta === 0) {
      const product = await Product.findOne(
        { _id: productId, 'variants.sku': normalizedSku },
        null,
        { session }
      );
      if (!product) {
        throw new AppError(`Product or variant with SKU '${normalizedSku}' not found`, 404);
      }
      return product;
    }

    if (delta < 0) {
      const requiredQty = Math.abs(delta);

      // Atomic decrement with floor guard: only matches if current variant stock >= requiredQty
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          variants: {
            $elemMatch: {
              sku: normalizedSku,
              stock: { $gte: requiredQty },
            },
          },
        },
        {
          $inc: { 'variants.$.stock': delta },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedProduct) {
        // Find if product/variant exists to give precise 409 vs 404
        const existing = await Product.findOne(
          { _id: productId, 'variants.sku': normalizedSku },
          { 'variants.$': 1 },
          { session }
        );

        if (!existing || !existing.variants || existing.variants.length === 0) {
          throw new AppError(`Product or variant with SKU '${normalizedSku}' not found`, 404);
        }

        const currentStock = existing.variants[0].stock;
        const shortfall = requiredQty - currentStock;
        throw new AppError(
          `Insufficient stock for SKU '${normalizedSku}'. Available: ${currentStock}, Requested reduction: ${requiredQty} (shortfall: ${shortfall})`,
          409,
          { sku: normalizedSku, available: currentStock, shortfall }
        );
      }

      return updatedProduct;
    } else {
      // delta > 0: Increment/Restock
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
        },
        {
          $inc: { 'variants.$[elem].stock': delta },
        },
        {
          arrayFilters: [{ 'elem.sku': normalizedSku }],
          new: true,
          session,
        }
      );

      if (!updatedProduct) {
        throw new AppError(`Product or variant with SKU '${normalizedSku}' not found`, 404);
      }

      return updatedProduct;
    }
  },

  /**
   * Check availability across multiple SKUs and quantities.
   * Returns ok status, current available stock, and shortfall for each SKU requested.
   */
  async checkAvailability(items: AvailabilityItem[]): Promise<AvailabilityResult[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const requestedSkus = items.map((i) => i.sku.trim());

    // Retrieve all variants matching the requested SKUs across the Product collection
    const products = await Product.find(
      { 'variants.sku': { $in: requestedSkus } },
      { variants: 1 }
    ).lean();

    const stockMap = new Map<string, number>();

    for (const product of products) {
      if (Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (requestedSkus.includes(variant.sku)) {
            stockMap.set(variant.sku, variant.stock);
          }
        }
      }
    }

    return items.map((item) => {
      const sku = item.sku.trim();
      const requestedQty = Math.max(0, item.qty);
      const available = stockMap.get(sku) ?? 0;
      const ok = available >= requestedQty;
      const shortfall = ok ? 0 : requestedQty - available;

      return {
        sku,
        ok,
        available,
        shortfall,
      };
    });
  },

  /**
   * Flatten all products' variants into paginated inventory rows with filtering & search.
   */
  async getAdminInventory(query: {
    search?: string;
    status?: 'low_stock' | 'out_of_stock';
    supplier?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      { $unwind: '$variants' },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'variants.supplier',
          foreignField: '_id',
          as: 'supplierDoc',
        },
      },
      {
        $project: {
          product: {
            _id: '$_id',
            name: '$name',
            slug: '$slug',
            image: { $arrayElemAt: ['$images', 0] },
          },
          sku: '$variants.sku',
          size: '$variants.size',
          color: '$variants.color',
          stock: '$variants.stock',
          supplier: {
            $cond: [
              { $gt: [{ $size: '$supplierDoc' }, 0] },
              {
                _id: { $arrayElemAt: ['$supplierDoc._id', 0] },
                name: { $arrayElemAt: ['$supplierDoc.name', 0] },
                companyName: { $arrayElemAt: ['$supplierDoc.companyName', 0] },
                status: { $arrayElemAt: ['$supplierDoc.status', 0] },
              },
              null,
            ],
          },
          supplierId: '$variants.supplier',
          status: {
            $cond: [
              { $lte: ['$variants.stock', 0] },
              'out_of_stock',
              {
                $cond: [
                  { $lte: ['$variants.stock', LOW_STOCK_THRESHOLD] },
                  'low_stock',
                  'in_stock',
                ],
              },
            ],
          },
        },
      },
    ];

    const matchConditions: any = {};

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      matchConditions.$or = [
        { 'product.name': searchRegex },
        { sku: searchRegex },
      ];
    }

    if (query.status === 'low_stock' || query.status === 'out_of_stock') {
      matchConditions.status = query.status;
    }

    if (query.supplier && query.supplier.trim()) {
      const s = query.supplier.trim();
      if (s === 'unassigned') {
        matchConditions.supplier = null;
      } else if (mongoose.isValidObjectId(s)) {
        matchConditions.supplierId = new mongoose.Types.ObjectId(s);
      }
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    });

    const [facetResult] = await Product.aggregate(pipeline);
    const total = facetResult?.metadata?.[0]?.total || 0;
    const items = facetResult?.data || [];
    const pages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      pages,
      results: items.length,
    };
  },

  /**
   * Adjust stock for a variant identified by SKU, calculating delta and calling adjustStock.
   */
  async adjustStockBySku(sku: string, targetStock: number) {
    const normalizedSku = sku.trim();
    if (typeof targetStock !== 'number' || isNaN(targetStock) || targetStock < 0) {
      throw new AppError('Stock must be a non-negative integer', 400);
    }

    const product = await Product.findOne({ 'variants.sku': normalizedSku });
    if (!product) {
      throw new AppError(`Variant with SKU '${normalizedSku}' not found`, 404);
    }

    const variant = product.variants.find((v) => v.sku === normalizedSku);
    if (!variant) {
      throw new AppError(`Variant with SKU '${normalizedSku}' not found`, 404);
    }

    const currentStock = variant.stock;
    const delta = targetStock - currentStock;

    const updatedProduct = await this.adjustStock(product._id, normalizedSku, delta);
    const updatedVariant = updatedProduct.variants.find((v) => v.sku === normalizedSku);
    const finalStock = updatedVariant ? updatedVariant.stock : targetStock;

    return {
      product: {
        _id: updatedProduct._id,
        name: updatedProduct.name,
        slug: updatedProduct.slug,
      },
      sku: normalizedSku,
      stock: finalStock,
      status: this.getStockStatus(finalStock),
    };
  },
};

export default inventoryService;
