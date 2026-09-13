import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
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
  ArrowLeft,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV_ITEMS, AdminNavItem, UserRole } from '../../config/roles';

// Icon lookup map
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers,
  FolderTree,
  Package,
  Boxes,
  Ticket,
  Wallet,
  ShoppingCart,
  RotateCcw,
  Users,
  BarChart3,
  Truck,
  ClipboardList,
};

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login?redirect=/admin" replace />;
  }

  // Filter navigation items visible to the current role
  const visibleNavItems = ADMIN_NAV_ITEMS.filter((item) =>
    item.allowedRoles.includes(user.role as UserRole)
  );

  // If at exact `/admin` or `/admin/`, redirect to the first visible item
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    const firstItem = visibleNavItems[0];
    if (firstItem) {
      return <Navigate to={firstItem.href} replace />;
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out of Admin Portal');
    } catch {
      toast.error('Logout failed');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'admin':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'staff':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'delivery_manager':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Open admin sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Admin Brand */}
          <Link to="/admin" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-base shadow-sm group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm tracking-wider uppercase text-white flex items-center gap-1.5">
                LARVO <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">PORTAL</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium -mt-0.5">Store Operations & Management</span>
            </div>
          </Link>
        </div>

        {/* Topbar User info + Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Back to store link */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
            title="Return to customer shopfront"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Storefront</span>
          </Link>

          {/* Current User Pill */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white leading-tight truncate max-w-[140px]">
                {user.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{user.email}</div>
            </div>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border ${getRoleBadgeColor(
                user.role
              )}`}
            >
              {user.role.replace('_', ' ')}
            </span>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col bg-slate-900 border-r border-slate-800 flex-shrink-0">
          <div className="p-3">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Management Modules
            </div>
            <nav className="space-y-1 mt-1">
              {visibleNavItems.map((item) => {
                const IconComponent = ICON_MAP[item.iconName] || Layers;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 group ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <IconComponent
                            className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                              isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-400'
                            }`}
                          />
                          <span>{item.title}</span>
                        </div>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-950" />}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-4 border-t border-slate-800 bg-slate-900/50 text-[11px] text-slate-400">
            <div className="flex items-center gap-2 font-medium text-slate-300 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>RBAC Enforced</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Showing {visibleNavItems.length} modules available for <span className="text-amber-300 font-semibold">{user.role}</span>.
            </p>
          </div>
        </aside>

        {/* Mobile Slide-in Sidebar Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col z-50 animate-fade-in">
              <div className="p-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-sm">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="font-display font-bold text-sm text-white">Admin Modules</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                <nav className="space-y-1">
                  {visibleNavItems.map((item) => {
                    const IconComponent = ICON_MAP[item.iconName] || Layers;
                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`
                        }
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="w-4 h-4" />
                          <span>{item.title}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900/70 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
