import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Layers,
  FolderTree,
  Package,
  Boxes,
  Ticket,
  ShoppingCart,
  RotateCcw,
  Users,
  BarChart3,
  Truck,
  ClipboardList,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ADMIN_NAV_ITEMS, UserRole } from '../config/roles';
import { useAuth } from '../context/AuthContext';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  FolderTree,
  Package,
  Boxes,
  Ticket,
  ShoppingCart,
  RotateCcw,
  Users,
  BarChart3,
  Truck,
  ClipboardList,
};

export const AdminPlaceholderPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Find matching nav item
  const currentItem =
    ADMIN_NAV_ITEMS.find((item) => item.href === location.pathname) ||
    ADMIN_NAV_ITEMS.find((item) => location.pathname.startsWith(item.href)) || {
      title: 'Admin Management',
      slug: 'dashboard',
      href: location.pathname,
      iconName: 'Shield',
      description: 'Operations and catalog administration console',
      allowedRoles: ['staff', 'admin', 'owner'] as UserRole[],
    };

  const IconComponent = ICON_MAP[currentItem.iconName] || Shield;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                {currentItem.title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Clock className="w-3 h-3" />
                Prompt Stage
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{currentItem.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Route:</span>
          <code className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-amber-400 border border-slate-800">
            {location.pathname}
          </code>
        </div>
      </div>

      {/* Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Active Session
          </span>
          <div className="text-sm font-semibold text-white">{user?.name}</div>
          <div className="text-xs text-slate-400 capitalize">Role: {user?.role}</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Access Permitted
          </span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {currentItem.allowedRoles.map((r) => (
              <span
                key={r}
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  r === user?.role
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-extrabold'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {r.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Status
          </span>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Shell & Navigation Mounted
          </div>
          <p className="text-[11px] text-slate-400">Module UI will be populated in subsequent tasks.</p>
        </div>
      </div>
    </div>
  );
};
