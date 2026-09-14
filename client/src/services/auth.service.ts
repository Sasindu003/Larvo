import api, { ApiResponse } from './api';
import type { UserRole } from '../config/roles';
import type { Address } from './user.service';

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  addresses: Address[];
  wishlist: string[];
  createdAt: string;
}

function extractError(error: any): never {
  if (error?.message) {
    throw new Error(error.message);
  }
  if (error?.response?.data?.message) {
    throw new Error(error.response.data.message);
  }
  throw error;
}

export const authService = {
  async register(data: RegisterData) {
    try {
      const res = await api.post('/auth/register', data);
      return res;
    } catch (error: any) {
      extractError(error);
    }
  },

  async login(data: LoginData) {
    try {
      const res = await api.post('/auth/login', data);
      return res;
    } catch (error: any) {
      extractError(error);
    }
  },

  async logout() {
    try {
      const res = await api.post('/auth/logout');
      return res;
    } catch (error: any) {
      extractError(error);
    }
  },

  async getMe(): Promise<User> {
    try {
      const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
      return (res as any).data?.user || (res as any).data || (res as any);
    } catch (error: any) {
      extractError(error);
    }
  },

  async googleLogin(credential: string) {
    try {
      const res = await api.post('/auth/google', { credential });
      return res;
    } catch (error: any) {
      extractError(error);
    }
  },
};
