import React, { useEffect, useState, useCallback } from 'react';
import {
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
  User,
  Coins,
  FileText,
  Clock,
  X,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  returnService,
  IReturnRequest,
  ReturnStatus,
} from '../../services/return.service';

interface StatusBadgeConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const STATUS_CONFIG: Record<ReturnStatus, StatusBadgeConfig> = {
  requested: {
    label: 'Requested',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  pickup_scheduled: {
    label: 'Pickup Scheduled',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  received: {
    label: 'Received',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
};

const TAB_STATUSES: Array<{ id: 'all' | ReturnStatus; label: string }> = [
  { id: 'all', label: 'All Returns' },
  { id: 'requested', label: 'Requested' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { id: 'picked_up', label: 'Picked Up' },
  { id: 'received', label: 'Received' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'rejected', label: 'Rejected' },
];

export const AdminReturnsPage: React.FC = () => {
  const [returns, setReturns] = useState<IReturnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ReturnStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [selectedReturn, setSelectedReturn] = useState<IReturnRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [activeActionReturn, setActiveActionReturn] = useState<IReturnRequest | null>(null);
  const [activeRefundReturn, setActiveRefundReturn] = useState<IReturnRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await returnService.getAdminReturns({
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setReturns(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load return requests');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleOpenApprove = (ret: IReturnRequest) => {
    setActiveActionReturn(ret);
    setActionError(null);
    setApproveModalOpen(true);
  };

  const handleOpenReject = (ret: IReturnRequest) => {
    setActiveActionReturn(ret);
    setRejectionReason('');
    setActionError(null);
    setRejectModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!activeActionReturn) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const updated = await returnService.processDecision(activeActionReturn._id, {
        decision: 'approved',
      });
      toast.success('Return request approved successfully');
      setApproveModalOpen(false);
      setActiveActionReturn(null);
      // Update item in local state
      setReturns((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
      );
      if (selectedReturn?._id === updated._id) {
        setSelectedReturn({ ...selectedReturn, ...updated });
      }
      fetchReturns();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to approve return request';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!activeActionReturn) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setActionError('Rejection reason is required');
      return;
    }
    if (trimmed.length < 5) {
      setActionError('Rejection reason must be at least 5 characters');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    try {
      const updated = await returnService.processDecision(activeActionReturn._id, {
        decision: 'rejected',
        rejectionReason: trimmed,
      });
      toast.success('Return request rejected');
      setRejectModalOpen(false);
      setActiveActionReturn(null);
      setRejectionReason('');
      // Update item in local state
      setReturns((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
      );
      if (selectedReturn?._id === updated._id) {
        setSelectedReturn({ ...selectedReturn, ...updated });
      }
      fetchReturns();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reject return request';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleOpenRefund = (ret: IReturnRequest) => {
    setActiveRefundReturn(ret);
    setRefundModalOpen(true);
  };

  const handleConfirmRefund = async () => {
    if (!activeRefundReturn) return;
    setSubmittingRefund(true);
    try {
      const updated = await returnService.processAdminRefund(activeRefundReturn._id);
      toast.success(
        `Refund of ${(updated.refundPoints || 0).toLocaleString()} points processed successfully!`
      );
      setRefundModalOpen(false);
      setActiveRefundReturn(null);
      setReturns((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
      );
      if (selectedReturn?._id === updated._id) {
        setSelectedReturn({ ...selectedReturn, ...updated });
      }
      fetchReturns();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to process refund';
      toast.error(msg);
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Client-side quick filter for search keyword
  const filteredReturns = returns.filter((ret) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = ret._id.toLowerCase().includes(q);
    const orderIdMatch =
      typeof ret.order === 'object' && ret.order?._id
        ? ret.order._id.toLowerCase().includes(q)
        : String(ret.order).toLowerCase().includes(q);
    const userMatch =
      typeof ret.user === 'object' && ret.user
        ? (ret.user.name || '').toLowerCase().includes(q) ||
          (ret.user.email || '').toLowerCase().includes(q)
        : false;
    return idMatch || orderIdMatch || userMatch;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-sm">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Return Requests</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {total}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Review, approve, or reject customer return requests and inspect estimated refund points.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchReturns}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-slate-700' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Filter Bar & Search ────────────────────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, customer name, or email..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick status tabs */}
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {TAB_STATUSES.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Request ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4 text-center">Est. Refund</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-slate-100 rounded w-40"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded w-16"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 rounded w-24"></div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-6 bg-slate-200 rounded-full w-20 mx-auto"></div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-6 bg-slate-200 rounded-full w-24 mx-auto"></div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-8 bg-slate-200 rounded-lg w-20 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                      <RotateCcw className="w-6 h-6" />
                    </div>
                    <p className="font-medium text-slate-800 mb-1">No return requests found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {statusFilter !== 'all'
                        ? `There are currently no return requests with status "${statusFilter}".`
                        : 'No return requests have been submitted yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => {
                  const st = STATUS_CONFIG[ret.status] || STATUS_CONFIG.requested;
                  const totalItemsQty = ret.items.reduce((acc, it) => acc + it.qty, 0);
                  const isCustomerObj = typeof ret.user === 'object' && ret.user !== null;
                  const customerName = isCustomerObj ? ret.user.name || 'Anonymous' : 'Customer';
                  const customerEmail = isCustomerObj ? ret.user.email : '';
                  const shortId = ret._id.substring(ret._id.length - 8).toUpperCase();
                  const canDecide = ret.status === 'requested' || ret.status === 'under_review';

                  // Est. Refund Points (server provided)
                  const displayPoints =
                    ret.status === 'refunded'
                      ? ret.refundPoints
                      : ret.estimatedRefundPoints;

                  return (
                    <tr
                      key={ret._id}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedReturn(ret);
                        setDetailModalOpen(true);
                      }}
                    >
                      <td className="py-4 px-4 font-mono font-medium text-slate-800">
                        <span className="text-slate-400">#</span>
                        {shortId}
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-800">{customerName}</p>
                        {customerEmail && (
                          <p className="text-xs text-slate-400">{customerEmail}</p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          {totalItemsQty} {totalItemsQty === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-xs text-slate-400 block">
                          ({ret.items.length} {ret.items.length === 1 ? 'sku' : 'skus'})
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-500 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(ret.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {displayPoints != null ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Coins className="w-3.5 h-3.5 text-amber-500" />
                            {displayPoints.toLocaleString()} pts
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.bg} ${st.text} ${st.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>

                      <td
                        className="py-4 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {canDecide ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenApprove(ret)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                                title="Approve return request"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReject(ret)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                                title="Reject return request"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              {ret.status === 'received' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRefund(ret)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-xs"
                                  title="Process points refund to customer wallet"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  Refund
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReturn(ret);
                                  setDetailModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                            </>
                          )}
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
        <div className="py-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{filteredReturns.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{total}</span> returns
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="px-2 font-medium text-slate-700">
              Page {page} of {pages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {detailModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-slate-700" />
                <h3 className="text-lg font-bold text-slate-900">
                  Return Request #{selectedReturn._id.substring(selectedReturn._id.length - 8).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Status and Points banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                    Status
                  </span>
                  {(() => {
                    const st = STATUS_CONFIG[selectedReturn.status] || STATUS_CONFIG.requested;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    );
                  })()}
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                    {selectedReturn.status === 'refunded' ? 'Refunded Points' : 'Estimated Refund Points'}
                  </span>
                  <div className="inline-flex items-center gap-1.5 text-base font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                    <Coins className="w-4 h-4 text-amber-600" />
                    {(
                      selectedReturn.status === 'refunded'
                        ? selectedReturn.refundPoints
                        : selectedReturn.estimatedRefundPoints
                    )?.toLocaleString() ?? '—'}{' '}
                    pts
                  </div>
                </div>

                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                    Submitted Date
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {new Date(selectedReturn.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Rejection notice if rejected */}
              {selectedReturn.status === 'rejected' && selectedReturn.rejectionReason && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-sm text-rose-900">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-800 mb-0.5">Rejection Reason:</p>
                    <p className="text-rose-700">{selectedReturn.rejectionReason}</p>
                  </div>
                </div>
              )}

              {/* Order Info */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Order Details
                </h4>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <p className="text-slate-700">
                    <span className="text-slate-400 font-medium">Order ID: </span>
                    <span className="font-mono">
                      {typeof selectedReturn.order === 'object' && selectedReturn.order?._id
                        ? selectedReturn.order._id
                        : String(selectedReturn.order)}
                    </span>
                  </p>
                  {typeof selectedReturn.order === 'object' && selectedReturn.order?.total != null && (
                    <p className="text-slate-700">
                      <span className="text-slate-400 font-medium">Order Total: </span>
                      <span className="font-semibold">${selectedReturn.order.total.toFixed(2)}</span>
                    </p>
                  )}
                  {typeof selectedReturn.user === 'object' && selectedReturn.user && (
                    <p className="text-slate-700">
                      <span className="text-slate-400 font-medium">Customer: </span>
                      <span>
                        {selectedReturn.user.name} ({selectedReturn.user.email})
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Return Items List */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Items to Return ({selectedReturn.items.length})
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedReturn.items.map((it, idx) => (
                    <div key={idx} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                            SKU: {it.sku || `Ref #${it.orderItemRef}`}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            Qty: <strong className="text-slate-800">{it.qty}</strong>
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mt-1">
                          <span className="text-xs text-slate-400 font-medium block">Reason for return:</span>
                          <span className="italic text-slate-800">"{it.reason}"</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(selectedReturn.status === 'requested' || selectedReturn.status === 'under_review') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenApprove(selectedReturn);
                      }}
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve Return
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenReject(selectedReturn);
                      }}
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Return
                    </button>
                  </>
                )}
                {selectedReturn.status === 'received' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenRefund(selectedReturn);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-xs"
                  >
                    <Coins className="w-4 h-4" />
                    Process Wallet Refund
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Modal ──────────────────────────────────────────────────── */}
      {approveModalOpen && activeActionReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Approve Return Request</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Request #{activeActionReturn._id.substring(activeActionReturn._id.length - 8).toUpperCase()}
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                <p className="text-xs text-amber-700 font-medium">Estimated Refund Points</p>
                <p className="text-xl font-bold text-amber-900 flex items-center gap-1.5 mt-0.5">
                  <Coins className="w-5 h-5 text-amber-500" />
                  {activeActionReturn.estimatedRefundPoints?.toLocaleString() ?? 0} pts
                </p>
                <p className="text-[11px] text-amber-600 mt-1">
                  Points will be credited to the customer wallet once items are received and processed.
                </p>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 text-left">
                  {actionError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmApprove}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                {submittingAction && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      {rejectModalOpen && activeActionReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject Return Request</h3>
                  <p className="text-xs text-slate-500">
                    Request #{activeActionReturn._id.substring(activeActionReturn._id.length - 8).toUpperCase()}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Please provide a reason for rejecting this return. This explanation will be recorded and visible to the customer.
              </p>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1.5">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State clear reasons (e.g., return period expired, item worn or tags missing)..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Minimum 5 characters required</span>
                  <span>{rejectionReason.trim().length} chars</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || rejectionReason.trim().length < 5}
                onClick={handleConfirmReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                {submittingAction && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund Modal ────────────────────────────────────────────────────── */}
      {refundModalOpen && activeRefundReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
                  <Coins className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Process Wallet Refund</h3>
              </div>
              <button
                onClick={() => setRefundModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to issue a wallet reward points refund for return request{' '}
                <strong className="font-mono text-slate-900">
                  #{activeRefundReturn._id.substring(activeRefundReturn._id.length - 8).toUpperCase()}
                </strong>
                ?
              </p>

              <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-teal-800">
                    Wallet Credit Amount
                  </span>
                  <div className="inline-flex items-center gap-1 font-bold text-teal-900 text-base">
                    <Coins className="w-4 h-4 text-teal-600" />
                    {(activeRefundReturn.estimatedRefundPoints || 0).toLocaleString()} pts
                  </div>
                </div>
                <p className="text-xs text-teal-700">
                  Points will be credited directly to the customer's wallet account balance with an immutable ledger entry.
                </p>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  • Customer:{' '}
                  <strong className="text-slate-700">
                    {typeof activeRefundReturn.user === 'object' && activeRefundReturn.user !== null
                      ? activeRefundReturn.user.name || activeRefundReturn.user.email
                      : 'Customer'}
                  </strong>
                </p>
                <p>
                  • Items Returned:{' '}
                  <strong className="text-slate-700">
                    {activeRefundReturn.items.reduce((acc, it) => acc + it.qty, 0)} items
                  </strong>
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingRefund}
                onClick={() => setRefundModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRefund}
                onClick={handleConfirmRefund}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                {submittingRefund && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm & Issue Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturnsPage;
