import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Truck,
  Copy,
  Check,
  ArrowLeft,
  Coins,
  MapPin,
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw,
  Ban,
  ShoppingBag,
  FileText,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { orderService, Order, OrderStatus } from '../services/order.service';
import { returnService, IReturnRequest, ReturnStatus } from '../services/return.service';

const LIFECYCLE_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'pending_payment', label: 'Order Placed', description: 'Awaiting payment confirmation' },
  { status: 'payment_review', label: 'Payment Review', description: 'Manual slip under review' },
  { status: 'confirmed', label: 'Confirmed', description: 'Payment verified & approved' },
  { status: 'processing', label: 'Processing', description: 'Items being picked & packed' },
  { status: 'ready_for_dispatch', label: 'Ready for Dispatch', description: 'Packed & ready at facility' },
  { status: 'picked_up', label: 'Picked Up', description: 'Collected by courier' },
  { status: 'in_transit', label: 'In Transit', description: 'Moving to delivery hub' },
  { status: 'out_for_delivery', label: 'Out for Delivery', description: 'Courier on final route' },
  { status: 'delivered', label: 'Delivered', description: 'Package safely delivered' },
];

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pending_payment: {
    label: 'Pending Payment',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
  },
  payment_review: {
    label: 'Payment Review',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  processing: {
    label: 'Processing',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    icon: <Package className="w-3.5 h-3.5 text-indigo-600" />,
  },
  ready_for_dispatch: {
    label: 'Ready for Dispatch',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: <Package className="w-3.5 h-3.5 text-purple-600" />,
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200',
    icon: <Truck className="w-3.5 h-3.5 text-violet-600" />,
  },
  in_transit: {
    label: 'In Transit',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    icon: <Truck className="w-3.5 h-3.5 text-sky-600" />,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: <Truck className="w-3.5 h-3.5 text-amber-600" />,
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
  },
};

const RETURN_STATUS_CONFIG: Record<
  ReturnStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  requested: {
    label: 'Return Requested',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  approved: {
    label: 'Return Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Return Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  pickup_scheduled: {
    label: 'Pickup Scheduled',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  picked_up: {
    label: 'Package Picked Up',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  received: {
    label: 'Return Received',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    icon: <Package className="w-3.5 h-3.5" />,
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900',
    border: 'border-emerald-300',
    icon: <Coins className="w-3.5 h-3.5" />,
  },
};

export const OrdersPage: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();

  // List state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  // Detail state (when orderId is set or selected)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // Return Request state (P56)
  const [orderReturn, setOrderReturn] = useState<IReturnRequest | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<{
    [itemIndex: number]: { selected: boolean; qty: number; reason: string };
  }>({});
  const [submittingReturn, setSubmittingReturn] = useState<boolean>(false);

  // Fetch paginated list
  const fetchOrders = async (targetPage = 1) => {
    setLoading(true);
    try {
      const res = await orderService.getMyOrders({ page: targetPage, limit: 8 });
      setOrders(res.orders || []);
      setPage(res.page || 1);
      setTotalPages(res.pages || 1);
      setTotalOrders(res.total || 0);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  // Fetch single order detail
  const fetchOrderDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await orderService.getOrderById(id);
      setSelectedOrder(res.order);
      try {
        const returnDoc = await returnService.getReturnByOrderId(id);
        setOrderReturn(returnDoc);
      } catch {
        setOrderReturn(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load order details');
      navigate('/orders', { replace: true });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail(orderId);
    } else {
      setSelectedOrder(null);
      setOrderReturn(null);
      fetchOrders(page);
    }
  }, [orderId, page]);

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(true);
    toast.success('Tracking number copied to clipboard');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setCancelling(true);
    try {
      const res = await orderService.cancelOrder(selectedOrder._id);
      setSelectedOrder(res.order);
      toast.success('Order cancelled successfully');
      setShowCancelModal(false);
      // Refresh list in background
      fetchOrders(page);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenReturnModal = () => {
    if (!selectedOrder) return;
    const initialItems: { [itemIndex: number]: { selected: boolean; qty: number; reason: string } } = {};
    selectedOrder.items.forEach((item, idx) => {
      initialItems[idx] = {
        selected: true,
        qty: item.quantity,
        reason: '',
      };
    });
    setSelectedReturnItems(initialItems);
    setShowReturnModal(true);
  };

  const handleSubmitReturn = async () => {
    if (!selectedOrder) return;
    const chosen = Object.entries(selectedReturnItems)
      .filter(([_, it]) => it.selected)
      .map(([idxStr, it]) => ({
        orderItemRef: Number(idxStr),
        qty: Number(it.qty),
        reason: it.reason.trim(),
      }));

    if (chosen.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    for (const it of chosen) {
      if (!it.reason || it.reason.length < 5) {
        toast.error('Each return item must include a reason of at least 5 characters');
        return;
      }
    }

    setSubmittingReturn(true);
    try {
      const created = await returnService.createReturn({
        orderId: selectedOrder._id,
        items: chosen,
      });
      setOrderReturn(created);
      setShowReturnModal(false);
      toast.success('Return request submitted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Helper to determine step progression
  const getStepIndex = (status: OrderStatus): number => {
    return LIFECYCLE_STEPS.findIndex((s) => s.status === status);
  };

  // Render Order Detail View
  if (orderId || selectedOrder) {
    if (detailLoading) {
      return (
        <div className="max-w-4xl mx-auto py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ink-600 mb-3" />
          <p className="text-sm text-ink-600 font-medium">Loading order details...</p>
        </div>
      );
    }

    if (!selectedOrder) {
      return (
        <div className="max-w-4xl mx-auto py-16 text-center">
          <AlertCircle className="w-10 h-10 text-ink-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-ink-900">Order Not Found</h2>
          <p className="text-sm text-ink-500 mt-1 mb-6">The requested order could not be located or you do not have permission.</p>
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-ink-900 rounded-lg hover:bg-ink-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Orders
          </Link>
        </div>
      );
    }

    const currentStepIdx = getStepIndex(selectedOrder.status);
    const statusCfg = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.pending_payment;
    // P46 customer legality: customer can self-cancel only from pending_payment
    const canCustomerCancel = selectedOrder.status === 'pending_payment';

    // P56 Return Eligibility
    const isDelivered = selectedOrder.status === 'delivered';
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isWithinReturnWindow = selectedOrder.deliveredAt
      ? Date.now() - new Date(selectedOrder.deliveredAt).getTime() <= SEVEN_DAYS_MS
      : false;
    const hasActiveReturn = Boolean(orderReturn && orderReturn.status !== 'rejected');
    const canRequestReturn = isDelivered && isWithinReturnWindow && !hasActiveReturn;
    const returnCfg = orderReturn ? RETURN_STATUS_CONFIG[orderReturn.status] : null;

    return (
      <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to All Orders
          </Link>
          <button
            type="button"
            onClick={() => fetchOrderDetail(selectedOrder._id)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-900 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Order Card Header */}
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-sand-200">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-display font-bold text-ink-950">
                  Order #{selectedOrder._id.slice(-8).toUpperCase()}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  {statusCfg.icon}
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-1 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Placed on {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div className="text-right flex flex-col items-end gap-2">
              <div>
                <span className="text-xs text-ink-500 block">Total Amount</span>
                <span className="text-2xl font-bold font-display text-ink-950">
                  ${selectedOrder.total?.toLocaleString() || '0'}
                </span>
              </div>
              {selectedOrder.status !== 'pending_payment' &&
                selectedOrder.status !== 'payment_review' &&
                selectedOrder.status !== 'cancelled' && (
                  <Link
                    to={`/orders/${selectedOrder._id}/invoice`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-900 bg-sand-100 hover:bg-sand-200 border border-sand-300 rounded-lg transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-ink-600" /> View Invoice
                  </Link>
                )}
            </div>
          </div>

          {/* Reward Points Badge Banner */}
          {selectedOrder.pointsPaid > 0 && (
            <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  Paid with Reward Points ({selectedOrder.pointsPaid.toLocaleString()} pts)
                </p>
                <p className="text-[11px] text-amber-700">
                  Order total fully covered via customer reward balance redemption.
                </p>
              </div>
            </div>
          )}

          {/* Tracking Number Card */}
          {selectedOrder.trackingNumber && (
            <div className="mt-4 p-4 bg-sky-50/80 border border-sky-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 flex-shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-sky-700 block uppercase tracking-wider">
                    Courier Tracking Number
                  </span>
                  <span className="text-sm font-mono font-bold text-sky-950">
                    {selectedOrder.trackingNumber}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyTracking(selectedOrder.trackingNumber!)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-white border border-sky-300 rounded-lg hover:bg-sky-100 transition-colors"
              >
                {copiedTracking ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedTracking ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {/* Cancellation Banner */}
          {selectedOrder.status === 'cancelled' && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider">Order Cancelled</h3>
                <p className="text-xs text-red-700 mt-0.5">
                  This order has been cancelled and will not be processed or delivered. Reserved items were returned to inventory.
                </p>
              </div>
            </div>
          )}

          {/* Slip Rejection Alert Banner (P49) */}
          {selectedOrder.payment?.status === 'rejected' && selectedOrder.payment?.reviewNote && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                  Payment Verification Notice
                </h3>
                <p className="text-xs text-rose-800 leading-relaxed">
                  <span className="font-semibold">Reviewer note: </span>
                  {selectedOrder.payment.reviewNote}
                </p>
                <p className="text-[11px] text-rose-600">
                  Your submitted bank transfer receipt could not be approved. Please upload a valid receipt or contact support.
                </p>
              </div>
            </div>
          )}

          {/* Horizontal Status Timeline */}
          {selectedOrder.status !== 'cancelled' && (
            <div className="mt-8 pt-6 border-t border-sand-100">
              <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-6">
                Fulfillment & Delivery Timeline
              </h3>

              {/* Desktop Horizontal Stepper */}
              <div className="hidden md:block overflow-x-auto pb-4">
                <div className="flex items-center min-w-[700px] justify-between relative">
                  {LIFECYCLE_STEPS.map((step, idx) => {
                    const isCompleted = currentStepIdx > idx || selectedOrder.status === 'delivered';
                    const isCurrent = currentStepIdx === idx && selectedOrder.status !== 'delivered';

                    return (
                      <div key={step.status} className="flex-1 flex flex-col items-center relative text-center px-1">
                        {/* Connecting line */}
                        {idx !== 0 && (
                          <div
                            className={`absolute top-4 -left-1/2 w-full h-0.5 -z-0 transition-colors ${
                              isCompleted || isCurrent ? 'bg-emerald-500' : 'bg-sand-200'
                            }`}
                          />
                        )}

                        {/* Node circle */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold z-10 transition-all ${
                            isCompleted
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : isCurrent
                              ? 'bg-ink-950 text-white ring-4 ring-ink-100 shadow'
                              : 'bg-sand-100 text-ink-400 border border-sand-300'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="w-4 h-4" />
                          ) : isCurrent ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        {/* Label & Description */}
                        <span
                          className={`text-xs mt-2 font-medium leading-tight ${
                            isCurrent
                              ? 'text-ink-950 font-bold'
                              : isCompleted
                              ? 'text-ink-800'
                              : 'text-ink-400'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Vertical Stepper */}
              <div className="md:hidden space-y-4">
                {LIFECYCLE_STEPS.map((step, idx) => {
                  const isCompleted = currentStepIdx > idx || selectedOrder.status === 'delivered';
                  const isCurrent = currentStepIdx === idx && selectedOrder.status !== 'delivered';

                  return (
                    <div key={step.status} className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                            ? 'bg-ink-950 text-white ring-2 ring-ink-200'
                            : 'bg-sand-100 text-ink-400 border border-sand-200'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div>
                        <p
                          className={`text-xs ${
                            isCurrent ? 'font-bold text-ink-950' : isCompleted ? 'font-semibold text-ink-800' : 'text-ink-400'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-ink-400 leading-tight">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Row: Cancel Order button (only when permitted by P46 transition rules) */}
          {canCustomerCancel && (
            <div className="mt-8 pt-6 border-t border-sand-200 flex items-center justify-between gap-4">
              <div className="text-xs text-ink-500">
                <span>Want to change or cancel this order? It can be cancelled while in pending payment.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" /> Cancel Order
              </button>
            </div>
          )}

          {/* Return Status Banner (P56) */}
          {orderReturn && returnCfg && (
            <div
              className={`mt-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${returnCfg.bg} ${returnCfg.border}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-white/80 border ${returnCfg.border} ${returnCfg.text} mt-0.5`}>
                  {returnCfg.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${returnCfg.text}`}>
                      {returnCfg.label}
                    </span>
                    <span className="text-[11px] text-ink-500">
                      • Submitted {new Date(orderReturn.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-ink-700 mt-1">
                    {orderReturn.status === 'requested' && 'Your return request has been received and will be reviewed shortly.'}
                    {orderReturn.status === 'under_review' && 'Our staff is currently reviewing your return request details.'}
                    {orderReturn.status === 'approved' && 'Your return is approved. Courier pickup will be scheduled.'}
                    {orderReturn.status === 'pickup_scheduled' && 'A courier pickup has been scheduled for your return.'}
                    {orderReturn.status === 'picked_up' && 'Courier has picked up your returned package.'}
                    {orderReturn.status === 'received' && 'Package has been received at our inspection facility.'}
                    {orderReturn.status === 'refunded' && `Refund issued${orderReturn.refundPoints ? `: ${orderReturn.refundPoints} reward points credited to your wallet` : ''}.`}
                    {orderReturn.status === 'rejected' && `Return request rejected: ${orderReturn.rejectionReason || 'Does not meet return criteria'}.`}
                  </p>
                </div>
              </div>
              {orderReturn.status === 'rejected' && isWithinReturnWindow && (
                <button
                  type="button"
                  id="request-return-btn"
                  onClick={handleOpenReturnModal}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-ink-900 hover:bg-ink-800 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-apply Return
                </button>
              )}
            </div>
          )}

          {/* Return Order Action Banner (P56) */}
          {canRequestReturn && (
            <div className="mt-8 pt-6 border-t border-sand-200 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-ink-600">
                <span className="font-semibold text-ink-900 block">Need to return this order?</span>
                <span>
                  Eligible for return until{' '}
                  {new Date(new Date(selectedOrder.deliveredAt!).getTime() + SEVEN_DAYS_MS).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  (7-day return window).
                </span>
              </div>
              <button
                type="button"
                id="request-return-btn"
                onClick={handleOpenReturnModal}
                className="px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Request Return
              </button>
            </div>
          )}

          {/* Return Expired Notice */}
          {isDelivered && !isWithinReturnWindow && !orderReturn && (
            <div className="mt-8 pt-6 border-t border-sand-200 text-xs text-ink-400 italic">
              Return window expired for this order (7 days after delivery date).
            </div>
          )}
        </div>

        {/* Two-column Order Details: Items & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Items List (col-span-2) */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-sand-200 shadow-sm p-6">
            <h2 className="text-sm font-bold font-display text-ink-900 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-ink-600" /> Order Items ({selectedOrder.items.length})
            </h2>

            <div className="divide-y divide-sand-100">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="py-3.5 flex items-center gap-4">
                  <div className="w-14 h-16 rounded-lg bg-sand-100 border border-sand-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-sand-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-ink-500">
                      SKU: <span className="font-mono text-ink-600">{item.variantSku}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-ink-600">
                      {item.size && (
                        <span className="px-1.5 py-0.5 bg-sand-100 rounded text-ink-700">Size: {item.size}</span>
                      )}
                      {item.color && (
                        <span className="px-1.5 py-0.5 bg-sand-100 rounded text-ink-700">Color: {item.color}</span>
                      )}
                      <span>Qty: {item.quantity}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-ink-900">
                      ${(item.unitPrice * item.quantity).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-ink-400">${item.unitPrice} each</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Address & Price breakdown */}
          <div className="space-y-6">
            {/* Shipping Address */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6">
              <h2 className="text-sm font-bold font-display text-ink-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-ink-600" /> Shipping Destination
              </h2>
              {selectedOrder.shippingAddress ? (
                <div className="text-xs text-ink-700 space-y-1">
                  {selectedOrder.shippingAddress.label && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-sand-100 text-ink-700 rounded-full mb-1">
                      {selectedOrder.shippingAddress.label}
                    </span>
                  )}
                  <p className="font-medium text-ink-900">{selectedOrder.shippingAddress.line1}</p>
                  {selectedOrder.shippingAddress.line2 && <p>{selectedOrder.shippingAddress.line2}</p>}
                  <p>
                    {selectedOrder.shippingAddress.city}
                    {selectedOrder.shippingAddress.province ? `, ${selectedOrder.shippingAddress.province}` : ''}
                  </p>
                  <p>
                    {selectedOrder.shippingAddress.postalCode}, {selectedOrder.shippingAddress.country}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-400 italic">No shipping address recorded</p>
              )}
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6">
              <h2 className="text-sm font-bold font-display text-ink-900 mb-3">Cost Breakdown</h2>
              <div className="space-y-2 text-xs divide-y divide-sand-50">
                <div className="flex justify-between text-ink-600 pt-1">
                  <span>Subtotal</span>
                  <span className="font-medium text-ink-900">${selectedOrder.subtotal?.toLocaleString() || '0'}</span>
                </div>
                {selectedOrder.discountAmount ? (
                  <div className="flex justify-between text-teal-700 pt-2">
                    <span>Discount {selectedOrder.couponCode ? `(${selectedOrder.couponCode})` : ''}</span>
                    <span className="font-semibold">-${selectedOrder.discountAmount.toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-ink-600 pt-2">
                  <span>Shipping Fee</span>
                  <span className="font-medium text-ink-900">
                    {selectedOrder.shippingFee === 0 ? 'Free' : `$${selectedOrder.shippingFee}`}
                  </span>
                </div>
                <div className="flex justify-between text-ink-950 font-bold text-sm pt-3 border-t border-sand-200">
                  <span>Total</span>
                  <span>${selectedOrder.total?.toLocaleString() || '0'}</span>
                </div>
                {selectedOrder.pointsPaid > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold pt-2">
                    <span>Points Redeemed</span>
                    <span>{selectedOrder.pointsPaid.toLocaleString()} pts</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Verification Details (P49) */}
            {selectedOrder.payment && (
              <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold font-display text-ink-900">Payment Details</h2>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                      selectedOrder.payment.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedOrder.payment.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {selectedOrder.payment.status}
                  </span>
                </div>
                <div className="space-y-2 text-xs divide-y divide-sand-50">
                  <div className="flex justify-between text-ink-600 pt-1">
                    <span>Method</span>
                    <span className="font-medium text-ink-900 capitalize">
                      {selectedOrder.payment.method.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-ink-600 pt-2">
                    <span>Amount</span>
                    <span className="font-medium text-ink-900">
                      ${(selectedOrder.payment.amount ?? selectedOrder.total).toLocaleString()}
                    </span>
                  </div>
                  {selectedOrder.payment.reviewNote && (
                    <div className="pt-2">
                      <span className="font-semibold block text-[10px] text-rose-800 uppercase tracking-wider">
                        Reviewer Feedback:
                      </span>
                      <p className="mt-1 text-rose-700 leading-relaxed bg-rose-50 p-2.5 rounded-lg border border-rose-100 whitespace-pre-wrap">
                        {selectedOrder.payment.reviewNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-sand-200">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-ink-950 font-display">Cancel Order #{selectedOrder._id.slice(-8).toUpperCase()}?</h3>
              <p className="text-xs text-ink-600 mt-2">
                Are you sure you want to cancel this order? Any reserved inventory will be released and this action cannot be undone.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-100 rounded-lg transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancelOrder}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return Request Modal (P56) */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-sand-200 my-8">
              <div className="flex items-center justify-between pb-4 border-b border-sand-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink-950 font-display">
                      Request Return
                    </h3>
                    <p className="text-xs text-ink-500">
                      Order #{selectedOrder._id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="text-ink-400 hover:text-ink-700 p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-ink-600 mt-3 mb-4 leading-relaxed">
                Select the items and quantities you wish to return. Please provide a clear reason for each item (at least 5 characters).
              </p>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {selectedOrder.items.map((item, idx) => {
                  const itemState = selectedReturnItems[idx] || { selected: false, qty: item.quantity, reason: '' };
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        itemState.selected
                          ? 'bg-amber-50/40 border-amber-200 ring-1 ring-amber-200'
                          : 'bg-sand-50/50 border-sand-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`return-item-check-${idx}`}
                          checked={itemState.selected}
                          onChange={(e) => {
                            setSelectedReturnItems((prev) => ({
                              ...prev,
                              [idx]: { ...itemState, selected: e.target.checked },
                            }));
                          }}
                          className="mt-1 h-4 w-4 rounded border-sand-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="w-12 h-14 rounded-lg bg-white border border-sand-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-sand-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-ink-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-ink-500 font-mono">SKU: {item.variantSku}</p>
                          <p className="text-[11px] text-ink-600">
                            Ordered: {item.quantity} • ${item.unitPrice} each
                          </p>
                        </div>
                      </div>

                      {itemState.selected && (
                        <div className="mt-3.5 pt-3 border-t border-amber-200/60 space-y-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-[11px] font-semibold text-ink-700">
                              Return Quantity:
                            </label>
                            <select
                              value={itemState.qty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSelectedReturnItems((prev) => ({
                                  ...prev,
                                  [idx]: { ...itemState, qty: val },
                                }));
                              }}
                              className="text-xs px-2.5 py-1 border border-sand-300 rounded-lg bg-white text-ink-900 focus:ring-amber-500 focus:border-amber-500"
                            >
                              {Array.from({ length: item.quantity }, (_, i) => i + 1).map((q) => (
                                <option key={q} value={q}>
                                  {q} of {item.quantity}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-ink-700 block mb-1">
                              Reason for Return:
                            </label>
                            <textarea
                              rows={2}
                              value={itemState.reason}
                              placeholder="e.g. Size didn't fit, defective seam, received wrong color..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedReturnItems((prev) => ({
                                  ...prev,
                                  [idx]: { ...itemState, reason: val },
                                }));
                              }}
                              className="w-full text-xs p-2.5 border border-sand-300 rounded-lg bg-white text-ink-900 placeholder:text-ink-400 focus:ring-amber-500 focus:border-amber-500 resize-none"
                            />
                            <p className="text-[10px] text-ink-500 text-right">
                              {itemState.reason.length}/500 (min 5 characters)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-sand-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={submittingReturn}
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="submit-return-request-btn"
                  disabled={submittingReturn}
                  onClick={handleSubmitReturn}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {submittingReturn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Orders List View (/orders)
  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink-950">My Orders</h1>
          <p className="text-xs sm:text-sm text-ink-600 mt-1">
            Track your order deliveries, status history, and points payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-500">
            {totalOrders} {totalOrders === 1 ? 'Order' : 'Orders'} Total
          </span>
        </div>
      </div>

      {/* Orders List Content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ink-600 mb-3" />
          <p className="text-sm text-ink-600 font-medium">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-sand-100 flex items-center justify-center text-sand-500 mx-auto mb-4">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-ink-950 font-display">No Orders Yet</h3>
          <p className="text-xs text-ink-500 max-w-sm mx-auto mt-1 mb-6">
            You haven't placed any orders yet. Discover our latest collection and start your wardrobe upgrade!
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-ink-900 rounded-lg hover:bg-ink-800 transition-colors shadow-sm"
          >
            Start Shopping <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_payment;

            return (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-sand-200 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-sand-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-ink-950">
                        #{order._id.slice(-8).toUpperCase()}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                      {order.pointsPaid > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Coins className="w-3 h-3 text-amber-600" />
                          {order.pointsPaid.toLocaleString()} pts
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base sm:text-lg font-bold font-display text-ink-950">
                      ${order.total?.toLocaleString() || '0'}
                    </span>
                    <span className="text-[11px] text-ink-400 block">
                      {order.items.reduce((sum, it) => sum + it.quantity, 0)} items
                    </span>
                  </div>
                </div>

                {/* Items Thumbnails Row */}
                <div className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                    {order.items.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-14 rounded-lg bg-sand-100 border border-sand-200 overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                        title={`${item.name} (${item.quantity})`}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-sand-400" />
                        )}
                        {item.quantity > 1 && (
                          <span className="absolute top-0.5 right-0.5 px-1 py-0.2 text-[9px] font-bold bg-ink-900 text-white rounded-full">
                            {item.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <div className="w-12 h-14 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center text-xs font-semibold text-ink-500">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {order.status !== 'pending_payment' &&
                      order.status !== 'payment_review' &&
                      order.status !== 'cancelled' && (
                        <Link
                          to={`/orders/${order._id}/invoice`}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 bg-white hover:bg-sand-50 border border-sand-300 rounded-lg transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-ink-500" /> Invoice
                        </Link>
                      )}
                    <Link
                      to={`/orders/${order._id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-ink-900 bg-sand-50 hover:bg-sand-100 border border-sand-300 rounded-lg transition-colors"
                    >
                      View Details & Tracking <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium text-ink-700 bg-white border border-sand-200 rounded-lg hover:bg-sand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-ink-600 px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium text-ink-700 bg-white border border-sand-200 rounded-lg hover:bg-sand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
