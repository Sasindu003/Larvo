import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Coins,
  Package,
  ShoppingBag,
  MapPin,
  CreditCard,
  FileText,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { Order, Payment } from '../../services/order.service';
import { Button } from '../../components/ui/Button';
import { PaymentMethod } from './types';

interface ConfirmationStepProps {
  createdOrder: Order | null;
  submittedPayment: Payment | null;
  paymentMethod: PaymentMethod | null;
  userName?: string;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  createdOrder,
  submittedPayment,
  paymentMethod,
  userName,
}) => {
  const method = submittedPayment?.method || (createdOrder?.pointsPaid ? 'reward_points' : paymentMethod);
  const isPoints = method === 'reward_points';
  const isBank = method === 'bank_transfer';
  const pointsUsedCount = submittedPayment?.pointsUsed || createdOrder?.pointsPaid || (createdOrder ? Math.ceil(createdOrder.total / 0.01) : 0);

  return (
    <div className="space-y-6">
      {/* Hero Status Card */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm text-center space-y-5">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
            isBank
              ? 'bg-amber-100 text-amber-700 ring-8 ring-amber-50'
              : 'bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50'
          }`}
        >
          {isBank ? (
            <Clock className="w-8 h-8 text-amber-600" />
          ) : isPoints ? (
            <Coins className="w-8 h-8 text-emerald-600" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                isBank
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isBank
                ? 'Under Review'
                : isPoints
                ? 'Confirmed - Paid with Reward Points'
                : 'Confirmed'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-950">
            {isBank ? 'Payment Under Review' : 'Order Confirmed!'}
          </h2>

          <p className="text-sm text-ink-600 max-w-xl mx-auto leading-relaxed">
            {isBank
              ? 'Your bank transfer receipt was received and is currently under review by our operations team. You will receive an email confirmation once verified.'
              : isPoints
              ? `Your order was paid in full using ${pointsUsedCount.toLocaleString()} reward points and is now confirmed. No further payment is needed.`
              : `Your simulated card payment (•••• ${submittedPayment?.maskedCardLast4 || '4242'}) was authorized successfully. We have received your order and are preparing your shipment.`}
          </p>
        </div>

        {createdOrder && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
            <div className="bg-sand-100 border border-sand-200 px-3.5 py-1.5 rounded-lg font-mono font-bold text-ink-950">
              Order #{createdOrder.orderNumber || createdOrder._id.slice(-8).toUpperCase()}
            </div>
            {submittedPayment?.transactionId && submittedPayment.transactionId !== 'declined' && (
              <div className="bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-lg font-mono text-ink-600 text-[11px]">
                TXN: {submittedPayment.transactionId}
              </div>
            )}
            <div className="bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-lg text-ink-600">
              Status: <span className="font-semibold text-ink-900 capitalize">{createdOrder.status.replace('_', ' ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Purchased Items Section */}
      {createdOrder && createdOrder.items && createdOrder.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-sand-100">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-ink-700" />
              <h3 className="font-display font-bold text-ink-950 text-base">
                Purchased Items ({createdOrder.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0})
              </h3>
            </div>
            <span className="text-xs text-ink-500 font-medium">Standard Delivery</span>
          </div>

          <div className="divide-y divide-sand-100">
            {createdOrder.items.map((item, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-14 h-14 object-cover rounded-xl border border-sand-200 bg-sand-50 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-sand-200 bg-sand-50 flex items-center justify-center flex-shrink-0 text-ink-400">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-ink-950 truncate">
                      {item.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500 mt-0.5">
                      {item.size && <span>Size: <strong className="text-ink-700">{item.size}</strong></span>}
                      {item.size && item.color && <span>•</span>}
                      {item.color && <span>Color: <strong className="text-ink-700">{item.color}</strong></span>}
                      <span>•</span>
                      <span>Qty: <strong className="text-ink-700">{item.quantity}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-bold text-ink-950">
                    Rs. {((item.lineTotal ?? (item.unitPrice * item.quantity)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  {item.quantity > 1 && (
                    <p className="text-[11px] text-ink-500">
                      Rs. {(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} each
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery & Payment Details Grid */}
      {createdOrder && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Delivery Address Card */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-ink-800 font-semibold text-sm">
              <MapPin className="w-4 h-4 text-ink-600" />
              <span>Delivery Address</span>
            </div>
            <div className="text-xs text-ink-600 space-y-1 pl-6">
              <p className="font-semibold text-ink-950 text-sm">{userName || 'Customer'}</p>
              <p>{createdOrder.shippingAddress?.line1}</p>
              {createdOrder.shippingAddress?.line2 && <p>{createdOrder.shippingAddress.line2}</p>}
              <p>
                {createdOrder.shippingAddress?.city}, {createdOrder.shippingAddress?.province || ''} {createdOrder.shippingAddress?.postalCode}
              </p>
              <p>{createdOrder.shippingAddress?.country}</p>
            </div>
          </div>

          {/* Payment Summary Card */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-ink-800 font-semibold text-sm">
              <CreditCard className="w-4 h-4 text-ink-600" />
              <span>Payment Breakdown</span>
            </div>
            <div className="space-y-1.5 text-xs text-ink-600 pl-6">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium text-ink-900">
                  Rs. {(createdOrder.subtotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {((createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0) > 0) && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount:</span>
                  <span>-Rs. {(createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span className="font-medium text-ink-900">
                  {(createdOrder.shippingFee ?? 0) === 0 ? 'FREE' : `Rs. ${(createdOrder.shippingFee ?? 0).toFixed(2)}`}
                </span>
              </div>
              <div className="border-t border-sand-200 pt-2 flex justify-between font-bold text-sm text-ink-950">
                <span>Total:</span>
                <span>Rs. {(createdOrder.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-1.5 text-[11px] text-ink-500">
                Method:{' '}
                <strong className="text-ink-800 capitalize">
                  {submittedPayment?.method === 'reward_points'
                    ? 'Reward Points'
                    : submittedPayment?.method === 'simulated_online'
                    ? `Online Card (•••• ${submittedPayment.maskedCardLast4 || '4242'})`
                    : 'Bank Transfer'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-sand-50/70 rounded-2xl border border-sand-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {createdOrder && (
            <Link to={`/orders/${createdOrder._id}`} className="w-full sm:w-auto">
              <Button variant="primary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                <span>View Order Details</span>
              </Button>
            </Link>
          )}
          {createdOrder && (
            <Link to={`/orders/${createdOrder._id}/invoice`} className="w-full sm:w-auto">
              <Button
                variant="secondary"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>View & Download Invoice</span>
              </Button>
            </Link>
          )}
        </div>

        <Link to="/" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Button>
        </Link>
      </div>
    </div>
  );
};
