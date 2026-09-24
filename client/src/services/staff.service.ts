import api, { ApiResponse } from './api';

export type StaffRole = 'staff' | 'delivery_manager' | 'admin' | 'owner';

export interface StaffUser {
  _id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  authProvider?: 'local' | 'google';
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedStaffResponse {
  results: StaffUser[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateStaffDto {
  name: string;
  email: string;
  password: string;
  role: 'staff' | 'delivery_manager' | 'admin';
}

export interface UpdateStaffDto {
  name?: string;
  active?: boolean;
  role?: StaffRole;
}

export const staffService = {
  /**
   * List staff accounts with optional pagination, role filter, and keyword search
   */
  async getStaff(params?: {
    page?: number;
    limit?: number;
    role?: StaffRole;
    search?: string;
  }): Promise<PaginatedStaffResponse> {
    const res = (await api.get<ApiResponse<PaginatedStaffResponse>>('/staff', {
      params,
    })) as unknown as ApiResponse<PaginatedStaffResponse>;
    return res.data!;
  },

  /**
   * Provision a new staff account directly
   */
  async createStaff(dto: CreateStaffDto): Promise<StaffUser> {
    const res = (await api.post<ApiResponse<{ user: StaffUser }>>(
      '/staff',
      dto
    )) as unknown as ApiResponse<{ user: StaffUser }>;
    return res.data!.user;
  },

  /**
   * Update staff name, active status, or role
   */
  async updateStaff(id: string, dto: UpdateStaffDto): Promise<StaffUser> {
    const res = (await api.patch<ApiResponse<{ user: StaffUser }>>(
      `/staff/${id}`,
      dto
    )) as unknown as ApiResponse<{ user: StaffUser }>;
    return res.data!.user;
  },
};
