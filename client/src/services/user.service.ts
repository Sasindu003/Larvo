import api, { ApiResponse, extractError } from './api';
import { User } from './auth.service';

export interface Address {
  _id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

export interface UpdateProfileData {
  name: string;
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

function unwrapResponse<T>(res: unknown): T {
  const obj = res as { data?: T } | null | undefined;
  if (obj && typeof obj === 'object' && obj.data !== undefined) {
    return obj.data;
  }
  return res as T;
}

export const userService = {
  /**
   * Update name for current authenticated user
   */
  async updateProfile(data: UpdateProfileData): Promise<User> {
    try {
      const res = await api.patch<ApiResponse<User>>('/users/me', data);
      return unwrapResponse(res);
    } catch (error: unknown) {
      extractError(error);
    }
  },

  /**
   * Update password (requires current password verification)
   */
  async updatePassword(data: UpdatePasswordData): Promise<User> {
    try {
      const res = await api.patch<ApiResponse<User>>('/users/me/password', data);
      return unwrapResponse(res);
    } catch (error: unknown) {
      extractError(error);
    }
  },

  /**
   * Add a new address
   */
  async addAddress(data: Omit<Address, '_id'>): Promise<Address[]> {
    try {
      const res = await api.post<ApiResponse<Address[]>>('/users/me/addresses', data);
      return unwrapResponse(res);
    } catch (error: unknown) {
      extractError(error);
    }
  },

  /**
   * Update an existing address
   */
  async updateAddress(id: string, data: Partial<Address>): Promise<Address[]> {
    try {
      const res = await api.patch<ApiResponse<Address[]>>(`/users/me/addresses/${id}`, data);
      return unwrapResponse(res);
    } catch (error: unknown) {
      extractError(error);
    }
  },

  /**
   * Delete an address
   */
  async deleteAddress(id: string): Promise<Address[]> {
    try {
      const res = await api.delete<ApiResponse<Address[]>>(`/users/me/addresses/${id}`);
      return unwrapResponse(res);
    } catch (error: unknown) {
      extractError(error);
    }
  },
};
