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

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const baseURL: string =
  import.meta.env.VITE_API_URL ||
  (!isLocal
    ? 'https://larvo-server.vercel.app/api'
    : 'http://localhost:5000/api');

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
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

export default api;
