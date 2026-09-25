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
  SubmitQuoteInput,
  DeclinePOInput,
  DecideQuoteInput,
  ReviewPaymentInput,
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
      totalCost: (po.items || []).reduce((sum: number, it: any) => {
        const useOriginal = ['requested', 'admin_rejected'].includes(po.status);
        return (
          sum +
          (useOriginal
            ? (it.orderedQty || 0) * (it.unitCost || 0)
            : (it.quotedQty || 0) * (it.quotedUnitCost || 0))
        );
      }, 0),
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
      estimatedDeliveryDate: input.estimatedDeliveryDate ?? null,
      paymentSlipUrl: input.paymentSlipUrl ?? null,
      paymentReviewNote: input.paymentReviewNote ?? null,
      declineReason: input.declineReason ?? null,
      notes: input.notes || '',
      status: 'requested',
    });

    // Stub notification hook: notify supplier of new stock request
    // TODO(P65): In future phases, dispatch notification/email to supplier

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

    // Only requested POs can be edited
    if (po.status !== 'requested') {
      throw new AppError(
        `Only requested purchase orders can be edited. Current status: ${po.status}`,
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

    if (input.estimatedDeliveryDate !== undefined) {
      po.estimatedDeliveryDate = input.estimatedDeliveryDate;
    }

    if (input.paymentSlipUrl !== undefined) {
      po.paymentSlipUrl = input.paymentSlipUrl;
    }

    if (input.paymentReviewNote !== undefined) {
      po.paymentReviewNote = input.paymentReviewNote;
    }

    if (input.declineReason !== undefined) {
      po.declineReason = input.declineReason;
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

    const cancellable: POStatus[] = [
      'requested',
      'admin_approved',
      'admin_rejected',
      'payment_rejected',
      'confirmed',
    ];
    if (!cancellable.includes(po.status)) {
      throw new AppError(
        `Cannot cancel a purchase order with status '${po.status}'. ` +
          `Only requested, admin_approved, admin_rejected, payment_rejected, or confirmed orders can be cancelled.`,
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

  /**
   * Submit a quote for a requested purchase order.
   * Asserts PO is in 'requested' status (via PO_VALID_TRANSITIONS) and supplier ownership.
   * Updates per-item quotedQty, quotedUnitCost, optional estimatedDeliveryDate, and sets status to 'quoted'.
   */
  async submitQuote(
    id: string,
    input: SubmitQuoteInput,
    supplierUserId: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Ownership check via Supplier.userId or direct supplier ID
    const supplier = await Supplier.findById(po.supplier);
    if (!supplier) {
      throw new AppError('Supplier record not found', 404);
    }

    const supplierUserIdStr = supplierUserId?.toString();
    const isOwner =
      (supplier.userId && supplier.userId.toString() === supplierUserIdStr) ||
      supplier._id.toString() === supplierUserIdStr;

    if (!isOwner) {
      throw new AppError('You do not have permission to quote this purchase order', 403);
    }

    // Assert status transition via PO_VALID_TRANSITIONS
    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext || !allowedNext.includes('quoted')) {
      throw new AppError(
        `Cannot submit a quote for a purchase order with status '${po.status}'. Allowed transitions: ${allowedNext && allowedNext.length ? allowedNext.join(', ') : 'none'}`,
        400
      );
    }

    // Map lines to items by SKU
    const itemBySku = new Map<string, (typeof po.items)[number]>();
    for (const item of po.items) {
      itemBySku.set(item.sku, item);
    }

    for (const line of input.lines) {
      const item = itemBySku.get(line.sku);
      if (!item) {
        throw new AppError(
          `SKU '${line.sku}' does not exist in this purchase order`,
          400
        );
      }
      item.quotedQty = line.quotedQty;
      item.quotedUnitCost = line.quotedUnitCost;
    }

    po.status = 'quoted';
    if (input.estimatedDeliveryDate !== undefined) {
      po.estimatedDeliveryDate = input.estimatedDeliveryDate;
    }

    await po.save();

    // Stub notification hook: notify admin of quote submission
    // TODO(P66): In future phases, notify admin of supplier quote

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  /**
   * Decline a requested purchase order.
   * Asserts PO is in 'requested' status (via PO_VALID_TRANSITIONS) and supplier ownership.
   * Sets declineReason and transitions status to 'declined'.
   */
  async declinePurchaseOrder(
    id: string,
    reasonOrInput: string | DeclinePOInput,
    supplierUserId: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Ownership check via Supplier.userId or direct supplier ID
    const supplier = await Supplier.findById(po.supplier);
    if (!supplier) {
      throw new AppError('Supplier record not found', 404);
    }

    const supplierUserIdStr = supplierUserId?.toString();
    const isOwner =
      (supplier.userId && supplier.userId.toString() === supplierUserIdStr) ||
      supplier._id.toString() === supplierUserIdStr;

    if (!isOwner) {
      throw new AppError('You do not have permission to decline this purchase order', 403);
    }

    // Assert status transition via PO_VALID_TRANSITIONS
    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext || !allowedNext.includes('declined')) {
      throw new AppError(
        `Cannot decline a purchase order with status '${po.status}'. Allowed transitions: ${allowedNext && allowedNext.length ? allowedNext.join(', ') : 'none'}`,
        400
      );
    }

    const declineReason =
      typeof reasonOrInput === 'string'
        ? reasonOrInput
        : reasonOrInput.declineReason;

    po.status = 'declined';
    po.declineReason = declineReason;

    await po.save();

    // Stub notification hook: notify admin of PO decline
    // TODO(P66): In future phases, notify admin of supplier decline

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  /**
   * Admin approves or rejects a supplier quote.
   * - PO must be in 'quoted' status (validated via PO_VALID_TRANSITIONS).
   * - Approve guard: at least one item must have quotedUnitCost > 0.
   * - approve -> 'admin_approved'; reject -> 'admin_rejected'.
   * - admin_rejected is terminal per PO_VALID_TRANSITIONS (only -> cancelled).
   */
  async decideQuote(id: string, input: DecideQuoteInput): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Validate status via PO_VALID_TRANSITIONS
    const targetStatus = input.decision === 'approve' ? 'admin_approved' : 'admin_rejected';
    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext || !allowedNext.includes(targetStatus)) {
      throw new AppError(
        `Cannot ${input.decision} a quote for a purchase order with status '${po.status}'. Allowed transitions: ${allowedNext && allowedNext.length ? allowedNext.join(', ') : 'none'}`,
        400
      );
    }

    // Quote completeness guard (approve only)
    if (input.decision === 'approve') {
      const allZero = po.items.every((item) => item.quotedUnitCost === 0);
      if (allZero) {
        throw new AppError(
          'Cannot approve: no supplier pricing has been provided (all quotedUnitCost values are 0). ' +
            'Ensure the supplier has submitted a quote via /quote before approving.',
          400
        );
      }
    }

    po.status = targetStatus;
    await po.save();

    // Stub notification hook: notify supplier of admin decision
    // TODO(P67): In future phases, notify supplier of quote approval/rejection

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  /**
   * Admin uploads a payment slip and submits to supplier.
   * Accepts entry from both 'admin_approved' (first submission) and 'payment_rejected' (resubmission).
   * Transitions status to 'payment_submitted'.
   */
  async submitPaymentSlip(id: string, slipUrl: string): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Assert status allows transition to payment_submitted
    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext || !allowedNext.includes('payment_submitted')) {
      throw new AppError(
        `Cannot submit payment slip for a purchase order with status '${po.status}'. ` +
          `Only admin_approved or payment_rejected orders can submit payment slips.`,
        400
      );
    }

    if (!slipUrl || typeof slipUrl !== 'string' || !slipUrl.trim()) {
      throw new AppError('Payment slip URL is required', 400);
    }

    po.paymentSlipUrl = slipUrl.trim();
    po.status = 'payment_submitted';
    await po.save();

    // Stub notification hook: notify supplier of payment slip submission
    // TODO(P68): In future phases, notify supplier of payment slip submission

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  /**
   * Supplier approves or rejects an admin-uploaded payment slip.
   * - PO must be in 'payment_submitted' status.
   * - Ownership check via Supplier.userId.
   * - Approve guard: paymentSlipUrl must be non-empty.
   * - approve -> 'confirmed'; reject -> 'payment_rejected' + paymentReviewNote.
   * - payment_rejected loops back to admin for slip resubmission (not a dead-end).
   */
  async reviewPayment(
    id: string,
    input: ReviewPaymentInput,
    supplierUserId: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Ownership check via Supplier.userId or direct supplier ID
    const supplier = await Supplier.findById(po.supplier);
    if (!supplier) {
      throw new AppError('Supplier record not found', 404);
    }
    const supplierUserIdStr = supplierUserId?.toString();
    const isOwner =
      (supplier.userId && supplier.userId.toString() === supplierUserIdStr) ||
      supplier._id.toString() === supplierUserIdStr;
    if (!isOwner) {
      throw new AppError('You do not have permission to review payment for this purchase order', 403);
    }

    // Assert status via PO_VALID_TRANSITIONS
    const targetStatus = input.decision === 'approve' ? 'confirmed' : 'payment_rejected';
    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext || !allowedNext.includes(targetStatus)) {
      throw new AppError(
        `Cannot ${input.decision} payment for a purchase order with status '${po.status}'. ` +
          `Allowed transitions: ${allowedNext && allowedNext.length ? allowedNext.join(', ') : 'none'}`,
        400
      );
    }

    // Approve guard: paymentSlipUrl must be present
    if (input.decision === 'approve') {
      if (!po.paymentSlipUrl || !po.paymentSlipUrl.trim()) {
        throw new AppError(
          'Cannot approve payment: no payment slip has been uploaded. ' +
            'Admin must upload a slip via /payment-slip before it can be reviewed.',
          400
        );
      }
    }

    po.status = targetStatus;
    if (input.note !== undefined) {
      po.paymentReviewNote = input.note;
    }
    await po.save();

    // Stub notification hook: notify admin of supplier payment review decision
    // TODO(P69): In future phases, notify admin of supplier payment review decision

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }

  /**
   * Supplier marks a confirmed purchase order as shipped (in_transit).
   * - PO must be in 'confirmed' status.
   * - Ownership check via Supplier.userId.
   */
  async markShipped(
    id: string,
    supplierUserId: string | Types.ObjectId
  ): Promise<IPurchaseOrder> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid purchase order ID', 400);
    }

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Ownership check via Supplier.userId or direct supplier ID
    const supplier = await Supplier.findById(po.supplier);
    if (!supplier) {
      throw new AppError('Supplier record not found', 404);
    }
    const supplierUserIdStr = supplierUserId?.toString();
    const isOwner =
      (supplier.userId && supplier.userId.toString() === supplierUserIdStr) ||
      supplier._id.toString() === supplierUserIdStr;
    if (!isOwner) {
      throw new AppError('You do not have permission to mark this purchase order as shipped', 403);
    }

    // Assert status via PO_VALID_TRANSITIONS
    const allowedNext = PO_VALID_TRANSITIONS[po.status];
    if (!allowedNext || !allowedNext.includes('in_transit')) {
      throw new AppError(
        `Cannot mark as shipped for a purchase order with status '${po.status}'. ` +
          `Allowed transitions: ${allowedNext && allowedNext.length ? allowedNext.join(', ') : 'none'}`,
        400
      );
    }

    po.status = 'in_transit';
    await po.save();

    // Stub notification hook: notify admin that shipment has been dispatched
    // TODO(P69): In future phases, notify admin that shipment has been dispatched

    return po.populate([
      { path: 'supplier', select: 'name companyName email status' },
      { path: 'items.product', select: 'name slug images basePrice' },
    ]);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;

