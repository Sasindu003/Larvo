import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Store, LayoutDashboard } from 'lucide-react';
import { AdminBehaviorLogsPage } from './admin/AdminBehaviorLogsPage';
import { useAuth } from '../context/AuthContext';

export const TrackingPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-400 selection:text-stone-950">
      {/* Dedicated Standalone Audit Header */}
      <header className="h-16 border-b border-stone-800 bg-stone-900/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-base shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wider uppercase text-white">
                LARVO <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 border border-stone-700">AUDIT CONSOLE</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.2 rounded-full hidden sm:inline">
                URL: /tracking
              </span>
            </div>
            <p className="text-[10px] text-stone-400">Independent Behavior Tracking & Interaction Telemetry</p>
          </div>
        </div>

        {/* Quick Navigation Controls */}
        <div className="flex items-center gap-3">
          {user && (user.role === 'admin' || user.role === 'owner') && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg border border-stone-700 transition-colors"
              title="Return to Admin Portal"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin Portal</span>
            </Link>
          )}

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg border border-stone-700 transition-colors"
            title="Return to Storefront"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Storefront</span>
          </Link>

          {user && (
            <div className="pl-3 border-l border-stone-800 hidden md:flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-purple-950 text-purple-300 border border-purple-800">
                {user.role}
              </span>
              <span className="text-stone-300 font-medium truncate max-w-[120px]">{user.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Tracking Console Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <AdminBehaviorLogsPage />
      </main>
    </div>
  );
};

export default TrackingPage;
