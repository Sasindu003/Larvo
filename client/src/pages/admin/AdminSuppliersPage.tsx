import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit3,
  Ban,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Package,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  supplierService,
  ISupplier,
  SupplierStatus,
  SupplierProductItem,
  CreateSupplierInput,
  UpdateSupplierInput,
} from '../../services/supplier.service';

export const AdminSuppliersPage: React.FC = () => {
  const { user } = useAuth();
  const canMutate = user?.role === 'admin' || user?.role === 'owner';

  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<ISupplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Form states
  const [formData, setFormData] = useState<CreateSupplierInput>({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierService.getSuppliers({
        page,
        limit,
        status: statusFilter,
        search: searchQuery.trim() || undefined,
      });
      setSuppliers(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, searchQuery]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    });
    setFormError(null);
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (sup: ISupplier) => {
    setSelectedSupplier(sup);
    setFormData({
      name: sup.name,
      companyName: sup.companyName,
      email: sup.email,
      phone: sup.phone,
      address: sup.address || '',
      notes: sup.notes || '',
    });
    setFormError(null);
    setEditModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetail = async (sup: ISupplier) => {
    setSelectedSupplier(sup);
    setDetailModalOpen(true);
    setLoadingProducts(true);
    try {
      const res = await supplierService.getSupplierProducts(sup._id);
      setSupplierProducts(res.products || []);
    } catch {
      setSupplierProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Open Deactivate Modal
  const handleOpenDeactivate = (sup: ISupplier) => {
    setSelectedSupplier(sup);
    setDeactivateModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (sup: ISupplier) => {
    setSelectedSupplier(sup);
    setDeleteModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in all required fields (Company, Contact Name, Email, Phone).');
      return;
    }

    if (!/^\d{10,13}$/.test(formData.phone.trim())) {
      setFormError('Phone number must contain only numbers and be 10 to 13 digits long (no letters or words).');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await supplierService.createSupplier(formData);
      const supplier = res.supplier;
      toast.success(`Supplier "${supplier.companyName}" created successfully`);
      setCreateModalOpen(false);
      fetchSuppliers();
      if (res.credentials) {
        setCredentialsModal(res.credentials);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create supplier';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Create Portal Account for selected supplier
  const handleCreateAccount = async () => {
    if (!selectedSupplier) return;
    setCreatingAccount(true);
    try {
      const res = await supplierService.createSupplierAccount(selectedSupplier._id);
      setSelectedSupplier({ ...selectedSupplier, userId: res.supplier.userId });
      setCredentialsModal(res.credentials);
      toast.success('Portal account created successfully!');
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create portal account');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    if (!formData.companyName.trim() || !formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (!/^\d{10,13}$/.test(formData.phone.trim())) {
      setFormError('Phone number must contain only numbers and be 10 to 13 digits long (no letters or words).');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await supplierService.updateSupplier(selectedSupplier._id, formData);
      toast.success(`Supplier "${updated.companyName}" updated successfully`);
      setEditModalOpen(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update supplier';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Deactivate
  const handleConfirmDeactivate = async () => {
    if (!selectedSupplier) return;

    setSubmitting(true);
    try {
      const updated = await supplierService.deactivateSupplier(selectedSupplier._id);
      toast.success(`Supplier "${updated.companyName}" marked as inactive`);
      setDeactivateModalOpen(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate supplier');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return;

    setSubmitting(true);
    try {
      await supplierService.deleteSupplier(selectedSupplier._id);
      toast.success(`Supplier "${selectedSupplier.companyName}" deleted successfully`);
      setDeleteModalOpen(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (err.response?.status === 409
          ? 'Cannot delete supplier because it is referenced by existing product variants. Please deactivate instead.'
          : 'Failed to delete supplier');
      toast.error(msg, { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              Supplier Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {total} suppliers
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Maintain garment vendors, textile mills, and authorized product suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchSuppliers()}
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
              Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* ── Filters & Search ────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Suppliers' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search company, contact, or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Primary Contact</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading suppliers...</span>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="font-semibold text-sm text-slate-300">No suppliers found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try clearing your search query or status filter.'
                        : 'Get started by creating your first supplier entry.'}
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr
                    key={sup._id}
                    onClick={() => handleOpenDetail(sup)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Company */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                            {sup.companyName}
                          </p>
                          {sup.notes && (
                            <p className="text-xs text-slate-400 line-clamp-1 italic mt-0.5">
                              {sup.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4">
                      <p className="font-medium text-slate-200">{sup.name}</p>
                      <div className="flex flex-col text-xs text-slate-400 mt-0.5 gap-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {sup.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {sup.phone}
                        </span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-4 px-4 text-xs text-slate-400 max-w-xs truncate">
                      {sup.address ? (
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{sup.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">No address recorded</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      {sup.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(sup)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canMutate && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(sup)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                              title="Edit Supplier"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {sup.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleOpenDeactivate(sup)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Deactivate Supplier"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenDelete(sup)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete Supplier"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────────── */}
        <div className="py-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
          <div>
            Showing <strong className="text-slate-200">{suppliers.length}</strong> of{' '}
            <strong className="text-slate-200">{total}</strong> suppliers
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── Create Modal ────────────────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Add New Supplier</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Company Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Textiles Ltd."
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Primary Contact Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rep@supplier.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Phone <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={13}
                    placeholder="e.g. 0771234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Numbers only, 10–13 digits {formData.phone ? `(${formData.phone.length}/13)` : ''}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, City, State/Province, Postal Code, Country"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Lead times, fabric specialties, minimum order quantities..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Create Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {editModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Edit Supplier Details</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Company Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Primary Contact Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Email <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Phone <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={13}
                    placeholder="e.g. 0771234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Numbers only, 10–13 digits {formData.phone ? `(${formData.phone.length}/13)` : ''}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {detailModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">{selectedSupplier.companyName}</h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Status</span>
                  {selectedSupplier.status === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-slate-800 text-slate-400 border border-slate-700 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Added On</span>
                  <span className="text-xs font-medium text-slate-200 mt-1 block">
                    {new Date(selectedSupplier.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block">Contact Person</span>
                  <p className="font-semibold text-slate-200 text-sm">{selectedSupplier.name}</p>
                  <p className="text-slate-400 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {selectedSupplier.email}
                  </p>
                  <p className="text-slate-400 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {selectedSupplier.phone}
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider block">Address</span>
                  {selectedSupplier.address ? (
                    <p className="text-slate-300 leading-relaxed mt-0.5">{selectedSupplier.address}</p>
                  ) : (
                    <p className="text-slate-500 italic">None provided</p>
                  )}
                </div>
              </div>

              {/* Portal Access Status & Actions */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {selectedSupplier.userId ? (
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {selectedSupplier.userId ? 'Portal Account Active' : 'No Portal Access'}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {selectedSupplier.userId
                        ? 'Supplier can log into the supplier portal with their email'
                        : 'Supplier does not have an active portal login yet'}
                    </span>
                  </div>
                </div>

                {!selectedSupplier.userId && canMutate && (
                  <button
                    type="button"
                    disabled={creatingAccount}
                    onClick={handleCreateAccount}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                  >
                    {creatingAccount ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                    Create Portal Account
                  </button>
                )}
              </div>

              {/* Associated Products */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    Supplied Products & Variants ({supplierProducts.reduce((sum, p) => sum + p.variants.length, 0)})
                  </span>
                </div>

                {loadingProducts ? (
                  <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    Loading supplied products...
                  </div>
                ) : supplierProducts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                    No products or variants currently linked to this supplier.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {supplierProducts.map((p) => (
                      <div key={p._id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            {p.images && p.images[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-slate-800 flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-xs flex-shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                              <span className="text-[10px] text-slate-400 font-mono">/{p.slug}</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-slate-200 flex-shrink-0 ml-2">Rs. {p.basePrice.toLocaleString()}</span>
                        </div>

                        {/* Variants pill list */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {p.variants.map((v) => (
                            <div key={v.sku} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]">
                              <span className="font-mono text-slate-300 font-semibold">{v.sku}</span>
                              <span className="text-slate-400">{v.size} · {v.color}</span>
                              <span className="font-medium text-slate-200">{v.stock} in stock</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSupplier.notes && (
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs">
                  <span className="font-semibold text-amber-400 uppercase tracking-wider block mb-1">Notes</span>
                  <p className="text-amber-200/90 italic">"{selectedSupplier.notes}"</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              {canMutate ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenEdit(selectedSupplier);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors border border-indigo-500/30"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {selectedSupplier.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenDeactivate(selectedSupplier);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors border border-amber-500/30"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Deactivate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenDelete(selectedSupplier);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors border border-rose-500/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              ) : (
                <div />
              )}
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate Modal ────────────────────────────────────────────────── */}
      {deactivateModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Deactivate Supplier</h3>
              </div>
              <button
                onClick={() => setDeactivateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-300">
                Are you sure you want to deactivate{' '}
                <strong className="text-white font-semibold">{selectedSupplier.companyName}</strong>?
              </p>
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                Deactivated suppliers cannot be chosen for new purchase orders or re-stock orders, but historical orders and directory records will be preserved.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeactivateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDeactivate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ────────────────────────────────────────────────────── */}
      {deleteModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Delete Supplier</h3>
                <p className="text-xs text-slate-400">
                  Are you sure you want to permanently delete <strong className="text-slate-200">{selectedSupplier.companyName}</strong>?
                </p>
                <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mt-2 text-left leading-relaxed">
                  <strong>Referential Integrity Rule:</strong> Suppliers referenced by existing product variants cannot be hard-deleted (409 Conflict). Deactivate instead to preserve historical catalog records.
                </div>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── One-Time Credentials Modal ─────────────────────────────────────── */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Supplier Portal Credentials</h3>
              </div>
              <button
                onClick={() => {
                  setCredentialsModal(null);
                  setCopiedPassword(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-200">Important: Save these credentials now</p>
                  <p className="text-[11px] leading-relaxed text-amber-300/90">
                    This temporary password is shown <strong>once only</strong>. Provide it to the supplier so they can access their portal.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Login Email
                  </label>
                  <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs select-all">
                    {credentialsModal.email}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Temporary Password
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 font-mono text-sm tracking-wider select-all font-semibold">
                      {credentialsModal.tempPassword}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(credentialsModal.tempPassword);
                        setCopiedPassword(true);
                        toast.success('Password copied to clipboard');
                        setTimeout(() => setCopiedPassword(false), 2500);
                      }}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {copiedPassword ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      {copiedPassword ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCredentialsModal(null);
                    setCopiedPassword(false);
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSuppliersPage;
