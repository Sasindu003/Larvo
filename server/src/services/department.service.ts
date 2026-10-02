import { Department, IDepartment } from '../models/Department';
import { AppError } from '../middleware/error.middleware';
import { CreateDepartmentInput, UpdateDepartmentInput } from '../validators/department.validator';

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export class DepartmentService {
  /**
   * Get all departments.
   * By default, returns only active departments.
   * When includeInactive is true (for authorized callers), returns all.
   */
  async getAllDepartments(includeInactive: boolean = false): Promise<IDepartment[]> {
    const filter = includeInactive ? {} : { active: true };
    return Department.find(filter).sort({ createdAt: 1 });
  }

  /**
   * Get single department by ID
   */
  async getDepartmentById(id: string): Promise<IDepartment | null> {
    return Department.findById(id);
  }

  /**
   * Get single department by slug
   */
  async getDepartmentBySlug(slug: string): Promise<IDepartment | null> {
    return Department.findOne({ slug: slug.toLowerCase() });
  }

  /**
   * Create a new department
   */
  async createDepartment(data: CreateDepartmentInput): Promise<IDepartment> {
    const slug = data.slug ? slugify(data.slug) : slugify(data.name);

    if (!slug) {
      throw new AppError('Invalid department name for slug generation', 400);
    }

    const existing = await Department.findOne({ slug });
    if (existing) {
      throw new AppError(`Department with slug '${slug}' already exists`, 409);
    }

    const department = await Department.create({
      name: data.name,
      slug,
      image: data.image,
      active: data.active !== undefined ? data.active : true,
    });

    return department;
  }

  /**
   * Update an existing department
   */
  async updateDepartment(id: string, data: UpdateDepartmentInput): Promise<IDepartment> {
    const department = await Department.findById(id);
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    if (data.slug || (data.name && !data.slug && data.name !== department.name)) {
      const newSlug = data.slug ? slugify(data.slug) : slugify(data.name!);
      if (newSlug !== department.slug) {
        const existing = await Department.findOne({ slug: newSlug, _id: { $ne: id } });
        if (existing) {
          throw new AppError(`Department with slug '${newSlug}' already exists`, 409);
        }
        department.slug = newSlug;
      }
    }

    if (data.name !== undefined) department.name = data.name;
    if (data.image !== undefined) department.image = data.image;
    if (data.active !== undefined) department.active = data.active;

    await department.save();
    return department;
  }

  /**
   * Deactivate a department (sets active: false).
   * Hides from public browse; does not delete the department or its categories.
   */
  async deactivateDepartment(id: string): Promise<IDepartment> {
    const department = await Department.findById(id);
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    department.active = false;
    await department.save();
    return department;
  }
}

export const departmentService = new DepartmentService();
