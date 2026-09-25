import React from 'react';
import { ClipboardList } from 'lucide-react';

export const AdminPurchaseOrdersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              Purchase Orders
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Procure inventory from authorized suppliers.
          </p>
        </div>
      </div>

      {/* ── Empty Container ───────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-16 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <ClipboardList className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">
          Purchase Orders
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
          This module is currently cleared and awaiting a fresh update.
        </p>
      </div>
    </div>
  );
};

export default AdminPurchaseOrdersPage;