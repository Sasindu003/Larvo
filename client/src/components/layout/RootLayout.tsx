import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '../cart/CartDrawer';
import { useAuth } from '../../context/AuthContext';

export const RootLayout: React.FC = () => {
  const { user } = useAuth();

  // Delivery managers are operational staff and should not see customer shopping storefront
  if (user?.role === 'delivery_manager') {
    return <Navigate to="/delivery/orders" replace />;
  }

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 flex flex-col font-sans selection:bg-sand-300 selection:text-ink-950">
      <Header />
      <CartDrawer />
      <main className="flex-grow container mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
