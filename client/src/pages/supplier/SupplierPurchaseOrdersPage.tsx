import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  X,
  XCircle,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supplierPortalService } from '../../services/supplier.service';

export interface IPOItem {
  _id?: string;
  product: {
    _id: string;
    name: string;
    slug?: string;
    images?: string[];
    basePrice?: number;
  };
  sku: string;
  size: string;
  color: string;
  orderedQty: number;
  quotedQty?: number;
  receivedQty: number;
  unitCost: number;
}

export interface IPurchaseOrder {
  _id: string;
  supplier: {
    _id: string;
    name: string;
    companyName: string;
    email: string;
    phone?: string;
  };
  items: IPOItem[];
  status:
    | 'draft'
    | 'submitted'
    | 'quoted'
    | 'supplier_rejected'
    | 'confirmed'
    | 'in_transit'
    | 'partially_received'
    | 'received'
    | 'cancelled';
  expectedDeliveryDate?: string | null;
  notes?: string;
  supplierFeedback?: {
    estimatedDeliveryDate?: string | null;
    supplierNotes?: string;
    rejectionReason?: string;
    respondedAt?: string | null;
  };
  cancelReason?: string;
  trackingInfo?: {
    carrier?: string;
    trackingNumber?: string;
    dispatchedAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  totalCost: number;
}

export const SupplierPurchaseOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<IPurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail modal
  const [selectedPO, setSelectedPO] = useState<IPurchaseOrder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Respond & Quote modal
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [respondingPO, setRespondingPO] = useState<IPurchaseOrder | null>(null);
  const [respondAction, setRespondAction] = useState<'confirm' | 'reject'>('confirm');
  const [rejectionReason, setRejectionReason] = useState('');
  const [quoteDeliveryDate, setQuoteDeliveryDate] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteItems, setQuoteItems] = useState<{ sku: string; quotedQty: number; unitCost: number }[]>([]);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Dispatch modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchingPO, setDispatchingPO] = useState<IPurchaseOrder | null>(null);
  const [dispatchCarrier, setDispatchCarrier] = useState('');
  const [dispatchTracking, setDispatchTracking] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierPortalService.getPurchaseOrders({
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setOrders(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOpenDetail = async (po: IPurchaseOrder) => {
    setSelectedPO(po);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const fullPO = await supplierPortalService.getPurchaseOrderById(po._id);
      setSelectedPO(fullPO);
    } catch {
      // Keep basic po in state if fetch fails
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Respond / Quote Modal
  const handleOpenRespond = (po: IPurchaseOrder) => {
    setRespondingPO(po);
    setRespondAction('confirm');
    setRejectionReason('');
    setQuoteDeliveryDate(
      po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().substring(0, 10) : ''
    );
    setQuoteNotes(po.notes || '');
    setQuoteItems(
      (po.items || []).map((it) => ({
        sku: it.sku,
        quotedQty: it.orderedQty,
        unitCost: it.unitCost,
      }))
    );
    setRespondModalOpen(true);
  };

  // Submit Respond (Quotation or Rejection)
  const handleSubmitRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingPO) return;

    if (respondAction === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a reason for declining this request');
      return;
    }

    setSubmittingAction(true);
    try {
      await supplierPortalService.respondPurchaseOrder(respondingPO._id, {
        action: respondAction,
        rejectionReason: respondAction === 'reject' ? rejectionReason : undefined,
        estimatedDeliveryDate:
          respondAction === 'confirm' && quoteDeliveryDate
            ? new Date(quoteDeliveryDate).toISOString()
            : null,
        supplierNotes: respondAction === 'confirm' ? quoteNotes : undefined,
        items: respondAction === 'confirm' ? quoteItems : undefined,
      });

      toast.success(
        respondAction === 'confirm'
          ? 'Quotation and feedback submitted to admin!'
          : 'Order request declined.'
      );
      setRespondModalOpen(false);
      setRespondingPO(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit response');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Open Dispatch Modal
  const handleOpenDispatch = (po: IPurchaseOrder) => {
    setDispatchingPO(po);
    setDispatchCarrier('');
    setDispatchTracking('');
    setDispatchModalOpen(true);
  };

  // Submit Dispatch
  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchingPO) return;

    setSubmittingAction(true);
    try {
      await supplierPortalService.dispatchPurchaseOrder(dispatchingPO._id, {
        carrier: dispatchCarrier,
        trackingNumber: dispatchTracking,
      });

      toast.success('Order marked as in transit!');
      setDispatchModalOpen(false);
      setDispatchingPO(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to mark as dispatched');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status: IPurchaseOrder['status']) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3 text-blue-400" />
            Action Required
          </span>
        );
      case 'quoted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Quotation Submitted
          </span>
        );
      case 'supplier_rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/30">
            <X className="w-3 h-3" />
            Declined
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Confirmed by Admin
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Truck className="w-3 h-3" />
            In Transit
          </span>
        );
      case 'partially_received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Clock className="w-3 h-3" />
            Partial Receipt
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Received
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" />
            Purchase Orders
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track purchase orders dispatched to your company and delivery verification
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOrders()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pending Requests Alert Banner */}
      {orders.some((o) => o.status === 'submitted') && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Action Required: New Supply Requests Awaiting Response</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                The shop admin has submitted supply requests. Please provide your quotation (available quantities, unit costs, and estimated delivery dates) or decline.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/60 font-medium"
          >
            <option value="all">All Orders</option>
            <option value="submitted">Action Required (Submitted)</option>
            <option value="quoted">Quotation Submitted</option>
            <option value="confirmed">Confirmed by Admin</option>
            <option value="in_transit">In Transit</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="supplier_rejected">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-400">
          Total: <span className="font-bold text-white">{total}</span> orders
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5">PO Ref</th>
                <th className="px-4 py-3.5">Date Issued</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Expected Delivery</th>
                <th className="px-4 py-3.5 text-right">Items</th>
                <th className="px-4 py-3.5 text-right">Total (Rs.)</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2 text-indigo-400">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading purchase orders...
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No purchase orders found for the selected status.
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const totalOrdered = (po.items || []).reduce((acc, it) => acc + (it.orderedQty || 0), 0);
                  const totalReceived = (po.items || []).reduce((acc, it) => acc + (it.receivedQty || 0), 0);

                  return (
                    <tr key={po._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-300">
                        PO-{po._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {new Date(po.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(po.status)}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {po.expectedDeliveryDate ? (
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="italic text-slate-500">Not scheduled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        <span className="font-semibold">{totalReceived}</span>
                        <span className="text-slate-500"> / {totalOrdered}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-100">
                        Rs. {(po.totalCost || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {po.status === 'submitted' && (
                            <button
                              type="button"
                              onClick={() => handleOpenRespond(po)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                            >
                              <Clock className="w-3 h-3" />
                              Respond & Quote
                            </button>
                          )}

                          {po.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDispatch(po)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-colors"
                            >
                              <Truck className="w-3 h-3" />
                              Dispatch
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDetail(po)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
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

        {/* Pagination */}
        {pages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page <strong className="text-white">{page}</strong> of <strong className="text-white">{pages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {detailModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Purchase Order PO-{selectedPO._id.slice(-6).toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Created on {new Date(selectedPO.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Status & Delivery Summary */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Current Status
                  </span>
                  <div className="mt-1">{getStatusBadge(selectedPO.status)}</div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Expected Delivery
                  </span>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">
                    {selectedPO.expectedDeliveryDate
                      ? new Date(selectedPO.expectedDeliveryDate).toLocaleDateString()
                      : 'Not specified'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Order Value
                  </span>
                  <span className="text-sm font-bold text-indigo-400 mt-0.5 block">
                    Rs. {(selectedPO.totalCost || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Fulfillment Progress */}
              {(() => {
                const totalOrdered = (selectedPO.items || []).reduce((a, b) => a + (b.orderedQty || 0), 0);
                const totalReceived = (selectedPO.items || []).reduce((a, b) => a + (b.receivedQty || 0), 0);
                const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                return (
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">Fulfillment Received</span>
                      <span className="text-indigo-400 font-mono">
                        {totalReceived} / {totalOrdered} items ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Supplier Quote Summary if Quoted */}
              {(selectedPO.status === 'quoted' || selectedPO.supplierFeedback?.respondedAt) && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-amber-300 font-bold uppercase tracking-wider text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Your Quotation & Feedback
                    </span>
                    <span>
                      {selectedPO.supplierFeedback?.respondedAt
                        ? new Date(selectedPO.supplierFeedback.respondedAt).toLocaleDateString()
                        : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Proposed Delivery Date:</span>
                      <span className="font-semibold text-white">
                        {selectedPO.supplierFeedback?.estimatedDeliveryDate
                          ? new Date(selectedPO.supplierFeedback.estimatedDeliveryDate).toLocaleDateString()
                          : 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Your Remarks:</span>
                      <span className="text-slate-200">
                        {selectedPO.supplierFeedback?.supplierNotes || 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Decline Reason if Supplier Rejected */}
              {selectedPO.status === 'supplier_rejected' && (
                <div className="p-3.5 bg-slate-950 border border-rose-500/30 rounded-xl space-y-1 text-xs">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                    Declined by Your Company
                  </span>
                  <p className="text-slate-300">
                    Reason: {selectedPO.supplierFeedback?.rejectionReason || 'No reason specified'}
                  </p>
                </div>
              )}

              {/* Cancellation Reason if Admin Cancelled */}
              {selectedPO.status === 'cancelled' && selectedPO.cancelReason && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Admin Cancellation Reason
                  </span>
                  <p className="text-slate-300">{selectedPO.cancelReason}</p>
                </div>
              )}

              {/* Tracking Info if Dispatched */}
              {selectedPO.trackingInfo?.trackingNumber && (
                <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl space-y-1 text-xs">
                  <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    Shipment Tracking
                  </div>
                  <div className="text-slate-300 flex flex-wrap gap-4 pt-1">
                    <div>Carrier: <span className="font-semibold text-white">{selectedPO.trackingInfo?.carrier || 'Standard Freight'}</span></div>
                    <div>Waybill / Tracking: <span className="font-mono font-semibold text-cyan-300">{selectedPO.trackingInfo?.trackingNumber}</span></div>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Ordered Line Items ({(selectedPO.items || []).length})
                </span>

                <div className="space-y-2">
                  {(selectedPO.items || []).map((item, idx) => {
                    const prod = item.product || ({} as any);
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {prod.images && prod.images[0] ? (
                            <img
                              src={prod.images[0]}
                              alt={prod.name || item.sku}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">
                              {prod.name || 'Product'}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                              <span>SKU: {item.sku}</span>
                              <span>•</span>
                              <span>Size: {item.size}</span>
                              <span>•</span>
                              <span>Color: {item.color}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-slate-200">
                            Rs. {item.unitCost.toLocaleString()} × {item.orderedQty}
                          </div>
                          {item.quotedQty !== undefined && item.quotedQty > 0 && (
                            <div className="text-[11px] text-amber-400 font-mono">
                              Quoted: {item.quotedQty} units
                            </div>
                          )}
                          <div className="text-[11px] text-indigo-400 font-mono">
                            Received: {item.receivedQty} / {item.orderedQty}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedPO.notes && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Order Instructions & Notes
                  </span>
                  <p className="text-slate-300 leading-relaxed text-xs">{selectedPO.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {selectedPO.status === 'submitted' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenRespond(selectedPO);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Respond & Quote
                  </button>
                )}

                {selectedPO.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenDispatch(selectedPO);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Dispatch Order
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Respond & Quote Modal ────────────────────────────────────────────── */}
      {respondModalOpen && respondingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                  Respond to Supply Request PO-{respondingPO._id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm allocable quantities, price, and delivery date or decline request
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRespondModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRespond} className="p-6 space-y-5 text-xs">
              {/* Toggle Accept / Decline */}
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRespondAction('confirm')}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    respondAction === 'confirm'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Provide Quote
                </button>
                <button
                  type="button"
                  onClick={() => setRespondAction('reject')}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    respondAction === 'reject'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  Decline Request
                </button>
              </div>

              {respondAction === 'confirm' ? (
                <>
                  {/* Item Line Quotation Inputs */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Line Items — Confirm Supply Quantities & Unit Costs
                    </span>
                    <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                      {quoteItems.map((item, idx) => {
                        const originalItem = (respondingPO.items || []).find((it) => it.sku === item.sku);
                        const prod = originalItem?.product || ({} as any);

                        return (
                          <div
                            key={item.sku}
                            className="p-3 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-white text-xs truncate">
                                {prod.name || 'Product'} ({item.sku})
                              </div>
                              <div className="text-slate-400 text-[11px]">
                                Requested: <span className="font-semibold text-slate-200">{originalItem?.orderedQty} units</span> @ Rs. {originalItem?.unitCost}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase block mb-0.5">Can Supply Qty</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.quotedQty}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                    setQuoteItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], quotedQty: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-24 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase block mb-0.5">Supply Price (Rs.)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitCost}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setQuoteItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], unitCost: val };
                                      return copy;
                                    });
                                  }}
                                  className="w-28 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium text-xs focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estimated Delivery Date */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Estimated Delivery Date / Completion Time
                    </label>
                    <input
                      type="date"
                      value={quoteDeliveryDate}
                      onChange={(e) => setQuoteDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Supplier Notes */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Supplier Notes & Production Terms
                    </label>
                    <textarea
                      rows={3}
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      placeholder="Specify minimum batch details, delivery terms, or material timeline..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {/* Total Calculation */}
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-300">Total Quoted Supply Value:</span>
                    <span className="text-sm font-bold text-indigo-400">
                      Rs. {quoteItems.reduce((acc, it) => acc + it.quotedQty * it.unitCost, 0).toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Reason for Declining Request <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Out of stock on requested fabrics, currently at full manufacturing capacity..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRespondModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-5 py-2 text-xs font-bold rounded-xl text-white transition-colors shadow-sm disabled:opacity-50 ${
                    respondAction === 'confirm'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {submittingAction
                    ? 'Submitting...'
                    : respondAction === 'confirm'
                    ? 'Send Quotation to Admin'
                    : 'Confirm Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dispatch Modal ───────────────────────────────────────────────────── */}
      {dispatchModalOpen && dispatchingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                Dispatch Order PO-{dispatchingPO._id.slice(-6).toUpperCase()}
              </h3>
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDispatch} className="p-6 space-y-4 text-xs">
              <p className="text-slate-300 text-xs">
                Enter shipment and courier details to mark this confirmed order as dispatched and in transit to the shop.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Logistics / Carrier Name
                </label>
                <input
                  type="text"
                  value={dispatchCarrier}
                  onChange={(e) => setDispatchCarrier(e.target.value)}
                  placeholder="e.g. Prompt Express, DHL, City Logistics"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Tracking Number / Waybill ID
                </label>
                <input
                  type="text"
                  value={dispatchTracking}
                  onChange={(e) => setDispatchTracking(e.target.value)}
                  placeholder="e.g. TRK-9823471"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingAction ? 'Marking...' : 'Mark Dispatched'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPurchaseOrdersPage;
