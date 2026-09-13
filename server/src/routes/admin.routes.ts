import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getAdminInventory,
  adjustAdminInventoryStock,
} from '../controllers/inventory.controller';
import {
  getAdminProducts,
  createProduct,
  updateProduct,
  archiveProduct,
} from '../controllers/product.controller';
import {
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deactivateAdminCoupon,
} from '../controllers/coupon.controller';
import {
  getAdminWallets,
  getAdminWalletByUser,
  getAdminWalletTransactions,
  adminAdjustWallet,
} from '../controllers/wallet.controller';
import {
  getAdminOrders,
  getOrderById,
} from '../controllers/order.controller';
import { reviewPayment } from '../controllers/payment.controller';
import {
  getSummary,
  getRevenueTrend,
  getTopProducts,
  getInventoryAlerts,
  getCustomerGrowth,
  getWalletSummary,
} from '../controllers/analytics.controller';
import {
  getAdminReturns,
  processDecision,
  processRefund,
} from '../controllers/return.controller';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  getSupplierProducts,
  deleteSupplier,
} from '../controllers/supplier.controller';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  advancePurchaseOrderStatus,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from '../controllers/purchase-order.controller';

const router = Router();

/**
 * @desc    RBAC proof-of-concept: admin/owner only
 * @route   GET /api/admin/ping
 * @access  admin, owner
 */
router.get(
  '/ping',
  requireAuth,
  requireRole('admin', 'owner'),
  (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'pong — you have admin or owner access',
    });
  }
);

// ── Inventory ──────────────────────────────────────────────────────────────────

/**
 * @desc    Central inventory listing with variant flattening, search, and status filter
 * @route   GET /api/admin/inventory
 * @access  staff, admin, owner
 */
router.get(
  '/inventory',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getAdminInventory
);

/**
 * @desc    Direct SKU stock adjustment
 * @route   PATCH /api/admin/inventory/:sku/adjust
 * @access  staff, admin, owner
 */
router.patch(
  '/inventory/:sku/adjust',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  adjustAdminInventoryStock
);

// ── Products ───────────────────────────────────────────────────────────────────

/**
 * @desc    List all products (any status) with search + status filter
 * @route   GET /api/admin/products
 * @access  staff, admin, owner
 */
router.get(
  '/products',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getAdminProducts
);

/**
 * @desc    Create a new product
 * @route   POST /api/admin/products
 * @access  staff, admin, owner
 */
router.post(
  '/products',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  createProduct
);

/**
 * @desc    Update a product (metadata, variants, status)
 * @route   PATCH /api/admin/products/:id
 * @access  staff, admin, owner
 */
router.patch(
  '/products/:id',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  updateProduct
);

/**
 * @desc    Archive (soft-delete) a product
 * @route   DELETE /api/admin/products/:id
 * @access  admin, owner only
 */
router.delete(
  '/products/:id',
  requireAuth,
  requireRole('admin', 'owner'),
  archiveProduct
);

// ── Coupons ───────────────────────────────────────────────────────────────────

/**
 * @desc    List all coupons with search + status filter
 * @route   GET /api/admin/coupons
 * @access  staff, admin, owner (view-only for staff)
 */
router.get(
  '/coupons',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getAdminCoupons
);

/**
 * @desc    Create a new coupon
 * @route   POST /api/admin/coupons
 * @access  admin, owner only
 */
router.post(
  '/coupons',
  requireAuth,
  requireRole('admin', 'owner'),
  createAdminCoupon
);

/**
 * @desc    Update coupon details
 * @route   PATCH /api/admin/coupons/:id
 * @access  admin, owner only
 */
router.patch(
  '/coupons/:id',
  requireAuth,
  requireRole('admin', 'owner'),
  updateAdminCoupon
);

/**
 * @desc    Deactivate a coupon
 * @route   PATCH /api/admin/coupons/:id/deactivate
 * @access  admin, owner only
 */
router.patch(
  '/coupons/:id/deactivate',
  requireAuth,
  requireRole('admin', 'owner'),
  deactivateAdminCoupon
);

// ── Wallets & Reward Points ───────────────────────────────────────────────────

/**
 * @desc    Get paginated customer wallets
 * @route   GET /api/admin/wallets
 * @access  admin, owner
 */
router.get(
  '/wallets',
  requireAuth,
  requireRole('admin', 'owner'),
  getAdminWallets
);

/**
 * @desc    Get specific user's wallet
 * @route   GET /api/admin/wallets/:userId
 * @access  admin, owner
 */
router.get(
  '/wallets/:userId',
  requireAuth,
  requireRole('admin', 'owner'),
  getAdminWalletByUser
);

/**
 * @desc    Get specific user's wallet transaction ledger
 * @route   GET /api/admin/wallets/:userId/transactions
 * @access  admin, owner
 */
router.get(
  '/wallets/:userId/transactions',
  requireAuth,
  requireRole('admin', 'owner'),
  getAdminWalletTransactions
);

/**
 * @desc    Adjust user's wallet balance (credit or debit)
 * @route   POST /api/admin/wallets/:userId/adjust
 * @access  admin, owner
 */
router.post(
  '/wallets/:userId/adjust',
  requireAuth,
  requireRole('admin', 'owner'),
  adminAdjustWallet
);

// ── Orders ───────────────────────────────────────────────────────────────────

/**
 * @desc    List all orders with search + status filter
 * @route   GET /api/admin/orders
 * @access  staff, admin, owner
 */
router.get(
  '/orders',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getAdminOrders
);

/**
 * @desc    Get order details by ID
 * @route   GET /api/admin/orders/:orderId
 * @access  staff, admin, owner
 */
router.get(
  '/orders/:orderId',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getOrderById
);

// ── Payments ─────────────────────────────────────────────────────────────────

/**
 * @desc    Review bank transfer payment slip (approve or reject with note)
 * @route   PATCH /api/admin/payments/:paymentId/review
 * @access  staff, admin, owner
 */
router.patch(
  '/payments/:paymentId/review',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  reviewPayment
);

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * @desc    Get order summary metrics (revenue, order count, AOV)
 * @route   GET /api/admin/analytics/summary
 * @access  admin, owner
 */
router.get(
  '/analytics/summary',
  requireAuth,
  requireRole('admin', 'owner'),
  getSummary
);

/**
 * @desc    Get revenue trend over time (day, week, month)
 * @route   GET /api/admin/analytics/revenue-trend
 * @access  admin, owner
 */
router.get(
  '/analytics/revenue-trend',
  requireAuth,
  requireRole('admin', 'owner'),
  getRevenueTrend
);

/**
 * @desc    Get top selling products by revenue
 * @route   GET /api/admin/analytics/top-products
 * @access  admin, owner
 */
router.get(
  '/analytics/top-products',
  requireAuth,
  requireRole('admin', 'owner'),
  getTopProducts
);

/**
 * @desc    Get inventory alerts for low stock and out of stock variants
 * @route   GET /api/admin/analytics/inventory-alerts
 * @access  admin, owner
 */
router.get(
  '/analytics/inventory-alerts',
  requireAuth,
  requireRole('admin', 'owner'),
  getInventoryAlerts
);

/**
 * @desc    Get customer registration growth over time
 * @route   GET /api/admin/analytics/customer-growth
 * @access  admin, owner
 */
router.get(
  '/analytics/customer-growth',
  requireAuth,
  requireRole('admin', 'owner'),
  getCustomerGrowth
);

/**
 * @desc    Get wallet balance and point transaction summaries
 * @route   GET /api/admin/analytics/wallet-summary
 * @access  admin, owner
 */
router.get(
  '/analytics/wallet-summary',
  requireAuth,
  requireRole('admin', 'owner'),
  getWalletSummary
);

// ── Returns Review ────────────────────────────────────────────────────────────

/**
 * @desc    Get all return requests with estimated refund points
 * @route   GET /api/admin/returns
 * @access  staff, admin, owner
 */
router.get(
  '/returns',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getAdminReturns
);

/**
 * @desc    Approve or reject a return request
 * @route   PATCH /api/admin/returns/:id/decision
 * @access  staff, admin, owner
 */
router.patch(
  '/returns/:id/decision',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  processDecision
);

/**
 * @desc    Process wallet points refund for a received return request
 * @route   PATCH /api/admin/returns/:id/refund
 * @access  admin, owner
 */
router.patch(
  '/returns/:id/refund',
  requireAuth,
  requireRole('admin', 'owner'),
  processRefund
);

// ── Suppliers ─────────────────────────────────────────────────────────────────

/**
 * @desc    Get suppliers directory with search
 * @route   GET /api/admin/suppliers
 * @access  staff, admin, owner
 */
router.get(
  '/suppliers',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getSuppliers
);

/**
 * @desc    Get supplier by ID
 * @route   GET /api/admin/suppliers/:id
 * @access  staff, admin, owner
 */
router.get(
  '/suppliers/:id',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getSupplierById
);

/**
 * @desc    Create supplier
 * @route   POST /api/admin/suppliers
 * @access  admin, owner
 */
router.post(
  '/suppliers',
  requireAuth,
  requireRole('admin', 'owner'),
  createSupplier
);

/**
 * @desc    Update supplier
 * @route   PATCH /api/admin/suppliers/:id
 * @access  admin, owner
 */
router.patch(
  '/suppliers/:id',
  requireAuth,
  requireRole('admin', 'owner'),
  updateSupplier
);

/**
 * @desc    Deactivate supplier
 * @route   PATCH /api/admin/suppliers/:id/deactivate
 * @access  admin, owner
 */
router.patch(
  '/suppliers/:id/deactivate',
  requireAuth,
  requireRole('admin', 'owner'),
  deactivateSupplier
);

/**
 * @desc    Get products and variants supplied by a supplier
 * @route   GET /api/admin/suppliers/:id/products
 * @access  staff, admin, owner
 */
router.get(
  '/suppliers/:id/products',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  getSupplierProducts
);

/**
 * @desc    Delete supplier (disallowed if referenced by variants -> 409)
 * @route   DELETE /api/admin/suppliers/:id
 * @access  admin, owner
 */
router.delete(
  '/suppliers/:id',
  requireAuth,
  requireRole('admin', 'owner'),
  deleteSupplier
);

// ── Purchase Orders ───────────────────────────────────────────────────────────

/**
 * @desc    List purchase orders with status + supplier filter
 * @route   GET /api/admin/purchase-orders
 * @access  admin, owner
 */
router.get(
  '/purchase-orders',
  requireAuth,
  requireRole('admin', 'owner'),
  getPurchaseOrders
);

/**
 * @desc    Get single purchase order
 * @route   GET /api/admin/purchase-orders/:id
 * @access  admin, owner
 */
router.get(
  '/purchase-orders/:id',
  requireAuth,
  requireRole('admin', 'owner'),
  getPurchaseOrderById
);

/**
 * @desc    Create a new purchase order
 * @route   POST /api/admin/purchase-orders
 * @access  admin, owner
 */
router.post(
  '/purchase-orders',
  requireAuth,
  requireRole('admin', 'owner'),
  createPurchaseOrder
);

/**
 * @desc    Update purchase order (draft only)
 * @route   PATCH /api/admin/purchase-orders/:id
 * @access  admin, owner
 */
router.patch(
  '/purchase-orders/:id',
  requireAuth,
  requireRole('admin', 'owner'),
  updatePurchaseOrder
);

/**
 * @desc    Advance purchase order status
 * @route   PATCH /api/admin/purchase-orders/:id/status
 * @access  admin, owner
 */
router.patch(
  '/purchase-orders/:id/status',
  requireAuth,
  requireRole('admin', 'owner'),
  advancePurchaseOrderStatus
);

/**
 * @desc    Cancel a purchase order
 * @route   PATCH /api/admin/purchase-orders/:id/cancel
 * @access  admin, owner
 */
router.patch(
  '/purchase-orders/:id/cancel',
  requireAuth,
  requireRole('admin', 'owner'),
  cancelPurchaseOrder
);

/**
 * @desc    Receive stock against a purchase order (partial or full receipt)
 * @route   PATCH /api/admin/purchase-orders/:id/receive
 * @access  staff, admin, owner
 */
router.patch(
  '/purchase-orders/:id/receive',
  requireAuth,
  requireRole('staff', 'admin', 'owner'),
  receivePurchaseOrder
);

export default router;
