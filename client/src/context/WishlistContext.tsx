import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { wishlistService } from '../services/wishlist.service';
import { Product } from '../services/product.service';
import { useAuth } from './AuthContext';

interface WishlistContextValue {
  items: Product[];
  totalWishlist: number;
  loading: boolean;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: Product) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, status } = useAuth();

  const refreshWishlist = useCallback(async () => {
    if (status !== 'authenticated') {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const data = await wishlistService.getWishlist();
      setItems(data);
    } catch (err: any) {
      console.error('Failed to fetch wishlist:', err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Fetch when authenticated, clear on logout
  useEffect(() => {
    if (status === 'authenticated') {
      refreshWishlist();
    } else {
      setItems([]);
    }
  }, [status, refreshWishlist]);

  const isWishlisted = useCallback(
    (productId: string) => {
      return items.some((item) => item._id === productId);
    },
    [items]
  );

  const toggleWishlist = async (product: Product): Promise<boolean> => {
    if (status !== 'authenticated') {
      toast.error('Please sign in to save items to your wishlist', {
        id: 'wishlist-auth-prompt',
      });
      const currentPath = window.location.pathname;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      return false;
    }

    const currentlySaved = isWishlisted(product._id);

    // Optimistic UI update
    if (currentlySaved) {
      setItems((prev) => prev.filter((i) => i._id !== product._id));
    } else {
      setItems((prev) => [product, ...prev]);
    }

    try {
      const res = await wishlistService.toggleWishlist(product._id);
      if (res.isWishlisted) {
        toast.success(`Saved "${product.name}" to wishlist`);
      } else {
        toast.success(`Removed "${product.name}" from wishlist`);
      }
      return res.isWishlisted;
    } catch (err: any) {
      // Revert optimistic update on error
      if (currentlySaved) {
        setItems((prev) => [product, ...prev]);
      } else {
        setItems((prev) => prev.filter((i) => i._id !== product._id));
      }
      toast.error(err.message || 'Failed to update wishlist');
      return currentlySaved;
    }
  };

  const removeFromWishlist = async (productId: string): Promise<void> => {
    if (status !== 'authenticated') return;

    const removedItem = items.find((i) => i._id === productId);
    setItems((prev) => prev.filter((i) => i._id !== productId));

    try {
      await wishlistService.removeFromWishlist(productId);
      if (removedItem) {
        toast.success(`Removed "${removedItem.name}" from wishlist`);
      }
    } catch (err: any) {
      if (removedItem) {
        setItems((prev) => [removedItem, ...prev]);
      }
      toast.error(err.message || 'Failed to remove from wishlist');
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        totalWishlist: items.length,
        loading,
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextValue => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
