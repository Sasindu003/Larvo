import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  MapPin,
  User,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  ExternalLink,
  Edit3,
  Save,
  X,
  Calendar,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  orderService,
  AdminOrder,
  OrderStatus,
} from '../../services/order.service';

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  processing: {
    label: 'Processing',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    icon: Package,
  },
  ready_for_dispatch: {
    label: 'Ready for Dispatch',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    icon: Package,
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    icon: Truck,
  },
  in_transit: {
    label: 'In Transit',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    icon: Truck,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
  },
};

const NEXT_STATUS_MAP: Record<
  string,
  { next: OrderStatus; label: string; color: string }
> = {
  processing: {
    next: 'ready_for_dispatch',
    label: 'Mark Ready for Dispatch',
    color: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  ready_for_dispatch: {
    next: 'picked_up',
    label: 'Confirm Courier Pickup',
    color: 'bg-violet-600 hover:bg-violet-500 text-white',
  },
  picked_up: {
    next: 'in_transit',
    label: 'Mark In Transit',
    color: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  in_transit: {
    next: 'out_for_delivery',
    label: 'Send Out for Delivery',
    color: 'bg-amber-600 hover:bg-amber-500 text-white',
  },
  out_for_delivery: {
    next: 'delivered',
    label: 'Confirm Delivery',
    color: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
};

export const DeliveryOrdersPage: React.FC = () => {
  const { user } = useAuth();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selected Order Drawer
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Inline Tracking Edit state
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [trackingInputValue, setTrackingInputValue] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);

  // Action in progress
  const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderService.getDeliveryOrders({
        page,
        limit: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      setOrders(res.orders || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch delivery orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── One-Tap Advance ────────────────────────────────────────────────────────
  const handleAdvanceStatus = async (order: AdminOrder) => {
    const transition = NEXT_STATUS_MAP[order.status];
    if (!transition) return;

    setAdvancingOrderId(order._id);
    try {
      const res = await orderService.updateOrderStatus(order._id, transition.next);
      toast.success(`Order advanced to ${STATUS_CONFIG[transition.next]?.label || transition.next}`);

      // Update in list
      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? { ...o, ...res.order } : o))
      );

      // Update in drawer if open
      if (selectedOrder?._id === order._id) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...res.order } : null));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to advance status');
    } finally {
      setAdvancingOrderId(null);
    }
  };

  // ── Save Tracking Number ───────────────────────────────────────────────────
  const handleSaveTracking = async (orderId: string) => {
    if (!trackingInputValue.trim()) {
      toast.error('Tracking number cannot be empty');
      return;
    }

    setSavingTracking(true);
    try {
      const res = await orderService.updateOrderTracking(orderId, trackingInputValue.trim());
      toast.success('Tracking number saved');

      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, ...res.order } : o))
      );

      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...res.order } : null));
      }

      setEditingTrackingId(null);
      setTrackingInputValue('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tracking');
    } finally {
      setSavingTracking(false);
    }
  };

  const startEditTracking = (order: AdminOrder) => {
    setEditingTrackingId(order._id);
    setTrackingInputValue(order.trackingNumber || '');
  };

  // ── Open Drawer ────────────────────────────────────────────────────────────
  const handleOpenDrawer = async (order: AdminOrder) => {
    setSelectedOrder(order);
    setDrawerLoading(true);
    try {
      const res = await orderService.getOrderById(order._id);
      setSelectedOrder((prev) => (prev ? { ...prev, ...res.order } : null));
    } catch {
      // Keep existing
    } finally {
      setDrawerLoading(false);
    }
  };

  const getCustomerName = (order: AdminOrder): string => {
    if (typeof order.user === 'object' && order.user !== null) {
      return (order.user as any).name || 'Customer';
    }
    return 'Customer';
  };

  // Calculate quick stats from current list
  const queueStats = {
    total,
    processing: orders.filter((o) => o.status === 'processing').length,
    ready: orders.filter((o) => o.status === 'ready_for_dispatch').length,
    inTransit: orders.filter((o) => o.status === 'in_transit' || o.status === 'picked_up').length,
    outForDelivery: orders.filter((o) => o.status === 'out_for_delivery').length,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Page Header & Stats ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                  Fulfillment & Delivery Queue
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage courier dispatches, update tracking, and advance order fulfillment states.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchOrders()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>

        {/* ── Filter Tabs & Search Bar ───────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Active Queue' },
              { id: 'processing', label: 'Processing' },
              { id: 'ready_for_dispatch', label: 'Ready for Dispatch' },
              { id: 'picked_up', label: 'Picked Up' },
              { id: 'in_transit', label: 'In Transit' },
              { id: 'out_for_delivery', label: 'Out for Delivery' },
              { id: 'delivered', label: 'Delivered' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px] sm:min-w-[320px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order ID, Tracking #, City..."
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Orders Queue List ─────────────────────────────────────────── */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading fulfillment orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center bg-slate-900/40 border border-slate-800/60 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200 font-display">No Orders in Queue</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no orders matching the selected status or search filter in the fulfillment pipeline.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.processing;
              const StatusIcon = cfg.icon;
              const nextStep = NEXT_STATUS_MAP[order.status];
              const isAdvancing = advancingOrderId === order._id;
              const isEditingTracking = editingTrackingId === order._id;

              return (
                <div
                  key={order._id}
                  className="bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Order ID & Customer */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white tracking-wide">
                          #{order._id.slice(-8).toUpperCase()}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(order._id, order._id)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                          title="Copy Full ID"
                        >
                          {copiedId === order._id ? (
                            <Check className="w-3.5 h-3.5 text-teal-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium text-slate-300">{getCustomerName(order)}</span>
                        <span>•</span>
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>

                    {/* Quick View Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer(order)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1"
                    >
                      Inspect Order
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  {/* Destination & Manifest & Tracking Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800/80 text-xs">
                    {/* Destination Address */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Delivery Destination
                      </span>
                      <div className="flex items-start gap-2 text-slate-300">
                        <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <p className="font-medium text-white">{order.shippingAddress.line1}</p>
                          {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                          <p>
                            {order.shippingAddress.city}, {order.shippingAddress.province || ''}{' '}
                            {order.shippingAddress.postalCode}
                          </p>
                          <p className="text-slate-400">{order.shippingAddress.country}</p>
                        </div>
                      </div>
                    </div>

                    {/* Package Manifest */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Items Manifest ({order.items.reduce((s, it) => s + it.quantity, 0)} units)
                      </span>
                      <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-300">
                            <span className="truncate pr-2 text-slate-200">
                              {item.name}{' '}
                              <span className="text-slate-400 font-mono text-[11px]">
                                ({item.size}/{item.color})
                              </span>
                            </span>
                            <span className="font-bold text-sky-400 font-mono shrink-0">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Courier Tracking Field */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Courier Tracking Number
                      </span>
                      {isEditingTracking ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={trackingInputValue}
                            onChange={(e) => setTrackingInputValue(e.target.value)}
                            placeholder="e.g. TRK-8726154"
                            className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-sky-500/50 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-400"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTracking(order._id)}
                            disabled={savingTracking}
                            className="p-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
                            title="Save"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTrackingId(null)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                          {order.trackingNumber ? (
                            <span className="font-mono text-xs text-sky-300 font-semibold tracking-wide">
                              {order.trackingNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs italic">
                              No tracking assigned
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditTracking(order)}
                            className="p-1 text-slate-400 hover:text-sky-300 rounded hover:bg-slate-800"
                            title="Edit Tracking Number"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {order.deliveredAt && (
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1 pt-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Delivered on {new Date(order.deliveredAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* One-Tap Advance Button Bar */}
                  {nextStep && (
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4">
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                        Next Fulfillment Stage:{' '}
                        <span className="text-slate-200 font-semibold">
                          {STATUS_CONFIG[nextStep.next]?.label || nextStep.next}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(order)}
                        disabled={isAdvancing}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 ${nextStep.color} disabled:opacity-50`}
                      >
                        {isAdvancing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Truck className="w-3.5 h-3.5" />
                        )}
                        {nextStep.label}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Page {page} of {pages} ({total} fulfillment orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Slide-in Order Details Drawer ───────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold font-display text-white">
                    Order #{selectedOrder._id.slice(-8).toUpperCase()}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      STATUS_CONFIG[selectedOrder.status]?.bg || ''
                    } ${STATUS_CONFIG[selectedOrder.status]?.text || ''} ${
                      STATUS_CONFIG[selectedOrder.status]?.border || ''
                    }`}
                  >
                    {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Customer: {getCustomerName(selectedOrder)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerLoading && (
                <div className="flex items-center justify-center py-2 text-xs text-sky-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Refreshing order details...
                </div>
              )}

              {/* Delivery Destination Card */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  Shipping Destination
                </div>
                <div className="text-xs text-slate-300 space-y-0.5 pl-6">
                  <p className="font-semibold text-white text-sm">
                    {selectedOrder.shippingAddress.line1}
                  </p>
                  {selectedOrder.shippingAddress.line2 && (
                    <p>{selectedOrder.shippingAddress.line2}</p>
                  )}
                  <p>
                    {selectedOrder.shippingAddress.city},{' '}
                    {selectedOrder.shippingAddress.province || ''}{' '}
                    {selectedOrder.shippingAddress.postalCode}
                  </p>
                  <p className="text-slate-400">{selectedOrder.shippingAddress.country}</p>
                </div>
              </div>

              {/* Items Manifest */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-sky-400" />
                    Package Items ({selectedOrder.items.length})
                  </span>
                  <span className="font-mono text-slate-400">
                    Total: {selectedOrder.items.reduce((s, it) => s + it.quantity, 0)} pcs
                  </span>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-slate-200">{item.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          SKU: {item.variantSku} | Size: {item.size} | Color: {item.color}
                        </p>
                      </div>
                      <span className="font-bold text-sm text-sky-400 font-mono">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tracking Assignment Card */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-400" />
                    Tracking Information
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      defaultValue={selectedOrder.trackingNumber || ''}
                      id="drawerTrackingInput"
                      placeholder="Enter courier tracking number..."
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = (
                          document.getElementById('drawerTrackingInput') as HTMLInputElement
                        )?.value;
                        if (val) handleSaveTracking(selectedOrder._id);
                      }}
                      disabled={savingTracking}
                      className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                  {selectedOrder.deliveredAt && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1 pt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Package marked delivered at:{' '}
                      {new Date(selectedOrder.deliveredAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Status Advance Action inside Drawer */}
              {NEXT_STATUS_MAP[selectedOrder.status] && (
                <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-sky-300 block">
                      Advance Fulfillment Stage
                    </span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Move order from{' '}
                      <span className="text-white font-semibold capitalize">
                        {selectedOrder.status.replace(/_/g, ' ')}
                      </span>{' '}
                      to{' '}
                      <span className="text-sky-300 font-semibold capitalize">
                        {NEXT_STATUS_MAP[selectedOrder.status].next.replace(/_/g, ' ')}
                      </span>
                      .
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(selectedOrder)}
                    disabled={advancingOrderId === selectedOrder._id}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 ${
                      NEXT_STATUS_MAP[selectedOrder.status].color
                    }`}
                  >
                    {advancingOrderId === selectedOrder._id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                    {NEXT_STATUS_MAP[selectedOrder.status].label}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrdersPage;
