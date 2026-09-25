import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Coins,
  AlertTriangle,
  PackageX,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ChevronRight,
  Boxes,
  Users,
  Award,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  analyticsService,
  AnalyticsSummary,
  RevenueTrendPoint,
  TopProductMetric,
  InventoryAlertsData,
  CustomerGrowthPoint,
  WalletSummaryMetrics,
} from '../../services/analytics.service';

type DatePreset = '7d' | '30d' | '90d' | 'this_month' | 'custom';
type Granularity = 'day' | 'week' | 'month';

function formatCurrency(val: number): string {
  return `Rs. ${(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const AdminAnalyticsPage: React.FC = () => {
  // Date range state
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  });
  const [to, setTo] = useState<string>(() => formatDate(new Date()));
  const [granularity, setGranularity] = useState<Granularity>('day');

  // Active inventory alert tab
  const [alertTab, setAlertTab] = useState<'out_of_stock' | 'low_stock'>('out_of_stock');

  // Loading & error states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<AnalyticsSummary>({
    orderCount: 0,
    revenue: 0,
    averageOrderValue: 0,
  });
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductMetric[]>([]);
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlertsData>({
    lowStock: [],
    outOfStock: [],
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [customerGrowth, setCustomerGrowth] = useState<CustomerGrowthPoint[]>([]);
  const [walletSummary, setWalletSummary] = useState<WalletSummaryMetrics>({
    totalOutstandingPoints: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    refundPointsIssued: 0,
    orderPointsRedeemed: 0,
    adminCreditPoints: 0,
    adminDebitPoints: 0,
    reversalPoints: 0,
    activeWalletsCount: 0,
    totalWalletsCount: 0,
  });

  // Handle date presets
  const applyPreset = (newPreset: DatePreset) => {
    setPreset(newPreset);
    const today = new Date();
    const endStr = formatDate(today);
    setTo(endStr);

    if (newPreset === '7d') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      setFrom(formatDate(start));
      setGranularity('day');
    } else if (newPreset === '30d') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setFrom(formatDate(start));
      setGranularity('day');
    } else if (newPreset === '90d') {
      const start = new Date();
      start.setDate(today.getDate() - 90);
      setFrom(formatDate(start));
      setGranularity('week');
    } else if (newPreset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFrom(formatDate(start));
      setGranularity('day');
    }
  };

  // Fetch all analytics datasets concurrently
  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Validate date bounds
      if (new Date(from) > new Date(to)) {
        setError('"From" date cannot be later than "To" date.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const [sumRes, revRes, topRes, alertRes, growthRes, walletRes] = await Promise.all([
          analyticsService.getSummary({ from, to }),
          analyticsService.getRevenueTrend({ from, to, granularity }),
          analyticsService.getTopProducts({ from, to, limit: 10 }),
          analyticsService.getInventoryAlerts(),
          analyticsService.getCustomerGrowth({ from, to, granularity }),
          analyticsService.getWalletSummary(),
        ]);

        setSummary(sumRes);
        setRevenueTrend(revRes);
        setTopProducts(topRes);
        setInventoryAlerts(alertRes);
        setCustomerGrowth(growthRes);
        setWalletSummary(walletRes);
      } catch (err: any) {
        console.error('Failed to load analytics data:', err);
        const errMsg = err?.message || 'Failed to fetch analytics metrics';
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to, granularity]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            Analytics & Performance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time business intelligence, revenue metrics, customer trends, and stock alerts.
          </p>
        </div>

        {/* Global Controls: Date Presets & Custom Picker */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Presets */}
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => applyPreset('7d')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                preset === '7d'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('30d')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                preset === '30d'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              30D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('90d')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                preset === '90d'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              90D
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                preset === 'this_month'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Month
            </button>
          </div>

          {/* Date Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setFrom(e.target.value);
              }}
              className="bg-transparent border-0 text-slate-200 focus:outline-none text-xs p-0 w-28"
              aria-label="Start date"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setTo(e.target.value);
              }}
              className="bg-transparent border-0 text-slate-200 focus:outline-none text-xs p-0 w-28"
              aria-label="End date"
            />
          </div>

          {/* Granularity Dropdown */}
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            aria-label="Time granularity"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            title="Refresh analytics data"
            aria-label="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-sm text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-md text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {loading ? '...' : formatCurrency(summary.revenue)}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>{summary.orderCount} completed orders in range</span>
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-transparent" />
        </div>

        {/* Total Orders */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Orders
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {loading ? '...' : summary.orderCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">Excludes cancelled orders</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-transparent" />
        </div>

        {/* Average Order Value */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Avg Order Value
            </span>
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {loading ? '...' : formatCurrency(summary.averageOrderValue)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Average cart ticket size</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-transparent" />
        </div>

        {/* Reward Points Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" /> Reward Points
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight">
                {loading ? '...' : walletSummary.totalOutstandingPoints.toLocaleString()}
              </p>
              <span className="text-xs text-slate-400 font-medium">outstanding</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-1.5">
              <span>Issued: {walletSummary.totalPointsIssued.toLocaleString()}</span>
              <span>Redeemed: {walletSummary.totalPointsRedeemed.toLocaleString()}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
        </div>
      </div>

      {/* Interactive Charts: Revenue Trend & Customer Acquisition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Line / Area Chart */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Revenue Trend</h2>
              <p className="text-xs text-slate-400">
                Revenue trajectory over time ({granularity} buckets)
              </p>
            </div>
            <span className="text-xs bg-slate-800 text-indigo-400 border border-slate-700/60 rounded px-2 py-0.5">
              {granularity.toUpperCase()}
            </span>
          </div>

          <div className="h-72 w-full mt-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Loading revenue trend...
              </div>
            ) : revenueTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No revenue recorded in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenueTrend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => (val.length > 5 ? val.slice(5) : val)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `Rs. ${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Revenue']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Customer Growth Bar Chart */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Customer Acquisition</h2>
              <p className="text-xs text-slate-400">
                New customer sign-ups over the selected period
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Total in range:{' '}
                {customerGrowth.reduce((acc, curr) => acc + curr.newCustomers, 0)}
              </span>
            </div>
          </div>

          <div className="h-72 w-full mt-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Loading customer growth...
              </div>
            ) : customerGrowth.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No customer registrations in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={customerGrowth}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => (val.length > 5 ? val.slice(5) : val)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => [`${value} new customers`, 'Sign-ups']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar
                    dataKey="newCustomers"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    name="Sign-ups"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Lower Section: Top Products Leaderboard & Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Top Performing Products</h2>
              <p className="text-xs text-slate-400">Ranked by revenue within selected dates</p>
            </div>
            <Link
              to="/admin/products"
              className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              View catalog <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Loading top products...
              </div>
            ) : topProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No product sales recorded in this date range.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {topProducts.map((p, idx) => (
                    <tr key={`${p.productId}-${idx}`} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-medium text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-100 max-w-[200px] truncate">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-300">
                        {p.unitsSold.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Inventory Health Alerts */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Inventory Stock Alerts
              </h2>
              <p className="text-xs text-slate-400">
                Critical stock levels requiring re-orders or variant restocking
              </p>
            </div>
            <Link
              to="/admin/inventory"
              className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              Inventory table <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Alert Tabs */}
          <div className="flex border-b border-slate-800 mb-3 gap-2">
            <button
              type="button"
              onClick={() => setAlertTab('out_of_stock')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                alertTab === 'out_of_stock'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <PackageX className="w-3.5 h-3.5" />
              Out of Stock ({inventoryAlerts.outOfStockCount})
            </button>
            <button
              type="button"
              onClick={() => setAlertTab('low_stock')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                alertTab === 'low_stock'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              Low Stock ({inventoryAlerts.lowStockCount})
            </button>
          </div>

          {/* Alert Variant List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-500">
                Checking stock alerts...
              </div>
            ) : alertTab === 'out_of_stock' ? (
              inventoryAlerts.outOfStock.length === 0 ? (
                <div className="py-6 text-center text-sm text-emerald-400/80 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                  ✓ No out-of-stock items. Inventory health is optimal!
                </div>
              ) : (
                inventoryAlerts.outOfStock.map((item, idx) => (
                  <div
                    key={`${item.sku}-${idx}`}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-rose-500/20 flex items-center justify-between hover:border-rose-500/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {item.product?.name || 'Unknown Product'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="font-mono text-slate-300">{item.sku}</span>
                        <span>·</span>
                        <span>Size: {item.size}</span>
                        <span>·</span>
                        <span>Color: {item.color}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                      0 left
                    </span>
                  </div>
                ))
              )
            ) : inventoryAlerts.lowStock.length === 0 ? (
              <div className="py-6 text-center text-sm text-emerald-400/80 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                ✓ No low-stock warnings at present.
              </div>
            ) : (
              inventoryAlerts.lowStock.map((item, idx) => (
                <div
                  key={`${item.sku}-${idx}`}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-amber-500/20 flex items-center justify-between hover:border-amber-500/40 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {item.product?.name || 'Unknown Product'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                      <span className="font-mono text-slate-300">{item.sku}</span>
                      <span>·</span>
                      <span>Size: {item.size}</span>
                      <span>·</span>
                      <span>Color: {item.color}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                    {item.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
