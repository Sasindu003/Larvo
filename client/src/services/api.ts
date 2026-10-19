import axios, { AxiosError, AxiosResponse } from 'axios';

export interface ApiError {
  message: string;
  status?: number;
  errors?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any;
}

const baseURL: string =
  (import.meta as any).env?.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'larvo-client',
  },
});

api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response.data as any;
  },
  (error: AxiosError<ApiResponse>) => {
    const normalizedError: ApiError = {
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      status: error.response?.status,
      errors: error.response?.data?.errors,
    };
    return Promise.reject(normalizedError);
  }
);

export const getFileUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = (
    (import.meta as any).env?.VITE_API_URL || '/api'
  ).replace(/\/+$/, '');

  const path = url.startsWith('/api') ? url.slice(4) : url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export default api;
