import axios from 'axios';
import { getApiBaseUrl } from './api';

// Configure axios to send cookies with every request
const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

import type { UserRole } from '../config/roles';
import type { Address } from './user.service';

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
  if (error.response?.data?.message) {
    throw new Error(error.response.data.message);
  }
  throw error;
}

export const authService = {
  async register(data: RegisterData) {
    try {
      const res = await api.post('/auth/register', data);
      return res.data;
    } catch (error: any) {
      extractError(error);
    }
  },

  async login(data: LoginData) {
    try {
      const res = await api.post('/auth/login', data);
      return res.data;
    } catch (error: any) {
      extractError(error);
    }
  },

  async logout() {
    try {
      const res = await api.post('/auth/logout');
      return res.data;
    } catch (error: any) {
      extractError(error);
    }
  },

  async getMe(): Promise<User> {
    try {
      const res = await api.get('/auth/me');
      return res.data.data.user;
    } catch (error: any) {
      extractError(error);
    }
  },

  async googleLogin(credential: string) {
    try {
      const res = await api.post('/auth/google', { credential });
      return res.data;
    } catch (error: any) {
      extractError(error);
    }
  },
};
