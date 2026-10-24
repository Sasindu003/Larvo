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
  ExternalLink,
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
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400',
  },
  pickup_scheduled: {
    label: 'Pickup Scheduled',
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    dot: 'bg-indigo-400',
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
  },
  received: {
    label: 'Received',
    bg: 'bg-teal-500/15',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    dot: 'bg-teal-400',
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
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
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const resolveImageUrl = (url?: string | null): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const apiBase =
      (import.meta as any).env?.VITE_API_URL ||
      (!isLocal
        ? 'https://larvo-server.vercel.app/api'
        : 'http://localhost:5000/api');
    const hostBase = apiBase.replace(/\/api\/?$/, '');
    return `${hostBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

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

  const handleOpenDetail = async (ret: IReturnRequest) => {
    setSelectedReturn(ret);
    setDetailModalOpen(true);
    if (ret.status === 'requested') {
      try {
        const updated = await returnService.markUnderReview(ret._id);
        setSelectedReturn((prev) => (prev?._id === updated._id ? { ...prev, ...updated } : prev));
        setReturns((prev) =>
          prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r))
        );
      } catch {
        // Silently preserve current view if transition fails or already under review
      }
    }
  };

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
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">Return Requests</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {total}
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Review, approve, or reject customer return requests and inspect estimated refund points.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchReturns}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Filter Bar & Search ────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-800 backdrop-blur-md space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, customer name, or email..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-950 border border-slate-800 text-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 rounded-2xl shadow-xl border border-slate-800 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Request ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4 text-center">Est. Refund</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-slate-800/60 rounded w-40"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-16"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-24"></div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-6 bg-slate-800 rounded-full w-20 mx-auto"></div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="h-6 bg-slate-800 rounded-full w-24 mx-auto"></div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-8 bg-slate-800 rounded-lg w-20 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-800/60 text-slate-400 mx-auto flex items-center justify-center mb-3">
                      <RotateCcw className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-200 mb-1">No return requests found</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
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
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => handleOpenDetail(ret)}
                    >
                      <td className="py-4 px-4 font-mono font-medium text-white">
                        <span className="text-slate-500">#</span>
                        {shortId}
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-200">{customerName}</p>
                        {customerEmail && (
                          <p className="text-xs text-slate-400">{customerEmail}</p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-300">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                          {totalItemsQty} {totalItemsQty === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-xs text-slate-500 block">
                          ({ret.items.length} {ret.items.length === 1 ? 'sku' : 'skus'})
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-400 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {new Date(ret.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {displayPoints != null ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            {displayPoints.toLocaleString()} pts
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
                                title="Approve return request"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReject(ret)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-xs"
                                  title="Process points refund to customer wallet"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  Refund
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(ret)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
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
        <div className="py-3 px-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-white">{filteredReturns.length}</span> of{' '}
            <span className="font-semibold text-white">{total}</span> returns
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="px-2 font-medium text-slate-300">
              Page {page} of {pages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {detailModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">
                  Return Request #{selectedReturn._id.substring(selectedReturn._id.length - 8).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Status and Points banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
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
                  <div className="inline-flex items-center gap-1.5 text-base font-bold text-amber-400 bg-amber-500/15 px-3 py-1 rounded-lg border border-amber-500/30">
                    <Coins className="w-4 h-4 text-amber-400" />
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
                  <span className="text-sm font-medium text-slate-200">
                    {new Date(selectedReturn.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Rejection notice if rejected */}
              {selectedReturn.status === 'rejected' && selectedReturn.rejectionReason && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-sm text-rose-200">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-300 mb-0.5">Rejection Reason:</p>
                    <p className="text-rose-200">{selectedReturn.rejectionReason}</p>
                  </div>
                </div>
              )}

              {/* Order Info */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Order Details
                </h4>
                <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs space-y-1">
                  <p className="text-slate-300">
                    <span className="text-slate-500 font-medium">Order ID: </span>
                    <span className="font-mono text-white">
                      {typeof selectedReturn.order === 'object' && selectedReturn.order?._id
                        ? selectedReturn.order._id
                        : String(selectedReturn.order)}
                    </span>
                  </p>
                  {typeof selectedReturn.order === 'object' && selectedReturn.order?.total != null && (
                    <p className="text-slate-300">
                      <span className="text-slate-500 font-medium">Order Total: </span>
                      <span className="font-semibold text-white">Rs. {selectedReturn.order.total.toFixed(2)}</span>
                    </p>
                  )}
                  {typeof selectedReturn.user === 'object' && selectedReturn.user && (
                    <p className="text-slate-300">
                      <span className="text-slate-500 font-medium">Customer: </span>
                      <span className="text-slate-200">
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
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                  {selectedReturn.items.map((it, idx) => (
                    <div key={idx} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-200 rounded">
                            SKU: {it.sku || `Ref #${it.orderItemRef}`}
                          </span>
                          <span className="text-xs font-medium text-slate-400">
                            Qty: <strong className="text-white">{it.qty}</strong>
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mt-1">
                          <span className="text-xs text-slate-500 font-medium block">Reason for return:</span>
                          <span className="italic text-slate-200">"{it.reason}"</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Attached Photos (Evidence) */}
              {selectedReturn.images && selectedReturn.images.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      Attached Photos ({selectedReturn.images.length})
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Click to inspect full size
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedReturn.images.map((img, idx) => {
                      const fullUrl = resolveImageUrl(img.url);
                      return (
                        <div
                          key={idx}
                          className="group relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 cursor-pointer hover:border-slate-700 transition-all shadow-2xs"
                          onClick={() => setLightboxImageUrl(fullUrl)}
                        >
                          <img
                            src={fullUrl}
                            alt={img.filename || `Evidence photo ${idx + 1}`}
                            className="w-full h-24 sm:h-28 object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                            <Eye className="w-4 h-4" />
                            <span>Enlarge</span>
                          </div>
                          <div className="p-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="truncate max-w-[110px] font-mono text-[10px]">
                              {img.filename}
                            </span>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-white p-0.5"
                              title="Open original in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(selectedReturn.status === 'requested' || selectedReturn.status === 'under_review') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenApprove(selectedReturn);
                      }}
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
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
                      className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-xs"
                  >
                    <Coins className="w-4 h-4" />
                    Process Wallet Refund
                  </button>
                )}
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve Modal ──────────────────────────────────────────────────── */}
      {approveModalOpen && activeActionReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Approve Return Request</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Request #{activeActionReturn._id.substring(activeActionReturn._id.length - 8).toUpperCase()}
                </p>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-left">
                <p className="text-xs text-amber-400 font-medium">Estimated Refund Points</p>
                <p className="text-xl font-bold text-amber-300 flex items-center gap-1.5 mt-0.5">
                  <Coins className="w-5 h-5 text-amber-400" />
                  {activeActionReturn.estimatedRefundPoints?.toLocaleString() ?? 0} pts
                </p>
                <p className="text-[11px] text-amber-400/80 mt-1">
                  Points will be credited to the customer wallet once items are received and processed.
                </p>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400 text-left">
                  {actionError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmApprove}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reject Return Request</h3>
                  <p className="text-xs text-slate-400">
                    Request #{activeActionReturn._id.substring(activeActionReturn._id.length - 8).toUpperCase()}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300">
                Please provide a reason for rejecting this return. This explanation will be recorded and visible to the customer.
              </p>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Rejection Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State clear reasons (e.g., return period expired, item worn or tags missing)..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 text-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all placeholder:text-slate-500"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Minimum 5 characters required</span>
                  <span>{rejectionReason.trim().length} chars</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-400">
                  {actionError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || rejectionReason.trim().length < 5}
                onClick={handleConfirmReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Coins className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Process Wallet Refund</h3>
              </div>
              <button
                onClick={() => setRefundModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300">
                Are you sure you want to issue a wallet reward points refund for return request{' '}
                <strong className="font-mono text-white">
                  #{activeRefundReturn._id.substring(activeRefundReturn._id.length - 8).toUpperCase()}
                </strong>
                ?
              </p>

              <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-teal-400">
                    Wallet Credit Amount
                  </span>
                  <div className="inline-flex items-center gap-1 font-bold text-teal-300 text-base">
                    <Coins className="w-4 h-4 text-teal-400" />
                    {(activeRefundReturn.estimatedRefundPoints || 0).toLocaleString()} pts
                  </div>
                </div>
                <p className="text-xs text-teal-400/80">
                  Points will be credited directly to the customer's wallet account balance with an immutable ledger entry.
                </p>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  • Customer:{' '}
                  <strong className="text-slate-200">
                    {typeof activeRefundReturn.user === 'object' && activeRefundReturn.user !== null
                      ? activeRefundReturn.user.name || activeRefundReturn.user.email
                      : 'Customer'}
                  </strong>
                </p>
                <p>
                  • Items Returned:{' '}
                  <strong className="text-slate-200">
                    {activeRefundReturn.items.reduce((acc, it) => acc + it.qty, 0)} items
                  </strong>
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submittingRefund}
                onClick={() => setRefundModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRefund}
                onClick={handleConfirmRefund}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                {submittingRefund && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm & Issue Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Photo Lightbox Modal ────────────────────────────────────── */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 text-white flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-amber-400">
                <RotateCcw className="w-4 h-4" />
                Return Evidence Photo Inspection
              </span>
              <button
                onClick={() => setLightboxImageUrl(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
              <img
                src={lightboxImageUrl}
                alt="Return Evidence Full Resolution"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturnsPage;
