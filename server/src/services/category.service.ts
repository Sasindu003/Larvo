import { Category, ICategory } from '../models/Category';
import { Department } from '../models/Department';
import { AppError } from '../middleware/error.middleware';
import { CreateCategoryInput, UpdateCategoryInput } from '../validators/category.validator';

export class CategoryService {
  /**
   * Helper to slugify category name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get all categories sorted alphabetically or by creation
   */
  async getAllCategories(includeInactive: boolean = false): Promise<ICategory[]> {
    const filter = includeInactive ? {} : { active: { $ne: false } };
    return Category.find(filter)
      .populate('parent', 'name slug')
      .populate('department', 'name slug image active')
      .sort({ createdAt: 1 });
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<ICategory | null> {
    return Category.findOne({ slug: slug.toLowerCase(), active: { $ne: false } })
      .populate('parent', 'name slug')
      .populate('department', 'name slug image active');
  }

  /**
   * Create a new category
   */
  async createCategory(input: CreateCategoryInput): Promise<ICategory> {
    // 1. Verify referenced department exists
    const department = await Department.findById(input.department);
    if (!department) {
      throw new AppError('Referenced department does not exist', 400);
    }

    // 2. Generate or sanitize slug
    let slug = input.slug ? input.slug.toLowerCase().trim() : this.generateSlug(input.name);

    // 3. Ensure slug uniqueness
    const existing = await Category.findOne({ slug });
    if (existing) {
      throw new AppError(`Category with slug '${slug}' already exists`, 409);
    }

    // 4. Create category
    const category = new Category({
      name: input.name,
      slug,
      image: input.image,
      department: input.department,
      parent: input.parent || null,
      active: input.active !== undefined ? input.active : true,
    });

    await category.save();
    return (await category.populate('department', 'name slug image active')).populate('parent', 'name slug');
  }

  /**
   * Update category
   */
  async updateCategory(id: string, input: UpdateCategoryInput): Promise<ICategory> {
    const category = await Category.findById(id);
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // 1. If department changed, verify it exists
    if (input.department && input.department !== category.department.toString()) {
      const department = await Department.findById(input.department);
      if (!department) {
        throw new AppError('Referenced department does not exist', 400);
      }
      category.department = department._id as any;
    }

    // 2. If name changed and slug not explicitly provided, don't necessarily override slug unless given
    if (input.name) {
      category.name = input.name;
    }

    // 3. If slug changed, verify uniqueness
    if (input.slug && input.slug.toLowerCase().trim() !== category.slug) {
      const newSlug = input.slug.toLowerCase().trim();
      const existing = await Category.findOne({ slug: newSlug, _id: { $ne: id } });
      if (existing) {
        throw new AppError(`Category with slug '${newSlug}' already exists`, 409);
      }
      category.slug = newSlug;
    }

    if (input.image) {
      category.image = input.image;
    }

    if (input.parent !== undefined) {
      category.parent = input.parent as any;
    }

    if (input.active !== undefined) {
      category.active = input.active;
    }

    await category.save();
    return (await category.populate('department', 'name slug image active')).populate('parent', 'name slug');
  }

  /**
   * Deactivate a category
   * Prevent deactivation if active products still reference it
   */
  async deactivateCategory(categoryId: string): Promise<ICategory> {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const { Product } = await import('../models/Product');
    const activeProductCount = await Product.countDocuments({
      category: categoryId,
      status: 'active',
    });

    if (activeProductCount > 0) {
      throw new AppError(
        `Cannot deactivate category: ${activeProductCount} active products still reference it.`,
        409
      );
    }

    category.active = false;
    await category.save();
    return (await category.populate('department', 'name slug image active')).populate('parent', 'name slug');
  }
}

export const categoryService = new CategoryService();
