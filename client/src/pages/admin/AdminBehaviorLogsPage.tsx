import React, { useState, useEffect, useCallback, useId } from 'react';
import {
  Shield,
  Key,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Monitor,
  Smartphone,
  Tablet,
  MousePointer,
  Eye,
  Navigation,
  Globe,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  Radio,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { trackingService, BehaviorLogItem, GetBehaviorLogsParams } from '../../services/tracking.service';

export const AdminBehaviorLogsPage: React.FC = () => {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('larvo_tracking_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const [passkeyInput, setPasskeyInput] = useState('');
  const [verifyingKey, setVerifyingKey] = useState(false);

  // Filter & Query States
  const [logs, setLogs] = useState<BehaviorLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pages, setPages] = useState(1);

  const [sortBy, setSortBy] = useState<GetBehaviorLogsParams['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveRefresh, setLiveRefresh] = useState(false);

  // Drawer detail state
  const [selectedLog, setSelectedLog] = useState<BehaviorLogItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const passkeyInputId = useId();

  // Fetch logs from API
  const fetchLogs = useCallback(async () => {
    if (!unlocked) return;
    setLoading(true);
    try {
      const res = await trackingService.getLogs({
        page,
        limit,
        sortBy,
        sortOrder,
        eventType: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
        userRole: roleFilter !== 'all' ? roleFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res.success && res.data) {
        setLogs(res.data.results || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch behavior logs');
    } finally {
      setLoading(false);
    }
  }, [unlocked, page, limit, sortBy, sortOrder, eventTypeFilter, roleFilter, searchQuery]);

  // Initial and trigger load
  useEffect(() => {
    if (unlocked) {
      fetchLogs();
    }
  }, [unlocked, fetchLogs]);

  // Live polling (10 seconds)
  useEffect(() => {
    if (!unlocked || !liveRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 10000);
    return () => clearInterval(interval);
  }, [unlocked, liveRefresh, fetchLogs]);

  // Passkey unlock handler
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeyInput.trim()) {
      toast.error('Please enter the security passkey');
      return;
    }
    setVerifyingKey(true);
    try {
      const res = await trackingService.verifyPasskey(passkeyInput.trim());
      if (res.success) {
        sessionStorage.setItem('larvo_tracking_unlocked', 'true');
        setUnlocked(true);
        toast.success('Behavior Tracking Console Unlocked');
      }
    } catch (err: any) {
      toast.error(err.message || 'Invalid security passkey');
    } finally {
      setVerifyingKey(false);
    }
  };

  const handleLockSession = () => {
    sessionStorage.removeItem('larvo_tracking_unlocked');
    setUnlocked(false);
    setPasskeyInput('');
    setSelectedLog(null);
    toast.success('Console Locked');
  };

  const toggleSort = (field: GetBehaviorLogsParams['sortBy']) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── 1. Passkey Gate Screen ────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-stone-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-700 border border-amber-200 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
            Behavior Tracking Console
          </h1>
          <p className="text-sm text-stone-500 mt-2 mb-6">
            Confidential audit trail of all store traffic and interactions. Enter the security passkey to inspect logs.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative text-left">
              <label htmlFor={passkeyInputId} className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Security Passkey / PIN
              </label>
              <div className="relative">
                <input
                  id={passkeyInputId}
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Enter passkey..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all font-mono text-sm"
                />
                <Key className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifyingKey}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {verifyingKey ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying Passkey...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Unlock Audit Stream
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-center gap-2 text-xs text-stone-400">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Immutable Forensic Audit Logging Enabled</span>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Full Behavior Logs Console ───────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Top Header & Console Controls */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-stone-900 text-white rounded-lg">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-serif font-bold text-stone-900">
                  User Behavior Tracking Log
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Real-time clickstream, route navigations, and client telemetry across all store visitors.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Live Polling Toggle */}
            <button
              onClick={() => setLiveRefresh((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                liveRefresh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${liveRefresh ? 'animate-pulse text-emerald-600' : 'text-stone-400'}`} />
              <span>Live Updates: {liveRefresh ? 'ON' : 'OFF'}</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchLogs()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium border border-stone-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-stone-500' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Lock Console */}
            <button
              onClick={handleLockSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Console</span>
            </button>
          </div>
        </div>

        {/* Filter and Sort Toolbar */}
        <div className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search bar */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search IP, User email, Path, or Target..."
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>

          {/* Event Type Filter */}
          <div className="md:col-span-2">
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="all">All Events</option>
              <option value="click">Clicks Only</option>
              <option value="page_view">Page Views Only</option>
              <option value="navigation">Navigations Only</option>
              <option value="form_submit">Form Submits</option>
            </select>
          </div>

          {/* User Role Filter */}
          <div className="md:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              <option value="all">All Roles</option>
              <option value="guest">Guests</option>
              <option value="customer">Customers</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
              <option value="owner">Owners</option>
            </select>
          </div>

          {/* Sort Option Dropdown */}
          <div className="md:col-span-3 flex items-center gap-2">
            <div className="flex-grow">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="createdAt">Sort by: Timestamp</option>
                <option value="eventType">Sort by: Event Type</option>
                <option value="userRole">Sort by: User Role</option>
                <option value="ip">Sort by: IP Address</option>
                <option value="path">Sort by: Page Path</option>
              </select>
            </div>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              title={`Sort direction: ${sortOrder === 'desc' ? 'Descending (Newest first)' : 'Ascending (Oldest first)'}`}
              className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-200 text-xs flex items-center justify-center transition-colors"
            >
              {sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Stats Pill */}
          <div className="md:col-span-1 flex items-center justify-end">
            <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-1 rounded">
              {total.toLocaleString()} total
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <th
                  onClick={() => toggleSort('createdAt')}
                  className="py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span>Timestamp</span>
                    {sortBy === 'createdAt' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-stone-700" /> : <ArrowUp className="w-3 h-3 text-stone-700" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('userRole')}
                  className="py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>User / Role</span>
                    {sortBy === 'userRole' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-stone-700" /> : <ArrowUp className="w-3 h-3 text-stone-700" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('eventType')}
                  className="py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <MousePointer className="w-3.5 h-3.5 text-stone-400" />
                    <span>Event</span>
                    {sortBy === 'eventType' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-stone-700" /> : <ArrowUp className="w-3 h-3 text-stone-700" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('path')}
                  className="py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-stone-400" />
                    <span>Page Path</span>
                    {sortBy === 'path' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-stone-700" /> : <ArrowUp className="w-3 h-3 text-stone-700" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Action / Target Detail</th>
                <th
                  onClick={() => toggleSort('ip')}
                  className="py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-stone-400" />
                    <span>IP & Location</span>
                    {sortBy === 'ip' && (
                      sortOrder === 'desc' ? <ArrowDown className="w-3 h-3 text-stone-700" /> : <ArrowUp className="w-3 h-3 text-stone-700" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Device & OS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-300" />
                    Loading tracking events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No behavior events found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateObj = new Date(log.createdAt);
                  const formattedTime = dateObj.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const formattedDate = dateObj.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-amber-50/40 cursor-pointer transition-colors ${
                        selectedLog?._id === log._id ? 'bg-amber-50/70' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-600">
                        <div className="font-medium text-stone-900">{formattedTime}</div>
                        <div className="text-[10px] text-stone-400">{formattedDate}</div>
                      </td>

                      {/* User & Role Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              log.userRole === 'admin' || log.userRole === 'owner'
                                ? 'bg-purple-100 text-purple-800'
                                : log.userRole === 'staff'
                                ? 'bg-blue-100 text-blue-800'
                                : log.userRole === 'customer'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {log.userRole}
                          </span>
                          <span className="text-stone-700 font-medium truncate max-w-[120px]" title={log.userEmail || log.userName || 'Guest'}>
                            {log.userEmail || log.userName || 'Guest'}
                          </span>
                        </div>
                      </td>

                      {/* Event Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.eventType === 'click' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium text-[11px]">
                            <MousePointer className="w-3 h-3" />
                            Click
                          </span>
                        ) : log.eventType === 'page_view' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-medium text-[11px]">
                            <Eye className="w-3 h-3" />
                            Page View
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium text-[11px]">
                            {log.eventType}
                          </span>
                        )}
                      </td>

                      {/* Page Path */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-700">
                        <span className="bg-stone-100 px-1.5 py-0.5 rounded text-[11px]" title={log.page.path}>
                          {log.page.path.length > 25 ? log.page.path.slice(0, 25) + '...' : log.page.path}
                        </span>
                      </td>

                      {/* Action / Target Details */}
                      <td className="py-3 px-4 max-w-[200px] truncate text-stone-600">
                        {log.eventType === 'click' ? (
                          <div className="flex items-center gap-1.5" title={log.target?.innerText || log.target?.selector}>
                            <span className="font-mono text-[10px] text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                              &lt;{log.target?.tagName?.toLowerCase() || 'el'}&gt;
                            </span>
                            <span className="truncate">
                              {log.target?.innerText || log.target?.ariaLabel || log.target?.selector || 'Clicked element'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">
                            {log.page.title || 'Visited Page'}
                          </span>
                        )}
                      </td>

                      {/* IP & Location */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-stone-800">{log.ip}</div>
                        <div className="text-[10px] text-stone-500">
                          {log.location?.country || 'Unknown'} {log.location?.city ? `(${log.location.city})` : ''}
                        </div>
                      </td>

                      {/* Device & OS */}
                      <td className="py-3 px-4 whitespace-nowrap text-stone-600">
                        <div className="flex items-center gap-1.5">
                          {log.clientInfo.device.type === 'mobile' ? (
                            <Smartphone className="w-3.5 h-3.5 text-stone-400" />
                          ) : log.clientInfo.device.type === 'tablet' ? (
                            <Tablet className="w-3.5 h-3.5 text-stone-400" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-stone-400" />
                          )}
                          <span>
                            {log.clientInfo.os.name} {log.clientInfo.os.version}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {log.clientInfo.browser.name} {log.clientInfo.browser.version}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-stone-50/70 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-stone-200 rounded px-2 py-1 text-xs text-stone-800 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-stone-400">|</span>
            <span>
              Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0} -{' '}
              {Math.min(page * limit, total)} of {total.toLocaleString()} events
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 bg-white border border-stone-200 rounded text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-stone-800">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="p-1.5 bg-white border border-stone-200 rounded text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Inspection Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-stone-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-stone-900 text-white rounded-lg">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900">Event Telemetry Details</h2>
                  <p className="text-xs text-stone-500 font-mono">{selectedLog._id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow text-xs text-stone-700">
              {/* Event & Target Section */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
                <h3 className="font-semibold text-stone-900 uppercase text-[10px] tracking-wider text-stone-500">
                  Target Interaction
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-stone-400 block text-[10px]">EVENT TYPE</span>
                    <span className="font-semibold text-stone-800">{selectedLog.eventType.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">CLICK COORDINATES</span>
                    <span className="font-mono text-stone-800">
                      X: {selectedLog.target?.coords?.x ?? 0}, Y: {selectedLog.target?.coords?.y ?? 0}
                    </span>
                  </div>
                </div>

                {selectedLog.target?.innerText && (
                  <div>
                    <span className="text-stone-400 block text-[10px]">TARGET TEXT</span>
                    <p className="mt-0.5 font-medium text-stone-900 bg-white p-2 rounded border border-stone-200">
                      "{selectedLog.target.innerText}"
                    </p>
                  </div>
                )}

                {selectedLog.target?.selector && (
                  <div>
                    <span className="text-stone-400 block text-[10px]">CSS SELECTOR / XPATH</span>
                    <p className="mt-0.5 font-mono text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 break-all">
                      {selectedLog.target.selector}
                    </p>
                  </div>
                )}

                {selectedLog.target?.href && (
                  <div>
                    <span className="text-stone-400 block text-[10px]">TARGET LINK (HREF)</span>
                    <a
                      href={selectedLog.target.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 text-blue-600 hover:underline flex items-center gap-1 break-all"
                    >
                      <span>{selectedLog.target.href}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {/* User & Session Telemetry */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
                <h3 className="font-semibold text-stone-900 uppercase text-[10px] tracking-wider text-stone-500">
                  Identity & Session
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-stone-400 block text-[10px]">ROLE</span>
                    <span className="font-semibold capitalize text-stone-800">{selectedLog.userRole}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">EMAIL / USER</span>
                    <span className="text-stone-800">{selectedLog.userEmail || 'Anonymous Guest'}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 block text-[10px]">PERSISTENT DEVICE ID</span>
                    <button
                      onClick={() => copyToClipboard(selectedLog.deviceId, 'Device ID')}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-1"
                    >
                      {copiedKey === 'Device ID' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-stone-700 bg-white p-2 rounded border border-stone-200 break-all">
                    {selectedLog.deviceId}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400 block text-[10px]">SESSION ID</span>
                    <button
                      onClick={() => copyToClipboard(selectedLog.sessionId, 'Session ID')}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-1"
                    >
                      {copiedKey === 'Session ID' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-stone-700 bg-white p-2 rounded border border-stone-200 break-all">
                    {selectedLog.sessionId}
                  </div>
                </div>
              </div>

              {/* Network & Device Profile */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
                <h3 className="font-semibold text-stone-900 uppercase text-[10px] tracking-wider text-stone-500">
                  Network & Environment
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-stone-400 block text-[10px]">IP ADDRESS</span>
                    <span className="font-mono text-stone-900 font-medium">{selectedLog.ip}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">GEO LOCATION</span>
                    <span className="text-stone-800">
                      {selectedLog.location?.country || 'Unknown'}, {selectedLog.location?.city || selectedLog.location?.region || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">OPERATING SYSTEM</span>
                    <span className="text-stone-800">
                      {selectedLog.clientInfo.os.name} {selectedLog.clientInfo.os.version}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">WEB BROWSER</span>
                    <span className="text-stone-800">
                      {selectedLog.clientInfo.browser.name} {selectedLog.clientInfo.browser.version}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">SCREEN RESOLUTION</span>
                    <span className="text-stone-800 font-mono">
                      {selectedLog.clientInfo.screenResolution || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">VIEWPORT SIZE</span>
                    <span className="text-stone-800 font-mono">
                      {selectedLog.clientInfo.viewport || 'N/A'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-stone-400 block text-[10px]">RAW USER-AGENT</span>
                  <div className="mt-0.5 font-mono text-[10px] text-stone-600 bg-white p-2 rounded border border-stone-200 break-all">
                    {selectedLog.clientInfo.userAgent || 'None'}
                  </div>
                </div>
              </div>

              {/* Raw JSON Viewer */}
              <div>
                <span className="text-stone-400 block text-[10px] uppercase font-semibold mb-1">
                  Full Raw Document JSON
                </span>
                <pre className="bg-stone-900 text-amber-200 p-3 rounded-lg overflow-x-auto font-mono text-[10px] max-h-48 border border-stone-800">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs text-stone-400">
              <span className="font-mono text-[10px]">
                Recorded: {new Date(selectedLog.createdAt).toISOString()}
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBehaviorLogsPage;
