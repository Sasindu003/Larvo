import React, { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart,
  Search,
  Clock,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Coins,
  RefreshCw,
  Eye,
  ExternalLink,
  Truck,
  Copy,
  Check,
  Package,
  FileText,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Ban,
  User,
  MapPin,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  orderService,
  AdminOrder,
  OrderStatus,
  Payment,
} from '../../services/order.service';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { getApiBaseUrl } from '../../services/api';

// ── Status Config & Colors ───────────────────────────────────────────────────

interface StatusBadgeConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const STATUS_CONFIG: Record<OrderStatus, StatusBadgeConfig> = {
  pending_payment: {
    label: 'Pending Payment',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  payment_review: {
    label: 'Payment Review',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  processing: {
    label: 'Processing',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
  },
  ready_for_dispatch: {
    label: 'Ready for Dispatch',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  in_transit: {
    label: 'In Transit',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
};

const ALL_STATUSES: OrderStatus[] = [
  'pending_payment',
  'payment_review',
  'confirmed',
  'processing',
  'ready_for_dispatch',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

// Helper to get allowed transitions based on status and role
function getAllowedNextStatuses(current: OrderStatus, role?: string): OrderStatus[] {
  const isDeliveryOrSuper = role === 'admin' || role === 'owner' || role === 'delivery_manager';
  const isStaffOrSuper = role === 'staff' || role === 'admin' || role === 'owner';

  switch (current) {
    case 'pending_payment':
      return isStaffOrSuper ? ['cancelled'] : [];
    case 'payment_review':
      return isStaffOrSuper ? ['confirmed', 'pending_payment', 'cancelled'] : [];
    case 'confirmed':
      return isStaffOrSuper ? ['processing', 'cancelled'] : [];
    case 'processing':
      return isStaffOrSuper ? ['ready_for_dispatch', 'cancelled'] : [];
    case 'ready_for_dispatch':
      return isDeliveryOrSuper ? ['picked_up'] : [];
    case 'picked_up':
      return isDeliveryOrSuper ? ['in_transit'] : [];
    case 'in_transit':
      return isDeliveryOrSuper ? ['out_for_delivery'] : [];
    case 'out_for_delivery':
      return isDeliveryOrSuper ? ['delivered'] : [];
    case 'delivered':
    case 'cancelled':
    default:
      return [];
  }
}

export const AdminOrdersPage: React.FC = () => {
  const { user } = useAuth();

  // ── List & Search State ────────────────────────────────────────────────────
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ── Selected Order & Drawer State ──────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Status Transition State ────────────────────────────────────────────────
  const [targetStatus, setTargetStatus] = useState<OrderStatus | ''>('');
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Payment Verification State (P49) ──────────────────────────────────────
  const [rejectionNote, setRejectionNote] = useState('');
  const [reviewingSlip, setReviewingSlip] = useState(false);

  // ── Slip Lightbox Modal ────────────────────────────────────────────────────
  const [lightboxSlipUrl, setLightboxSlipUrl] = useState<string | null>(null);

  // ── Fetch Orders ───────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await orderService.getAdminOrders({
        page,
        limit: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      setOrders(res.orders || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      setListError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  // ── Open Drawer & Sync Selected Order ──────────────────────────────────────
  const handleOpenDrawer = async (order: AdminOrder) => {
    setSelectedOrder(order);
    setTargetStatus('');
    setTrackingNumberInput(order.trackingNumber || '');
    setRejectionNote('');
    setDrawerLoading(true);

    try {
      // Refresh single order details from backend to ensure latest state and payment
      const res = await orderService.getAdminOrderById(order._id);
      setSelectedOrder(res.order);
      setTrackingNumberInput(res.order.trackingNumber || '');
    } catch {
      // Keep existing row data if single fetch fails
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedOrder(null);
    setTargetStatus('');
    setTrackingNumberInput('');
    setRejectionNote('');
  };

  // ── Copy Helper ────────────────────────────────────────────────────────────
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Resolve Slip URL Helper ────────────────────────────────────────────────
  const resolveSlipUrl = (url?: string | null): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const apiBase = getApiBaseUrl();
    const hostBase = apiBase.replace(/\/api\/?$/, '');
    return `${hostBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // ── Transition Status Action ───────────────────────────────────────────────
  const handleTransition = async (nextStatus: OrderStatus, customTracking?: string) => {
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    try {
      const tracking = customTracking !== undefined ? customTracking : trackingNumberInput;
      const res = await orderService.updateOrderStatus(
        selectedOrder._id,
        nextStatus,
        tracking.trim() || undefined
      );
      toast.success(`Order status changed to ${STATUS_CONFIG[nextStatus].label}`);

      // Update in selected drawer
      setSelectedOrder((prev) => (prev ? { ...prev, ...res.order } : null));

      // Refresh table in place
      setOrders((prev) =>
        prev.map((o) => (o._id === selectedOrder._id ? { ...o, ...res.order } : o))
      );

      setTargetStatus('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Payment Verification Workflow (P49) ───────────────────────────────────
  const handleReviewPayment = async (decision: 'approved' | 'rejected') => {
    if (!selectedOrder) return;
    const paymentId = selectedOrder.payment?._id;
    if (!paymentId) {
      toast.error('No payment record associated with this order');
      return;
    }

    if (decision === 'rejected' && !rejectionNote.trim()) {
      toast.error('A rejection reason is required before rejecting a slip');
      return;
    }

    setReviewingSlip(true);
    try {
      const res = await orderService.reviewPayment(
        paymentId,
        decision,
        rejectionNote.trim() || undefined
      );

      toast.success(
        decision === 'approved'
          ? 'Payment slip approved — order confirmed'
          : 'Payment slip rejected — order returned to pending payment'
      );

      // Update in selected drawer with fresh payment and order details
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              ...res.order,
              payment: res.payment,
            }
          : null
      );

      // Refresh table row in place
      setOrders((prev) =>
        prev.map((o) =>
          o._id === selectedOrder._id
            ? { ...o, ...res.order, payment: res.payment }
            : o
        )
      );

      setRejectionNote('');
    } catch (err: any) {
      toast.error(err.message || 'Payment review failed');
    } finally {
      setReviewingSlip(false);
    }
  };

  // ── Customer Display Helper ────────────────────────────────────────────────
  const getCustomerInfo = (order: AdminOrder) => {
    if (typeof order.user === 'object' && order.user !== null) {
      return {
        name: order.user.name || 'Anonymous',
        email: order.user.email || 'No email',
      };
    }
    return { name: 'Customer', email: String(order.user) };
  };

  const allowedNext = selectedOrder
    ? getAllowedNextStatuses(selectedOrder.status, user?.role)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
              <p className="text-sm text-slate-500">
                Track orders, review payment slips, and manage fulfillment workflows.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filters & Search ──────────────────────────────────────────────── */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer name, email, or order ID..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-56 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
              >
                <option value="all">All Statuses</option>
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick status tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Orders ({total})
            </button>
            <button
              onClick={() => setStatusFilter('payment_review')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'payment_review'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              Review Slips
            </button>
            <button
              onClick={() => setStatusFilter('pending_payment')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === 'pending_payment'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Pending Payment
            </button>
            <button
              onClick={() => setStatusFilter('confirmed')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === 'confirmed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              Confirmed
            </button>
            <button
              onClick={() => setStatusFilter('processing')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === 'processing'
                  ? 'bg-cyan-700 text-white'
                  : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200'
              }`}
            >
              Processing
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === 'delivered'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Delivered
            </button>
          </div>
        </div>

        {/* ── Table Container ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {listError && (
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3 text-rose-700 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{listError}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 sm:px-6">Order ID</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Items</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-6">
                        <div className="h-4 bg-slate-200 rounded w-24 mb-1"></div>
                        <div className="h-3 bg-slate-100 rounded w-16"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 rounded w-20"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 rounded w-28 mb-1"></div>
                        <div className="h-3 bg-slate-100 rounded w-36"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 rounded w-12"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 rounded w-16"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 rounded w-24"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-6 bg-slate-200 rounded-full w-24"></div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-8 bg-slate-200 rounded-lg w-16 ml-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-slate-800 mb-1">No orders found</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        No orders match your filter criteria. Try choosing a different status filter or clear your search keyword.
                      </p>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const cust = getCustomerInfo(order);
                    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_payment;
                    const itemsCount = order.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
                    const paymentMethod = order.payment?.method;

                    return (
                      <tr
                        key={order._id}
                        className="hover:bg-slate-50/75 transition-colors group cursor-pointer"
                        onClick={() => handleOpenDrawer(order)}
                      >
                        {/* Order ID */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-900">
                              #{order._id.slice(-6).toUpperCase()}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(order._id, order._id);
                              }}
                              className="text-slate-300 hover:text-slate-600 p-0.5 rounded transition-colors"
                              title="Copy full order ID"
                            >
                              {copiedId === order._id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {order.trackingNumber && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Truck className="w-3 h-3 text-slate-400" />
                              {order.trackingNumber}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          <div className="text-[10px] text-slate-400">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-4 px-4">
                          <div className="font-medium text-slate-900 text-xs sm:text-sm">
                            {cust.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-[180px]">
                            {cust.email}
                          </div>
                        </td>

                        {/* Items */}
                        <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                            <Package className="w-3 h-3 text-slate-500" />
                            {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 text-sm">
                            Rs. {order.total.toLocaleString()}
                          </div>
                          {order.pointsPaid > 0 && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                              <Coins className="w-3 h-3 text-amber-600" />
                              {order.pointsPaid.toLocaleString()} pts
                            </div>
                          )}
                        </td>

                        {/* Payment */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {paymentMethod === 'bank_transfer' ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 w-fit">
                                <FileText className="w-3 h-3 text-purple-600" />
                                Bank Slip
                              </span>
                              {order.payment?.slipImageUrl && (
                                <span className="text-[10px] text-purple-600 font-medium flex items-center gap-1">
                                  Slip attached
                                </span>
                              )}
                            </div>
                          ) : paymentMethod === 'reward_points' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Coins className="w-3 h-3 text-amber-600" />
                              Points
                            </span>
                          ) : paymentMethod === 'simulated_online' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Card (Online)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Unpaid</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.bg} ${st.text} ${st.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(order);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ────────────────────────────────────────────────────── */}
          <div className="py-3 px-6 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{orders.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{total}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-slate-700">
                Page {page} of {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages || loading}
                className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Slide-in Order Details Drawer ────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={handleCloseDrawer}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
              {/* Drawer Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-indigo-300">
                      #{selectedOrder._id}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedOrder._id, 'drawer-id')}
                      className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                      title="Copy full Order ID"
                    >
                      {copiedId === 'drawer-id' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(selectedOrder.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Current status pill */}
                  {(() => {
                    const st = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.pending_payment;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                  <button
                    onClick={handleCloseDrawer}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {drawerLoading && (
                  <div className="flex items-center justify-center py-4 text-xs text-indigo-600 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Refreshing order details...
                  </div>
                )}

                {/* ── Bank Slip Review Alert & Actions (P49) ────────────────── */}
                {selectedOrder.status === 'payment_review' && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <h4 className="text-sm font-semibold text-purple-900">
                          Bank Transfer Slip Needs Verification
                        </h4>
                        <p className="text-xs text-purple-700 leading-relaxed">
                          A customer submitted a deposit receipt. Inspect the slip preview below. If valid, approve to advance the order to confirmed status. If invalid, specify the rejection reason and reject to return the order to pending payment.
                        </p>
                      </div>
                    </div>

                    {/* Rejection Note Field */}
                    <div className="pt-1">
                      <label className="block text-xs font-semibold text-purple-950 mb-1">
                        Rejection Reason <span className="text-rose-500 font-normal">(required if rejecting)</span>
                      </label>
                      <textarea
                        value={rejectionNote}
                        onChange={(e) => setRejectionNote(e.target.value)}
                        placeholder="State why the slip is invalid (e.g. Deposit amount mismatch, receipt illegible, incorrect reference)..."
                        rows={2}
                        className="w-full text-xs p-2.5 rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white placeholder:text-slate-400 text-slate-800"
                        disabled={reviewingSlip || updatingStatus}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-purple-100">
                      <button
                        onClick={() => handleReviewPayment('approved')}
                        disabled={reviewingSlip || updatingStatus}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                      >
                        {reviewingSlip ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                        Approve Slip (Confirm)
                      </button>
                      <button
                        onClick={() => handleReviewPayment('rejected')}
                        disabled={reviewingSlip || updatingStatus || !rejectionNote.trim()}
                        title={!rejectionNote.trim() ? 'Please provide a rejection reason' : 'Reject slip'}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reviewingSlip ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4 text-rose-600" />
                        )}
                        Reject Slip (Return to Pending)
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Status Transition Controls ────────────────────────────── */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Order Status Control
                  </h3>

                  {allowedNext.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                      This order is in a terminal state ({STATUS_CONFIG[selectedOrder.status]?.label}). No further status transitions are allowed.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={targetStatus}
                          onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
                          className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                        >
                          <option value="">Select next status transition...</option>
                          {allowedNext.map((st) => (
                            <option key={st} value={st}>
                              Advance to: {STATUS_CONFIG[st].label}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => {
                            if (targetStatus) {
                              handleTransition(targetStatus);
                            }
                          }}
                          disabled={!targetStatus || updatingStatus}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {updatingStatus ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          Update Status
                        </button>
                      </div>

                      {/* Optional Tracking Number input */}
                      <div className="pt-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Tracking Number (optional courier tracking ID)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={trackingNumberInput}
                            onChange={(e) => setTrackingNumberInput(e.target.value)}
                            placeholder="e.g. SLPOST-9823481 or COURIER-XYZ"
                            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {selectedOrder.trackingNumber !== trackingNumberInput && (
                            <button
                              onClick={() => handleTransition(selectedOrder.status, trackingNumberInput)}
                              disabled={updatingStatus}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              Save Tracking
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Customer & Shipping Address ───────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Card */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <User className="w-3.5 h-3.5" />
                      Customer Info
                    </div>
                    {(() => {
                      const cust = getCustomerInfo(selectedOrder);
                      return (
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-slate-900 text-sm">{cust.name}</p>
                          <p className="text-slate-500">{cust.email}</p>
                          {typeof selectedOrder.user === 'object' && selectedOrder.user?._id && (
                            <p className="text-[10px] font-mono text-slate-400 pt-1">
                              ID: {selectedOrder.user._id}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Address Card */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      Shipping Address
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <p className="font-medium text-slate-800">
                        {selectedOrder.shippingAddress.line1}
                      </p>
                      {selectedOrder.shippingAddress.line2 && (
                        <p>{selectedOrder.shippingAddress.line2}</p>
                      )}
                      <p>
                        {selectedOrder.shippingAddress.city}
                        {selectedOrder.shippingAddress.province
                          ? `, ${selectedOrder.shippingAddress.province}`
                          : ''}{' '}
                        {selectedOrder.shippingAddress.postalCode}
                      </p>
                      <p className="font-medium text-slate-700">
                        {selectedOrder.shippingAddress.country}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Payment Information & Slip Viewer ───────────────────────── */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Payment Verification
                    </h3>
                    {selectedOrder.payment && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                          selectedOrder.payment.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : selectedOrder.payment.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        Payment: {selectedOrder.payment.status}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Method:</span>{' '}
                      <span className="font-semibold text-slate-800 capitalize">
                        {selectedOrder.payment?.method?.replace('_', ' ') || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Amount:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        Rs. {(selectedOrder.payment?.amount ?? selectedOrder.total).toLocaleString()}
                      </span>
                    </div>
                    {selectedOrder.pointsPaid > 0 && (
                      <div className="sm:col-span-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-800">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-amber-600" />
                          <span className="font-medium">Paid with Reward Points:</span>
                        </div>
                        <span className="font-bold text-sm">
                          {selectedOrder.pointsPaid.toLocaleString()} Points
                        </span>
                      </div>
                    )}
                    {selectedOrder.payment?.transactionId && (
                      <div>
                        <span className="text-slate-400">Transaction ID:</span>{' '}
                        <span className="font-mono text-slate-700">
                          {selectedOrder.payment.transactionId}
                        </span>
                      </div>
                    )}
                    {selectedOrder.payment?.maskedCardLast4 && (
                      <div>
                        <span className="text-slate-400">Card ending:</span>{' '}
                        <span className="font-mono text-slate-700">
                          •••• {selectedOrder.payment.maskedCardLast4}
                        </span>
                      </div>
                    )}
                    {selectedOrder.payment?.reviewedAt && (
                      <div className="sm:col-span-2 text-slate-500">
                        Reviewed at: {new Date(selectedOrder.payment.reviewedAt).toLocaleString()}
                      </div>
                    )}
                    {selectedOrder.payment?.reviewNote && (
                      <div
                        className={`sm:col-span-2 p-3 rounded-xl border text-xs space-y-1 ${
                          selectedOrder.payment.status === 'rejected'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <span className="font-semibold flex items-center gap-1.5">
                          {selectedOrder.payment.status === 'rejected' ? (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          Staff Review Note:
                        </span>
                        <p className="leading-relaxed whitespace-pre-wrap pl-5">
                          {selectedOrder.payment.reviewNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bank Slip Thumbnail / Preview */}
                  {selectedOrder.payment?.slipImageUrl && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          Uploaded Bank Deposit Slip
                        </span>
                        <a
                          href={resolveSlipUrl(selectedOrder.payment.slipImageUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Open in new tab
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div
                        onClick={() =>
                          setLightboxSlipUrl(
                            resolveSlipUrl(selectedOrder.payment?.slipImageUrl)
                          )
                        }
                        className="relative group cursor-pointer border border-slate-200 rounded-xl overflow-hidden max-w-sm bg-slate-100 hover:border-indigo-400 transition-colors"
                      >
                        <img
                          src={resolveSlipUrl(selectedOrder.payment.slipImageUrl)}
                          alt="Bank Payment Slip"
                          className="w-full h-48 object-cover object-top"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs gap-1.5">
                          <Eye className="w-4 h-4" />
                          Click to enlarge
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Order Items ───────────────────────────────────────────── */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Order Items ({selectedOrder.items?.length || 0})
                  </h3>

                  <div className="divide-y divide-slate-100">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shrink-0">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-xs sm:text-sm">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {item.size && <span>Size: {item.size}</span>}
                              {item.color && <span>Color: {item.color}</span>}
                              <span className="font-mono">SKU: {item.variantSku}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                            Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Rs. {item.unitPrice.toLocaleString()} × {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price Breakdown */}
                  <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>Rs. {selectedOrder.subtotal.toLocaleString()}</span>
                    </div>

                    {(selectedOrder.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span className="flex items-center gap-1">
                          Coupon Discount{' '}
                          {selectedOrder.couponCode && (
                            <span className="font-mono text-[10px] bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                              {selectedOrder.couponCode}
                            </span>
                          )}
                        </span>
                        <span>- Rs. {(selectedOrder.discountAmount || 0).toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-slate-600">
                      <span>Shipping Fee</span>
                      <span>
                        {selectedOrder.shippingFee === 0
                          ? 'FREE'
                          : `Rs. ${selectedOrder.shippingFee.toLocaleString()}`}
                      </span>
                    </div>

                    {selectedOrder.pointsPaid > 0 && (
                      <div className="flex justify-between text-amber-700 font-medium">
                        <span className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-600" />
                          Reward Points Used
                        </span>
                        <span>{selectedOrder.pointsPaid.toLocaleString()} pts</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                      <span>Grand Total</span>
                      <span>Rs. {selectedOrder.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Slip Lightbox Modal ────────────────────────────────────────── */}
      {lightboxSlipUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Bank Transfer Slip Inspection
              </span>
              <button
                onClick={() => setLightboxSlipUrl(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100 max-h-[calc(90vh-60px)]">
              <img
                src={lightboxSlipUrl}
                alt="Bank slip full resolution"
                className="max-w-full max-h-full object-contain rounded-lg shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
