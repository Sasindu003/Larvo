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
  FileText,
  XCircle,
  Send,
  DollarSign,
  Check,
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
  receivedQty: number;
  unitCost: number;
}

export interface ISupplierResponseItem {
  poItemId: string;
  canSupplyQty: number;
  unitPrice: number;
}

export interface ISupplierResponse {
  decision: 'pending' | 'accepted' | 'declined';
  respondedAt?: string | null;
  items: ISupplierResponseItem[];
  estimatedDeliveryDate?: string | null;
  notes?: string;
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
    | 'confirmed'
    | 'in_transit'
    | 'partially_received'
    | 'received'
    | 'cancelled';
  expectedDeliveryDate?: string | null;
  notes?: string;
  supplierResponse?: ISupplierResponse;
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

  // Response Form State
  const [respondMode, setRespondMode] = useState<'none' | 'accept' | 'decline'>('none');
  const [responseItems, setResponseItems] = useState<{ poItemId: string; canSupplyQty: number; unitPrice: number }[]>([]);
  const [responseDeliveryDate, setResponseDeliveryDate] = useState('');
  const [responseNotes, setResponseNotes] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

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

  const initResponseState = (po: IPurchaseOrder) => {
    const items = (po.items || []).map((it) => ({
      poItemId: it._id || '',
      canSupplyQty: it.orderedQty,
      unitPrice: it.unitCost,
    }));
    setResponseItems(items);
    setResponseDeliveryDate(
      po.expectedDeliveryDate
        ? new Date(po.expectedDeliveryDate).toISOString().substring(0, 10)
        : ''
    );
    setResponseNotes('');
    setRespondMode('none');
  };

  const handleOpenDetail = async (po: IPurchaseOrder) => {
    setSelectedPO(po);
    initResponseState(po);
    setDetailModalOpen(true);
    setLoadingDetail(true);
    try {
      const fullPO = await supplierPortalService.getPurchaseOrderById(po._id);
      setSelectedPO(fullPO);
      initResponseState(fullPO);
    } catch {
      // Keep basic po in state if fetch fails
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmitResponse = async (decision: 'accepted' | 'declined') => {
    if (!selectedPO) return;

    if (decision === 'declined' && !responseNotes.trim()) {
      toast.error('Please provide a reason in the notes field for declining this request');
      return;
    }

    if (decision === 'accepted') {
      for (const item of responseItems) {
        if (item.canSupplyQty < 0 || isNaN(item.canSupplyQty)) {
          toast.error('Can supply quantity must be 0 or more');
          return;
        }
        if (item.unitPrice < 0 || isNaN(item.unitPrice)) {
          toast.error('Unit price cannot be negative');
          return;
        }
      }
    }

    setSubmittingResponse(true);
    try {
      const payload: any = {
        decision,
        notes: responseNotes.trim(),
      };

      if (decision === 'accepted') {
        payload.items = responseItems;
        if (responseDeliveryDate) {
          payload.estimatedDeliveryDate = new Date(responseDeliveryDate).toISOString();
        }
      }

      const updated = await supplierPortalService.respondToPurchaseOrder(selectedPO._id, payload);
      toast.success(
        decision === 'accepted'
          ? 'Quote and acceptance submitted to admin!'
          : 'Order request declined'
      );
      setSelectedPO(updated);
      setRespondMode('none');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit response');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const getStatusBadge = (status: IPurchaseOrder['status']) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Submitted
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Confirmed
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
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
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_transit">In Transit</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
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
                      <td className="px-4 py-3">
                        {getStatusBadge(po.status)}
                        {po.status === 'submitted' && (
                          <div className="mt-1">
                            {po.supplierResponse?.decision === 'accepted' ? (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Quoted & Accepted
                              </span>
                            ) : po.supplierResponse?.decision === 'declined' ? (
                              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Declined
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-400 font-semibold animate-pulse flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Action Required
                              </span>
                            )}
                          </div>
                        )}
                      </td>
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
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(po)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

              {/* Supplier Response Section (Already Responded) */}
              {selectedPO.supplierResponse && selectedPO.supplierResponse.decision !== 'pending' && (
                <div
                  className={`p-4 rounded-xl border ${
                    selectedPO.supplierResponse.decision === 'accepted'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-rose-500/30 bg-rose-500/5'
                  } space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedPO.supplierResponse.decision === 'accepted' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                        {selectedPO.supplierResponse.decision === 'accepted'
                          ? 'You Accepted this Order Request'
                          : 'You Declined this Order Request'}
                      </span>
                    </div>
                    {selectedPO.supplierResponse.respondedAt && (
                      <span className="text-[11px] text-slate-400">
                        Responded: {new Date(selectedPO.supplierResponse.respondedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {selectedPO.supplierResponse.estimatedDeliveryDate && (
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-medium">Your Estimated Delivery Date:</span>{' '}
                      <span className="text-white font-semibold">
                        {new Date(selectedPO.supplierResponse.estimatedDeliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {selectedPO.supplierResponse.notes && (
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-medium">Your Notes:</span>{' '}
                      <span className="text-slate-200">{selectedPO.supplierResponse.notes}</span>
                    </div>
                  )}

                  {selectedPO.supplierResponse.decision === 'accepted' &&
                    selectedPO.supplierResponse.items?.length > 0 && (
                      <div className="mt-2 border border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                            <tr>
                              <th className="px-3 py-1.5">SKU / Item</th>
                              <th className="px-3 py-1.5 text-right">Can Supply</th>
                              <th className="px-3 py-1.5 text-right">Quoted Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                            {selectedPO.supplierResponse.items.map((it, i) => {
                              const originalItem = (selectedPO.items || []).find(
                                (orig) => orig._id?.toString() === it.poItemId?.toString()
                              );
                              return (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 text-slate-200 font-mono">
                                    {originalItem?.sku || `Item #${i + 1}`}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-emerald-400">
                                    {it.canSupplyQty}{' '}
                                    <span className="text-slate-500 font-normal">
                                      / {originalItem?.orderedQty || '?'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-white">
                                    Rs. {it.unitPrice.toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
              )}

              {/* Action Required: Respond Form (When Pending) */}
              {selectedPO.status === 'submitted' &&
                (!selectedPO.supplierResponse || selectedPO.supplierResponse.decision === 'pending') && (
                  <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-white">
                          Action Required: Respond to Order Request
                        </span>
                      </div>
                      <span className="text-[11px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                        Decision Pending
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      The shop admin has submitted this purchase order request. Review the items and confirm how many units you can supply and your unit price quote, or decline.
                    </p>

                    {respondMode === 'none' && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setRespondMode('accept')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept & Provide Supply Quote
                        </button>
                        <button
                          type="button"
                          onClick={() => setRespondMode('decline')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Decline Request
                        </button>
                      </div>
                    )}

                    {respondMode === 'accept' && (
                      <div className="pt-3 border-t border-indigo-500/20 space-y-3">
                        <div className="font-semibold text-xs text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Provide Supply Details for Each Item:
                        </div>

                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                              <tr>
                                <th className="px-3 py-2">Item</th>
                                <th className="px-3 py-2">Requested</th>
                                <th className="px-3 py-2">Can Supply Qty</th>
                                <th className="px-3 py-2">Quoted Unit Price (Rs.)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {(selectedPO.items || []).map((it, idx) => {
                                const currentResp = responseItems[idx] || {
                                  canSupplyQty: it.orderedQty,
                                  unitPrice: it.unitCost,
                                };
                                return (
                                  <tr key={idx} className="hover:bg-slate-800/30">
                                    <td className="px-3 py-2">
                                      <div className="font-mono text-white font-medium">{it.sku}</div>
                                      <div className="text-[10px] text-slate-400">
                                        {it.size} / {it.color}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-slate-400">
                                      <div>{it.orderedQty} pcs</div>
                                      <div className="text-[10px]">@ Rs. {it.unitCost}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        min={0}
                                        value={currentResp.canSupplyQty}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 0;
                                          setResponseItems((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = { ...copy[idx], canSupplyQty: val };
                                            return copy;
                                          });
                                        }}
                                        className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        value={currentResp.unitPrice}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          setResponseItems((prev) => {
                                            const copy = [...prev];
                                            copy[idx] = { ...copy[idx], unitPrice: val };
                                            return copy;
                                          });
                                        }}
                                        className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                              Estimated Delivery Date
                            </label>
                            <input
                              type="date"
                              value={responseDeliveryDate}
                              onChange={(e) => setResponseDeliveryDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                              Additional Notes / Remarks
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Can ship batch 1 within 5 days"
                              value={responseNotes}
                              onChange={(e) => setResponseNotes(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setRespondMode('none')}
                            disabled={submittingResponse}
                            className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitResponse('accepted')}
                            disabled={submittingResponse}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                          >
                            {submittingResponse ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Submit Acceptance & Quote
                          </button>
                        </div>
                      </div>
                    )}

                    {respondMode === 'decline' && (
                      <div className="pt-3 border-t border-indigo-500/20 space-y-3">
                        <div className="font-semibold text-xs text-rose-400 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          Decline Request Confirmation
                        </div>
                        <p className="text-xs text-slate-400">
                          Please provide the reason why your company cannot fulfill this order request:
                        </p>
                        <textarea
                          rows={3}
                          required
                          placeholder="e.g. Out of fabric / insufficient lead time / unable to meet requested pricing"
                          value={responseNotes}
                          onChange={(e) => setResponseNotes(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:ring-1 focus:ring-rose-500 focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setRespondMode('none')}
                            disabled={submittingResponse}
                            className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitResponse('declined')}
                            disabled={submittingResponse}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                          >
                            {submittingResponse ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Confirm Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
            <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex justify-end shrink-0">
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
    </div>
  );
};

export default SupplierPurchaseOrdersPage;
