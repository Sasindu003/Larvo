import api from './api';
import { Product } from './product.service';

export interface WishlistResponse {
  success: boolean;
  data: {
    wishlist: Product[];
  };
  message?: string;
}

export interface ToggleWishlistResponse {
  success: boolean;
  data: {
    wishlist: string[];
    isWishlisted: boolean;
    action: 'added' | 'removed';
  };
  message?: string;
}

export const wishlistService = {
  async getWishlist(): Promise<Product[]> {
    const res = await api.get<WishlistResponse>('/wishlist');
    return (res as any).data?.wishlist || (res as any).wishlist || [];
  },

  async toggleWishlist(productId: string): Promise<ToggleWishlistResponse['data']> {
    const res = await api.post<ToggleWishlistResponse>(`/wishlist/${productId}`);
    return (res as any).data || (res as any);
  },

  async removeFromWishlist(productId: string): Promise<{ wishlist: string[] }> {
    const res = await api.delete(`/wishlist/${productId}`);
    return (res as any).data || (res as any);
  },
};
