import React, { useEffect, useState, useCallback } from 'react';
import {
  Tag,
  Plus,
  Search,
  Edit2,
  PowerOff,
  Calendar,
  Percent,
  Coins,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  couponService,
  Coupon,
  DiscountType,
  CreateCouponDto,
  UpdateCouponDto,
} from '../../services/coupon.service';

interface FormState {
  code: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  validFrom: string;
  validUntil: string;
  usageLimit: string;
  perCustomerLimit: string;
  active: boolean;
}

const blankForm = (): FormState => {
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(now.getDate() + 30);

  return {
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '0',
    maxDiscountAmount: '',
    validFrom: now.toISOString().slice(0, 10),
    validUntil: nextMonth.toISOString().slice(0, 10),
    usageLimit: '',
    perCustomerLimit: '',
    active: true,
  };
};

export const AdminCouponsPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'owner';

  // ── List state ───────────────────────────────────────────────────────────────
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ── Modal / Action state ─────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Deactivate dialog
  const [deactivateTarget, setDeactivateTarget] = useState<Coupon | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // ── Fetch Coupons ────────────────────────────────────────────────────────────
  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await couponService.getAdminCoupons({
        page,
        limit: 10,
        q: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setCoupons(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err: any) {
      setListError(err.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // ── Modal helpers ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setForm(blankForm());
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c: Coupon) => {
    setEditTarget(c);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      minOrderAmount: String(c.minOrderAmount || 0),
      maxDiscountAmount: c.maxDiscountAmount !== null ? String(c.maxDiscountAmount) : '',
      validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 10) : '',
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 10) : '',
      usageLimit: c.usageLimit !== null ? String(c.usageLimit) : '',
      perCustomerLimit: c.perCustomerLimit !== null ? String(c.perCustomerLimit) : '',
      active: c.active,
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const code = form.code.trim().toUpperCase();
    if (!code) {
      setFormError('Coupon code is required');
      return;
    }

    const discountVal = parseFloat(form.discountValue);
    if (isNaN(discountVal) || discountVal <= 0) {
      setFormError('Discount value must be a positive number');
      return;
    }

    if (form.discountType === 'percentage' && discountVal > 100) {
      setFormError('Percentage discount cannot exceed 100%');
      return;
    }

    if (!form.validUntil) {
      setFormError('Expiry date is required');
      return;
    }

    const fromDate = form.validFrom ? new Date(form.validFrom) : new Date();
    const untilDate = new Date(form.validUntil);
    if (untilDate.getTime() <= fromDate.getTime()) {
      setFormError('Expiry date must be after the start date');
      return;
    }

    const payload: CreateCouponDto | UpdateCouponDto = {
      code,
      discountType: form.discountType,
      discountValue: discountVal,
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
      maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
      validUntil: new Date(form.validUntil).toISOString(),
      usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : null,
      perCustomerLimit: form.perCustomerLimit ? parseInt(form.perCustomerLimit, 10) : null,
      active: form.active,
    };

    setSubmitting(true);
    try {
      if (editTarget) {
        await couponService.updateCoupon(editTarget._id, payload);
      } else {
        await couponService.createCoupon(payload as CreateCouponDto);
      }
      closeModal();
      fetchCoupons();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Deactivate Handler ───────────────────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await couponService.deactivateCoupon(deactivateTarget._id);
      setDeactivateTarget(null);
      fetchCoupons();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate coupon');
    } finally {
      setDeactivating(false);
    }
  };

  // ── Status Helper ────────────────────────────────────────────────────────────
  const getCouponStatus = (c: Coupon) => {
    const isExpired = new Date(c.validUntil).getTime() < Date.now();
    if (!c.active) return { label: 'Inactive', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    if (isExpired) return { label: 'Expired', color: 'bg-amber-950/40 text-amber-400 border-amber-800/60' };
    return { label: 'Active', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60' };
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-violet-400" />
            Coupons
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create and manage promotional discount codes and order limits.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            New Coupon
          </button>
        )}
      </div>

      {/* ── Filter & Search Bar ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by coupon code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          {(['all', 'active', 'inactive', 'expired'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700/60 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table / Cards ─────────────────────────────────────────────────── */}
      {listError && (
        <div className="p-4 bg-rose-950/30 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          {listError}
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/50 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min Order</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-4 py-12 text-center">
                    <Tag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-slate-400">No coupons found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {search || statusFilter !== 'all'
                        ? 'Try clearing your search or status filter.'
                        : 'Click "New Coupon" above to create your first discount code.'}
                    </p>
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const statusInfo = getCouponStatus(c);
                  return (
                    <tr key={c._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-100 tracking-wider">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-violet-300">
                          {c.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200">
                          {c.discountType === 'percentage' ? (
                            <>
                              <Percent className="w-3.5 h-3.5 text-violet-400" />
                              <span>{c.discountValue}% Off</span>
                              {c.maxDiscountAmount && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  (up to ৳{c.maxDiscountAmount})
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <Coins className="w-3.5 h-3.5 text-emerald-400" />
                              <span>৳{c.discountValue} Flat</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {c.minOrderAmount > 0 ? `৳${c.minOrderAmount}` : 'None'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{new Date(c.validUntil).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>
                            {c.usedCount}
                            {c.usageLimit !== null ? ` / ${c.usageLimit}` : ' (Unlimited)'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              title="Edit Coupon"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-300 hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {c.active && (
                              <button
                                type="button"
                                onClick={() => setDeactivateTarget(c)}
                                title="Deactivate Coupon"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} coupons
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                {page} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-violet-400" />
                {editTarget ? 'Edit Coupon' : 'Create New Coupon'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/30 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Code */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  placeholder="e.g. SUMMER25"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 font-mono uppercase focus:outline-none focus:border-violet-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Always uppercase and case-insensitively unique.</p>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Discount Type *</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {form.discountType === 'percentage' ? 'Discount Percentage (%) *' : 'Discount Value (৳) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={form.discountType === 'percentage' ? 100 : undefined}
                    step="any"
                    placeholder={form.discountType === 'percentage' ? '20' : '200'}
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Min Order Amount (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Discount Cap (৳)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="Optional limit"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valid From</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valid Until (Expiry) *</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Per-Customer Limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={form.perCustomerLimit}
                    onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="couponActive"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded text-violet-600 bg-slate-800 border-slate-700 focus:ring-violet-500"
                />
                <label htmlFor="couponActive" className="text-slate-300 select-none cursor-pointer">
                  Coupon is active and redeemable by eligible customers
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editTarget ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Deactivate Dialog ─────────────────────────────────────────────── */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-100">Deactivate Coupon</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to deactivate <strong className="text-slate-100">{deactivateTarget.code}</strong>?
              Customers will immediately no longer be able to apply this code at checkout.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deactivating}
                onClick={handleDeactivate}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCouponsPage;
