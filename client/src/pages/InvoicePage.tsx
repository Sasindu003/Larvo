import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  Coins,
  CreditCard,
  Building2,
  Calendar,
  FileText,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { invoiceService, Invoice } from '../services/invoice.service';

export const InvoicePage: React.FC = () => {
  const { id, orderId: orderIdParam } = useParams<{ id?: string; orderId?: string }>();
  const effectiveOrderId = id || orderIdParam || '';
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    if (!effectiveOrderId) {
      setError('Invalid order identifier');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    invoiceService
      .getInvoiceByOrderId(effectiveOrderId)
      .then((data) => {
        if (isMounted) {
          setInvoice(data);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Invoice not found or order has not been confirmed yet');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveOrderId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!effectiveOrderId || !invoice) return;
    setDownloading(true);
    try {
      await invoiceService.downloadInvoicePdf(effectiveOrderId, invoice.invoiceNumber);
      toast.success('Invoice PDF downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink-600 mb-3" />
        <p className="text-sm font-medium text-ink-600">Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-display font-bold text-ink-950 mb-2">
          Invoice Not Available
        </h1>
        <p className="text-sm text-ink-600 leading-relaxed mb-6">
          {error || 'An official invoice record is only generated once an order has been paid and confirmed.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {effectiveOrderId && (
            <Link
              to={`/orders/${effectiveOrderId}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-ink-900 bg-sand-100 hover:bg-sand-200 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> View Order Status
            </Link>
          )}
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-ink-900 hover:bg-ink-800 rounded-xl transition-colors"
          >
            My Orders
          </Link>
        </div>
      </div>
    );
  }

  const { snapshot } = invoice;
  const isRewardPoints = snapshot.paymentMethod === 'reward_points' || (snapshot.pointsUsed && snapshot.pointsUsed > 0);

  return (
    <div className="min-h-screen bg-sand-50/60 py-6 sm:py-10 px-4 sm:px-6 print:bg-white print:p-0">
      {/* Print-specific style overrides to hide global nav/footer during window.print() */}
      <style>{`
        @media print {
          nav, header, footer, .print-hide {
            display: none !important;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .invoice-sheet {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Top Actions Toolbar (Hidden when printing) */}
      <div className="max-w-4xl mx-auto mb-6 print-hide">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-sand-200 shadow-sm rounded-2xl p-4">
          <Link
            to={`/orders/${effectiveOrderId}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-ink-700 hover:text-ink-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Order Details</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-ink-800 bg-sand-100 hover:bg-sand-200 border border-sand-300 rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-ink-950 hover:bg-ink-800 rounded-xl transition-colors shadow-sm disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document Sheet */}
      <div className="invoice-sheet max-w-4xl mx-auto bg-white border border-sand-200 shadow-sm rounded-2xl p-6 sm:p-10 text-ink-950">
        {/* Header Block */}
        <div className="flex flex-wrap items-start justify-between gap-6 pb-8 border-b border-sand-200">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-2xl font-bold tracking-tight text-ink-950">
                LARVO
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Paid & Confirmed
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-1">Contemporary Fashion & Apparel</p>
            <p className="text-xs text-ink-400 mt-0.5">Automated Electronic Invoice</p>
          </div>

          <div className="text-right">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-ink-950">
              INVOICE
            </h1>
            <p className="text-xs font-mono font-bold text-ink-700 mt-1">
              {invoice.invoiceNumber}
            </p>
            <p className="text-xs text-ink-500 mt-0.5">
              Order #{effectiveOrderId.slice(-8).toUpperCase()}
            </p>
            <p className="text-xs text-ink-500 mt-0.5 flex items-center justify-end gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-ink-400" />
              {new Date(invoice.issuedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Billed & Shipped To Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-sand-200 text-xs leading-relaxed">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2">
              Billed & Shipped To
            </h2>
            <p className="text-sm font-bold text-ink-900 mb-1">
              {typeof invoice.user === 'object' && invoice.user?.name
                ? invoice.user.name
                : 'Valued Customer'}
            </p>
            {typeof invoice.user === 'object' && invoice.user?.email && (
              <p className="text-ink-600 mb-1.5">{invoice.user.email}</p>
            )}
            <p className="text-ink-700">{snapshot.shippingAddress.line1}</p>
            {snapshot.shippingAddress.line2 && (
              <p className="text-ink-700">{snapshot.shippingAddress.line2}</p>
            )}
            <p className="text-ink-700">
              {snapshot.shippingAddress.city}, {snapshot.shippingAddress.province}{' '}
              {snapshot.shippingAddress.postalCode}
            </p>
            <p className="text-ink-700">{snapshot.shippingAddress.country}</p>
          </div>

          <div className="sm:text-right flex flex-col justify-start sm:items-end">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2">
              Payment Summary
            </h2>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Status: {snapshot.paymentStatus.toUpperCase()}</span>
            </div>
            <p className="text-ink-600">
              Method:{' '}
              <strong className="text-ink-900 capitalize">
                {snapshot.paymentMethod === 'reward_points'
                  ? 'Reward Points'
                  : snapshot.paymentMethod === 'simulated_online'
                  ? 'Online Card'
                  : 'Bank Transfer'}
              </strong>
            </p>
            {isRewardPoints && (
              <p className="text-amber-800 font-semibold mt-1">
                Points Redeemed: {(snapshot.pointsUsed || 0).toLocaleString()} pts
              </p>
            )}
          </div>
        </div>

        {/* Reward Points Banner on Invoice when Applicable */}
        {isRewardPoints && (
          <div className="my-6 p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                Paid with Reward Points ({(snapshot.pointsUsed || 0).toLocaleString()} pts)
              </p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                The total balance for this invoice was settled in full using customer loyalty reward points at the standard conversion value.
              </p>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="py-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-3">
            Order Items ({snapshot.items.reduce((s, i) => s + i.quantity, 0)})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 bg-sand-50/70 text-ink-600 font-semibold">
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Size / Color</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {snapshot.items.map((item, idx) => {
                  const lineTotal = item.unitPrice * item.quantity;
                  return (
                    <tr key={idx} className="hover:bg-sand-50/40">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-ink-950 block">{item.name}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-ink-600 text-[11px]">
                        {item.variantSku || '-'}
                      </td>
                      <td className="py-3 px-3 text-ink-600">
                        {item.size || '-'} / {item.color || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-ink-900">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-3 text-right text-ink-600">
                        ${item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-ink-950">
                        ${lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="border-t border-sand-200 pt-6 flex flex-col sm:flex-row justify-between items-start gap-6">
          <div className="w-full sm:max-w-xs space-y-2 text-xs text-ink-500">
            <p className="font-semibold text-ink-700">Payment Authorization</p>
            <p>
              Transaction verified and completed electronically. All taxes included where applicable.
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between text-ink-600">
              <span>Subtotal</span>
              <span className="font-medium text-ink-900">${snapshot.subtotal.toFixed(2)}</span>
            </div>

            {snapshot.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount</span>
                <span>-${snapshot.discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-ink-600">
              <span>Shipping Fee</span>
              <span className="font-medium text-ink-900">
                {snapshot.shippingFee === 0 ? 'FREE' : `$${snapshot.shippingFee.toFixed(2)}`}
              </span>
            </div>

            <div className="border-t border-sand-200 pt-2.5 mt-2 flex justify-between text-sm sm:text-base font-bold text-ink-950">
              <span>Total Paid</span>
              <span>${snapshot.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-sand-200 mt-10 pt-6 text-center text-[11px] text-ink-400">
          <p>Thank you for choosing Larvo Atelier. For any order or delivery inquiries, please consult your account portal.</p>
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;
