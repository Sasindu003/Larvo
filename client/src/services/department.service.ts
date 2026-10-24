import api, { ApiResponse } from './api';

export interface Department {
  _id: string;
  name: string;
  slug: string;
  image: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDepartmentDto {
  name: string;
  slug?: string;
  image: string;
  active?: boolean;
}

export interface UpdateDepartmentDto {
  name?: string;
  slug?: string;
  image?: string;
  active?: boolean;
}

export const departmentService = {
  /**
   * Fetch departments (public active only by default; all if includeInactive=true)
   */
  async getDepartments(includeInactive: boolean = false): Promise<Department[]> {
    const url = includeInactive ? '/departments?includeInactive=true' : '/departments';
    const res = await api.get<ApiResponse<Department[]>>(url);
    return (res as any).data || (res as any);
  },

  /**
   * Get single department by slug
   */
  async getDepartmentBySlug(slug: string): Promise<Department> {
    const res = await api.get<ApiResponse<Department>>(`/departments/${slug}`);
    return (res as any).data || (res as any);
  },

  /**
   * Create department (Admin/Owner)
   */
  async createDepartment(data: CreateDepartmentDto): Promise<Department> {
    const res = await api.post<ApiResponse<Department>>('/departments', data);
    return (res as any).data || (res as any);
  },

  /**
   * Update department (Admin/Owner)
   */
  async updateDepartment(id: string, data: UpdateDepartmentDto): Promise<Department> {
    const res = await api.patch<ApiResponse<Department>>(`/departments/${id}`, data);
    return (res as any).data || (res as any);
  },

  /**
   * Deactivate department (Admin/Owner)
   */
  async deactivateDepartment(id: string): Promise<Department> {
    const res = await api.patch<ApiResponse<Department>>(`/departments/${id}/deactivate`);
    return (res as any).data || (res as any);
  },
};

export default departmentService;
