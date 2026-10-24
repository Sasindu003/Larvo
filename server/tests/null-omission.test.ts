import mongoose, { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Product } from '../src/models/Product';
import { Coupon } from '../src/models/Coupon';
import { User } from '../src/models/User';
import { Review } from '../src/models/Review';
import { Supplier } from '../src/models/Supplier';
import { PointsTransaction } from '../src/models/PointsTransaction';
import { ReturnRequest } from '../src/models/ReturnRequest';
import { Category } from '../src/models/Category';
import { Department } from '../src/models/Department';
import { Invoice } from '../src/models/Invoice';
import { PurchaseOrder } from '../src/models/PurchaseOrder';
import { Payment } from '../src/models/Payment';
import { Order } from '../src/models/Order';
import { CategoryService } from '../src/services/category.service';
import { productService } from '../src/services/product.service';
import { couponService } from '../src/services/coupon.service';
import { paymentService } from '../src/services/payment.service';
import { PurchaseOrderService } from '../src/services/purchase-order.service';
import { orderService } from '../src/services/order.service';
import { invoiceService } from '../src/services/invoice.service';
import { returnService } from '../src/services/return.service';
import { reviewService } from '../src/services/review.service';
import { up as runUnsetNullMigration } from '../src/migrations/2026_unset_null_fields';

describe('Null Omission & Schema Hygiene Tests', () => {
  const getDb = () => mongoose.connection.db!;

  describe('Section 1: Static Model Inspection', () => {
    it('ensures no domain model contains default: null in server/src/models/', () => {
      const modelsDir = path.resolve(__dirname, '../src/models');
      // UserBehaviorLog is an immutable telemetry log where guest sessions explicitly record userId: null
      const modelFiles = fs
        .readdirSync(modelsDir)
        .filter((f) => f.endsWith('.ts') && f !== 'UserBehaviorLog.ts');

      for (const file of modelFiles) {
        const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
        const hasDefaultNull = /default:\s*null\b/.test(content);
        expect(hasDefaultNull).toBe(false);
      }
    });
  });

  describe('Section 2: BSON Document Key Omission on Creation', () => {
    it('omits unset optional keys from MongoDB BSON documents', async () => {
      const db = getDb();
      const suffix = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      // 1. Department & Category
      const dept = await Department.create({
        name: 'Test Dept',
        slug: `test-dept-${suffix}`,
        image: 'https://example.com/dept.jpg',
      });
      const cat = await Category.create({
        name: 'Test Cat',
        slug: `test-cat-${suffix}`,
        image: 'https://example.com/cat.jpg',
        department: dept._id,
      });
      const rawCat = await db.collection('categories').findOne({ _id: cat._id });
      expect('parent' in rawCat!).toBe(false);

      // 2. User
      const user = await User.create({
        name: 'Test Null User',
        email: `nulluser-${suffix}@example.com`,
        role: 'customer',
      });
      const rawUser = await db.collection('users').findOne({ _id: user._id });
      expect('supplierId' in rawUser!).toBe(false);

      // 3. Product
      const prod = await Product.create({
        name: 'Test Null Product',
        slug: `test-prod-${suffix}`,
        description: 'Test description',
        category: cat._id,
        images: ['https://example.com/prod.jpg'],
        basePrice: 100,
        status: 'active',
        variants: [
          {
            size: 'M',
            color: 'Black',
            material: 'Cotton',
            sku: `SKU-TEST-${suffix}`,
            stock: 10,
          },
        ],
      });
      const rawProd = await db.collection('products').findOne({ _id: prod._id });
      expect('discountPrice' in rawProd!).toBe(false);
      expect('supplier' in rawProd!.variants[0]).toBe(false);

      // 4. Coupon
      const coupon = await Coupon.create({
        code: `TESTCPN${suffix}`,
        discountType: 'percentage',
        discountValue: 15,
        minOrderAmount: 1000,
        validUntil: new Date('2030-01-01'),
      });
      const rawCoupon = await db.collection('coupons').findOne({ _id: coupon._id });
      expect('maxDiscountAmount' in rawCoupon!).toBe(false);
      expect('usageLimit' in rawCoupon!).toBe(false);
      expect('perCustomerLimit' in rawCoupon!).toBe(false);

      // 5. Supplier
      const supplier = await Supplier.create({
        name: 'Contact Person',
        companyName: `Test Supplier Co ${suffix}`,
        email: `supplier-${suffix}@example.com`,
        phone: '0112345678',
        status: 'active',
      });
      const rawSupplier = await db.collection('suppliers').findOne({ _id: supplier._id });
      expect('userId' in rawSupplier!).toBe(false);

      // 6. Order
      const order = await Order.create({
        user: user._id,
        items: [
          {
            product: prod._id,
            name: prod.name,
            image: prod.images[0],
            variantSku: prod.variants[0].sku,
            size: prod.variants[0].size,
            color: prod.variants[0].color,
            unitPrice: 100,
            quantity: 1,
          },
        ],
        shippingAddress: {
          line1: '123 Street',
          city: 'Colombo',
          province: 'Western',
          postalCode: '00100',
          country: 'Sri Lanka',
        },
        subtotal: 100,
        shippingFee: 0,
        total: 100,
        status: 'pending_payment',
      });
      const rawOrder = await db.collection('orders').findOne({ _id: order._id });
      expect('couponCode' in rawOrder!).toBe(false);
      expect('trackingNumber' in rawOrder!).toBe(false);
      expect('deliveredAt' in rawOrder!).toBe(false);

      // 7. Payment
      const payment = await Payment.create({
        order: order._id,
        method: 'bank_transfer',
        amount: 100,
        status: 'submitted',
      });
      const rawPayment = await db.collection('payments').findOne({ _id: payment._id });
      expect('slipImageUrl' in rawPayment!).toBe(false);
      expect('transactionId' in rawPayment!).toBe(false);
      expect('pointsUsed' in rawPayment!).toBe(false);
      expect('walletTransaction' in rawPayment!).toBe(false);
      expect('reviewedBy' in rawPayment!).toBe(false);

      // 8. Invoice
      const invoice = await Invoice.create({
        invoiceNumber: `INV-${suffix}`,
        order: order._id,
        user: user._id,
        issuedAt: new Date(),
        snapshot: {
          items: order.items,
          shippingAddress: order.shippingAddress,
          subtotal: order.subtotal,
          discountAmount: 0,
          shippingFee: 0,
          total: order.total,
          paymentStatus: 'submitted',
          paymentMethod: 'bank_transfer',
        },
      });
      const rawInvoice = await db.collection('invoices').findOne({ _id: invoice._id });
      expect('pointsUsed' in rawInvoice!.snapshot).toBe(false);

      // 9. Review
      const review = await Review.create({
        product: prod._id,
        user: user._id,
        order: order._id,
        rating: 5,
        title: 'Great product',
        comment: 'Really loved this product!',
        verifiedPurchase: true,
      });
      const rawReview = await db.collection('reviews').findOne({ _id: review._id });
      expect('adminReply' in rawReview!).toBe(false);

      // 10. PurchaseOrder
      const po = await PurchaseOrder.create({
        supplier: supplier._id,
        items: [
          {
            product: prod._id,
            sku: prod.variants[0].sku,
            size: prod.variants[0].size,
            color: prod.variants[0].color,
            orderedQty: 50,
          },
        ],
        status: 'requested',
      });
      const rawPo = await db.collection('purchaseorders').findOne({ _id: po._id });
      expect('estimatedDeliveryDate' in rawPo!).toBe(false);
      expect('paymentSlipUrl' in rawPo!).toBe(false);
      expect('quotationNotes' in rawPo!).toBe(false);

      // 11. ReturnRequest
      const returnReq = await ReturnRequest.create({
        order: order._id,
        user: user._id,
        items: [
          {
            orderItemRef: 0,
            sku: prod.variants[0].sku,
            qty: 1,
            reason: 'Wrong size',
          },
        ],
        status: 'requested',
      });
      const rawReturn = await db.collection('returnrequests').findOne({ _id: returnReq._id });
      expect('pickup' in rawReturn!).toBe(false);
      expect('refundAmount' in rawReturn!).toBe(false);
      expect('rejectionReason' in rawReturn!).toBe(false);
      expect('refundPoints' in rawReturn!).toBe(false);

      // 12. PointsTransaction
      const tx = await PointsTransaction.create({
        wallet: new Types.ObjectId(),
        user: user._id,
        type: 'admin_credit',
        direction: 'credit',
        points: 100,
        balanceAfter: 100,
        idempotencyKey: `pt-${suffix}`,
      });
      const rawTx = await db.collection('pointstransactions').findOne({ _id: tx._id });
      expect('order' in rawTx!).toBe(false);
      expect('returnRequest' in rawTx!).toBe(false);
      expect('note' in rawTx!).toBe(false);
      expect('createdBy' in rawTx!).toBe(false);
    });
  });

  describe('Section 3: Migration Execution & Idempotency', () => {
    it('unsets literal nulls and operates idempotently', async () => {
      const db = getDb();
      const suffix = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      const testLegacyOrderId = new Types.ObjectId();
      await db.collection('orders').insertOne({
        _id: testLegacyOrderId,
        couponCode: null,
        trackingNumber: null,
        deliveredAt: null,
        status: 'cancelled',
      });
      const testLegacyCouponId = new Types.ObjectId();
      await db.collection('coupons').insertOne({
        _id: testLegacyCouponId,
        code: `LEGACY${suffix}`,
        maxDiscountAmount: null,
        usageLimit: null,
        perCustomerLimit: null,
      });
      const testLegacyUserId = new Types.ObjectId();
      await db.collection('users').insertOne({
        _id: testLegacyUserId,
        name: 'Legacy User',
        email: `legacy-${suffix}@test.com`,
        role: 'customer',
        addresses: [
          {
            _id: new Types.ObjectId(),
            line1: '123 Legacy St',
            line2: null,
            phone: null,
            city: 'Colombo',
            province: 'Western',
            postalCode: '00100',
            country: 'LK',
            isDefault: true,
          },
        ],
      });
      const testLegacyProductId = new Types.ObjectId();
      await db.collection('products').insertOne({
        _id: testLegacyProductId,
        name: 'Legacy Prod',
        slug: `legacy-prod-${suffix}`,
        description: 'desc',
        category: new Types.ObjectId(),
        images: ['https://example.com/legacy.jpg'],
        basePrice: 50,
        discountPrice: null,
        variants: [
          {
            size: 'M',
            color: 'Black',
            material: 'Cotton',
            sku: `LEGACY-SKU-${suffix}`,
            stock: 5,
            supplier: null,
          },
        ],
      });

      const migrationResult1 = await runUnsetNullMigration();
      expect(migrationResult1.totalUnset).toBeGreaterThanOrEqual(4);

      const rawLegacyOrderAfter = await db.collection('orders').findOne({ _id: testLegacyOrderId });
      expect('couponCode' in rawLegacyOrderAfter!).toBe(false);
      expect('trackingNumber' in rawLegacyOrderAfter!).toBe(false);
      expect('deliveredAt' in rawLegacyOrderAfter!).toBe(false);

      const rawLegacyCouponAfter = await db.collection('coupons').findOne({ _id: testLegacyCouponId });
      expect('maxDiscountAmount' in rawLegacyCouponAfter!).toBe(false);
      expect('usageLimit' in rawLegacyCouponAfter!).toBe(false);

      const rawLegacyUserAfter = await db.collection('users').findOne({ _id: testLegacyUserId });
      expect('phone' in rawLegacyUserAfter!.addresses[0]).toBe(false);
      expect('line2' in rawLegacyUserAfter!.addresses[0]).toBe(false);

      const rawLegacyProdAfter = await db.collection('products').findOne({ _id: testLegacyProductId });
      expect('discountPrice' in rawLegacyProdAfter!).toBe(false);
      expect('supplier' in rawLegacyProdAfter!.variants[0]).toBe(false);

      const migrationResult2 = await runUnsetNullMigration();
      expect(migrationResult2.totalUnset).toBe(0);
    });
  });

  describe('Section 4: Service Level Explicit Null Handling & $unset Guardrails', () => {
    it('properly unsets fields across services when passed null', async () => {
      const db = getDb();
      const suffix = Date.now().toString() + Math.random().toString(36).slice(2, 6);

      const dept = await Department.create({
        name: 'Service Dept',
        slug: `service-dept-${suffix}`,
        image: 'https://example.com/dept.jpg',
      });

      // 1. CategoryService
      const catService = new CategoryService();
      const createdRootCat = await catService.createCategory({
        name: 'Service Test Cat Root',
        slug: `service-cat-root-${suffix}`,
        image: 'https://example.com/root.jpg',
        department: dept._id.toString(),
      });
      const rawServiceRootCat = await db.collection('categories').findOne({ _id: createdRootCat._id });
      expect('parent' in rawServiceRootCat!).toBe(false);

      const createdChildCat = await catService.createCategory({
        name: 'Service Test Cat Child',
        slug: `service-cat-child-${suffix}`,
        image: 'https://example.com/child.jpg',
        department: dept._id.toString(),
        parent: createdRootCat._id.toString(),
      });
      const rawChildBefore = await db.collection('categories').findOne({ _id: createdChildCat._id });
      expect('parent' in rawChildBefore!).toBe(true);

      await catService.updateCategory(createdChildCat._id.toString(), { parent: null });
      const rawChildAfter = await db.collection('categories').findOne({ _id: createdChildCat._id });
      expect('parent' in rawChildAfter!).toBe(false);

      // 2. ProductService
      const createdServiceProd = await productService.createProduct({
        name: 'Service Test Product',
        description: 'Test description',
        category: createdRootCat._id.toString(),
        images: ['https://example.com/sp.jpg'],
        basePrice: 200,
        discountPrice: null,
        status: 'active',
        variants: [
          {
            size: 'L',
            color: 'Navy',
            material: 'Wool',
            sku: `SKU-SVC-1-${suffix}`,
            stock: 5,
            supplier: null as any,
          },
        ],
      });
      const rawServiceProd = await db.collection('products').findOne({ _id: createdServiceProd._id });
      expect('discountPrice' in rawServiceProd!).toBe(false);
      expect('supplier' in rawServiceProd!.variants[0]).toBe(false);

      await productService.updateProduct(createdServiceProd._id.toString(), { discountPrice: 150 });
      const rawProdDiscounted = await db.collection('products').findOne({ _id: createdServiceProd._id });
      expect(rawProdDiscounted?.discountPrice).toBe(150);

      await productService.updateProduct(createdServiceProd._id.toString(), { discountPrice: null });
      const rawProdDiscountUnset = await db.collection('products').findOne({ _id: createdServiceProd._id });
      expect('discountPrice' in rawProdDiscountUnset!).toBe(false);

      // 3. CouponService
      const createdServiceCoupon = await couponService.createCoupon({
        code: `SVCCOUPON${suffix}`,
        discountType: 'percentage',
        discountValue: 10,
        minOrderAmount: 0,
        maxDiscountAmount: null,
        validUntil: new Date('2030-01-01'),
        usageLimit: null,
        perCustomerLimit: null,
        active: true,
      });
      const rawServiceCoupon = await db.collection('coupons').findOne({ _id: createdServiceCoupon._id });
      expect('maxDiscountAmount' in rawServiceCoupon!).toBe(false);
      expect('usageLimit' in rawServiceCoupon!).toBe(false);
      expect('perCustomerLimit' in rawServiceCoupon!).toBe(false);

      await couponService.updateCoupon(createdServiceCoupon._id.toString(), {
        maxDiscountAmount: 500,
        usageLimit: 100,
        perCustomerLimit: 1,
      });
      const rawCouponWithLimits = await db.collection('coupons').findOne({ _id: createdServiceCoupon._id });
      expect(rawCouponWithLimits?.maxDiscountAmount).toBe(500);

      await couponService.updateCoupon(createdServiceCoupon._id.toString(), {
        maxDiscountAmount: null,
        usageLimit: null,
        perCustomerLimit: null,
      });
      const rawCouponLimitsUnset = await db.collection('coupons').findOne({ _id: createdServiceCoupon._id });
      expect('maxDiscountAmount' in rawCouponLimitsUnset!).toBe(false);
      expect('usageLimit' in rawCouponLimitsUnset!).toBe(false);
      expect('perCustomerLimit' in rawCouponLimitsUnset!).toBe(false);

      // 4. PurchaseOrderService
      const supplier = await Supplier.create({
        name: 'PO Supplier',
        companyName: `PO Supplier Co ${suffix}`,
        email: `po-sup-${suffix}@example.com`,
        phone: '0112345678',
        status: 'active',
      });
      const po = await PurchaseOrder.create({
        supplier: supplier._id,
        items: [
          {
            product: createdServiceProd._id,
            sku: createdServiceProd.variants[0].sku,
            size: createdServiceProd.variants[0].size,
            color: createdServiceProd.variants[0].color,
            orderedQty: 50,
          },
        ],
        status: 'requested',
      });

      const poService = new PurchaseOrderService();
      await PurchaseOrder.findByIdAndUpdate(po._id, {
        estimatedDeliveryDate: new Date(),
        paymentReviewNote: 'Initial note',
      });
      await poService.updatePurchaseOrder(po._id.toString(), {
        estimatedDeliveryDate: null as any,
        paymentReviewNote: null as any,
      });
      const rawPoUpdated = await db.collection('purchaseorders').findOne({ _id: po._id });
      expect('estimatedDeliveryDate' in rawPoUpdated!).toBe(false);
      expect('paymentReviewNote' in rawPoUpdated!).toBe(false);

      // 5. Payment review without note
      const user = await User.create({
        name: 'Order User',
        email: `ord-usr-${suffix}@example.com`,
        role: 'customer',
      });
      const staffUser = await User.create({
        name: 'Staff Reviewer',
        email: `staff-rev-${suffix}@example.com`,
        role: 'staff',
      });
      const reviewOrder = await Order.create({
        user: user._id,
        items: [
          {
            product: createdServiceProd._id,
            name: createdServiceProd.name,
            image: createdServiceProd.images[0],
            variantSku: createdServiceProd.variants[0].sku,
            size: createdServiceProd.variants[0].size,
            color: createdServiceProd.variants[0].color,
            unitPrice: 100,
            quantity: 1,
          },
        ],
        shippingAddress: {
          line1: '123 Street',
          city: 'Colombo',
          province: 'Western',
          postalCode: '00100',
          country: 'Sri Lanka',
        },
        subtotal: 100,
        shippingFee: 0,
        total: 100,
        status: 'payment_review',
      });
      const reviewPaymentDoc = await Payment.create({
        order: reviewOrder._id,
        method: 'bank_transfer',
        amount: 100,
        status: 'submitted',
        slipImageUrl: 'https://example.com/slip.jpg',
      });
      await paymentService.reviewPayment(staffUser as any, reviewPaymentDoc._id.toString(), 'approved');
      const rawApprovedPayment = await db.collection('payments').findOne({ _id: reviewPaymentDoc._id });
      expect('reviewNote' in rawApprovedPayment!).toBe(false);

      // 6. User Address phone & line2 omission
      const addrUser = await User.create({
        name: 'Address Test User',
        email: `addr-test-${suffix}@example.com`,
        role: 'customer',
      });
      const newAddrPayload: any = {
        label: 'Home',
        line1: '100 Beach Road',
        city: 'Negombo',
        province: 'Western',
        postalCode: '11500',
        country: 'Sri Lanka',
      };
      addrUser.addresses.push(newAddrPayload);
      await addrUser.save();

      const rawAddrUser = await db.collection('users').findOne({ _id: addrUser._id });
      expect('phone' in rawAddrUser!.addresses[0]).toBe(false);
      expect('line2' in rawAddrUser!.addresses[0]).toBe(false);
    });
  });
});
