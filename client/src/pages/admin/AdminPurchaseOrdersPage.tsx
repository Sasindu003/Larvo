import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Plus,
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
  Upload,
  Ban,
  Calendar,
  Package,
  Layers,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  purchaseOrderService,
  IPurchaseOrder,
  POStatus,
  PO_STATUSES,
  SkuSearchResult,
} from '../../services/purchase-order.service';
import { supplierService, ISupplier } from '../../services/supplier.service';

// ── Status Badge Component covering all 12 statuses ──────────────────────────
export const POStatusBadge: React.FC<{ status: POStatus }> = ({ status }) => {
  const configs: Record<POStatus, { label: string; bg: string; text: string; border: string }> = {
    requested: {
      label: 'Requested',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
    },
    quoted: {
      label: 'Quoted',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/20',
    },
    declined: {
      label: 'Declined',
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/20',
    },
    admin_approved: {
      label: 'Quote Approved',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    admin_rejected: {
      label: 'Quote Rejected',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
    },
    payment_submitted: {
      label: 'Payment Submitted',
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      border: 'border-sky-500/20',
    },
    payment_rejected: {
      label: 'Payment Rejected',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/20',
    },
    confirmed: {
      label: 'Confirmed',
      bg: 'bg-teal-500/10',
      text: 'text-teal-400',
      border: 'border-teal-500/20',
    },
    in_transit: {
      label: 'In Transit',
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
      label: 'Received',
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

export const AdminPurchaseOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const canMutate = user?.role === 'admin' || user?.role === 'owner';

  const [orders, setOrders] = useState<IPurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activePO, setActivePO] = useState<IPurchaseOrder | null>(null);

  // Data for Create Modal
  const [suppliersList, setSuppliersList] = useState<ISupplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createItems, setCreateItems] = useState<
    Array<{
      product: string;
      sku: string;
      size: string;
      color: string;
      orderedQty: number;
      unitCost: number;
      productName?: string;
      currentStock?: number;
    }>
  >([]);

  // SKU Autocomplete Search State for Create Modal
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [skuSearchResults, setSkuSearchResults] = useState<SkuSearchResult[]>([]);
  const [skuSearching, setSkuSearching] = useState(false);
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Action Panel States in Manage Modal
  const [submittingAction, setSubmittingAction] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [receiveDeltas, setReceiveDeltas] = useState<Record<string, number>>({});

  // ── Fetch Purchase Orders ───────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await purchaseOrderService.getPurchaseOrders({
        page,
        limit,
        status: statusFilter,
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
  }, [page, limit, statusFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Load suppliers for create modal
  useEffect(() => {
    if (createModalOpen) {
      supplierService
        .getSuppliers({ limit: 100, status: 'active' })
        .then((res) => setSuppliersList(res.results))
        .catch(() => toast.error('Failed to load suppliers'));
    }
  }, [createModalOpen]);

  // Handle SKU Search with debounce
  const handleSkuSearchChange = (query: string) => {
    setSkuSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!query.trim()) {
      setSkuSearchResults([]);
      setShowSkuDropdown(false);
      return;
    }

    setSkuSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await purchaseOrderService.searchSku(query);
        setSkuSearchResults(results);
        setShowSkuDropdown(true);
      } catch (err) {
        setSkuSearchResults([]);
      } finally {
        setSkuSearching(false);
      }
    }, 250);
  };

  const handleSelectSku = (item: SkuSearchResult) => {
    // Check if already in createItems
    const exists = createItems.some((ci) => ci.sku === item.sku);
    if (exists) {
      toast.error(`SKU ${item.sku} is already added`);
      setShowSkuDropdown(false);
      setSkuSearchQuery('');
      return;
    }

    setCreateItems((prev) => [
      ...prev,
      {
        product: item.productId,
        sku: item.sku,
        size: item.size,
        color: item.color,
        orderedQty: 10,
        unitCost: 0,
        productName: item.name,
        currentStock: item.currentStock,
      },
    ]);

    setSkuSearchQuery('');
    setSkuSearchResults([]);
    setShowSkuDropdown(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (createItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    try {
      setSubmittingAction(true);
      await purchaseOrderService.createPurchaseOrder({
        supplier: selectedSupplier,
        items: createItems.map((it) => ({
          product: it.product,
          sku: it.sku,
          size: it.size,
          color: it.color,
          orderedQty: it.orderedQty,
          unitCost: it.unitCost,
        })),
        notes: createNotes.trim() || undefined,
      });

      toast.success('Stock request created successfully');
      setCreateModalOpen(false);
      setSelectedSupplier('');
      setCreateItems([]);
      setCreateNotes('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create purchase order');
    } finally {
      setSubmittingAction(false);
    }
  };

  // ── Open PO Details ─────────────────────────────────────────────────────────
  const openDetail = async (po: IPurchaseOrder) => {
    try {
      const fresh = await purchaseOrderService.getPurchaseOrderById(po._id);
      setActivePO(fresh);
      // Initialize receive deltas
      const deltas: Record<string, number> = {};
      for (const item of fresh.items) {
        const target = item.quotedQty > 0 ? item.quotedQty : item.orderedQty;
        const rem = Math.max(0, target - (item.receivedQty || 0));
        deltas[item.sku] = rem;
      }
      setReceiveDeltas(deltas);
      setSlipFile(null);
      setDetailModalOpen(true);
    } catch (err: any) {
      toast.error('Failed to load order details');
    }
  };

  // ── Actions on PO ───────────────────────────────────────────────────────────
  const handleDecideQuote = async (decision: 'approve' | 'reject') => {
    if (!activePO) return;
    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.decideQuote(activePO._id, decision);
      setActivePO(updated);
      toast.success(`Quote ${decision === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${decision} quote`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleUploadPaymentSlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePO || !slipFile) {
      toast.error('Please choose a slip image or PDF file');
      return;
    }

    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.submitPaymentSlip(activePO._id, slipFile);
      setActivePO(updated);
      setSlipFile(null);
      toast.success('Payment slip uploaded and submitted to supplier');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload payment slip');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReceiveStock = async () => {
    if (!activePO) return;
    const linesToReceive = Object.entries(receiveDeltas)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([sku, delta]) => ({ sku, receivedQtyDelta: Number(delta) }));

    if (linesToReceive.length === 0) {
      toast.error('Please enter received quantity for at least one item');
      return;
    }

    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.receivePurchaseOrder(activePO._id, linesToReceive);
      setActivePO(updated);
      toast.success('Stock receipt recorded and inventory restocked');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record stock receipt');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!activePO) return;
    if (!window.confirm('Are you sure you want to cancel this purchase order?')) return;

    try {
      setSubmittingAction(true);
      const updated = await purchaseOrderService.cancelPurchaseOrder(activePO._id);
      setActivePO(updated);
      toast.success('Purchase order cancelled');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel purchase order');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              Purchase Orders
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Create stock requests, review quotes, track shipments, and receive inventory.
          </p>
        </div>

        {canMutate && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Create Request
          </button>
        )}
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID or notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs text-slate-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 capitalize"
          >
            <option value="all">All Statuses ({total})</option>
            {PO_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <button
            onClick={fetchOrders}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Orders Table ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Items / SKUs</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Total Cost</th>
                <th className="py-3 px-4">Est. Delivery</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No purchase orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const supplierObj = typeof po.supplier === 'object' ? (po.supplier as ISupplier) : null;
                  const supplierName = supplierObj?.companyName || supplierObj?.name || 'Unknown Supplier';

                  return (
                    <tr key={po._id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-xs text-indigo-300">
                        #{po._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">{supplierName}</td>
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
                        <button
                          onClick={() => openDetail(po)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-medium transition border border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Manage
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
            <div>
              Showing {orders.length} of {total} orders
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-slate-700 transition"
              >
                Previous
              </button>
              <span className="px-2 py-1">
                {page} / {pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-slate-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE STOCK REQUEST MODAL ───────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Create Stock Request</h2>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-5 mt-4">
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Supplier <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select an active supplier...</option>
                  {suppliersList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.companyName || s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* SKU Autocomplete Search */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Search & Add Line Items by SKU / Product Name
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type SKU or product name (e.g. SLM, Cotton, Jeans)..."
                    value={skuSearchQuery}
                    onChange={(e) => handleSkuSearchChange(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  {skuSearching && (
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Dropdown Results */}
                {showSkuDropdown && skuSearchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-700/60">
                    {skuSearchResults.map((sr) => (
                      <div
                        key={sr.sku}
                        onClick={() => handleSelectSku(sr)}
                        className="p-3 hover:bg-slate-700/70 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <p className="font-semibold text-slate-200">{sr.name}</p>
                          <p className="text-slate-400 font-mono">
                            SKU: <span className="text-indigo-300">{sr.sku}</span> | Size: {sr.size} | Color: {sr.color}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 bg-slate-900 rounded text-slate-300 font-mono">
                            Stock: {sr.currentStock}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Line Items ({createItems.length})
                </label>
                {createItems.length === 0 ? (
                  <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center text-xs text-slate-400">
                    No items selected. Use the search bar above to pick SKUs for this request.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-slate-300 text-left">
                      <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3">Product / SKU</th>
                          <th className="py-2.5 px-3">Variant</th>
                          <th className="py-2.5 px-3 w-28">Order Qty</th>
                          <th className="py-2.5 px-3 w-32">Ref. Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {createItems.map((item, idx) => (
                          <tr key={item.sku} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3">
                              <p className="font-medium text-slate-200">{item.productName || item.sku}</p>
                              <p className="font-mono text-indigo-400">{item.sku}</p>
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {item.size} / {item.color}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={1}
                                value={item.orderedQty}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setCreateItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, orderedQty: val } : it))
                                  );
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  setCreateItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, unitCost: val } : it))
                                  );
                                }}
                                className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setCreateItems((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-rose-400 hover:text-rose-300 font-medium"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes / Instructions (optional)
                </label>
                <textarea
                  rows={2}
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="Special instructions for the supplier..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submittingAction ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MANAGE & DETAIL MODAL ────────────────────────────────────────────── */}
      {detailModalOpen && activePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-mono">
                      PO #{activePO._id.slice(-6).toUpperCase()}
                    </h2>
                    <POStatusBadge status={activePO.status} />
                  </div>
                  <p className="text-xs text-slate-400">
                    Supplier:{' '}
                    <span className="text-slate-200 font-medium">
                      {typeof activePO.supplier === 'object'
                        ? (activePO.supplier as ISupplier).companyName ||
                          (activePO.supplier as ISupplier).name
                        : activePO.supplier}
                    </span>{' '}
                    | Created: {new Date(activePO.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Items Table ──────────────────────────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Order Line Items
              </h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Variant</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Quoted Qty</th>
                      <th className="py-2.5 px-3 text-right">Quoted Cost</th>
                      <th className="py-2.5 px-3 text-right">Received Qty</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activePO.items.map((it) => {
                      const isQuotedOrPast = !['requested', 'admin_rejected'].includes(activePO.status);
                      const effectiveQty = isQuotedOrPast ? it.quotedQty || 0 : it.orderedQty || 0;
                      const effectiveCost = isQuotedOrPast ? it.quotedUnitCost || 0 : it.unitCost || 0;
                      const lineTotal = effectiveQty * effectiveCost;

                      return (
                        <tr key={it.sku} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-medium text-indigo-300">{it.sku}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {it.size} / {it.color}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{it.orderedQty}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-purple-300">
                            {it.quotedQty > 0 ? it.quotedQty : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {it.quotedUnitCost > 0 ? `$${it.quotedUnitCost.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                            {it.receivedQty || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-200">
                            ${lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-950/60 border-t border-slate-800 font-semibold text-xs text-slate-200">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-right">
                        Total Order Cost:
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-400 text-sm">
                        ${(activePO.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes if any */}
            {activePO.notes && (
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Order Notes: </span>
                {activePO.notes}
              </div>
            )}

            {/* ── STATUS-GATED ACTION PANELS ───────────────────────────────── */}

            {/* 1. Quote Review Panel (ONLY when status === 'quoted') */}
            {activePO.status === 'quoted' && (
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
                    <DollarSign className="w-4 h-4 text-purple-400" />
                    Supplier Quotation Review
                  </div>
                  {activePO.estimatedDeliveryDate && (
                    <span className="text-xs text-purple-300 bg-purple-900/40 px-2.5 py-1 rounded-md border border-purple-500/30">
                      Est. Delivery: {new Date(activePO.estimatedDeliveryDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300">
                  The supplier has submitted their pricing and available quantities. Please review the quotation
                  breakdown above before approving or rejecting.
                </p>

                {canMutate && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleDecideQuote('reject')}
                      className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition"
                    >
                      Reject Quote
                    </button>
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleDecideQuote('approve')}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-emerald-600/20"
                    >
                      Approve Quote
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. Payment Slip Upload Panel (when status in ['admin_approved', 'payment_rejected']) */}
            {['admin_approved', 'payment_rejected'].includes(activePO.status) && (
              <div className="bg-sky-950/20 border border-sky-500/30 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-sky-300 font-semibold text-sm">
                  <Upload className="w-4 h-4 text-sky-400" />
                  Bank Transfer Payment Slip Upload
                </div>

                {/* Warning note if previously rejected */}
                {activePO.status === 'payment_rejected' && activePO.paymentReviewNote && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Supplier Rejected Previous Slip:</p>
                      <p className="mt-0.5 text-rose-200">{activePO.paymentReviewNote}</p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-300">
                  Please upload a receipt/slip (JPEG, PNG, WebP, or PDF, max 5MB) verifying the bank transfer to the
                  supplier.
                </p>

                {canMutate && (
                  <form onSubmit={handleUploadPaymentSlip} className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                      required
                    />
                    <button
                      type="submit"
                      disabled={!slipFile || submittingAction}
                      className="w-full sm:w-auto px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition shrink-0 disabled:opacity-50"
                    >
                      {submittingAction ? 'Uploading...' : 'Submit Slip'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 3. Read-Only Lifecycle Tracker (when submitted/confirmed/shipped/received) */}
            {[
              'payment_submitted',
              'confirmed',
              'in_transit',
              'partially_received',
              'received',
            ].includes(activePO.status) && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Lifecycle Tracking
                  </h4>
                  {activePO.paymentSlipUrl && (
                    <a
                      href={activePO.paymentSlipUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Uploaded Slip
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Payment</p>
                    <p className="text-xs font-medium text-emerald-400 mt-0.5">
                      {['confirmed', 'in_transit', 'partially_received', 'received'].includes(activePO.status)
                        ? 'Confirmed by Supplier'
                        : 'Awaiting Supplier Review'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Shipment</p>
                    <p className="text-xs font-medium text-indigo-400 mt-0.5">
                      {['in_transit', 'partially_received', 'received'].includes(activePO.status)
                        ? 'Dispatched / In Transit'
                        : 'Pending Dispatch'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Est. Delivery</p>
                    <p className="text-xs font-medium text-slate-300 mt-0.5">
                      {activePO.estimatedDeliveryDate
                        ? new Date(activePO.estimatedDeliveryDate).toLocaleDateString()
                        : 'Not specified'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Stock Status</p>
                    <p className="text-xs font-medium text-amber-400 mt-0.5">
                      {activePO.status === 'received'
                        ? 'Fully Received'
                        : activePO.status === 'partially_received'
                        ? 'Partially Received'
                        : 'Awaiting Arrival'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Stock Receiving Panel (ONLY when status in ['in_transit', 'partially_received']) */}
            {['in_transit', 'partially_received'].includes(activePO.status) && (
              <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                  <Package className="w-4 h-4 text-indigo-400" />
                  Receive Delivered Stock
                </div>

                <p className="text-xs text-slate-300">
                  Enter incoming quantities to restock the warehouse. Quantities are capped against the supplier's
                  quoted amount.
                </p>

                <div className="space-y-2">
                  {activePO.items.map((item) => {
                    const targetCap = item.quotedQty > 0 ? item.quotedQty : item.orderedQty;
                    const rem = Math.max(0, targetCap - (item.receivedQty || 0));

                    return (
                      <div
                        key={item.sku}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/80 border border-slate-800 rounded-lg gap-2 text-xs"
                      >
                        <div>
                          <p className="font-mono font-medium text-indigo-300">{item.sku}</p>
                          <p className="text-slate-400">
                            Target Quota: <span className="text-slate-200 font-semibold">{targetCap}</span> | Already
                            Received: <span className="text-emerald-400 font-semibold">{item.receivedQty || 0}</span> |
                            Remaining: <span className="text-amber-400 font-semibold">{rem}</span>
                          </p>
                        </div>

                        {rem > 0 ? (
                          <div className="flex items-center gap-2">
                            <label className="text-slate-400">Receive Qty:</label>
                            <input
                              type="number"
                              min={0}
                              max={rem}
                              value={receiveDeltas[item.sku] ?? 0}
                              onChange={(e) => {
                                const val = Math.min(rem, Math.max(0, parseInt(e.target.value) || 0));
                                setReceiveDeltas((prev) => ({ ...prev, [item.sku]: val }));
                              }}
                              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-center font-mono"
                            />
                          </div>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canMutate && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={handleReceiveStock}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                    >
                      {submittingAction ? 'Processing Receipt...' : 'Record Stock Receipt'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Footer with Close and Cancel Order */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div>
                {[
                  'requested',
                  'admin_approved',
                  'admin_rejected',
                  'payment_rejected',
                  'confirmed',
                ].includes(activePO.status) &&
                  canMutate && (
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={handleCancelOrder}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium transition"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancel Order
                    </button>
                  )}
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
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

export default AdminPurchaseOrdersPage;