import axios, { AxiosError, AxiosResponse } from 'axios';

export interface ApiError {
  message: string;
  status?: number;
  errors?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

const isVercelDeployment =
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'larvo-client.vercel.app');

const configuredApiUrl = (import.meta as any).env?.VITE_API_URL;

// When running on Vercel, prefer same-site relative '/api' (rewritten by client/vercel.json to server)
// to prevent cross-origin preflight overhead and ensure SameSite=Lax cookies are preserved.
const baseURL: string =
  isVercelDeployment && (!configuredApiUrl || configuredApiUrl.includes('larvo-server.vercel.app'))
    ? '/api'
    : configuredApiUrl || '/api';

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

  const base = baseURL.replace(/\/+$/, '');
  const path = url.startsWith('/api') ? url.slice(4) : url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
};

export function extractError(error: unknown): never {
  const err = error as { message?: string; response?: { data?: { message?: string } } } | null | undefined;
  if (err?.message) {
    throw new Error(err.message);
  }
  if (err?.response?.data?.message) {
    throw new Error(err.response.data.message);
  }
  throw error;
}

export default api;
