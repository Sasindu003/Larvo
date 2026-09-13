import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '../cart/CartDrawer';

export const RootLayout: React.FC = () => {
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
