import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Coins,
  Calendar,
  ChevronRight,
  Loader2,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { orderService, Order, OrderStatus as ServiceOrderStatus } from '../services/order.service';
import { returnService, IReturnRequest } from '../services/return.service';
import { OrderDetailSkeleton } from './orders/detail/OrderDetailSkeleton';
import { OrderNotFoundState } from './orders/detail/OrderNotFoundState';
import { OrderDetailView } from './orders/detail/OrderDetailView';

// Re-export types and domain interfaces
export {
  OrderStatus,
  type StatusHistoryEntry,
  type OrderItemDTO,
  type ShippingAddressDTO,
  type PaymentDetailsDTO,
  type DeliveryDetailsDTO,
  type OrderDTO,
  type TimelineStageDefinition,
  type DerivedStage,
  type DerivedTimeline,
} from '../types/order';

// Re-export utility and timeline logic
export {
  TIMELINE_STAGES,
  TERMINAL_STATUSES,
  formatDateRange,
  deriveInvoiceNumber,
  deriveTimeline,
} from './orders/detail/orderTimeline';

export { formatLKR, formatDateTime } from '../utils/format';

// Re-export card and modal components
export { OrderSummaryBar } from './orders/detail/OrderSummaryBar';
export { MilestoneCard } from './orders/detail/MilestoneCard';
export { OrderItemsCard } from './orders/detail/OrderItemsCard';
export { ShippingCard } from './orders/detail/ShippingCard';
export { CostBreakdownCard } from './orders/detail/CostBreakdownCard';
export { PaymentCard } from './orders/detail/PaymentCard';
export { FulfillmentTimeline } from './orders/detail/FulfillmentTimeline';
export { ReturnDetailsCard } from './orders/detail/ReturnDetailsCard';
export { InvoiceModal } from './orders/detail/InvoiceModal';
export { OrderDetailSkeleton } from './orders/detail/OrderDetailSkeleton';
export { OrderNotFoundState } from './orders/detail/OrderNotFoundState';
export { OrderDetailView } from './orders/detail/OrderDetailView';

const STATUS_CONFIG: Record<
  ServiceOrderStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pending_payment: { label: 'Pending Payment', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', icon: <Clock className="w-3.5 h-3.5 text-amber-600" /> },
  payment_review: { label: 'Payment Review', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: <Clock className="w-3.5 h-3.5 text-blue-600" /> },
  confirmed: { label: 'Confirmed', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> },
  processing: { label: 'Processing', bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', icon: <Package className="w-3.5 h-3.5 text-indigo-600" /> },
  ready_for_dispatch: { label: 'Ready for Dispatch', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', icon: <Package className="w-3.5 h-3.5 text-purple-600" /> },
  picked_up: { label: 'Picked Up', bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200', icon: <Truck className="w-3.5 h-3.5 text-violet-600" /> },
  in_transit: { label: 'In Transit', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', icon: <Truck className="w-3.5 h-3.5 text-sky-600" /> },
  out_for_delivery: { label: 'Out for Delivery', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', icon: <Truck className="w-3.5 h-3.5 text-amber-600" /> },
  delivered: { label: 'Delivered', bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: <XCircle className="w-3.5 h-3.5 text-red-600" /> },
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
  const [orderReturn, setOrderReturn] = useState<IReturnRequest | null>(null);

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
  const fetchOrderDetail = async (id: string, silent = false) => {
    if (!silent) setDetailLoading(true);
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
      if (!silent) {
        toast.error(err?.message || 'Failed to load order details');
        navigate('/orders', { replace: true });
      }
    } finally {
      if (!silent) setDetailLoading(false);
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

  // Render Order Detail View
  if (orderId || selectedOrder) {
    if (detailLoading) {
      return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 w-full">
          <OrderDetailSkeleton />
        </div>
      );
    }

    if (!selectedOrder) {
      return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 w-full">
          <OrderNotFoundState onRetry={() => orderId && fetchOrderDetail(orderId)} />
        </div>
      );
    }

    return (
      <OrderDetailView
        order={selectedOrder}
        orderReturn={orderReturn}
        onRefresh={(silent) => fetchOrderDetail(selectedOrder._id, silent)}
        onOrderUpdated={(upd) => {
          setSelectedOrder(upd);
          fetchOrders(page);
        }}
        onReturnUpdated={(ret) => {
          setOrderReturn(ret);
        }}
      />
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
                      Rs. {order.total?.toLocaleString() || '0'}
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
