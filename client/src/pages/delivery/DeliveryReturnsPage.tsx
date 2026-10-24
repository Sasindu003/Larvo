import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  MapPin,
  User,
  Phone,
  Calendar,
  X,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Boxes,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  returnService,
  IReturnRequest,
  ReturnStatus,
} from '../../services/return.service';

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pickup_scheduled: {
    label: 'Pickup Scheduled',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    icon: Clock,
  },
  picked_up: {
    label: 'Picked Up (In Transit)',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    icon: Truck,
  },
  received: {
    label: 'Received at Hub',
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    icon: CheckCircle2,
  },
};

export const DeliveryReturnsPage: React.FC = () => {
  const { user } = useAuth();

  const [returns, setReturns] = useState<IReturnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pickup_scheduled' | 'picked_up'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawer
  const [selectedReturn, setSelectedReturn] = useState<IReturnRequest | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await returnService.getDeliveryReturns({
        page,
        limit: 15,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setReturns(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load return pickups');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleAdvanceStatus = async (
    returnItem: IReturnRequest,
    targetStatus: 'picked_up' | 'received'
  ) => {
    setUpdatingId(returnItem._id);
    try {
      const updated = await returnService.advanceDeliveryReturnStatus(returnItem._id, targetStatus);
      const label = targetStatus === 'picked_up' ? 'Picked Up' : 'Received at Hub';
      toast.success(`Return marked as ${label}`);

      // Update local state or refresh
      setReturns((prev) =>
        prev
          .map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
          // if targetStatus is received, it will naturally drop out of active queue on refresh
      );
      if (selectedReturn?._id === updated._id) {
        setSelectedReturn({ ...selectedReturn, ...updated });
      }
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update pickup status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Client-side search filtering
  const filteredReturns = returns.filter((ret) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = ret._id.toLowerCase().includes(q);
    const orderMatch =
      typeof ret.order === 'object' && ret.order !== null
        ? (ret.order.orderNumber || ret.order._id || '').toLowerCase().includes(q)
        : String(ret.order).toLowerCase().includes(q);
    const userMatch =
      typeof ret.user === 'object' && ret.user !== null
        ? (ret.user.name || '').toLowerCase().includes(q) ||
          (ret.user.email || '').toLowerCase().includes(q) ||
          (ret.user.phone || '').toLowerCase().includes(q)
        : false;
    const skuMatch = ret.items.some((it) => it.sku.toLowerCase().includes(q));
    return idMatch || orderMatch || userMatch || skuMatch;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Return Pickup Queue
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {total} active
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Coordinate customer pickups, scan packages into transit, and receive them into the fulfillment hub.
          </p>
        </div>

        <button
          onClick={() => fetchReturns()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Info Banner ────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-200 mb-0.5">Return Lifecycle Workflow</p>
          <p>
            When an admin approves a return, it enters this queue as <strong className="text-indigo-300">Pickup Scheduled</strong>.
            Confirm pickup once the driver has collected the items (<strong className="text-purple-300">Picked Up</strong>),
            then mark as <strong className="text-teal-300">Received at Hub</strong> upon intake. Admin/Finance then verifies goods and executes customer wallet refunds.
          </p>
        </div>
      </div>

      {/* ── Controls & Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start">
          {[
            { id: 'all', label: 'All Active Pickups' },
            { id: 'pickup_scheduled', label: 'Scheduled' },
            { id: 'picked_up', label: 'In Transit' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-sky-500 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search return #, order #, SKU, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Returns Table / List ────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Return ID</th>
                <th className="py-3.5 px-4">Order / Customer</th>
                <th className="py-3.5 px-4">Pickup Address</th>
                <th className="py-3.5 px-4">Items / Reason</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                    Loading return pickups...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-400">No return pickups found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {statusFilter !== 'all' || searchQuery
                        ? 'Try clearing your filters or search keywords.'
                        : 'There are currently no returns awaiting pickup or delivery intake.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => {
                  const cfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pickup_scheduled;
                  const StatusIcon = cfg.icon;
                  const shortId = ret._id.substring(ret._id.length - 8).toUpperCase();
                  const totalQty = ret.items.reduce((acc, it) => acc + it.qty, 0);

                  const isOrderObj = typeof ret.order === 'object' && ret.order !== null;
                  const orderNum = isOrderObj ? ret.order.orderNumber || ret.order._id : String(ret.order);
                  const isUserObj = typeof ret.user === 'object' && ret.user !== null;
                  const customerName = isUserObj ? ret.user.name || 'Anonymous' : 'Customer';
                  const customerPhone = isUserObj ? ret.user.phone : (isOrderObj ? ret.order.contactPhone : null);

                  const shippingAddr = isOrderObj && ret.order.shippingAddress ? ret.order.shippingAddress : null;

                  return (
                    <tr
                      key={ret._id}
                      onClick={() => setSelectedReturn(ret)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Return ID */}
                      <td className="py-4 px-4 font-mono font-medium text-slate-200">
                        <span className="text-slate-500">#</span>
                        {shortId}
                      </td>

                      {/* Order / Customer */}
                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-200">{customerName}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">
                          Order: <span className="text-sky-400">{orderNum}</span>
                        </p>
                        {customerPhone && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {customerPhone}
                          </p>
                        )}
                      </td>

                      {/* Pickup Address */}
                      <td className="py-4 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {shippingAddr ? (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">
                              {shippingAddr.addressLine1 || shippingAddr.street}
                              {shippingAddr.city ? `, ${shippingAddr.city}` : ''}
                              {shippingAddr.postalCode ? ` ${shippingAddr.postalCode}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">Address on file</span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1 text-slate-200 text-xs font-semibold">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          {totalQty} {totalQty === 1 ? 'item' : 'items'} ({ret.items.length} {ret.items.length === 1 ? 'sku' : 'skus'})
                        </div>
                        <p className="text-xs text-slate-400 italic line-clamp-1 mt-0.5">
                          "{ret.items[0]?.reason}"
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {ret.status === 'pickup_scheduled' && (
                            <button
                              type="button"
                              disabled={updatingId === ret._id}
                              onClick={() => handleAdvanceStatus(ret, 'picked_up')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-xs disabled:opacity-50"
                              title="Mark package as collected by courier"
                            >
                              {updatingId === ret._id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Truck className="w-3.5 h-3.5" />
                              )}
                              Confirm Pickup
                            </button>
                          )}

                          {ret.status === 'picked_up' && (
                            <button
                              type="button"
                              disabled={updatingId === ret._id}
                              onClick={() => handleAdvanceStatus(ret, 'received')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-xs disabled:opacity-50"
                              title="Mark package as received at warehouse"
                            >
                              {updatingId === ret._id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Mark Received
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedReturn(ret)}
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="View return details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────────── */}
        <div className="py-3.5 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/50">
          <div>
            Showing <strong className="text-slate-200">{filteredReturns.length}</strong> of{' '}
            <strong className="text-slate-200">{total}</strong> pickups
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-slate-300">
              Page {page} of {pages}
            </span>
            <button
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Drawer / Modal ───────────────────────────────────────────── */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Return Pickup #{selectedReturn._id.substring(selectedReturn._id.length - 8).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Status Header */}
              {(() => {
                const cfg = STATUS_CONFIG[selectedReturn.status] || STATUS_CONFIG.pickup_scheduled;
                const StatusIcon = cfg.icon;
                return (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
                        Current Status
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase font-semibold text-slate-500 block mb-1">
                        Created On
                      </span>
                      <span className="text-xs text-slate-300">
                        {new Date(selectedReturn.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Customer & Pickup Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Customer Contact
                  </span>
                  <p className="font-semibold text-slate-200">
                    {typeof selectedReturn.user === 'object' && selectedReturn.user !== null
                      ? selectedReturn.user.name
                      : 'Customer'}
                  </p>
                  {typeof selectedReturn.user === 'object' && selectedReturn.user?.email && (
                    <p className="text-slate-400">{selectedReturn.user.email}</p>
                  )}
                  {typeof selectedReturn.user === 'object' && selectedReturn.user?.phone && (
                    <p className="text-slate-400 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {selectedReturn.user.phone}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Pickup Location
                  </span>
                  {typeof selectedReturn.order === 'object' &&
                  selectedReturn.order !== null &&
                  selectedReturn.order.shippingAddress ? (
                    <div className="text-slate-300 leading-relaxed">
                      <p>{selectedReturn.order.shippingAddress.addressLine1 || selectedReturn.order.shippingAddress.street}</p>
                      {selectedReturn.order.shippingAddress.addressLine2 && (
                        <p>{selectedReturn.order.shippingAddress.addressLine2}</p>
                      )}
                      <p>
                        {selectedReturn.order.shippingAddress.city}, {selectedReturn.order.shippingAddress.state || ''}{' '}
                        {selectedReturn.order.shippingAddress.postalCode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">Address details in associated order</p>
                  )}
                </div>
              </div>

              {/* Returned Items */}
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
                  Items to Collect ({selectedReturn.items.reduce((acc, it) => acc + it.qty, 0)} total)
                </h4>
                <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 bg-slate-950/40">
                  {selectedReturn.items.map((it, idx) => (
                    <div key={idx} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                            {it.sku || `Ref #${it.orderItemRef}`}
                          </span>
                          <span className="text-slate-400">
                            Qty: <strong className="text-slate-200">{it.qty}</strong>
                          </span>
                        </div>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Reason: </span>
                          <span className="italic text-slate-300">"{it.reason}"</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedReturn.status === 'pickup_scheduled' && (
                  <button
                    type="button"
                    disabled={updatingId === selectedReturn._id}
                    onClick={() => handleAdvanceStatus(selectedReturn, 'picked_up')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-xs disabled:opacity-50"
                  >
                    {updatingId === selectedReturn._id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Truck className="w-3.5 h-3.5" />
                    )}
                    Confirm Courier Pickup
                  </button>
                )}

                {selectedReturn.status === 'picked_up' && (
                  <button
                    type="button"
                    disabled={updatingId === selectedReturn._id}
                    onClick={() => handleAdvanceStatus(selectedReturn, 'received')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-xs disabled:opacity-50"
                  >
                    {updatingId === selectedReturn._id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Mark Received at Hub
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryReturnsPage;
