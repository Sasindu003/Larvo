import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import {
  Truck,
  Package,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  Shield,
  Layers,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export const DeliveryLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login?redirect=/delivery" replace />;
  }

  // Redirect root /delivery to /delivery/orders
  if (location.pathname === '/delivery' || location.pathname === '/delivery/') {
    return <Navigate to="/delivery/orders" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out of Delivery Portal');
    } catch {
      toast.error('Logout failed');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'delivery_manager':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'owner':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'admin':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  const navLinks = [
    {
      label: 'Fulfillment Queue',
      href: '/delivery/orders',
      icon: Truck,
      description: 'Dispatch, transit & delivery progression',
    },
    {
      label: 'Return Pickups',
      href: '/delivery/returns',
      icon: RotateCcw,
      description: 'Scheduled pickups & return reception',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/delivery/orders" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/20 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                Delivery Portal
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border bg-sky-500/10 text-sky-400 border-sky-500/20">
                  Operations
                </span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Courier dispatch & fulfillment queue
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}

          {/* Admin link if user is admin or owner */}
          {(user.role === 'admin' || user.role === 'owner') && (
            <Link
              to="/admin/orders"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 rounded-lg transition-colors border border-indigo-900/40 ml-2"
              title="Return to Admin Management"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Portal
            </Link>
          )}
        </nav>

        {/* Right User & Actions */}
        <div className="flex items-center gap-3">
          {(user.role === 'admin' || user.role === 'owner') && (
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Storefront
            </Link>
          )}

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <div className="text-right">
              <span className="font-medium text-slate-200 block text-xs leading-tight">
                {user.name}
              </span>
              <span
                className={`text-[10px] font-mono capitalize px-1.5 py-0.2 rounded border ${getRoleBadge(
                  user.role
                )}`}
              >
                {user.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-sky-400" />
              <span className="font-bold text-sm text-white">Delivery Navigation</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-slate-900 p-4 space-y-2 flex-1 overflow-y-auto">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <div>
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{item.description}</div>
                  </div>
                </NavLink>
              );
            })}

            <div className="pt-4 border-t border-slate-800 space-y-2">
              {(user.role === 'admin' || user.role === 'owner') && (
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Storefront
                </Link>
              )}

              {(user.role === 'admin' || user.role === 'owner') && (
                <Link
                  to="/admin/orders"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 p-3 rounded-xl text-xs font-semibold text-indigo-400 hover:bg-indigo-950/40"
                >
                  <Shield className="w-4 h-4" />
                  Go to Admin Portal
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
};

export default DeliveryLayout;
