import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Search,
  RefreshCw,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Package,
  Loader2,
  Check,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  inventoryService,
  AdminInventoryItem,
} from '../../services/inventory.service';
import { supplierService, ISupplier } from '../../services/supplier.service';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/roles';

export const AdminInventoryPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = !!user && ROLES.STAFF_AND_ABOVE.includes(user.role as any);

  const [items, setItems] = useState<AdminInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'low_stock' | 'out_of_stock' | ''>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  // Inline edit state map: sku -> { value: string, saving: boolean, saved: boolean, error?: string }
  const [editStates, setEditStates] = useState<
    Record<string, { value: string; saving: boolean; saved: boolean; error?: string }>
  >({});

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch inventory
  const fetchInventory = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);

        const res = await inventoryService.getAdminInventory({
          search: debouncedSearch.trim() || undefined,
          status: statusFilter || undefined,
          supplier: supplierFilter || undefined,
          page,
          limit,
        });

        setItems(res.items || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);

        // Initialize inline edit state values from server
        const initialEdits: Record<string, { value: string; saving: boolean; saved: boolean }> = {};
        (res.items || []).forEach((item) => {
          initialEdits[item.sku] = {
            value: item.stock.toString(),
            saving: false,
            saved: false,
          };
        });
        setEditStates(initialEdits);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load inventory');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter, supplierFilter, page, limit]
  );

  useEffect(() => {
    supplierService.getSuppliers({ limit: 100 }).then((res) => {
      setSuppliers(res.results || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Handle stock value change locally in input
  const handleStockChange = (sku: string, value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        value,
        saved: false,
        error: undefined,
      },
    }));
  };

  // Commit stock adjustment on blur or enter key
  const handleStockSave = async (sku: string, currentServerStock: number) => {
    const editState = editStates[sku];
    if (!editState) return;

    const parsed = parseInt(editState.value, 10);
    if (isNaN(parsed) || parsed < 0) {
      toast.error(`Invalid stock quantity for ${sku}. Must be 0 or greater.`);
      setEditStates((prev) => ({
        ...prev,
        [sku]: { ...prev[sku], value: currentServerStock.toString() },
      }));
      return;
    }

    if (parsed === currentServerStock) {
      // Nothing changed
      return;
    }

    try {
      setEditStates((prev) => ({
        ...prev,
        [sku]: { ...prev[sku], saving: true, error: undefined },
      }));

      const updated = await inventoryService.adjustStock(sku, parsed);

      // Update item in local list
      setItems((prev) =>
        prev.map((item) =>
          item.sku === sku
            ? { ...item, stock: updated.stock, status: updated.status as any }
            : item
        )
      );

      setEditStates((prev) => ({
        ...prev,
        [sku]: { value: updated.stock.toString(), saving: false, saved: true },
      }));

      toast.success(`Updated SKU ${sku} stock to ${updated.stock}`);

      // Clear saved checkmark after 2 seconds
      setTimeout(() => {
        setEditStates((prev) =>
          prev[sku] ? { ...prev, [sku]: { ...prev[sku], saved: false } } : prev
        );
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || `Failed to update stock for ${sku}`);
      setEditStates((prev) => ({
        ...prev,
        [sku]: {
          value: currentServerStock.toString(),
          saving: false,
          saved: false,
          error: err.message,
        },
      }));
    }
  };

  const renderStatusBadge = (status: AdminInventoryItem['status']) => {
    switch (status) {
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            Out of Stock
          </span>
        );
      case 'low_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            Low Stock
          </span>
        );
      case 'in_stock':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            In Stock
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">
            <Boxes className="w-4 h-4" />
            Stock & Warehousing
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">
            Central Inventory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor real-time catalog stock levels, identify supply deficits, and make inline stock adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchInventory(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Refresh inventory data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Status Filter Tabs */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-0.5"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === ''
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            All Items
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('low_stock');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'low_stock'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-amber-400/90 hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Low Stock (1–5)
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('out_of_stock');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'out_of_stock'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-slate-950 text-rose-400/90 hover:bg-slate-800 border border-slate-800/80'
            }`}
          >
            <XCircle className="w-3 h-3" />
            Out of Stock (0)
          </button>
        </div>

        {/* Supplier Filter Dropdown */}
        <div className="relative min-w-[200px] flex-shrink-0">
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setPage(1);
            }}
            className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            <option value="">All Suppliers</option>
            <option value="unassigned">Unassigned (No Supplier)</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.companyName || s.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Inventory Table Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">Variant</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 w-40">Available Stock</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    <span>Loading real-time inventory catalog...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p className="font-semibold text-sm text-slate-300">No inventory matches found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery || statusFilter || supplierFilter
                        ? 'Try clearing your search query or resetting filters.'
                        : 'No product variants currently registered in the database.'}
                    </p>
                    {(searchQuery || statusFilter || supplierFilter) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('');
                          setSupplierFilter('');
                          setPage(1);
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                      >
                        Reset Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const editState = editStates[item.sku] || {
                    value: item.stock.toString(),
                    saving: false,
                    saved: false,
                  };

                  const isLowStock = item.status === 'low_stock';
                  const isOutOfStock = item.status === 'out_of_stock';

                  const rowHighlightClass = isOutOfStock
                    ? 'bg-rose-950/15 hover:bg-rose-950/25 border-l-2 border-l-rose-500'
                    : isLowStock
                    ? 'bg-amber-950/15 hover:bg-amber-950/25 border-l-2 border-l-amber-500'
                    : 'hover:bg-slate-800/40 border-l-2 border-l-transparent';

                  return (
                    <tr
                      key={item.sku}
                      className={`transition-colors ${rowHighlightClass}`}
                    >
                      {/* Product Thumbnail + Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/80 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {item.product.image ? (
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className="w-full h-full object-cover object-center"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-[240px]">
                            <div className="font-semibold text-slate-200 truncate" title={item.product.name}>
                              {item.product.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">
                              /{item.product.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-300 font-semibold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                          {item.sku}
                        </span>
                      </td>

                      {/* Variant Size & Color */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.size}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/80">
                            {item.color}
                          </span>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4">
                        {item.supplier ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200 text-xs truncate max-w-[160px]" title={item.supplier.companyName || item.supplier.name}>
                              {item.supplier.companyName || item.supplier.name}
                            </span>
                            {item.supplier.status === 'inactive' && (
                              <span className="text-[10px] text-slate-500 font-medium">(Inactive)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Inline Stock Edit */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              disabled={!canEdit || editState.saving}
                              value={editState.value}
                              onChange={(e) => handleStockChange(item.sku, e.target.value)}
                              onBlur={() => handleStockSave(item.sku, item.stock)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className={`w-20 px-2.5 py-1 text-center font-mono font-bold text-xs rounded-lg border bg-slate-950 focus:outline-none transition-all ${
                                editState.saving
                                  ? 'opacity-60 cursor-wait border-slate-700'
                                  : isOutOfStock
                                  ? 'text-rose-400 border-rose-500/40 focus:border-rose-400 focus:ring-1 focus:ring-rose-500/30'
                                  : isLowStock
                                  ? 'text-amber-400 border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-500/30'
                                  : 'text-slate-200 border-slate-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30'
                              }`}
                              title="Click to edit stock level. Saves automatically on blur or Enter."
                            />
                          </div>

                          {/* Inline status indicator */}
                          <div className="w-5 h-5 flex items-center justify-center">
                            {editState.saving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            ) : editState.saved ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400 animate-fade-in" />
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* Link to public PDP */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/products/${item.product.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-amber-400 transition-colors p-1 rounded hover:bg-slate-800"
                          title="Open product details page in new tab"
                        >
                          <span>PDP</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{items.length}</span> of{' '}
            <span className="font-semibold text-slate-200">{total}</span> total variants
            {statusFilter && (
              <span className="ml-1 text-slate-500">
                (filtered by {statusFilter === 'low_stock' ? 'Low Stock' : 'Out of Stock'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-2 font-mono font-medium text-slate-300">
              {page} / {pages}
            </span>

            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminInventoryPage;
