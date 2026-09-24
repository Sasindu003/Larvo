import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Eye,
  Edit3,
  XCircle,
  Truck,
  Building2,
  Calendar,
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  Trash2,
  DollarSign,
  ArrowRight,
  Clock,
  Send,
  Boxes,
  PackageCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  purchaseOrderService,
  IPurchaseOrder,
  POStatus,
  PO_STATUSES,
  PO_VALID_TRANSITIONS,
  CreatePOItemInput,
} from '../../services/purchase-order.service';
import { supplierService, ISupplier } from '../../services/supplier.service';
import { productService, Product } from '../../services/product.service';

const STATUS_CONFIG: Record<
  POStatus,
  { label: string; badgeClass: string; stepIndex: number }
> = {
  draft: {
    label: 'Draft',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    stepIndex: 0,
  },
  submitted: {
    label: 'Submitted',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    stepIndex: 1,
  },
  confirmed: {
    label: 'Confirmed',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    stepIndex: 2,
  },
  in_transit: {
    label: 'In Transit',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    stepIndex: 3,
  },
  partially_received: {
    label: 'Partially Received',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    stepIndex: 4,
  },
  received: {
    label: 'Received',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    stepIndex: 4,
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    stepIndex: -1,
  },
};

interface ItemRowForm {
  productId: string;
  sku: string;
  size: string;
  color: string;
  orderedQty: number;
  unitCost: number;
}

interface ReceiveLineForm {
  sku: string;
  orderedQty: number;
  receivedQty: number;
  receivedQtyDelta: number;
}

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
  const [supplierFilter, setSupplierFilter] = useState<string>('');

  // Dropdown options
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveLines, setReceiveLines] = useState<ReceiveLineForm[]>([]);

  // Selected for View / Edit / Cancel
  const [selectedOrder, setSelectedOrder] = useState<IPurchaseOrder | null>(null);

  // Form State
  const [formSupplier, setFormSupplier] = useState('');
  const [formExpectedDate, setFormExpectedDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<ItemRowForm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load initial suppliers & products for item picking
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [supRes, prodRes] = await Promise.all([
          supplierService.getSuppliers({ limit: 100 }),
          productService.getAdminProducts({ limit: 100 }),
        ]);
        setSuppliers(supRes.results || []);
        setProducts(prodRes.items || []);
      } catch (err) {
        console.error('Failed to load suppliers/products lookups', err);
      }
    };
    loadLookups();
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrders({
        page,
        limit,
        status: statusFilter,
        supplier: supplierFilter || undefined,
      });
      setOrders(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, supplierFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormSupplier(suppliers[0]?._id || '');
    setFormExpectedDate('');
    setFormNotes('');
    setFormItems([
      {
        productId: '',
        sku: '',
        size: '',
        color: '',
        orderedQty: 10,
        unitCost: 0,
      },
    ]);
    setFormError(null);
    setCreateModalOpen(true);
  };

  // Open Edit Modal (Draft Only)
  const handleOpenEdit = (po: IPurchaseOrder) => {
    if (po.status !== 'draft') {
      toast.error('Only draft purchase orders can be edited');
      return;
    }
    setSelectedOrder(po);
    const supId = typeof po.supplier === 'object' ? (po.supplier as any)._id : po.supplier;
    setFormSupplier(supId || '');
    setFormExpectedDate(
      po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().substring(0, 10) : ''
    );
    setFormNotes(po.notes || '');
    setFormItems(
      (po.items || []).map((item) => {
        const pId = typeof item.product === 'object' ? (item.product as any)._id : item.product;
        return {
          productId: pId,
          sku: item.sku,
          size: item.size,
          color: item.color,
          orderedQty: item.orderedQty,
          unitCost: item.unitCost,
        };
      })
    );
    setFormError(null);
    setEditModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetail = async (po: IPurchaseOrder) => {
    try {
      const fresh = await purchaseOrderService.getPurchaseOrderById(po._id);
      setSelectedOrder(fresh);
    } catch {
      setSelectedOrder(po);
    }
    setDetailModalOpen(true);
  };

  // Handle Item Row Changes
  const handleItemProductChange = (index: number, productId: string) => {
    const p = products.find((prod) => prod._id === productId);
    const firstVariant = p?.variants?.[0];

    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId,
        sku: firstVariant?.sku || '',
        size: firstVariant?.size || '',
        color: firstVariant?.color || '',
        unitCost: copy[index].unitCost || (p?.basePrice ? +(p.basePrice * 0.5).toFixed(2) : 0),
      };
      return copy;
    });
  };

  const handleItemVariantChange = (index: number, sku: string) => {
    const row = formItems[index];
    const p = products.find((prod) => prod._id === row.productId);
    const variant = p?.variants?.find((v) => v.sku === sku);

    if (variant) {
      setFormItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
        };
        return copy;
      });
    }
  };

  const handleItemFieldChange = (
    index: number,
    field: 'orderedQty' | 'unitCost',
    value: number
  ) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return copy;
    });
  };

  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        productId: '',
        sku: '',
        size: '',
        color: '',
        orderedQty: 10,
        unitCost: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length <= 1) {
      toast.error('At least one item is required');
      return;
    }
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculated form total
  const formTotalCost = formItems.reduce(
    (sum, item) => sum + (item.orderedQty || 0) * (item.unitCost || 0),
    0
  );

  // Submit Create
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplier) {
      setFormError('Please select a supplier');
      return;
    }
    for (const item of formItems) {
      if (!item.productId || !item.sku) {
        setFormError('All item rows must have a valid product and SKU selected');
        return;
      }
      if (item.orderedQty < 1) {
        setFormError('Ordered quantity must be at least 1 for all items');
        return;
      }
      if (item.unitCost < 0) {
        setFormError('Unit cost cannot be negative');
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payloadItems: CreatePOItemInput[] = formItems.map((item) => ({
        product: item.productId,
        sku: item.sku,
        size: item.size,
        color: item.color,
        orderedQty: Number(item.orderedQty),
        unitCost: Number(item.unitCost),
      }));

      await purchaseOrderService.createPurchaseOrder({
        supplier: formSupplier,
        items: payloadItems,
        expectedDeliveryDate: formExpectedDate ? new Date(formExpectedDate).toISOString() : null,
        notes: formNotes,
      });

      toast.success('Purchase order created successfully');
      setCreateModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!formSupplier) {
      setFormError('Please select a supplier');
      return;
    }
    for (const item of formItems) {
      if (!item.productId || !item.sku) {
        setFormError('All item rows must have a valid product and SKU selected');
        return;
      }
      if (item.orderedQty < 1) {
        setFormError('Ordered quantity must be at least 1 for all items');
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const payloadItems: CreatePOItemInput[] = formItems.map((item) => ({
        product: item.productId,
        sku: item.sku,
        size: item.size,
        color: item.color,
        orderedQty: Number(item.orderedQty),
        unitCost: Number(item.unitCost),
      }));

      await purchaseOrderService.updatePurchaseOrder(selectedOrder._id, {
        supplier: formSupplier,
        items: payloadItems,
        expectedDeliveryDate: formExpectedDate ? new Date(formExpectedDate).toISOString() : null,
        notes: formNotes,
      });

      toast.success('Purchase order updated successfully');
      setEditModalOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  // Advance Status
  const handleAdvanceStatus = async (po: IPurchaseOrder, nextStatus: POStatus) => {
    try {
      const updated = await purchaseOrderService.advanceStatus(po._id, nextStatus);
      toast.success(`Order advanced to "${STATUS_CONFIG[nextStatus]?.label || nextStatus}"`);
      if (selectedOrder && selectedOrder._id === po._id) {
        setSelectedOrder(updated);
      }
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to advance order status');
    }
  };

  // Open Cancel Modal
  const handleOpenCancel = (po: IPurchaseOrder) => {
    const cancellable: POStatus[] = ['draft', 'submitted', 'confirmed'];
    if (!cancellable.includes(po.status)) {
      toast.error(
        `Cannot cancel orders in "${STATUS_CONFIG[po.status]?.label || po.status}" state. Only pre-transit orders can be cancelled.`
      );
      return;
    }
    setSelectedOrder(po);
    setCancelModalOpen(true);
  };

  // Confirm Cancel
  const handleConfirmCancel = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const updated = await purchaseOrderService.cancelPurchaseOrder(selectedOrder._id);
      toast.success('Purchase order cancelled successfully');
      setCancelModalOpen(false);
      if (detailModalOpen) {
        setSelectedOrder(updated);
      } else {
        setSelectedOrder(null);
      }
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Receive Modal
  const handleOpenReceive = (po: IPurchaseOrder) => {
    const receivable: POStatus[] = ['in_transit', 'partially_received'];
    if (!receivable.includes(po.status)) {
      toast.error(
        `Cannot receive stock for an order in "${STATUS_CONFIG[po.status]?.label || po.status}" status.`
      );
      return;
    }
    setSelectedOrder(po);
    setReceiveLines(
      (po.items || []).map((item) => ({
        sku: item.sku,
        orderedQty: item.orderedQty,
        receivedQty: item.receivedQty,
        receivedQtyDelta: Math.max(0, item.orderedQty - item.receivedQty),
      }))
    );
    setFormError(null);
    setReceiveModalOpen(true);
  };

  const handleReceiveLineChange = (index: number, delta: number) => {
    setReceiveLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], receivedQtyDelta: Math.max(0, delta) };
      return copy;
    });
  };

  const handleSubmitReceive = async () => {
    if (!selectedOrder) return;
    const lines = receiveLines
      .filter((l) => l.receivedQtyDelta > 0)
      .map((l) => ({ sku: l.sku, receivedQtyDelta: l.receivedQtyDelta }));

    if (lines.length === 0) {
      setFormError('Enter at least one quantity greater than 0 to receive.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await purchaseOrderService.receivePurchaseOrder(selectedOrder._id, lines);
      toast.success('Stock received and inventory updated.');
      setReceiveModalOpen(false);
      if (detailModalOpen) setSelectedOrder(updated);
      fetchOrders();
    } catch (err: any) {
      setFormError(err.message || 'Failed to receive stock');
    } finally {
      setSubmitting(false);
    }
  };

  const getSupplierName = (sup: any) => {
    if (!sup) return 'Unknown Supplier';
    if (typeof sup === 'object') {
      return sup.companyName || sup.name || 'Unknown Supplier';
    }
    const found = suppliers.find((s) => s._id === sup);
    return found ? found.companyName || found.name : 'Unknown Supplier';
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              Purchase Orders
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {total} orders
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Procure inventory from authorized suppliers with full status tracking & variant validation.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchOrders()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>

          {canMutate && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            All Statuses
          </button>
          {PO_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              {STATUS_CONFIG[st]?.label || st}
            </button>
          ))}
        </div>

        {/* Supplier Selector */}
        <div className="w-full md:w-64">
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-950 text-slate-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading purchase orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No purchase orders found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {statusFilter !== 'all' || supplierFilter
                ? 'Try adjusting your filters to find existing purchase orders.'
                : 'Get started by creating your first purchase order with an active supplier.'}
            </p>
            {canMutate && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Purchase Order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">PO Reference</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Items & Qty</th>
                  <th className="px-4 py-3.5">Total Cost</th>
                  <th className="px-4 py-3.5">Expected Delivery</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((po) => {
                  const totalUnits = (po.items || []).reduce(
                    (sum, it) => sum + (it.orderedQty || 0),
                    0
                  );
                  const orderTotalCost =
                    po.totalCost ||
                    (po.items || []).reduce(
                      (sum, it) => sum + (it.orderedQty || 0) * (it.unitCost || 0),
                      0
                    );
                  const allowedTransitions = PO_VALID_TRANSITIONS[po.status] || [];
                  const cancellable = ['draft', 'submitted', 'confirmed'].includes(po.status);
                  const nextStatus = allowedTransitions.find((s) => s !== 'cancelled');

                  return (
                    <tr key={po._id} className="hover:bg-slate-800/40 transition-colors">
                      {/* PO Ref */}
                      <td className="px-4 py-3.5 font-mono font-medium text-xs text-slate-200">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(po)}
                          className="hover:text-indigo-400 text-slate-200 underline decoration-slate-700 hover:decoration-indigo-400 transition-colors"
                        >
                          PO-{po._id.slice(-6).toUpperCase()}
                        </button>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white">
                          {getSupplierName(po.supplier)}
                        </div>
                        {typeof po.supplier === 'object' && (po.supplier as any).email && (
                          <div className="text-xs text-slate-400">
                            {(po.supplier as any).email}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3.5">
                        <div className="text-slate-200 font-medium">
                          {po.items?.length || 0} line {po.items?.length === 1 ? 'item' : 'items'}
                        </div>
                        <div className="text-xs text-slate-400">{totalUnits} units ordered</div>
                      </td>

                      {/* Total Cost */}
                      <td className="px-4 py-3.5 font-semibold text-white">
                        Rs. {orderTotalCost.toFixed(2)}
                      </td>

                      {/* Expected Delivery */}
                      <td className="px-4 py-3.5 text-xs text-slate-300">
                        {po.expectedDeliveryDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(po.expectedDeliveryDate).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Not set</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border ${
                            STATUS_CONFIG[po.status]?.badgeClass || 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {STATUS_CONFIG[po.status]?.label || po.status}
                        </span>
                        {po.status === 'submitted' && (
                          <div className="mt-1">
                            {po.supplierResponse?.decision === 'accepted' ? (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Supplier Accepted
                              </span>
                            ) : po.supplierResponse?.decision === 'declined' ? (
                              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Supplier Declined
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Awaiting Quote
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                        {/* View Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(po)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit Button (Draft Only) */}
                        {canMutate && po.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(po)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Edit Draft"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Quick Advance Status */}
                        {canMutate && nextStatus && (() => {
                          const isGated = po.status === 'submitted' && nextStatus === 'confirmed';
                          const decision = po.supplierResponse?.decision;
                          const isPending = isGated && (decision === 'pending' || !decision);
                          const isDeclined = isGated && decision === 'declined';
                          const isDisabled = isPending || isDeclined;

                          return (
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleAdvanceStatus(po, nextStatus)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                                isDisabled
                                  ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                                  : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/30'
                              }`}
                              title={
                                isPending
                                  ? 'Cannot confirm: Awaiting supplier response'
                                  : isDeclined
                                  ? 'Cannot confirm: Supplier declined'
                                  : `Advance to ${STATUS_CONFIG[nextStatus]?.label}`
                              }
                            >
                              <span>{STATUS_CONFIG[nextStatus]?.label}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          );
                        })()}

                        {/* Cancel Button */}
                        {canMutate && cancellable && (
                          <button
                            type="button"
                            onClick={() => handleOpenCancel(po)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Cancel Order"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Receive Stock Button */}
                        {(po.status === 'in_transit' || po.status === 'partially_received') && (
                          <button
                            type="button"
                            onClick={() => handleOpenReceive(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                            title="Receive Stock"
                          >
                            <PackageCheck className="w-3 h-3" />
                            <span>Receive</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {pages} ({total} total)
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-800 rounded-lg bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="px-2.5 py-1 border border-slate-800 rounded-lg bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {(createModalOpen || editModalOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {editModalOpen ? 'Edit Draft Purchase Order' : 'Create Purchase Order'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditModalOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editModalOpen ? handleSubmitEdit : handleSubmitCreate} className="p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Supplier & Expected Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Supplier <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/60"
                  >
                    <option value="" disabled>
                      Select a supplier
                    </option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.companyName} ({s.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formExpectedDate}
                    onChange={(e) => setFormExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-950 text-white [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/60"
                  />
                </div>
              </div>

              {/* Order Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Order Items <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Variant / SKU</th>
                        <th className="px-3 py-2 w-24">Ordered Qty</th>
                        <th className="px-3 py-2 w-28">Unit Cost (Rs.)</th>
                        <th className="px-3 py-2 w-24 text-right">Line Total</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {formItems.map((item, idx) => {
                        const selectedProduct = products.find((p) => p._id === item.productId);
                        const variants = selectedProduct?.variants || [];
                        const lineTotal = (item.orderedQty || 0) * (item.unitCost || 0);

                        return (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            {/* Product Dropdown */}
                            <td className="p-2">
                              <select
                                value={item.productId}
                                onChange={(e) => handleItemProductChange(idx, e.target.value)}
                                required
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Select product</option>
                                {products.map((p) => (
                                  <option key={p._id} value={p._id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Variant / SKU Dropdown */}
                            <td className="p-2">
                              <select
                                value={item.sku}
                                onChange={(e) => handleItemVariantChange(idx, e.target.value)}
                                disabled={!item.productId || variants.length === 0}
                                required
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-800 disabled:text-slate-500"
                              >
                                <option value="">Select SKU</option>
                                {variants.map((v) => (
                                  <option key={v.sku} value={v.sku}>
                                    {v.sku} ({v.size} / {v.color}) - Stock: {v.stock}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Ordered Qty */}
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={item.orderedQty}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'orderedQty', parseInt(e.target.value) || 1)
                                }
                                required
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>

                            {/* Unit Cost */}
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={item.unitCost}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'unitCost', parseFloat(e.target.value) || 0)
                                }
                                required
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>

                            {/* Line Total */}
                            <td className="p-2 text-right font-semibold text-slate-200">
                              Rs. {lineTotal.toFixed(2)}
                            </td>

                            {/* Delete Row */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                disabled={formItems.length <= 1}
                                className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded-md transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-950/70 border-t border-slate-800 font-semibold text-slate-300">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right">
                          Grand Total:
                        </td>
                        <td className="px-3 py-2 text-right text-indigo-400 font-bold">
                          Rs. {formTotalCost.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Notes & Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Include packing slips, ship via express freight..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/60"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setEditModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving...'
                    : editModalOpen
                    ? 'Update Purchase Order'
                    : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail View Modal ────────────────────────────────────────────────── */}
      {detailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white font-mono">
                      PO-{selectedOrder._id.slice(-6).toUpperCase()}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        STATUS_CONFIG[selectedOrder.status]?.badgeClass
                      }`}
                    >
                      {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Created on {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Top Meta Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Card */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    Supplier Details
                  </div>
                  <div className="font-bold text-white text-base">
                    {getSupplierName(selectedOrder.supplier)}
                  </div>
                  {typeof selectedOrder.supplier === 'object' && (
                    <div className="text-xs text-slate-300 space-y-1">
                      <div>Contact: {(selectedOrder.supplier as any).name}</div>
                      <div>Email: {(selectedOrder.supplier as any).email}</div>
                      {(selectedOrder.supplier as any).phone && (
                        <div>Phone: {(selectedOrder.supplier as any).phone}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Delivery & Cost Card */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    Order Summary
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                    <div>
                      <span className="text-slate-400 block">Expected Delivery:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedOrder.expectedDeliveryDate
                          ? new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString()
                          : 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Total Order Cost:</span>
                      <span className="font-bold text-indigo-400 text-sm">
                        Rs. {(
                          selectedOrder.totalCost ||
                          (selectedOrder.items || []).reduce(
                            (sum, it) => sum + (it.orderedQty || 0) * (it.unitCost || 0),
                            0
                          )
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {selectedOrder.notes && (
                    <div className="pt-2 text-xs text-slate-300 border-t border-slate-800">
                      <span className="font-semibold text-slate-200">Notes:</span> {selectedOrder.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Supplier Response & Feedback Card */}
              {selectedOrder.supplierResponse && (
                <div
                  className={`p-4 rounded-xl border ${
                    selectedOrder.supplierResponse.decision === 'accepted'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : selectedOrder.supplierResponse.decision === 'declined'
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  } space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {selectedOrder.supplierResponse.decision === 'accepted' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : selectedOrder.supplierResponse.decision === 'declined' ? (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                        {selectedOrder.supplierResponse.decision === 'accepted'
                          ? 'Supplier Accepted Request & Provided Quote'
                          : selectedOrder.supplierResponse.decision === 'declined'
                          ? 'Supplier Declined Order Request'
                          : 'Awaiting Supplier Response'}
                      </span>
                    </div>
                    {selectedOrder.supplierResponse.respondedAt && (
                      <span className="text-[11px] text-slate-400">
                        Responded: {new Date(selectedOrder.supplierResponse.respondedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {selectedOrder.supplierResponse.decision === 'pending' && (
                    <p className="text-xs text-slate-400">
                      This order request has been submitted to the supplier. The supplier must review the requested quantities and quote their supply price before you can confirm this order.
                    </p>
                  )}

                  {selectedOrder.supplierResponse.estimatedDeliveryDate && (
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-medium">Supplier Estimated Delivery:</span>{' '}
                      <span className="text-white font-semibold">
                        {new Date(selectedOrder.supplierResponse.estimatedDeliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {selectedOrder.supplierResponse.notes && (
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-medium">Supplier Notes / Reason:</span>{' '}
                      <span className="text-slate-200">{selectedOrder.supplierResponse.notes}</span>
                    </div>
                  )}

                  {selectedOrder.supplierResponse.decision === 'accepted' &&
                    selectedOrder.supplierResponse.items?.length > 0 && (
                      <div className="mt-2 border border-slate-800 rounded-lg overflow-hidden">
                        <div className="p-2 bg-slate-950/90 border-b border-slate-800 text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Supplier Supply & Price Quote
                        </div>
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                            <tr>
                              <th className="px-3 py-1.5">SKU</th>
                              <th className="px-3 py-1.5 text-right">Requested Qty</th>
                              <th className="px-3 py-1.5 text-right">Can Supply Qty</th>
                              <th className="px-3 py-1.5 text-right">Admin Target Cost</th>
                              <th className="px-3 py-1.5 text-right">Supplier Quoted Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                            {selectedOrder.supplierResponse.items.map((it, i) => {
                              const originalItem = (selectedOrder.items || []).find(
                                (orig) => orig._id?.toString() === it.poItemId?.toString()
                              );
                              return (
                                <tr key={i}>
                                  <td className="px-3 py-1.5 text-slate-200 font-mono font-medium">
                                    {originalItem?.sku || `Item #${i + 1}`}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-slate-400">
                                    {originalItem?.orderedQty || '?'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-emerald-400">
                                    {it.canSupplyQty}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-slate-400">
                                    Rs. {(originalItem?.unitCost || 0).toFixed(2)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-bold text-white">
                                    Rs. {it.unitPrice.toFixed(2)}
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

              {/* Status Progression Bar */}
              {selectedOrder.status !== 'cancelled' && (
                <div className="p-4 border border-slate-800 rounded-xl bg-slate-950 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Order Lifecycle</span>
                    <span className="text-indigo-400 font-bold">
                      {STATUS_CONFIG[selectedOrder.status]?.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {['draft', 'submitted', 'confirmed', 'in_transit', 'received'].map(
                      (stKey, i) => {
                        const currentStep = STATUS_CONFIG[selectedOrder.status]?.stepIndex ?? 0;
                        const isPast = i < currentStep;
                        const isCurrent = i === currentStep;

                        return (
                          <div key={stKey} className="flex flex-col items-center text-center">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                isCurrent
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : isPast
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {isPast ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                            </div>
                            <span
                              className={`text-[11px] mt-1 capitalize ${
                                isCurrent
                                  ? 'font-bold text-indigo-400'
                                  : isPast
                                  ? 'font-medium text-slate-200'
                                  : 'text-slate-500'
                              }`}
                            >
                              {stKey.replace('_', ' ')}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-400" />
                  Line Items ({selectedOrder.items?.length || 0})
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5">Product Name</th>
                        <th className="px-4 py-2.5">SKU</th>
                        <th className="px-4 py-2.5">Size / Color</th>
                        <th className="px-4 py-2.5 text-right">Ordered Qty</th>
                        <th className="px-4 py-2.5 text-right">Received Qty</th>
                        <th className="px-4 py-2.5 text-right">Unit Cost</th>
                        <th className="px-4 py-2.5 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(selectedOrder.items || []).map((it, idx) => {
                        const pName =
                          typeof it.product === 'object'
                            ? (it.product as any).name
                            : 'Product #' + String(it.product).slice(-4);
                        const lineTotal = (it.orderedQty || 0) * (it.unitCost || 0);

                        return (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2.5 font-medium text-white">{pName}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">{it.sku}</td>
                            <td className="px-4 py-2.5 text-slate-400">
                              {it.size} / {it.color}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-200">
                              {it.orderedQty}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                              {it.receivedQty || 0}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-300">
                              Rs. {(it.unitCost || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-white">
                              Rs. {lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-950/70 border-t border-slate-800 font-bold text-slate-200">
                      <tr>
                        <td colSpan={6} className="px-4 py-2.5 text-right">
                          Total Order Value:
                        </td>
                        <td className="px-4 py-2.5 text-right text-indigo-400 font-extrabold text-sm">
                          Rs. {(
                            selectedOrder.totalCost ||
                            (selectedOrder.items || []).reduce(
                              (sum, it) => sum + (it.orderedQty || 0) * (it.unitCost || 0),
                              0
                            )
                          ).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Status Transition & Actions in Modal */}
              {canMutate && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {['draft', 'submitted', 'confirmed'].includes(selectedOrder.status) && (
                      <button
                        type="button"
                        onClick={() => handleOpenCancel(selectedOrder)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel Order
                      </button>
                    )}

                    {(selectedOrder.status === 'in_transit' || selectedOrder.status === 'partially_received') && (
                      <button
                        type="button"
                        onClick={() => handleOpenReceive(selectedOrder)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        Receive Stock
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {(PO_VALID_TRANSITIONS[selectedOrder.status] || [])
                      .filter((s) => s !== 'cancelled')
                      .map((nextSt) => {
                        const isGatedConfirm =
                          selectedOrder.status === 'submitted' && nextSt === 'confirmed';
                        const decision = selectedOrder.supplierResponse?.decision;
                        const isPending = isGatedConfirm && (decision === 'pending' || !decision);
                        const isDeclined = isGatedConfirm && decision === 'declined';
                        const isDisabled = isPending || isDeclined;

                        return (
                          <div key={nextSt} className="flex flex-col items-end">
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleAdvanceStatus(selectedOrder, nextSt)}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-colors shadow-sm ${
                                isDisabled
                                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
                              }`}
                            >
                              <span>Advance to {STATUS_CONFIG[nextSt]?.label || nextSt}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            {isPending && (
                              <span className="text-[10px] text-amber-400 mt-1">
                                Awaiting supplier quote & response
                              </span>
                            )}
                            {isDeclined && (
                              <span className="text-[10px] text-rose-400 mt-1">
                                Supplier declined order request
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ────────────────────────────────────────── */}
      {cancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white">
                Cancel Purchase Order?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to cancel order{' '}
                <span className="font-mono font-bold text-slate-200">
                  PO-{selectedOrder._id.slice(-6).toUpperCase()}
                </span>
                ? This order cannot be reopened once cancelled.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Cancelling...' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receive Stock Modal ─────────────────────────────────────────── */}
      {receiveModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Receive Stock</h2>
                <span className="text-xs text-slate-400 font-mono">
                  PO-{selectedOrder._id.slice(-6).toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-400">
                Enter the quantity received for each SKU. Amounts are capped at the remaining ordered quantity.
              </p>

              {receiveLines.map((line, idx) => {
                const remaining = line.orderedQty - line.receivedQty;
                return (
                  <div
                    key={line.sku}
                    className="flex items-center gap-4 p-3 rounded-xl border border-slate-800 bg-slate-950"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{line.sku}</p>
                      <p className="text-xs text-slate-400">
                        Ordered: {line.orderedQty} &bull; Already received: {line.receivedQty} &bull;{' '}
                        <span className={remaining > 0 ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                          Remaining: {remaining}
                        </span>
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={line.receivedQtyDelta}
                      onChange={(e) => handleReceiveLineChange(idx, Number(e.target.value))}
                      disabled={remaining <= 0}
                      className="w-24 text-sm text-center border border-slate-700 bg-slate-900 text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-800 disabled:text-slate-500"
                    />
                  </div>
                );
              })}

              {formError && (
                <p className="text-xs text-rose-400 font-medium mt-2">{formError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReceive}
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
              >
                <PackageCheck className="w-4 h-4" />
                {submitting ? 'Receiving...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPurchaseOrdersPage;