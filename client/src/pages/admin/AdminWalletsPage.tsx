import React, { useEffect, useState, useCallback } from 'react';
import {
  Wallet,
  Search,
  Clock,
  Sliders,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  ShieldAlert,
  Coins,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  walletService,
  AdminWallet,
  PointsTransaction,
  PointsTransactionType,
} from '../../services/wallet.service';
import { useDebounce } from '../../hooks/useDebounce';

export const AdminWalletsPage: React.FC = () => {
  // ── List & Search State ──────────────────────────────────────────────────────
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ── Drawer / Ledger History State ────────────────────────────────────────────
  const [drawerWallet, setDrawerWallet] = useState<AdminWallet | null>(null);
  const [drawerTransactions, setDrawerTransactions] = useState<PointsTransaction[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerPage, setDrawerPage] = useState(1);
  const [drawerPages, setDrawerPages] = useState(1);
  const [drawerTotal, setDrawerTotal] = useState(0);

  // ── Manual Adjust Modal State ────────────────────────────────────────────────
  const [adjustTarget, setAdjustTarget] = useState<AdminWallet | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<'credit' | 'debit'>('credit');
  const [adjustPoints, setAdjustPoints] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string>('');

  // ── Fetch Wallets List ───────────────────────────────────────────────────────
  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await walletService.getAdminWallets({
        page,
        limit: 10,
        q: debouncedSearch.trim() || undefined,
      });
      setWallets(res.results || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch (err: any) {
      setListError(err.message || 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // ── Fetch Drawer Transactions ────────────────────────────────────────────────
  const fetchDrawerHistory = useCallback(
    async (userId: string, targetPage = 1) => {
      setDrawerLoading(true);
      try {
        const res = await walletService.getAdminWalletTransactions(userId, targetPage, 8);
        setDrawerTransactions(res.results || []);
        setDrawerPage(res.page || 1);
        setDrawerPages(res.pages || 1);
        setDrawerTotal(res.total || 0);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load transaction history');
      } finally {
        setDrawerLoading(false);
      }
    },
    []
  );

  const openDrawer = (wallet: AdminWallet) => {
    setDrawerWallet(wallet);
    setDrawerPage(1);
    fetchDrawerHistory(wallet.user._id, 1);
  };

  const closeDrawer = () => {
    setDrawerWallet(null);
    setDrawerTransactions([]);
  };

  // ── Open Adjust Modal ────────────────────────────────────────────────────────
  const openAdjust = (wallet: AdminWallet) => {
    setAdjustTarget(wallet);
    setAdjustDirection('credit');
    setAdjustPoints('');
    setAdjustReason('');
    setAdjustError('');
  };

  const closeAdjust = () => {
    setAdjustTarget(null);
    setAdjustError('');
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');

    if (!adjustTarget) return;

    const pointsNum = parseInt(adjustPoints, 10);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      setAdjustError('Points must be a positive whole number');
      return;
    }

    if (!adjustReason.trim()) {
      setAdjustError('Reason is required for audit tracking');
      return;
    }

    if (adjustDirection === 'debit' && pointsNum > adjustTarget.balancePoints) {
      setAdjustError('Debit amount cannot exceed current balance');
      return;
    }

    setAdjustSubmitting(true);
    try {
      const res = await walletService.adminAdjustWallet(adjustTarget.user._id, {
        direction: adjustDirection,
        points: pointsNum,
        reason: adjustReason.trim(),
      });

      toast.success(
        `Successfully ${adjustDirection === 'credit' ? 'credited' : 'debited'} ${pointsNum.toLocaleString()} points`
      );

      // Refresh list
      await fetchWallets();

      // If drawer is currently open for this user, refresh drawer history and update target
      if (drawerWallet && drawerWallet.user._id === adjustTarget.user._id) {
        setDrawerWallet(res.wallet);
        await fetchDrawerHistory(adjustTarget.user._id, 1);
      }

      closeAdjust();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust points');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const formatTransactionType = (type: PointsTransactionType) => {
    switch (type) {
      case 'refund_earn':
        return { label: 'Refund Credit', icon: RotateCcw, color: 'text-emerald-400' };
      case 'order_spend':
        return { label: 'Order Payment', icon: ShoppingBag, color: 'text-rose-400' };
      case 'admin_credit':
        return { label: 'Admin Credit', icon: Sparkles, color: 'text-amber-400' };
      case 'admin_debit':
        return { label: 'Admin Debit', icon: ShieldAlert, color: 'text-red-400' };
      case 'reversal':
        return { label: 'Reversal', icon: RefreshCw, color: 'text-sky-400' };
      default:
        return { label: 'Activity', icon: Coins, color: 'text-slate-400' };
    }
  };

  // Quick stats
  const totalCirculatingPoints = wallets.reduce((acc, w) => acc + w.balancePoints, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-white flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-violet-400" />
            Reward Wallets
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit customer point balances, inspect immutable transaction ledgers, and manually adjust reward points.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchWallets()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors self-start sm:self-auto border border-slate-700/60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Summary Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Customer Wallets</span>
            <Coins className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-display">
            {total.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Total registered customer wallets</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Points on Current Page</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400 font-display">
            {totalCirculatingPoints.toLocaleString()} <span className="text-xs text-slate-400 font-sans">pts</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            ≈ Rs. {walletService.pointsToCurrency(totalCirculatingPoints).toLocaleString(undefined, { minimumFractionDigits: 2 })} fiat value
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Point Conversion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 font-display">
            100 pts <span className="text-xs text-slate-400 font-sans">= Rs. 1.00</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">1 point = Rs. 0.01 checkout credit</p>
        </div>
      </div>

      {/* ── Search Bar ────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table Container ───────────────────────────────────────────────── */}
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
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Available Balance</th>
                <th className="px-4 py-3">Lifetime Earned</th>
                <th className="px-4 py-3">Lifetime Spent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading customer wallets...
                  </td>
                </tr>
              ) : wallets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No wallets found matching your search.
                  </td>
                </tr>
              ) : (
                wallets.map((w) => {
                  const userName = w.user?.name || 'Unknown';
                  const userEmail = w.user?.email || '—';
                  const userRole = w.user?.role || 'customer';
                  const fiat = walletService.pointsToCurrency(w.balancePoints);

                  return (
                    <tr key={w._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{userName}</div>
                        <div className="text-[11px] text-slate-400">{userEmail}</div>
                        <span className="inline-block mt-1 px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {userRole}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                        <span className="text-amber-400 text-sm">
                          {w.balancePoints.toLocaleString()} pts
                        </span>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          ≈ Rs. {fiat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-emerald-400 whitespace-nowrap">
                        +{w.lifetimeEarnedPoints.toLocaleString()} pts
                      </td>

                      <td className="px-4 py-3 font-mono text-rose-400 whitespace-nowrap">
                        -{w.lifetimeSpentPoints.toLocaleString()} pts
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            w.active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-700 text-slate-400 border border-slate-600'
                          }`}
                        >
                          {w.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(w.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDrawer(w)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors border border-slate-700"
                            title="View Points Ledger History"
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Ledger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openAdjust(w)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 rounded text-xs font-medium transition-colors border border-violet-500/30"
                            title="Adjust Points Balance"
                          >
                            <Sliders className="w-3.5 h-3.5 text-violet-400" />
                            <span>Adjust</span>
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

        {/* ── Table Pagination ──────────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-400 bg-slate-900/40">
            <div>
              Page <span className="font-semibold text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-200">{pages}</span> ({total} total wallets)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ROW DETAIL DRAWER (Slide-over from right) ──────────────────────── */}
      {drawerWallet && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/90">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  Customer Points Ledger
                </div>
                <h2 className="text-lg font-bold text-white font-display mt-0.5">
                  {drawerWallet.user?.name || 'Customer'}
                </h2>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{drawerWallet.user?.email}</span>
                  <span>•</span>
                  <span className="font-mono text-slate-500">ID: {drawerWallet.user?._id}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAdjust(drawerWallet)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Adjust Points</span>
                </button>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Balance Summary Bar */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/50 border-b border-slate-800 text-xs">
              <div>
                <div className="text-slate-400 text-[10px] uppercase">Current Balance</div>
                <div className="font-bold text-amber-400 font-mono text-base">
                  {drawerWallet.balancePoints.toLocaleString()} pts
                </div>
                <div className="text-[10px] text-slate-500">
                  ≈ Rs. {walletService.pointsToCurrency(drawerWallet.balancePoints).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase">Lifetime Earned</div>
                <div className="font-bold text-emerald-400 font-mono text-base">
                  +{drawerWallet.lifetimeEarnedPoints.toLocaleString()} pts
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase">Lifetime Spent</div>
                <div className="font-bold text-rose-400 font-mono text-base">
                  -{drawerWallet.lifetimeSpentPoints.toLocaleString()} pts
                </div>
              </div>
            </div>

            {/* Drawer Ledger Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-semibold text-slate-200">Mutation History</span>
                <span>{drawerTotal} transactions</span>
              </div>

              {drawerLoading ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Loading ledger rows...
                </div>
              ) : drawerTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800/80">
                  No points transactions recorded for this wallet yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {drawerTransactions.map((tx) => {
                    const meta = formatTransactionType(tx.type);
                    const TypeIcon = meta.icon;
                    const isCredit = tx.direction === 'credit';
                    const dateStr = new Date(tx.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={tx._id}
                        className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isCredit
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              <TypeIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-white text-xs">
                                {meta.label}
                              </div>
                              <div className="text-[10px] text-slate-400">{dateStr}</div>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <div
                              className={`text-xs font-bold ${
                                isCredit ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isCredit ? '+' : '-'}
                              {tx.points.toLocaleString()} pts
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Bal after: {tx.balanceAfter.toLocaleString()} pts
                            </div>
                          </div>
                        </div>

                        {/* Note & Reference */}
                        {(tx.note || tx.order) && (
                          <div className="bg-slate-900/80 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 border border-slate-800/80 space-y-0.5">
                            {tx.note && (
                              <div>
                                <span className="text-slate-500">Reason:</span> "{tx.note}"
                              </div>
                            )}
                            {tx.order && (
                              <div className="font-mono text-slate-400 text-[10px]">
                                Ref Order: {typeof tx.order === 'object' ? tx.order._id : tx.order}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Pagination */}
            {drawerPages > 1 && (
              <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/90">
                <span>
                  Page {drawerPage} of {drawerPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fetchDrawerHistory(drawerWallet.user._id, drawerPage - 1)}
                    disabled={drawerPage <= 1 || drawerLoading}
                    className="p-1 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchDrawerHistory(drawerWallet.user._id, drawerPage + 1)}
                    disabled={drawerPage >= drawerPages || drawerLoading}
                    className="p-1 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MANUAL ADJUST POINTS MODAL ────────────────────────────────────── */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-violet-400" />
                  Adjust Reward Points
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  For customer:{' '}
                  <span className="text-slate-200 font-semibold">
                    {adjustTarget.user?.name}
                  </span>{' '}
                  ({adjustTarget.user?.email})
                </p>
              </div>
              <button
                type="button"
                onClick={closeAdjust}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Pill */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-slate-400">Current Balance</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {adjustTarget.balancePoints.toLocaleString()} pts
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Direction Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('credit')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                      adjustDirection === 'credit'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Credit (Add)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustDirection('debit')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                      adjustDirection === 'debit'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Debit (Deduct)</span>
                  </button>
                </div>
              </div>

              {/* Points Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Points Amount
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 500"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Real-time Preview Calculation */}
              {adjustPoints && !isNaN(parseInt(adjustPoints, 10)) && parseInt(adjustPoints, 10) > 0 && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium">Resulting Balance Preview:</div>
                  {adjustDirection === 'credit' ? (
                    <div className="font-mono text-emerald-400 font-bold">
                      {adjustTarget.balancePoints.toLocaleString()} + {parseInt(adjustPoints, 10).toLocaleString()} ={' '}
                      {(adjustTarget.balancePoints + parseInt(adjustPoints, 10)).toLocaleString()} pts{' '}
                      <span className="text-[10px] text-slate-400 font-sans">
                        (≈ Rs. {walletService.pointsToCurrency(adjustTarget.balancePoints + parseInt(adjustPoints, 10)).toFixed(2)})
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="font-mono text-rose-400 font-bold">
                        {adjustTarget.balancePoints.toLocaleString()} - {parseInt(adjustPoints, 10).toLocaleString()} ={' '}
                        {(adjustTarget.balancePoints - parseInt(adjustPoints, 10)).toLocaleString()} pts{' '}
                        <span className="text-[10px] text-slate-400 font-sans">
                          (≈ Rs. {walletService.pointsToCurrency(Math.max(0, adjustTarget.balancePoints - parseInt(adjustPoints, 10))).toFixed(2)})
                        </span>
                      </div>
                      {parseInt(adjustPoints, 10) > adjustTarget.balancePoints && (
                        <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Deduction exceeds balance! Balance cannot become negative.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Reason / Audit Note <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. VIP loyalty promotional bonus, customer service goodwill credit, correction debit..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  This note is recorded in the customer's permanent ledger.
                </span>
              </div>

              {/* Error Message */}
              {adjustError && (
                <div className="p-3 bg-rose-950/30 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAdjust}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    adjustSubmitting ||
                    (adjustDirection === 'debit' &&
                      parseInt(adjustPoints, 10) > adjustTarget.balancePoints)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  {adjustSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWalletsPage;
