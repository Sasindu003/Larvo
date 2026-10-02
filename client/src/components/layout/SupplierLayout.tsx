import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import {
  Building2,
  Package,
  LogOut,
  Menu,
  X,
  Shield,
  Home,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export const SupplierLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login?redirect=/supplier" replace />;
  }

  // Redirect root /supplier to /supplier/products
  if (location.pathname === '/supplier' || location.pathname === '/supplier/') {
    return <Navigate to="/supplier/products" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out of Supplier Portal');
    } catch {
      toast.error('Logout failed');
    }
  };

  const navLinks = [
    {
      label: 'My Products',
      href: '/supplier/products',
      icon: Package,
      description: 'Supplied catalog & variants',
    },
    {
      label: 'Company Profile',
      href: '/supplier/profile',
      icon: Building2,
      description: 'Vendor details & password',
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

          <Link to="/supplier/purchase-orders" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                Supplier Portal
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                  Vendor
                </span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Supply chain orders & catalog
              </p>
            </div>
          </Link>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">{user.name}</span>
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                Supplier
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{user.email}</span>
          </div>

          <Link
            to="/"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-colors shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900/60 p-4 shrink-0">
          <div className="mb-3 px-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Supplier Operations
            </span>
          </div>

          <nav className="space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-start gap-3 p-3 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 font-semibold shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="leading-none text-xs">{item.label}</p>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold text-slate-300">Verified Vendor</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Service access granted on par with store staff for purchase fulfillment.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative w-72 bg-slate-900 border-r border-slate-800 p-5 flex flex-col z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-sm">Supplier Portal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>

              <nav className="space-y-1.5 flex-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 p-3 rounded-xl text-xs font-semibold ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <Link
                  to="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 p-2 text-xs text-slate-400 hover:text-white"
                >
                  <Home className="w-4 h-4" />
                  <span>Storefront</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SupplierLayout;
