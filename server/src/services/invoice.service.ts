import { ClientSession, Types } from 'mongoose';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { Invoice, IInvoice, IInvoiceSnapshot, deriveInvoiceNumber } from '../models/Invoice';
import { IOrder, Order } from '../models/Order';
import { IPayment, Payment } from '../models/Payment';
import User, { IUser } from '../models/User';
import { AppError } from '../middleware/error.middleware';

export const invoiceService = {
  /**
   * Generate an immutable invoice record for a confirmed order.
   * Idempotent: Uses unique index on `order` and findOneAndUpdate with $setOnInsert.
   */
  async generateInvoice(
    order: IOrder,
    payment?: IPayment | null,
    session?: ClientSession
  ): Promise<IInvoice> {
    let resolvedPayment = payment;
    if (!resolvedPayment) {
      resolvedPayment = await Payment.findOne({ order: order._id }).session(session || null);
    }

    const invoiceNumber = deriveInvoiceNumber(order._id);
    const paymentMethod = resolvedPayment?.method || 'bank_transfer';
    const paymentStatus = resolvedPayment?.status || 'approved';
    const pointsUsed =
      paymentMethod === 'reward_points'
        ? (resolvedPayment?.pointsUsed ?? order.pointsPaid ?? null)
        : null;

    const snapshot: IInvoiceSnapshot = {
      items: order.items,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      shippingFee: order.shippingFee,
      total: order.total,
      paymentStatus,
      paymentMethod,
      pointsUsed,
    };

    try {
      const invoice = await Invoice.findOneAndUpdate(
        { order: order._id },
        {
          $setOnInsert: {
            invoiceNumber,
            order: order._id,
            user: order.user,
            snapshot,
            issuedAt: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          session: session || undefined,
          runValidators: true,
        }
      );
      return invoice!;
    } catch (err: any) {
      if (err.code === 11000) {
        const existing = await Invoice.findOne({ order: order._id }).session(session || null);
        if (existing) return existing;
      }
      throw err;
    }
  },

  /**
   * Retrieve invoice by orderId.
   * Enforces customer ownership or staff/admin/owner privilege.
   * Returns 404 if order not found or invoice not generated yet (unconfirmed order).
   */
  async getInvoiceByOrderId(user: IUser, orderId: string): Promise<IInvoice> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError('Invalid order ID', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const isOwner = order.user.toString() === user._id.toString();
    const isPrivileged = ['staff', 'admin', 'owner'].includes(user.role);

    if (!isOwner && !isPrivileged) {
      throw new AppError('You do not have access to this invoice', 403);
    }

    const invoice = await Invoice.findOne({ order: order._id });
    if (!invoice) {
      throw new AppError('Invoice not found for this order', 404);
    }

    return invoice;
  },

  /**
   * Stream a vector PDF invoice directly to the HTTP response using PDFKit.
   * Enforces customer ownership or staff/admin/owner privilege.
   */
  async streamInvoicePdf(user: IUser, orderId: string, res: Response): Promise<void> {
    const invoice = await this.getInvoiceByOrderId(user, orderId);
    const customer = await User.findById(invoice.user).select('name email');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40, compress: false });
    doc.pipe(res);

    const snapshot = invoice.snapshot;
    const customerName = customer?.name || 'Customer';
    const customerEmail = customer?.email || '';

    // ── Header ─────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('LARVO', 40, 40);

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('Contemporary Fashion & Apparel', 40, 68);

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('INVOICE', 350, 40, { align: 'right', width: 205 });

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#334155')
      .text(`Invoice #: ${invoice.invoiceNumber}`, 350, 66, { align: 'right', width: 205 });

    doc
      .font('Helvetica')
      .fillColor('#64748b')
      .text(`Order #: ${orderId.slice(-8).toUpperCase()}`, 350, 79, { align: 'right', width: 205 })
      .text(
        `Date: ${new Date(invoice.issuedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}`,
        350,
        92,
        { align: 'right', width: 205 }
      )
      .text(`Payment Status: ${snapshot.paymentStatus.toUpperCase()}`, 350, 105, {
        align: 'right',
        width: 205,
      });

    // Divider
    doc
      .moveTo(40, 125)
      .lineTo(555, 125)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke();

    // ── Customer & Destination Info ─────────────────────────────────────────
    const addr = snapshot.shippingAddress;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('BILLED & SHIPPED TO:', 40, 140);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(customerName, 40, 156);

    let currentY = 170;
    if (customerEmail) {
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(customerEmail, 40, currentY);
      currentY += 13;
    }

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#475569')
      .text(addr.line1, 40, currentY);
    currentY += 13;

    if (addr.line2) {
      doc.text(addr.line2, 40, currentY);
      currentY += 13;
    }

    doc.text(`${addr.city}, ${addr.province} ${addr.postalCode}`, 40, currentY);
    currentY += 13;
    doc.text(addr.country, 40, currentY);

    // ── Table Header ───────────────────────────────────────────────────────
    const tableTop = Math.max(currentY + 25, 235);

    // Header Background box
    doc
      .rect(40, tableTop - 4, 515, 22)
      .fillColor('#f8fafc')
      .fill();

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('ITEM & DETAILS', 48, tableTop + 2)
      .text('SKU', 250, tableTop + 2)
      .text('SIZE/COLOR', 340, tableTop + 2)
      .text('QTY', 420, tableTop + 2, { width: 30, align: 'right' })
      .text('PRICE', 460, tableTop + 2, { width: 45, align: 'right' })
      .text('TOTAL', 510, tableTop + 2, { width: 40, align: 'right' });

    let itemY = tableTop + 26;

    // ── Line Items ─────────────────────────────────────────────────────────
    snapshot.items.forEach((item) => {
      const lineTotal = item.unitPrice * item.quantity;

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(item.name, 48, itemY, { width: 195, ellipsis: true });

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#64748b')
        .text(item.variantSku || '-', 250, itemY, { width: 85, ellipsis: true })
        .text(`${item.size || '-'} / ${item.color || '-'}`, 340, itemY, { width: 75 })
        .text(item.quantity.toString(), 420, itemY, { width: 30, align: 'right' })
        .text(`$${item.unitPrice.toFixed(2)}`, 460, itemY, { width: 45, align: 'right' })
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(`$${lineTotal.toFixed(2)}`, 510, itemY, { width: 40, align: 'right' });

      itemY += 22;

      // Divider below item
      doc
        .moveTo(40, itemY - 6)
        .lineTo(555, itemY - 6)
        .strokeColor('#f1f5f9')
        .lineWidth(0.5)
        .stroke();
    });

    // ── Totals & Payment Summary ───────────────────────────────────────────
    const totalsY = itemY + 15;

    // Payment Info Card (Left)
    doc
      .roundedRect(40, totalsY, 260, 95, 6)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .fillColor('#f8fafc')
      .fillAndStroke();

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('PAYMENT DETAILS', 52, totalsY + 12);

    const formattedMethod =
      snapshot.paymentMethod === 'reward_points'
        ? 'Reward Points'
        : snapshot.paymentMethod === 'simulated_online'
        ? 'Online Card'
        : 'Bank Transfer';

    doc
      .fontSize(8.5)
      .font('Helvetica')
      .fillColor('#475569')
      .text(`Payment Method: ${formattedMethod}`, 52, totalsY + 28)
      .text(`Status: Approved / Verified`, 52, totalsY + 41);

    if (snapshot.paymentMethod === 'reward_points' || (snapshot.pointsUsed && snapshot.pointsUsed > 0)) {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#b45309')
        .text(
          `Paid with Reward Points: ${(snapshot.pointsUsed || 0).toLocaleString()} pts`,
          52,
          totalsY + 58
        );
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#92400e')
        .text('Full order total paid via customer points balance', 52, totalsY + 72);
    } else {
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('Electronic payment record generated on confirmation', 52, totalsY + 58);
    }

    // Totals Breakdown (Right)
    const rightLabelX = 350;
    const rightValueX = 475;
    let rightY = totalsY + 4;

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('Subtotal:', rightLabelX, rightY)
      .text(`$${snapshot.subtotal.toFixed(2)}`, rightValueX, rightY, { width: 75, align: 'right' });
    rightY += 16;

    if (snapshot.discountAmount > 0) {
      doc
        .fillColor('#059669')
        .text('Discount:', rightLabelX, rightY)
        .text(`-$${snapshot.discountAmount.toFixed(2)}`, rightValueX, rightY, {
          width: 75,
          align: 'right',
        });
      rightY += 16;
    }

    doc
      .fillColor('#64748b')
      .text('Shipping:', rightLabelX, rightY)
      .text(
        snapshot.shippingFee === 0 ? 'FREE' : `$${snapshot.shippingFee.toFixed(2)}`,
        rightValueX,
        rightY,
        { width: 75, align: 'right' }
      );
    rightY += 18;

    doc
      .moveTo(rightLabelX, rightY)
      .lineTo(555, rightY)
      .strokeColor('#cbd5e1')
      .lineWidth(1)
      .stroke();
    rightY += 8;

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('Total Amount:', rightLabelX, rightY)
      .text(`$${snapshot.total.toFixed(2)}`, rightValueX, rightY, { width: 75, align: 'right' });

    // ── Footer ─────────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#94a3b8')
      .text(
        'Thank you for your purchase with Larvo Atelier. This is a computer-generated invoice record.',
        40,
        740,
        { align: 'center', width: 515 }
      );

    doc.end();
  },
};

export default invoiceService;

