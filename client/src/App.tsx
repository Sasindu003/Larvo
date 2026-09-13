import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { router } from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { DatabaseStatusIndicator } from './components/ui/DatabaseStatusIndicator';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Toaster position="top-center" />
          <RouterProvider router={router} />
          <DatabaseStatusIndicator />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

