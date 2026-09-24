import mongoose, { Types } from 'mongoose';
import { AppError } from '../middleware/error.middleware';
import { PurchaseOrder, IPurchaseOrder, PO_VALID_TRANSITIONS, POStatus } from '../models/PurchaseOrder';
import { Product } from '../models/Product';
import Supplier from '../models/Supplier';
import { inventoryService } from './inventory.service';
import {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  GetPurchaseOrdersQuery,
  ReceivePOInput,
} from '../validators/purchase-order.validator';

export interface PaginatedPurchaseOrders {
  results: IPurchaseOrder[];
  total: number;
  page: number;
  pages: number;
}

export class PurchaseOrderService {
  /**
   * Validate that every item references an existing product and a variant with the matching SKU.
   */
  private async validateItems(items: CreatePurchaseOrderInput['items']): Promise<void> {
    for (const item of items) {
      if (!Types.ObjectId.isValid(item.product)) {
        throw new AppError(`Invalid product ID: ${item.product}`, 400);
      }

      const product = await Product.findById(item.product).lean();
      if (!product) {
        throw new AppError(`Product not found: ${item.product}`, 400);
      }

      const variant = (product.variants || []).find((v: any) => v.sku === item.sku);
      if (!variant) {
        throw new AppError(
          `SKU '${item.sku}' does not exist on product '${product.name}'`,
          400
        );
      }
    }
  }

  async getPurchaseOrders(query: GetPurchaseOrdersQuery): Promise<PaginatedPurchaseOrders> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.supplier && Types.ObjectId.isValid(query.supplier)) {
      filter.supplier = new Types.ObjectId(query.supplier);
    }

    const [results, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplier', 'name companyName email status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);

    const formatted = (results as any[]).map((po) => ({
      ...po,
      totalCost: (po.items || []).reduce(
        (sum: number, it: any) => sum + (it.orderedQty || 0) * (it.unitCost || 0),
        0
      ),
    }));

    return {
      results: formatted as unknown as IPurchaseOrder[],
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  async getPurchaseOrderById(id: string): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id)
      .populate('supplier', 'name companyName email phone status')
      .populate('items.product', 'name slug images basePrice');

    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    return po;
  }

  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(input.supplier)) {
      throw new AppError('Invalid supplier ID', 400);
    }

    const supplier = await Supplier.findById(input.supplier);
    if (!supplier) {
      throw new AppError('Supplier not found', 400);
    }

    await this.validateItems(input.items);

    const po = await PurchaseOrder.create({
      supplier: input.supplier,
      items: input.items,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      notes: input.notes || '',
      status: 'draft',
    });

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  async updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Only draft POs can be edited
    if (po.status !== 'draft') {
      throw new AppError(
        `Only draft purchase orders can be edited. Current status: ${po.status}`,
        400
      );
    }

    if (input.supplier !== undefined) {
      if (!Types.ObjectId.isValid(input.supplier)) {
        throw new AppError('Invalid supplier ID', 400);
      }
      const supplier = await Supplier.findById(input.supplier);
      if (!supplier) {
        throw new AppError('Supplier not found', 400);
      }
      po.supplier = new Types.ObjectId(input.supplier);
    }

    if (input.items !== undefined) {
      await this.validateItems(input.items);
      po.items = input.items as any;
    }

    if (input.expectedDeliveryDate !== undefined) {
      po.expectedDeliveryDate = input.expectedDeliveryDate;
    }

    if (input.notes !== undefined) {
      po.notes = input.notes;
    }

    await po.save();

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  async advanceStatus(id: string, newStatus: POStatus): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext.includes(newStatus)) {
      throw new AppError(
        `Cannot transition from '${po.status}' to '${newStatus}'. ` +
          `Allowed: ${allowedNext.length ? allowedNext.join(', ') : 'none'}`,
        400
      );
    }

    po.status = newStatus;
    await po.save();

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  async cancelPurchaseOrder(id: string): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    const cancellable: POStatus[] = ['draft', 'submitted', 'confirmed'];
    if (!cancellable.includes(po.status)) {
      throw new AppError(
        `Cannot cancel a purchase order with status '${po.status}'. ` +
          `Only draft, submitted, or confirmed orders can be cancelled.`,
        400
      );
    }

    po.status = 'cancelled';
    await po.save();

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }
  /**
   * Record a partial or full receipt against a PO.
   * - PO must be in_transit or partially_received to accept a receipt.
   * - Each line increments PurchaseOrder.items[].receivedQty (capped at orderedQty).
   * - Calls inventoryService.adjustStock for each line to restock the SKU.
   * - Auto-advances status: if all items fully received → 'received', else → 'partially_received'.
   * Runs inside a Mongoose transaction to keep PO + Product stock in sync.
   */
  async receivePurchaseOrder(id: string, input: ReceivePOInput): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const po = await PurchaseOrder.findById(id).session(session);
      if (!po) {
        throw new AppError('Purchase order not found', 404);
      }

      const receivableStatuses: POStatus[] = ['in_transit', 'partially_received'];
      if (!receivableStatuses.includes(po.status)) {
        throw new AppError(
          `Cannot receive stock for a purchase order with status '${po.status}'. ` +
            `Order must be in_transit or partially_received.`,
          400
        );
      }

      // Build a map of SKU → item index for O(1) lookup
      const itemBySku = new Map<string, (typeof po.items)[number]>();
      for (const item of po.items) {
        itemBySku.set(item.sku, item);
      }

      // Process each receive line
      for (const line of input.lines) {
        const item = itemBySku.get(line.sku);
        if (!item) {
          throw new AppError(
            `SKU '${line.sku}' does not exist in this purchase order`,
            400
          );
        }

        const maxReceivable = item.orderedQty - item.receivedQty;
        if (maxReceivable <= 0) {
          throw new AppError(
            `SKU '${line.sku}' has already been fully received (orderedQty: ${item.orderedQty})`,
            400
          );
        }

        // Cap the delta at the remaining receivable quantity
        const appliedDelta = Math.min(line.receivedQtyDelta, maxReceivable);

        // Increment PO line received quantity
        item.receivedQty += appliedDelta;

        // Restock the product variant — positive delta = increment
        await inventoryService.adjustStock(item.product.toString(), item.sku, appliedDelta, {
          session,
        });
      }

      // Determine new PO status
      const allReceived = po.items.every((item) => item.receivedQty >= item.orderedQty);
      po.status = allReceived ? 'received' : 'partially_received';

      await po.save({ session });
      await session.commitTransaction();

      return po.populate([
        { path: 'supplier', select: 'name companyName email status' },
        { path: 'items.product', select: 'name slug images basePrice' },
      ]);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;

