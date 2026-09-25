import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Search,
  RefreshCw,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  DollarSign,
  FileText,
  Ban,
  Calendar,
  Check,
  ExternalLink,
  Send,
  AlertCircle,
  Inbox,
  CreditCard,
  Archive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  purchaseOrderService,
  IPurchaseOrder,
  POStatus,
  SubmitQuoteLineInput,
  getFileUrl,
} from '../../services/purchase-order.service';

// ── Status Badge Component covering all 12 statuses ──────────────────────────
export const POStatusBadge: React.FC<{ status: POStatus }> = ({ status }) => {
  const configs: Record<POStatus, { label: string; bg: string; text: string; border: string }> = {
    requested: {
      label: 'Request Received',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
    },
    quoted: {
      label: 'Quotation Submitted',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/20',
    },
    declined: {
      label: 'Declined by You',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/20',
    },
    admin_approved: {
      label: 'Quote Accepted by Admin',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    admin_rejected: {
      label: 'Quote Rejected by Admin',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
    },
    payment_submitted: {
      label: 'Payment Slip Uploaded',
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      border: 'border-sky-500/20',
    },
    payment_rejected: {
      label: 'Payment Rejected by You',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/20',
    },
    confirmed: {
      label: 'Payment Confirmed',
      bg: 'bg-teal-500/10',
      text: 'text-teal-400',
      border: 'border-teal-500/20',
    },
    in_transit: {
      label: 'Dispatched / In Transit',
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-400',
      border: 'border-indigo-500/20',
    },
    partially_received: {
      label: 'Partially Received',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      border: 'border-yellow-500/20',
    },
    received: {
      label: 'Completed / Received',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      border: 'border-green-500/20',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/20',
    },
  };

  const c = configs[status] || {
    label: status,
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
};

type TabKey = 'incoming' | 'awaiting_payment' | 'active' | 'history' | 'all';

export const SupplierPurchaseOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const isSupplierUser = user?.role === 'supplier' || !!user?.supplierId || user?.role === 'admin' || user?.role === 'owner';

  const [orders, setOrders] = useState<IPurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<TabKey>('incoming');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [reviewPaymentModalOpen, setReviewPaymentModalOpen] = useState(false);
  const [activePO, setActivePO] = useState<IPurchaseOrder | null>(null);

  // Quote Form State
  const [quoteLines, setQuoteLines] = useState<Record<string, { quotedQty: number; quotedUnitCost: number }>>({});
  const [quoteEstDelivery, setQuoteEstDelivery] = useState('');
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Payment Review State
  const [paymentReviewNote, setPaymentReviewNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // ── Fetch Orders ───────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await purchaseOrderService.getSupplierPurchaseOrders({
        page,
        limit: 15,
        search: searchQuery.trim() || undefined,
      });
      setOrders(data.results);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Categorized Tab Filtering ───────────────────────────────────────────────
  const filteredOrders = orders.filter((po) => {
    if (activeTab === 'incoming') {
      return po.status === 'requested';
    }
    if (activeTab === 'awaiting_payment') {
      return ['quoted', 'admin_approved', 'payment_submitted', 'payment_rejected'].includes(po.status);
    }
    if (activeTab === 'active') {
      return ['confirmed', 'in_transit', 'partially_received'].includes(po.status);
    }
    if (activeTab === 'history') {
      return ['received', 'declined', 'cancelled', 'admin_rejected'].includes(po.status);
    }
    return true;
  });

  // Tab count badges
  const counts: Record<TabKey, number> = {
    incoming: orders.filter((o) => o.status === 'requested').length,
    awaiting_payment: orders.filter((o) =>
      ['quoted', 'admin_approved', 'payment_submitted', 'payment_rejected'].includes(o.status)
    ).length,
    active: orders.filter((o) => ['confirmed', 'in_transit', 'partially_received'].includes(o.status)).length,
    history: orders.filter((o) => ['received', 'declined', 'cancelled', 'admin_rejected'].includes(o.status)).length,
    all: orders.length,
  };

  // ── Open Quote Modal ───────────────────────────────────────────────────────
  const openQuoteModal = (po: IPurchaseOrder) => {
    setActivePO(po);
    const initialLines: Record<string, { quotedQty: number; quotedUnitCost: number }> = {};
    for (const item of po.items) {
      initialLines[item.sku] = {
        quotedQty: item.quotedQty > 0 ? item.quotedQty : item.orderedQty,
        quotedUnitCost: item.quotedUnitCost > 0 ? item.quotedUnitCost : item.unitCost || 0,
      };
    }
    setQuoteLines(initialLines);
    setQuoteEstDelivery(
      po.estimatedDeliveryDate ? new Date(po.estimatedDeliveryDate).toISOString().split('T')[0] : ''
    );
    setIsDeclining(false);
    setDeclineReason('');
    setQuoteModalOpen(true);
  };

  // ── Submit Quotation ────────────────────────────────────────────────────────
  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePO) return;

    const lines: SubmitQuoteLineInput[] = activePO.items.map((it) => {
      const q = quoteLines[it.sku] || { quotedQty: it.orderedQty, quotedUnitCost: 0 };
      return {
        sku: it.sku,
        quotedQty: Number(q.quotedQty),
        quotedUnitCost: Number(q.quotedUnitCost),
      };
    });

    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.submitQuote(activePO._id, {
        lines,
        estimatedDeliveryDate: quoteEstDelivery ? new Date(quoteEstDelivery).toISOString() : null,
      });
      toast.success('Quotation submitted to store admin');
      setQuoteModalOpen(false);
      setActivePO(updated);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit quotation');
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── Decline Purchase Order ─────────────────────────────────────────────────
  const handleDeclinePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePO) return;
    if (!declineReason.trim()) {
      toast.error('Please specify a reason for declining this request');
      return;
    }

    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.declinePurchaseOrder(activePO._id, {
        declineReason: declineReason.trim(),
      });
      toast.success('Purchase order request declined');
      setQuoteModalOpen(false);
      setActivePO(updated);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline request');
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── Open Payment Review Modal ───────────────────────────────────────────────
  const openPaymentReviewModal = (po: IPurchaseOrder) => {
    setActivePO(po);
    setPaymentReviewNote('');
    setReviewPaymentModalOpen(true);
  };

  // ── Review Payment (Approve or Reject) ──────────────────────────────────────
  const handleReviewPayment = async (decision: 'approve' | 'reject') => {
    if (!activePO) return;

    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.reviewPayment(activePO._id, {
        decision,
        note: paymentReviewNote.trim() || undefined,
      });
      toast.success(`Payment slip ${decision === 'approve' ? 'approved & confirmed' : 'rejected'}`);
      setReviewPaymentModalOpen(false);
      setActivePO(updated);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${decision} payment slip`);
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── Mark as Shipped ────────────────────────────────────────────────────────
  const handleMarkShipped = async (po: IPurchaseOrder) => {
    if (!window.confirm(`Mark purchase order #${po._id.slice(-6).toUpperCase()} as shipped and in-transit?`)) {
      return;
    }

    try {
      setSubmittingAction(true);
      await purchaseOrderService.markShipped(po._id);
      toast.success('Order marked as shipped and in-transit');
      if (detailModalOpen && activePO?._id === po._id) {
        setDetailModalOpen(false);
      }
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark order as shipped');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Total Quoted Amount in Quote Form
  const totalQuoteSum = activePO
    ? activePO.items.reduce((sum, it) => {
        const q = quoteLines[it.sku];
        return sum + (q ? q.quotedQty * q.quotedUnitCost : 0);
      }, 0)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Package className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              Supplier Purchase Orders
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Review incoming stock requests, submit pricing quotes, verify payment slips, and mark dispatches.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </button>
      </div>

      {/* ── Categorized Tabs & Search Bar ────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              activeTab === 'incoming'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Incoming Requests
            {counts.incoming > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold">
                {counts.incoming}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('awaiting_payment')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              activeTab === 'awaiting_payment'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Awaiting Payment
            {counts.awaiting_payment > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-sky-500/20 text-sky-300 rounded-full text-[10px] font-bold">
                {counts.awaiting_payment}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              activeTab === 'active'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Active Orders
            {counts.active > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded-full text-[10px] font-bold">
                {counts.active}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            History
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All ({counts.all})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO number or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* ── Orders List ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Items / SKUs</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Quoted / Total Cost</th>
                <th className="py-3 px-4">Est. Delivery</th>
                <th className="py-3 px-4">Received Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders in this section.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => {
                  return (
                    <tr key={po._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300 font-semibold">
                        #{po._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                          {po.items.length} {po.items.length === 1 ? 'line' : 'lines'}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          ({po.items.map((i) => i.sku).slice(0, 2).join(', ')}
                          {po.items.length > 2 ? '...' : ''})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <POStatusBadge status={po.status} />
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        ${(po.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {po.estimatedDeliveryDate
                          ? new Date(po.estimatedDeliveryDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Status-specific triggers */}
                          {po.status === 'requested' && isSupplierUser && (
                            <button
                              onClick={() => openQuoteModal(po)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition"
                            >
                              Quote / Decline
                            </button>
                          )}

                          {po.status === 'payment_submitted' && isSupplierUser && (
                            <button
                              onClick={() => openPaymentReviewModal(po)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition"
                            >
                              Review Payment
                            </button>
                          )}

                          {po.status === 'confirmed' && isSupplierUser && (
                            <button
                              onClick={() => handleMarkShipped(po)}
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold transition flex items-center gap-1"
                            >
                              <Truck className="w-3 h-3" />
                              Mark Shipped
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setActivePO(po);
                              setDetailModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700 transition"
                          >
                            Details
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
      </div>

      {/* ── QUOTE & DECLINE MODAL ────────────────────────────────────────────── */}
      {quoteModalOpen && activePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white font-mono">
                  Quote Order #{activePO._id.slice(-6).toUpperCase()}
                </h2>
              </div>
              <button
                onClick={() => setQuoteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switch between Quoting and Declining */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg text-xs">
              <span className="text-slate-400">
                Action: {isDeclining ? 'Decline Request' : 'Submit Quotation'}
              </span>
              <button
                type="button"
                onClick={() => setIsDeclining(!isDeclining)}
                className={`font-semibold transition ${
                  isDeclining ? 'text-indigo-400 hover:text-indigo-300' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                {isDeclining ? '← Back to Quotation' : 'Decline this order instead'}
              </button>
            </div>

            {isDeclining ? (
              /* Decline Form */
              <form onSubmit={handleDeclinePO} className="space-y-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                  <p className="font-semibold">Declining this purchase order:</p>
                  <p className="mt-0.5">
                    This will reject the request. The order will be closed and cannot be quoted later.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Decline Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Provide a reason (e.g. Out of stock, lead time too high, MOQ not met)..."
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDeclining(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction || !declineReason.trim()}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    {submittingAction ? 'Declining...' : 'Confirm Decline'}
                  </button>
                </div>
              </form>
            ) : (
              /* Quotation Form */
              <form onSubmit={handleSubmitQuote} className="space-y-5">
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Item / SKU</th>
                        <th className="py-2.5 px-3">Variant</th>
                        <th className="py-2.5 px-3 text-right">Requested</th>
                        <th className="py-2.5 px-3 text-right w-28">Quoted Qty</th>
                        <th className="py-2.5 px-3 text-right w-32">Unit Price ($)</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activePO.items.map((it) => {
                        const q = quoteLines[it.sku] || { quotedQty: it.orderedQty, quotedUnitCost: 0 };
                        const lineTotal = q.quotedQty * q.quotedUnitCost;

                        return (
                          <tr key={it.sku} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <p className="font-mono font-medium text-indigo-300">{it.sku}</p>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {it.size} / {it.color}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-200">{it.orderedQty}</td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                value={q.quotedQty}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setQuoteLines((prev) => ({
                                    ...prev,
                                    [it.sku]: { ...prev[it.sku], quotedQty: val },
                                  }));
                                }}
                                className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-slate-200 font-mono"
                                required
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={q.quotedUnitCost}
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  setQuoteLines((prev) => ({
                                    ...prev,
                                    [it.sku]: { ...prev[it.sku], quotedUnitCost: val },
                                  }));
                                }}
                                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-slate-200 font-mono"
                                required
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-purple-300 font-mono">
                              ${lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-950/60 border-t border-slate-800 text-xs font-semibold text-slate-200">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 text-right">
                          Total Quoted Quotation:
                        </td>
                        <td className="py-2.5 px-3 text-right text-indigo-400 text-sm font-mono">
                          ${totalQuoteSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Estimated Delivery Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Estimated Delivery / Fulfillment Date (optional)
                  </label>
                  <input
                    type="date"
                    value={quoteEstDelivery}
                    onChange={(e) => setQuoteEstDelivery(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setQuoteModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {submittingAction ? 'Submitting...' : 'Submit Quotation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── PAYMENT REVIEW MODAL ─────────────────────────────────────────────── */}
      {reviewPaymentModalOpen && activePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-white font-mono">
                  Review Payment #{activePO._id.slice(-6).toUpperCase()}
                </h2>
              </div>
              <button
                onClick={() => setReviewPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              The store administrator has uploaded a payment receipt for bank transfer verification. Please verify the
              transaction before approving the order for production/dispatch.
            </p>

            {/* Slip Previewer */}
            <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 text-center">
              {activePO.paymentSlipUrl ? (
                <div className="space-y-3">
                  {activePO.paymentSlipUrl.toLowerCase().endsWith('.pdf') ? (
                    <div className="p-8 text-center bg-slate-900 rounded-lg border border-slate-800">
                      <FileText className="w-12 h-12 text-sky-400 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-200">PDF Payment Document Attached</p>
                      <a
                        href={getFileUrl(activePO.paymentSlipUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium transition"
                      >
                        Open PDF Document <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <img
                        src={getFileUrl(activePO.paymentSlipUrl)}
                        alt="Payment Slip"
                        className="max-h-72 mx-auto rounded-lg object-contain border border-slate-800"
                      />
                      <a
                        href={getFileUrl(activePO.paymentSlipUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        View Full Resolution <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-xs text-rose-400 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  No payment slip file attached to this order.
                </div>
              )}
            </div>

            {/* Optional Note */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Note / Comment (optional for approval, recommended if rejecting)
              </label>
              <textarea
                rows={2}
                value={paymentReviewNote}
                onChange={(e) => setPaymentReviewNote(e.target.value)}
                placeholder="Reference number verified, or explain reason if rejecting..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReviewPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
              >
                Close
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => handleReviewPayment('reject')}
                  className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition"
                >
                  Reject Slip
                </button>
                <button
                  type="button"
                  disabled={submittingAction || !activePO.paymentSlipUrl}
                  onClick={() => handleReviewPayment('approve')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  Confirm & Approve Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAILS MODAL ───────────────────────────────────────────────────── */}
      {detailModalOpen && activePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white font-mono">
                  PO #{activePO._id.slice(-6).toUpperCase()}
                </h2>
                <POStatusBadge status={activePO.status} />
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Declined / Rejected Notes */}
            {activePO.status === 'declined' && activePO.declineReason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                <span className="font-semibold">Decline Reason: </span>
                {activePO.declineReason}
              </div>
            )}

            {activePO.status === 'admin_rejected' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
                <span className="font-semibold">Admin Decision: </span>
                The administrator rejected the quotation for this order.
              </div>
            )}

            {activePO.paymentReviewNote && (
              <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs text-slate-300">
                <span className="font-semibold">Payment Review Note: </span>
                {activePO.paymentReviewNote}
              </div>
            )}

            {/* Line Items */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item / SKU</th>
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3 text-right">Requested</th>
                    <th className="py-2.5 px-3 text-right">Quoted Qty</th>
                    <th className="py-2.5 px-3 text-right">Quoted Cost</th>
                    <th className="py-2.5 px-3 text-right">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activePO.items.map((it) => (
                    <tr key={it.sku} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono font-medium text-indigo-300">{it.sku}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {it.size} / {it.color}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200 font-semibold">{it.orderedQty}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-purple-300">
                        {it.quotedQty > 0 ? it.quotedQty : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {it.quotedUnitCost > 0 ? `$${it.quotedUnitCost.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                        {it.receivedQty || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Order Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <p className="text-slate-500 font-medium">Estimated Delivery</p>
                <p className="text-slate-200 mt-0.5">
                  {activePO.estimatedDeliveryDate
                    ? new Date(activePO.estimatedDeliveryDate).toLocaleDateString()
                    : 'Not specified'}
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <p className="text-slate-500 font-medium">Total Cost</p>
                <p className="text-indigo-400 font-bold mt-0.5">
                  ${(activePO.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <p className="text-slate-500 font-medium">Payment Slip</p>
                {activePO.paymentSlipUrl ? (
                  <a
                    href={getFileUrl(activePO.paymentSlipUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 mt-0.5"
                  >
                    View Document <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-slate-500 mt-0.5">None uploaded</p>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div>
                {activePO.status === 'confirmed' && isSupplierUser && (
                  <button
                    onClick={() => handleMarkShipped(activePO)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Mark Order as Shipped
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
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

export default SupplierPurchaseOrdersPage;
