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

/**
 * Resolves the appropriate API base URL:
 * - On deployed domains (e.g. *.vercel.app, production): Always uses relative '/api' unless
 *   a valid remote https:// URL is provided (prevents mixed content/localhost failures).
 * - On local development (localhost / 127.0.0.1): Uses VITE_API_URL or http://localhost:5000/api.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any)?.env?.VITE_API_URL?.trim();

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    // In production browser environments (Vercel, custom domain)
    if (!isLocalhost) {
      if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return '/api';
      }
      return envUrl;
    }
  }

  return envUrl || (import.meta?.env?.PROD ? '/api' : 'http://localhost:5000/api');
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dynamically ensure request always targets the correct runtime base URL
api.interceptors.request.use((config) => {
  if (!config.baseURL || config.baseURL.includes('localhost')) {
    config.baseURL = getApiBaseUrl();
  }
  return config;
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

export default api;
