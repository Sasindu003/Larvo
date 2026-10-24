import { env } from '../config/env';
import mongoose, { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Product } from '../models/Product';
import { Coupon } from '../models/Coupon';
import { User } from '../models/User';
import { Review } from '../models/Review';
import { Supplier } from '../models/Supplier';
import { PointsTransaction } from '../models/PointsTransaction';
import { ReturnRequest } from '../models/ReturnRequest';
import { Category } from '../models/Category';
import { Department } from '../models/Department';
import { Invoice } from '../models/Invoice';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Payment } from '../models/Payment';
import { Order } from '../models/Order';
import { CategoryService } from '../services/category.service';
import { productService } from '../services/product.service';
import { couponService } from '../services/coupon.service';
import { paymentService } from '../services/payment.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { orderService } from '../services/order.service';
import { invoiceService } from '../services/invoice.service';
import { returnService } from '../services/return.service';
import { reviewService } from '../services/review.service';
import { up as runUnsetNullMigration } from '../migrations/2026_unset_null_fields';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('--- Starting Null Omission & Schema Hygiene Tests ---');
  await mongoose.connect(env.MONGO_URI);
  const db = mongoose.connection.db!;

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 1: Schema Code Static Analysis (No default: null in models/)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SECTION 1] Static Model Inspection: No default: null in server/src/models/');
  const modelsDir = path.resolve(__dirname, '../models');
  const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.ts'));

  for (const file of modelFiles) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const hasDefaultNull = /default:\s*null\b/.test(content);
    assert(!hasDefaultNull, `Model ${file} contains no 'default: null'`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 2: Newly created documents omit unset optional keys in MongoDB
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SECTION 2] BSON Document Key Omission on Creation');

  // 1. Department & Category
  const dept = await Department.create({
    name: 'Test Dept',
    slug: `test-dept-${Date.now()}`,
    image: 'https://example.com/dept.jpg',
  });
  const cat = await Category.create({
    name: 'Test Cat',
    slug: `test-cat-${Date.now()}`,
    image: 'https://example.com/cat.jpg',
    department: dept._id,
  });
  const rawCat = await db.collection('categories').findOne({ _id: cat._id });
  assert(!('parent' in rawCat!), 'Category BSON omits unset parent key');

  // 2. User
  const user = await User.create({
    name: 'Test Null User',
    email: `nulluser-${Date.now()}@example.com`,
    role: 'customer',
  });
  const rawUser = await db.collection('users').findOne({ _id: user._id });
  assert(!('supplierId' in rawUser!), 'User BSON omits unset supplierId key');

  // 3. Product
  const prod = await Product.create({
    name: 'Test Null Product',
    slug: `test-prod-${Date.now()}`,
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
        sku: `SKU-TEST-${Date.now()}`,
        stock: 10,
      },
    ],
  });
  const rawProd = await db.collection('products').findOne({ _id: prod._id });
  assert(!('discountPrice' in rawProd!), 'Product BSON omits unset discountPrice key');
  assert(!('supplier' in rawProd!.variants[0]), 'Product variant BSON omits unset supplier key');

  // 4. Coupon
  const coupon = await Coupon.create({
    code: `TESTCPN${Date.now()}`,
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 1000,
    validUntil: new Date('2030-01-01'),
  });
  const rawCoupon = await db.collection('coupons').findOne({ _id: coupon._id });
  assert(!('maxDiscountAmount' in rawCoupon!), 'Coupon BSON omits unset maxDiscountAmount key');
  assert(!('usageLimit' in rawCoupon!), 'Coupon BSON omits unset usageLimit key');
  assert(!('perCustomerLimit' in rawCoupon!), 'Coupon BSON omits unset perCustomerLimit key');

  // 5. Supplier
  const supplier = await Supplier.create({
    name: 'Contact Person',
    companyName: `Test Supplier Co ${Date.now()}`,
    email: `supplier-${Date.now()}@example.com`,
    phone: '0112345678',
    status: 'active',
  });
  const rawSupplier = await db.collection('suppliers').findOne({ _id: supplier._id });
  assert(!('userId' in rawSupplier!), 'Supplier BSON omits unset userId key');

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
  assert(!('couponCode' in rawOrder!), 'Order BSON omits unset couponCode key');
  assert(!('trackingNumber' in rawOrder!), 'Order BSON omits unset trackingNumber key');
  assert(!('deliveredAt' in rawOrder!), 'Order BSON omits unset deliveredAt key');

  // 7. Payment
  const payment = await Payment.create({
    order: order._id,
    method: 'bank_transfer',
    amount: 100,
    status: 'submitted',
  });
  const rawPayment = await db.collection('payments').findOne({ _id: payment._id });
  assert(!('slipImageUrl' in rawPayment!), 'Payment BSON omits unset slipImageUrl key');
  assert(!('transactionId' in rawPayment!), 'Payment BSON omits unset transactionId key');
  assert(!('pointsUsed' in rawPayment!), 'Payment BSON omits unset pointsUsed key');
  assert(!('walletTransaction' in rawPayment!), 'Payment BSON omits unset walletTransaction key');
  assert(!('reviewedBy' in rawPayment!), 'Payment BSON omits unset reviewedBy key');

  // 8. Invoice
  const invoice = await Invoice.create({
    invoiceNumber: `INV-${Date.now()}`,
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
  assert(!('pointsUsed' in rawInvoice!.snapshot), 'Invoice snapshot BSON omits unset pointsUsed key');

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
  assert(!('adminReply' in rawReview!), 'Review BSON omits unset adminReply key');

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
  assert(!('estimatedDeliveryDate' in rawPo!), 'PurchaseOrder BSON omits unset estimatedDeliveryDate key');
  assert(!('paymentSlipUrl' in rawPo!), 'PurchaseOrder BSON omits unset paymentSlipUrl key');
  assert(!('quotationNotes' in rawPo!), 'PurchaseOrder BSON omits unset quotationNotes key');

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
  assert(!('pickup' in rawReturn!), 'ReturnRequest BSON omits unset pickup key');
  assert(!('refundAmount' in rawReturn!), 'ReturnRequest BSON omits unset refundAmount key');
  assert(!('rejectionReason' in rawReturn!), 'ReturnRequest BSON omits unset rejectionReason key');
  assert(!('refundPoints' in rawReturn!), 'ReturnRequest BSON omits unset refundPoints key');

  // 12. PointsTransaction
  const tx = await PointsTransaction.create({
    wallet: new Types.ObjectId(),
    user: user._id,
    type: 'admin_credit',
    direction: 'credit',
    points: 100,
    balanceAfter: 100,
    idempotencyKey: `pt-${Date.now()}`,
  });
  const rawTx = await db.collection('pointstransactions').findOne({ _id: tx._id });
  assert(!('order' in rawTx!), 'PointsTransaction BSON omits unset order key');
  assert(!('returnRequest' in rawTx!), 'PointsTransaction BSON omits unset returnRequest key');
  assert(!('note' in rawTx!), 'PointsTransaction BSON omits unset note key');
  assert(!('createdBy' in rawTx!), 'PointsTransaction BSON omits unset createdBy key');

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 3: Migration Idempotency & Literal Null Cleanup Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SECTION 3] Migration Execution & Idempotency');

  // Seed raw documents with literal null values to simulate legacy state
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
    code: `LEGACY${Date.now()}`,
    maxDiscountAmount: null,
    usageLimit: null,
    perCustomerLimit: null,
  });
  const testLegacyUserId = new Types.ObjectId();
  await db.collection('users').insertOne({
    _id: testLegacyUserId,
    name: 'Legacy User',
    email: `legacy-${Date.now()}@test.com`,
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
    slug: `legacy-prod-${Date.now()}`,
    description: 'desc',
    category: cat._id,
    images: ['https://example.com/legacy.jpg'],
    basePrice: 50,
    discountPrice: null,
    variants: [
      {
        size: 'M',
        color: 'Black',
        material: 'Cotton',
        sku: `LEGACY-SKU-${Date.now()}`,
        stock: 5,
        supplier: null,
      },
    ],
  });

  const rawLegacyOrderBefore = await db.collection('orders').findOne({ _id: testLegacyOrderId });
  assert(rawLegacyOrderBefore?.couponCode === null, 'Pre-condition: legacy order contains literal null couponCode');
  const rawLegacyUserBefore = await db.collection('users').findOne({ _id: testLegacyUserId });
  assert(rawLegacyUserBefore?.addresses?.[0]?.phone === null, 'Pre-condition: legacy user address contains literal null phone');
  const rawLegacyProdBefore = await db.collection('products').findOne({ _id: testLegacyProductId });
  assert(rawLegacyProdBefore?.variants?.[0]?.supplier === null, 'Pre-condition: legacy product variant contains literal null supplier');

  // Run migration
  const migrationResult1 = await runUnsetNullMigration();
  assert(migrationResult1.totalUnset >= 4, `First migration pass cleaned at least 4 documents (got ${migrationResult1.totalUnset})`);

  const rawLegacyOrderAfter = await db.collection('orders').findOne({ _id: testLegacyOrderId });
  assert(!('couponCode' in rawLegacyOrderAfter!), 'Post-condition: legacy order couponCode was unset');
  assert(!('trackingNumber' in rawLegacyOrderAfter!), 'Post-condition: legacy order trackingNumber was unset');
  assert(!('deliveredAt' in rawLegacyOrderAfter!), 'Post-condition: legacy order deliveredAt was unset');

  const rawLegacyCouponAfter = await db.collection('coupons').findOne({ _id: testLegacyCouponId });
  assert(!('maxDiscountAmount' in rawLegacyCouponAfter!), 'Post-condition: legacy coupon maxDiscountAmount was unset');
  assert(!('usageLimit' in rawLegacyCouponAfter!), 'Post-condition: legacy coupon usageLimit was unset');

  const rawLegacyUserAfter = await db.collection('users').findOne({ _id: testLegacyUserId });
  assert(!('phone' in rawLegacyUserAfter!.addresses[0]), 'Post-condition: legacy user address phone was unset');
  assert(!('line2' in rawLegacyUserAfter!.addresses[0]), 'Post-condition: legacy user address line2 was unset');

  const rawLegacyProdAfter = await db.collection('products').findOne({ _id: testLegacyProductId });
  assert(!('discountPrice' in rawLegacyProdAfter!), 'Post-condition: legacy product discountPrice was unset');
  assert(!('supplier' in rawLegacyProdAfter!.variants[0]), 'Post-condition: legacy product variant supplier was unset');

  // Run migration a second time to verify complete idempotency
  const migrationResult2 = await runUnsetNullMigration();
  assert(migrationResult2.totalUnset === 0, `Idempotency verified: second pass unset 0 documents`);

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 4: Service & Controller Level Explicit Null Handling & $unset Guardrails
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n[SECTION 4] Service & Controller Level Explicit Null Handling');

  // 1. CategoryService: create without parent omits parent; update with parent: null unsets parent
  const catService = new CategoryService();
  const createdRootCat = await catService.createCategory({
    name: 'Service Test Cat Root',
    slug: `service-cat-root-${Date.now()}`,
    image: 'https://example.com/root.jpg',
    department: dept._id.toString(),
  });
  const rawServiceRootCat = await db.collection('categories').findOne({ _id: createdRootCat._id });
  assert(!('parent' in rawServiceRootCat!), 'CategoryService.createCategory omits unset parent key in BSON');

  // Create child category and then clear parent via update
  const createdChildCat = await catService.createCategory({
    name: 'Service Test Cat Child',
    slug: `service-cat-child-${Date.now()}`,
    image: 'https://example.com/child.jpg',
    department: dept._id.toString(),
    parent: createdRootCat._id.toString(),
  });
  const rawChildBefore = await db.collection('categories').findOne({ _id: createdChildCat._id });
  assert('parent' in rawChildBefore!, 'Pre-condition: child category has parent');

  await catService.updateCategory(createdChildCat._id.toString(), {
    parent: null,
  });
  const rawChildAfter = await db.collection('categories').findOne({ _id: createdChildCat._id });
  assert(!('parent' in rawChildAfter!), 'CategoryService.updateCategory unsets parent when null passed');

  // 2. ProductService: create with discountPrice: null or omitted omits discountPrice; update unsets it
  const createdServiceProd = await productService.createProduct({
    name: 'Service Test Product',
    description: 'Test description',
    category: cat._id.toString(),
    images: ['https://example.com/sp.jpg'],
    basePrice: 200,
    discountPrice: null,
    status: 'active',
    variants: [
      {
        size: 'L',
        color: 'Navy',
        material: 'Wool',
        sku: `SKU-SVC-1-${Date.now()}`,
        stock: 5,
        supplier: null as any,
      },
    ],
  });
  const rawServiceProd = await db.collection('products').findOne({ _id: createdServiceProd._id });
  assert(!('discountPrice' in rawServiceProd!), 'productService.createProduct omits discountPrice when null passed');
  assert(!('supplier' in rawServiceProd!.variants[0]), 'productService.createProduct omits variant supplier when null passed');

  // Update product to set discountPrice then unset via null
  await productService.updateProduct(createdServiceProd._id.toString(), {
    discountPrice: 150,
  });
  const rawProdDiscounted = await db.collection('products').findOne({ _id: createdServiceProd._id });
  assert(rawProdDiscounted?.discountPrice === 150, 'Pre-condition: product discountPrice updated to 150');

  await productService.updateProduct(createdServiceProd._id.toString(), {
    discountPrice: null,
  });
  const rawProdDiscountUnset = await db.collection('products').findOne({ _id: createdServiceProd._id });
  assert(!('discountPrice' in rawProdDiscountUnset!), 'productService.updateProduct unsets discountPrice when null passed');

  // 3. CouponService: create with null limits omits them; update with null unsets them
  const createdServiceCoupon = await couponService.createCoupon({
    code: `SVCCOUPON${Date.now()}`,
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
  assert(!('maxDiscountAmount' in rawServiceCoupon!), 'couponService.createCoupon omits maxDiscountAmount when null');
  assert(!('usageLimit' in rawServiceCoupon!), 'couponService.createCoupon omits usageLimit when null');
  assert(!('perCustomerLimit' in rawServiceCoupon!), 'couponService.createCoupon omits perCustomerLimit when null');

  // Update coupon with limits, then unset with null
  await couponService.updateCoupon(createdServiceCoupon._id.toString(), {
    maxDiscountAmount: 500,
    usageLimit: 100,
    perCustomerLimit: 1,
  });
  const rawCouponWithLimits = await db.collection('coupons').findOne({ _id: createdServiceCoupon._id });
  assert(rawCouponWithLimits?.maxDiscountAmount === 500, 'Pre-condition: coupon limits updated');

  await couponService.updateCoupon(createdServiceCoupon._id.toString(), {
    maxDiscountAmount: null,
    usageLimit: null,
    perCustomerLimit: null,
  });
  const rawCouponLimitsUnset = await db.collection('coupons').findOne({ _id: createdServiceCoupon._id });
  assert(!('maxDiscountAmount' in rawCouponLimitsUnset!), 'couponService.updateCoupon unsets maxDiscountAmount when null');
  assert(!('usageLimit' in rawCouponLimitsUnset!), 'couponService.updateCoupon unsets usageLimit when null');
  assert(!('perCustomerLimit' in rawCouponLimitsUnset!), 'couponService.updateCoupon unsets perCustomerLimit when null');

  // 4. PurchaseOrderService: update with null optional fields unsets them
  const poService = new PurchaseOrderService();
  await PurchaseOrder.findByIdAndUpdate(po._id, {
    estimatedDeliveryDate: new Date(),
    paymentReviewNote: 'Initial note',
  });
  const rawPoBefore = await db.collection('purchaseorders').findOne({ _id: po._id });
  assert('estimatedDeliveryDate' in rawPoBefore!, 'Pre-condition: PO has estimatedDeliveryDate');

  await poService.updatePurchaseOrder(po._id.toString(), {
    estimatedDeliveryDate: null as any,
    paymentReviewNote: null as any,
  });
  const rawPoUpdated = await db.collection('purchaseorders').findOne({ _id: po._id });
  assert(!('estimatedDeliveryDate' in rawPoUpdated!), 'poService.updatePurchaseOrder unsets estimatedDeliveryDate when null');
  assert(!('paymentReviewNote' in rawPoUpdated!), 'poService.updatePurchaseOrder unsets paymentReviewNote when null');

  // 5. Payment review without a note does NOT persist reviewNote: null
  const staffUser = await User.create({
    name: 'Staff Reviewer',
    email: `staff-rev-${Date.now()}@example.com`,
    role: 'staff',
  });
  const reviewOrder = await Order.create({
    user: user._id,
    items: order.items,
    shippingAddress: order.shippingAddress,
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
  assert(!('reviewNote' in rawApprovedPayment!), 'paymentService.reviewPayment without note omits reviewNote key in BSON');

  // 6. User Address: creation with null / empty phone & line2 omits them from BSON
  const addrUser = await User.create({
    name: 'Address Test User',
    email: `addr-test-${Date.now()}@example.com`,
    role: 'customer',
  });
  const newAddrPayload: any = {
    label: 'Home',
    line1: '100 Beach Road',
    city: 'Negombo',
    province: 'Western',
    postalCode: '11500',
    country: 'Sri Lanka',
    phone: null,
    line2: null,
  };
  if (newAddrPayload.phone === null || newAddrPayload.phone === '') delete newAddrPayload.phone;
  if (newAddrPayload.line2 === null || newAddrPayload.line2 === '') delete newAddrPayload.line2;
  addrUser.addresses.push(newAddrPayload);
  await addrUser.save();

  const rawAddrUser = await db.collection('users').findOne({ _id: addrUser._id });
  assert(!('phone' in rawAddrUser!.addresses[0]), 'User address creation with null phone omits phone in BSON');
  assert(!('line2' in rawAddrUser!.addresses[0]), 'User address creation with null line2 omits line2 in BSON');

  // 7. User Address: update to unset existing phone & line2
  await db.collection('users').updateOne(
    { _id: addrUser._id },
    { $set: { 'addresses.0.phone': '0771234567', 'addresses.0.line2': 'Apt 4B' } }
  );
  const reloadedAddrUser = await User.findById(addrUser._id);
  (reloadedAddrUser!.addresses[0] as any).phone = undefined;
  (reloadedAddrUser!.addresses[0] as any).line2 = undefined;
  await reloadedAddrUser!.save();

  const rawAddrUserUpdated = await db.collection('users').findOne({ _id: addrUser._id });
  assert(!('phone' in rawAddrUserUpdated!.addresses[0]), 'User address update unsets phone in BSON');
  assert(!('line2' in rawAddrUserUpdated!.addresses[0]), 'User address update unsets line2 in BSON');

  // 8. ProductService: updating variant with supplier: null unsets supplier on variant subdocument
  const variantProd = await productService.createProduct({
    name: 'Variant Supplier Test Prod',
    description: 'Variant supplier test',
    category: cat._id.toString(),
    images: ['https://example.com/v.jpg'],
    basePrice: 200,
    status: 'active',
    variants: [
      {
        size: 'M',
        color: 'Navy',
        material: 'Linen',
        sku: `V-SUP-SKU-${Date.now()}`,
        stock: 10,
        supplier: supplier._id.toString(),
      },
    ],
  });
  const rawVariantProdBefore = await db.collection('products').findOne({ _id: variantProd._id });
  assert('supplier' in rawVariantProdBefore!.variants[0], 'Pre-condition: variant has supplier set');

  await productService.updateProduct(variantProd._id.toString(), {
    variants: [
      {
        size: 'M',
        color: 'Navy',
        material: 'Linen',
        sku: rawVariantProdBefore!.variants[0].sku,
        stock: 10,
        supplier: null as any,
      },
    ],
  });
  const rawVariantProdAfter = await db.collection('products').findOne({ _id: variantProd._id });
  assert(!('supplier' in rawVariantProdAfter!.variants[0]), 'productService.updateProduct with supplier: null unsets supplier from variant subdocument in BSON');

  // 9. Product partial update: Updating with only name preserves existing discountPrice
  const partialProd = await productService.createProduct({
    name: 'Discount Preservation Prod',
    description: 'Testing partial update discountPrice retention',
    category: cat._id.toString(),
    images: ['https://example.com/disc.jpg'],
    basePrice: 500,
    discountPrice: 400,
    status: 'active',
    variants: [
      {
        size: 'L',
        color: 'Olive',
        material: 'Cotton',
        sku: `DISC-PRESERVE-${Date.now()}`,
        stock: 20,
      },
    ],
  });
  const updatedPartialProd = await productService.updateProduct(partialProd._id.toString(), {
    name: 'Renamed Discount Preservation Prod',
  });
  assert(updatedPartialProd.discountPrice === 400, 'Partial update with only name preserves existing discountPrice');
  const rawPartialProd = await db.collection('products').findOne({ _id: partialProd._id });
  assert(rawPartialProd!.discountPrice === 400, 'Partial update preserves discountPrice in MongoDB BSON');

  // 10. Order Creation: user shipping address with omitted line2 persists shippingAddress without line2 in BSON
  const orderUser = await User.create({
    name: 'Order Address User',
    email: `order_user_${Date.now()}@example.com`,
    passwordHash: 'hashed123',
    role: 'customer',
    addresses: [
      {
        label: 'Home',
        line1: '45 Lotus Lane',
        city: 'Kandy',
        province: 'Central',
        postalCode: '20000',
        country: 'Sri Lanka',
        isDefault: true,
      },
    ],
  });
  const orderResult = await orderService.createOrder(orderUser._id.toString(), {
    shippingAddressId: orderUser.addresses[0]._id!.toString(),
    items: [
      {
        productId: partialProd._id.toString(),
        variantSku: partialProd.variants[0].sku,
        quantity: 1,
      },
    ],
  });
  const placedOrder = orderResult.order;
  const rawPlacedOrder = await db.collection('orders').findOne({ _id: placedOrder._id });
  assert(!('line2' in rawPlacedOrder!.shippingAddress), 'Order shippingAddress omits unset line2 in BSON');
  assert(!('couponCode' in rawPlacedOrder!), 'Order without coupon omits couponCode in BSON');

  // 11. Invoice Generation: non-reward-points order omits pointsUsed in snapshot BSON
  const generatedInvoice = await invoiceService.generateInvoice(placedOrder);
  const rawGenInvoice = await db.collection('invoices').findOne({ _id: generatedInvoice._id });
  assert(!('pointsUsed' in rawGenInvoice!.snapshot), 'Invoice snapshot omits pointsUsed for non-reward-points payment in BSON');
  assert(!('line2' in rawGenInvoice!.snapshot.shippingAddress), 'Invoice snapshot shippingAddress omits unset line2 in BSON');

  // 12. Return Request: transitionReturnStatus with pickup containing null/empty fields cleans & omits keys in BSON
  await db.collection('orders').updateOne(
    { _id: placedOrder._id },
    { $set: { status: 'delivered', deliveredAt: new Date() } }
  );
  const retForPickup = await returnService.createReturnRequest(orderUser._id.toString(), {
    orderId: placedOrder._id.toString(),
    items: [{ orderItemRef: 0, qty: 1, reason: 'Size too big' }],
  });
  await returnService.transitionReturnStatus(retForPickup._id.toString(), 'pickup_scheduled', {
    userId: staffUser._id.toString(),
    role: 'staff',
  }, {
    pickup: {
      courier: 'ExpressCourier',
      waybill: null,
      timeWindow: '',
      address: '45 Lotus Lane, Kandy',
    },
  });
  const rawRetForPickup = await db.collection('returnrequests').findOne({ _id: retForPickup._id });
  assert(rawRetForPickup!.pickup.courier === 'ExpressCourier', 'Return pickup courier is recorded');
  assert(!('waybill' in rawRetForPickup!.pickup), 'Return pickup omits null waybill key in BSON');
  assert(!('timeWindow' in rawRetForPickup!.pickup), 'Return pickup omits empty timeWindow key in BSON');

  // 13. Review aggregation: unreplied reviews cleanly omit adminReply field rather than returning empty object
  const unrepliedReview = await Review.create({
    product: partialProd._id,
    user: orderUser._id,
    order: placedOrder._id,
    rating: 5,
    title: 'Solid quality',
    comment: 'Fits nicely after all',
    status: 'published',
  });
  const reviewsAgg = await reviewService.getProductReviews(partialProd._id.toString(), {});
  const foundAggReview = reviewsAgg.items.find((r: any) => r._id.toString() === unrepliedReview._id.toString());
  assert(foundAggReview && !('adminReply' in foundAggReview), 'reviewService.getProductReviews cleanly omits adminReply when unreplied');

  // Clean up additional service test documents
  await db.collection('categories').deleteMany({ _id: { $in: [createdRootCat._id, createdChildCat._id] } });
  await db.collection('products').deleteMany({ _id: { $in: [createdServiceProd._id, variantProd._id, partialProd._id, testLegacyProductId] } });
  await db.collection('coupons').deleteOne({ _id: createdServiceCoupon._id });
  await db.collection('users').deleteMany({ _id: { $in: [staffUser._id, addrUser._id, orderUser._id, testLegacyUserId] } });
  await db.collection('orders').deleteMany({ _id: { $in: [reviewOrder._id, placedOrder._id] } });
  await db.collection('payments').deleteOne({ _id: reviewPaymentDoc._id });
  await db.collection('invoices').deleteOne({ _id: generatedInvoice._id });
  await db.collection('returnrequests').deleteOne({ _id: retForPickup._id });
  await db.collection('reviews').deleteOne({ _id: unrepliedReview._id });

  // Clean up test documents
  await db.collection('departments').deleteOne({ _id: dept._id });
  await db.collection('categories').deleteOne({ _id: cat._id });
  await db.collection('users').deleteOne({ _id: user._id });
  await db.collection('products').deleteOne({ _id: prod._id });
  await db.collection('coupons').deleteMany({ _id: { $in: [coupon._id, testLegacyCouponId] } });
  await db.collection('suppliers').deleteOne({ _id: supplier._id });
  await db.collection('orders').deleteMany({ _id: { $in: [order._id, testLegacyOrderId] } });
  await db.collection('payments').deleteOne({ _id: payment._id });
  await db.collection('invoices').deleteOne({ _id: invoice._id });
  await db.collection('reviews').deleteOne({ _id: review._id });
  await db.collection('purchaseorders').deleteOne({ _id: po._id });
  await db.collection('returnrequests').deleteOne({ _id: returnReq._id });
  await db.collection('pointstransactions').deleteOne({ _id: tx._id });

  await mongoose.disconnect();

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
