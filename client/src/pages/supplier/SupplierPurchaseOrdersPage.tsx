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
