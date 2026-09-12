import axios from 'axios';
import { Product } from './product.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

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
    return res.data.data.wishlist;
  },

  async toggleWishlist(productId: string): Promise<ToggleWishlistResponse['data']> {
    const res = await api.post<ToggleWishlistResponse>(`/wishlist/${productId}`);
    return res.data.data;
  },

  async removeFromWishlist(productId: string): Promise<{ wishlist: string[] }> {
    const res = await api.delete(`/wishlist/${productId}`);
    return res.data.data;
  },
};
