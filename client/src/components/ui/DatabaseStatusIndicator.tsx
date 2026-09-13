import React, { useEffect, useState, useCallback } from 'react';
import { Database, Server, RefreshCw, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, Activity, Globe } from 'lucide-react';
import { healthService, HealthStatus } from '../../services/health.service';

export const DatabaseStatusIndicator: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus>({
    serverStatus: 'checking',
    dbStatus: 'checking',
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
        serverStatus: 'disconnected',
        dbStatus: 'disconnected',
        error: 'System health check failed',
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

  const isServerOk = health.serverStatus === 'connected';
  const isDbOk = health.dbStatus === 'connected';
  const isChecking = health.serverStatus === 'checking';

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        title="Open Server & Database Status"
        aria-label="Open Server and Database Status"
        className="fixed bottom-4 left-4 z-50 p-2.5 rounded-full bg-white/95 backdrop-blur-md shadow-lg border border-ink-200/80 hover:shadow-xl hover:scale-105 transition-all text-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-900"
      >
        <div className="flex items-center gap-1.5">
          {/* Server Dot */}
          <span className="relative flex h-2.5 w-2.5">
            {isServerOk ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            ) : isChecking ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            )}
          </span>
          {/* DB Dot */}
          <span className="relative flex h-2.5 w-2.5">
            {isDbOk ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            ) : isChecking ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            )}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none font-sans text-xs">
      {/* Expanded Details Card */}
      {isExpanded && (
        <div className="mb-2 w-84 rounded-2xl bg-white/95 backdrop-blur-md border border-ink-200/90 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-ink-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold tracking-wide">System & Database Health</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={checkStatus}
                disabled={isRefreshing}
                title="Refresh Status"
                aria-label="Refresh Status"
                className="p-1 text-ink-400 hover:text-white rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                title="Collapse Card"
                aria-label="Collapse Card"
                className="p-1 text-ink-400 hover:text-white rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body Info */}
          <div className="p-4 space-y-3.5">
            {/* 1. Backend Server Card */}
            <div className="p-3 rounded-xl border border-ink-100 bg-ink-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                  <Server className="w-3.5 h-3.5 text-ink-600" />
                  <span>Backend Server</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold">
                  {isServerOk ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Online</span>
                    </>
                  ) : isChecking ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                      <span className="text-amber-600">Checking...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-rose-700">Offline</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-ink-600 pt-1 border-t border-ink-200/50">
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-ink-400" />
                  API Endpoint
                </span>
                <span className="font-mono text-[10px] text-ink-800 truncate max-w-[170px]" title={health.apiUrl}>
                  {health.apiUrl || '/api'}
                </span>
              </div>

              {health.latencyMs !== undefined && (
                <div className="flex items-center justify-between text-[11px] text-ink-600">
                  <span>Latency</span>
                  <span className="font-mono font-medium text-emerald-700">
                    {health.latencyMs} ms
                  </span>
                </div>
              )}
            </div>

            {/* 2. MongoDB Database Card */}
            <div className="p-3 rounded-xl border border-ink-100 bg-ink-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                  <Database className="w-3.5 h-3.5 text-ink-600" />
                  <span>MongoDB Database</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold">
                  {isDbOk ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Connected</span>
                    </>
                  ) : isChecking ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                      <span className="text-amber-600">Checking...</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-rose-700">Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              {isDbOk && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-ink-600 pt-1 border-t border-ink-200/50">
                    <span>Database</span>
                    <span className="font-mono font-semibold text-ink-900 bg-sand-100 px-2 py-0.5 rounded">
                      {health.dbName || 'shop'}
                    </span>
                  </div>

                  {health.host && (
                    <div className="flex items-center justify-between text-[11px] text-ink-600">
                      <span>Cluster Host</span>
                      <span className="font-mono text-ink-700 text-[10px] truncate max-w-[160px]" title={health.host}>
                        {health.host}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Error Diagnosis if either failed */}
            {(!isServerOk || !isDbOk) && health.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
                <p className="font-semibold flex items-center gap-1 mb-0.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                  {!isServerOk ? 'Server Unreachable' : 'Database Connection Issue'}
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
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-md border transition-all hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ink-900 ${
            isServerOk && isDbOk
              ? 'border-emerald-300 text-ink-800'
              : isChecking
              ? 'border-amber-300 text-ink-800'
              : !isServerOk
              ? 'border-rose-400 text-rose-900 bg-rose-50/90'
              : 'border-amber-400 text-amber-900 bg-amber-50/90'
          }`}
        >
          {/* Dual Status Dots */}
          <div className="flex items-center gap-1">
            {/* Server Dot */}
            <span className="relative flex h-2 w-2" title={isServerOk ? 'Server: Connected' : 'Server: Offline'}>
              {isServerOk ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              ) : isChecking ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              )}
            </span>

            {/* DB Dot */}
            <span className="relative flex h-2 w-2" title={isDbOk ? 'Database: Connected' : 'Database: Offline'}>
              {isDbOk ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              ) : isChecking ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              )}
            </span>
          </div>

          <span className="font-semibold tracking-tight text-[11px]">
            {isServerOk && isDbOk ? (
              <>Server & DB Online</>
            ) : isChecking ? (
              <>Checking Services...</>
            ) : !isServerOk ? (
              <>Server Offline</>
            ) : (
              <>DB Offline</>
            )}
          </span>

          {isServerOk && health.latencyMs !== undefined && (
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
          title="Refresh server and database check"
          aria-label="Refresh server and database check"
          className="p-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-sm border border-ink-200 text-ink-600 hover:text-ink-950 hover:bg-white transition-all disabled:opacity-50 focus:outline-none"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
