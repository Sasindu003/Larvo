import React, { useEffect, useState, useCallback } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { healthService, HealthStatus } from '../../services/health.service';

export const DatabaseStatusIndicator: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus>({
    connected: false,
    status: 'checking',
    lastChecked: new Date(),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await healthService.checkHealth();
      setHealth(result);
    } catch {
      setHealth({
        connected: false,
        status: 'disconnected',
        error: 'Connection check failed',
        lastChecked: new Date(),
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    // Poll every 25 seconds
    const interval = setInterval(checkStatus, 25000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        title="Open Database Health Status"
        aria-label="Open Database Health Status"
        className="fixed bottom-4 left-4 z-50 p-2.5 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-ink-200/80 hover:shadow-xl hover:scale-105 transition-all text-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-900"
      >
        <span className="relative flex h-3 w-3">
          {health.status === 'connected' ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </>
          ) : health.status === 'checking' ? (
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 animate-pulse"></span>
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </>
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none font-sans text-xs">
      {/* Expanded Details Card */}
      {isExpanded && (
        <div className="mb-2 w-80 rounded-2xl bg-white/95 backdrop-blur-md border border-ink-200/90 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-ink-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold tracking-wide">Database Health</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={checkStatus}
                disabled={isRefreshing}
                title="Refresh Status"
                aria-label="Refresh Database Status"
                className="p-1 text-ink-400 hover:text-white rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                title="Collapse Card"
                aria-label="Collapse Database Card"
                className="p-1 text-ink-400 hover:text-white rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body Info */}
          <div className="p-4 space-y-3">
            {/* Status Row */}
            <div className="flex items-center justify-between pb-2.5 border-b border-ink-100">
              <span className="text-ink-500 font-medium">Connection</span>
              <div className="flex items-center gap-1.5 font-semibold">
                {health.status === 'connected' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Online</span>
                  </>
                ) : health.status === 'checking' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                    <span className="text-amber-600">Connecting...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-rose-700">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            {/* Database Details */}
            {health.status === 'connected' && (
              <>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-500">Database Name</span>
                  <span className="font-mono font-semibold text-ink-900 bg-sand-100 px-2 py-0.5 rounded">
                    {health.dbName || 'shop'}
                  </span>
                </div>

                {health.host && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-500">Cluster Host</span>
                    <span className="font-mono text-ink-700 text-[10px] truncate max-w-[170px]" title={health.host}>
                      {health.host}
                    </span>
                  </div>
                )}

                {health.latencyMs !== undefined && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-500">API Latency</span>
                    <span className="font-mono font-medium text-emerald-700 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-emerald-500" />
                      {health.latencyMs} ms
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Error Message if disconnected */}
            {health.status === 'disconnected' && health.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                <p className="font-semibold flex items-center gap-1 mb-0.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                  Connection Error
                </p>
                <p className="text-[10px] break-words text-rose-700">{health.error}</p>
              </div>
            )}

            {/* Last Checked Footer */}
            <div className="pt-2 border-t border-ink-100 flex items-center justify-between text-[10px] text-ink-400">
              <span>Last checked: {formatTime(health.lastChecked)}</span>
              <button
                onClick={() => {
                  setIsExpanded(false);
                  setIsMinimized(true);
                }}
                className="text-ink-500 hover:text-ink-900 underline"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Pill Button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-md border transition-all hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ink-900 ${
            health.status === 'connected'
              ? 'border-emerald-300 text-ink-800'
              : health.status === 'checking'
              ? 'border-amber-300 text-ink-800'
              : 'border-rose-300 text-rose-900 bg-rose-50/90'
          }`}
        >
          {/* Pulsing Status Dot */}
          <span className="relative flex h-2.5 w-2.5">
            {health.status === 'connected' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : health.status === 'checking' ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse"></span>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </>
            )}
          </span>

          <span className="font-semibold tracking-tight text-[11px]">
            {health.status === 'connected'
              ? `DB Online (${health.dbName || 'shop'})`
              : health.status === 'checking'
              ? 'Checking DB...'
              : 'DB Offline'}
          </span>

          {health.status === 'connected' && health.latencyMs !== undefined && (
            <span className="text-[10px] text-ink-400 font-mono hidden sm:inline">
              {health.latencyMs}ms
            </span>
          )}

          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-ink-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-ink-400" />
          )}
        </button>

        {/* Quick Re-check button */}
        <button
          onClick={checkStatus}
          disabled={isRefreshing}
          title="Refresh database connection check"
          aria-label="Refresh database connection check"
          className="p-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-ink-200 text-ink-600 hover:text-ink-950 hover:bg-white transition-all disabled:opacity-50 focus:outline-none"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
