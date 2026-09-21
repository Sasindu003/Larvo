import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet as WalletIcon,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShoppingBag,
  RotateCcw,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  walletService,
  Wallet,
  PointsTransaction,
  PointsTransactionType,
  ConversionRate,
} from '../services/wallet.service';

export const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [rate, setRate] = useState<ConversionRate>({ pointsPerRupee: 100, pointValue: 0.01 });
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const fetchWallet = useCallback(async () => {
    try {
      setError(null);
      const [data, rateData] = await Promise.all([
        walletService.getMyWallet(),
        walletService.getConversionRate().catch(() => ({ pointsPerRupee: 100, pointValue: 0.01 })),
      ]);
      setWallet(data);
      if (rateData) setRate(rateData);
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet data');
    }
  }, []);

  const fetchTransactions = useCallback(async (targetPage: number) => {
    try {
      setTransactionsLoading(true);
      const data = await walletService.getMyTransactions(targetPage, limit);
      setTransactions(data.results);
      setTotalPages(data.pages);
      setTotalCount(data.total);
      setPage(data.page);
    } catch (err: any) {
      // If wallet fetch also failed, error is already set
      if (!error) {
        setError(err.message || 'Failed to load transaction history');
      }
    } finally {
      setTransactionsLoading(false);
    }
  }, [error, limit]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchWallet();
      await fetchTransactions(1);
      setLoading(false);
    };
    init();
  }, [fetchWallet, fetchTransactions]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      fetchTransactions(newPage);
    }
  };

  const formatTransactionType = (type: PointsTransactionType) => {
    switch (type) {
      case 'refund_earn':
        return {
          label: 'Refund Credit',
          desc: 'Points credited from approved return',
          icon: RotateCcw,
        };
      case 'order_spend':
        return {
          label: 'Order Payment',
          desc: 'Points redeemed during checkout',
          icon: ShoppingBag,
        };
      case 'admin_credit':
        return {
          label: 'Adjustment Credit',
          desc: 'Points added by support team',
          icon: Sparkles,
        };
      case 'admin_debit':
        return {
          label: 'Adjustment Debit',
          desc: 'Points deducted by support team',
          icon: ShieldAlert,
        };
      case 'reversal':
        return {
          label: 'Points Reversal',
          desc: 'Transaction correction',
          icon: RefreshCw,
        };
      default:
        return {
          label: 'Points Activity',
          desc: 'Balance update',
          icon: Coins,
        };
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-8 bg-sand-200 rounded-md w-64"></div>
          <div className="h-4 bg-sand-100 rounded-md w-96"></div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="h-40 bg-sand-200 rounded-2xl"></div>
          <div className="h-40 bg-sand-100 rounded-2xl"></div>
          <div className="h-40 bg-sand-100 rounded-2xl"></div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4">
          <div className="h-6 bg-sand-200 rounded w-48"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-sand-50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !wallet) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-ink-950 font-display">
            Unable to Load Wallet
          </h2>
          <p className="text-sm text-ink-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchWallet();
              fetchTransactions(1);
              setLoading(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink-900 text-white rounded-lg text-xs font-semibold hover:bg-ink-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const balance = wallet?.balancePoints ?? 0;
  const lifetimeEarned = wallet?.lifetimeEarnedPoints ?? 0;
  const lifetimeSpent = wallet?.lifetimeSpentPoints ?? 0;
  const fiatEquivalent = walletService.pointsToCurrency(balance, rate.pointsPerRupee);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-ink-500 text-xs font-medium mb-1">
            <Link to="/profile" className="hover:text-ink-900 transition-colors">
              Account
            </Link>
            <span>/</span>
            <span className="text-ink-900 font-semibold">Wallet</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-ink-950 flex items-center gap-2.5">
            <WalletIcon className="w-7 h-7 text-ink-900" />
            Reward Points & Wallet
          </h1>
          <p className="text-xs sm:text-sm text-ink-600 mt-1">
            Track your reward balance, return credits, and spending history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchWallet();
            fetchTransactions(page);
          }}
          disabled={transactionsLoading}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-ink-700 bg-white border border-sand-300 rounded-xl hover:bg-sand-50 transition-colors disabled:opacity-50 self-start sm:self-auto shadow-sm"
          title="Refresh Wallet"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${transactionsLoading ? 'animate-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hero Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main Balance Card */}
        <div className="bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 text-white rounded-2xl p-6 sm:p-7 shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-sand-300 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                Available Balance
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-white">
                {balance.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-amber-400">pts</span>
            </div>

            <p className="text-xs text-sand-300 mt-1">
              Worth{' '}
              <strong className="text-white font-semibold">
                Rs. {fiatEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </strong>{' '}
              on your next purchase
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-ink-800/80 flex items-center justify-between text-[11px] text-sand-400">
            <span>Rate: {rate.pointsPerRupee} pts = Rs. 1.00</span>
            <Link
              to="/products"
              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Shop Now</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Lifetime Earned Card */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Lifetime Earned
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-display text-ink-950">
                {lifetimeEarned.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-ink-400">pts</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-500 mt-4 pt-3 border-t border-sand-100">
            Accumulated from return refunds and promotional awards.
          </p>
        </div>

        {/* Lifetime Spent Card */}
        <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mb-3">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Lifetime Spent
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-display text-ink-950">
                {lifetimeSpent.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-ink-400">pts</span>
            </div>
          </div>
          <p className="text-[11px] text-ink-500 mt-4 pt-3 border-t border-sand-100">
            Redeemed at checkout as payment for order purchases.
          </p>
        </div>
      </div>

      {/* Info Callout Banner */}
      <div className="bg-sand-100/70 border border-sand-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-white shadow-sm text-ink-800 shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="text-xs text-ink-700 space-y-1">
          <p className="font-semibold text-ink-900">How reward points work</p>
          <p className="leading-relaxed">
            Points are automatically credited when returning purchased items or granted during
            exclusive promotions. During checkout, you can apply your available points balance to
            cover up to the full order amount.
          </p>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="bg-white rounded-2xl border border-sand-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-sand-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold font-display text-ink-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-700" />
              Transaction Ledger
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Detailed chronological record of every points mutation
            </p>
          </div>
          <span className="text-xs font-medium text-ink-500 self-start sm:self-auto bg-sand-100 px-2.5 py-1 rounded-full">
            {totalCount} total entries
          </span>
        </div>

        {transactionsLoading && transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-500">
            Loading ledger transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center max-w-sm mx-auto space-y-4">
            <div className="w-14 h-14 bg-sand-100 text-ink-400 rounded-2xl flex items-center justify-center mx-auto">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink-900 font-display">
                No Transactions Yet
              </h3>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                You haven't earned or spent any reward points yet. When you return items or receive
                promotional credits, your history will show up here.
              </p>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-4 py-2 bg-ink-900 text-white rounded-xl text-xs font-semibold hover:bg-ink-800 transition-colors shadow-sm"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-sand-50/70 border-b border-sand-200 text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="py-3 px-6">
                      Date & Time
                    </th>
                    <th scope="col" className="py-3 px-6">
                      Activity
                    </th>
                    <th scope="col" className="py-3 px-6">
                      Reference / Note
                    </th>
                    <th scope="col" className="py-3 px-6">
                      Direction
                    </th>
                    <th scope="col" className="py-3 px-6 text-right">
                      Points
                    </th>
                    <th scope="col" className="py-3 px-6 text-right">
                      Balance After
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {transactions.map((tx) => {
                    const typeMeta = formatTransactionType(tx.type);
                    const TypeIcon = typeMeta.icon;
                    const isCredit = tx.direction === 'credit';
                    const formattedDate = new Date(tx.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={tx._id} className="hover:bg-sand-50/40 transition-colors">
                        <td className="py-4 px-6 text-ink-600 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isCredit
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              <TypeIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-ink-900">
                                {typeMeta.label}
                              </div>
                              <div className="text-[10px] text-ink-400">
                                {typeMeta.desc}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-ink-700">
                          {tx.order && (
                            <div className="font-mono text-[11px] text-ink-800">
                              Order:{' '}
                              {typeof tx.order === 'object'
                                ? tx.order.trackingNumber || tx.order._id
                                : tx.order}
                            </div>
                          )}
                          {tx.note && (
                            <div className="text-ink-500 text-[11px] italic">
                              "{tx.note}"
                            </div>
                          )}
                          {!tx.order && !tx.note && (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isCredit
                                ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100/70 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {tx.direction}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap font-mono font-bold">
                          <span
                            className={
                              isCredit ? 'text-emerald-700' : 'text-rose-700'
                            }
                          >
                            {isCredit ? '+' : '-'}
                            {tx.points.toLocaleString()} pts
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-medium text-ink-600 whitespace-nowrap">
                          {tx.balanceAfter.toLocaleString()} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-sand-200">
              {transactions.map((tx) => {
                const typeMeta = formatTransactionType(tx.type);
                const TypeIcon = typeMeta.icon;
                const isCredit = tx.direction === 'credit';
                const formattedDate = new Date(tx.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={tx._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-ink-950">
                            {typeMeta.label}
                          </div>
                          <div className="text-[10px] text-ink-400">
                            {formattedDate}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div
                          className={`text-xs font-bold ${
                            isCredit ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isCredit ? '+' : '-'}
                          {tx.points.toLocaleString()} pts
                        </div>
                        <div className="text-[10px] text-ink-400">
                          Bal: {tx.balanceAfter.toLocaleString()} pts
                        </div>
                      </div>
                    </div>

                    {(tx.order || tx.note) && (
                      <div className="bg-sand-50 rounded-lg p-2.5 text-[11px] text-ink-700 space-y-0.5 border border-sand-100">
                        {tx.order && (
                          <div className="font-mono text-ink-900 font-semibold">
                            Ref Order:{' '}
                            {typeof tx.order === 'object'
                              ? tx.order.trackingNumber || tx.order._id
                              : tx.order}
                          </div>
                        )}
                        {tx.note && (
                          <div className="italic text-ink-600">
                            "{tx.note}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-sand-200 bg-sand-50/50 flex items-center justify-between">
                <div className="text-xs text-ink-500">
                  Page <span className="font-semibold text-ink-900">{page}</span> of{' '}
                  <span className="font-semibold text-ink-900">{totalPages}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || transactionsLoading}
                    className="p-1.5 rounded-lg border border-sand-300 text-ink-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || transactionsLoading}
                    className="p-1.5 rounded-lg border border-sand-300 text-ink-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
