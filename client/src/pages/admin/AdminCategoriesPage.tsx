import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  Plus,
  Edit2,
  Power,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  Filter,
  RefreshCw,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { categoryService, Category, CreateCategoryDto } from '../../services/category.service';
import { departmentService, Department } from '../../services/department.service';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/roles';

export const AdminCategoriesPage: React.FC = () => {
  const { user } = useAuth();
  // Backend only allows admin/owner to mutate categories (see category.routes.ts).
  // Staff can view this page (per ADMIN_NAV_ITEMS) but must not see enabled mutation controls.
  const canManage = !!user && ROLES.ADMIN_AND_ABOVE.includes(user.role as any);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Inline Conflict Alert State (surfacing 409 blocked-by-active-products reason)
  const [conflictError, setConflictError] = useState<{
    categoryName: string;
    message: string;
  } | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsData, deptsData] = await Promise.all([
        categoryService.getCategories(true),
        departmentService.getDepartments(true),
      ]);
      setCategories(catsData);
      setDepartments(deptsData);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormImage('');
    // Default to first active department if available
    const defaultDept = departments.find((d) => d.active)?._id || '';
    setFormDepartment(defaultDept);
    setFormActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormImage(cat.image || '');
    const deptId =
      typeof cat.department === 'object' && cat.department !== null
        ? cat.department._id
        : (cat.department as string) || '';
    setFormDepartment(deptId);
    setFormActive(cat.active !== false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side required field validations
    if (!formName.trim()) {
      setFormError('Category name is required');
      return;
    }
    if (!formDepartment.trim()) {
      setFormError('A Department must be selected. Categories cannot be orphaned.');
      return;
    }
    if (!formImage.trim()) {
      setFormError('Category image URL is required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingCategory) {
        // Update
        const updated = await categoryService.updateCategory(editingCategory._id, {
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          image: formImage.trim(),
          department: formDepartment.trim(),
          active: formActive,
        });
        toast.success(`Category "${updated.name}" updated`);
      } else {
        // Create
        const payload: CreateCategoryDto = {
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          image: formImage.trim(),
          department: formDepartment.trim(),
          active: formActive,
        };
        const created = await categoryService.createCategory(payload);
        toast.success(`Category "${created.name}" created`);
      }
      closeModal();
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDeactivate = async (cat: Category) => {
    setConflictError(null);
    try {
      setActionLoadingId(cat._id);
      if (cat.active !== false) {
        await categoryService.deactivateCategory(cat._id);
        toast.success(`Category "${cat.name}" deactivated`);
      } else {
        await categoryService.updateCategory(cat._id, { active: true });
        toast.success(`Category "${cat.name}" activated`);
      }
      await fetchData();
    } catch (err: any) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message || err.message || 'Failed to update category status';

      if (status === 409) {
        // Surface the exact backend reason inline
        setConflictError({
          categoryName: cat.name,
          message: msg,
        });
        toast.error(msg, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter categories by department & search term
  const filteredCategories = categories.filter((cat) => {
    const matchesSearch =
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedDeptFilter === 'ALL') return true;

    const deptId =
      typeof cat.department === 'object' && cat.department !== null
        ? cat.department._id
        : (cat.department as string);

    return deptId === selectedDeptFilter;
  });

  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.active !== false).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Category Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Manage department categories, catalog assignments, and status controls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors disabled:opacity-50"
            title="Refresh categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Category</span>
            </button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
          Read-only view. Creating, editing, and deactivating categories requires an Admin or Owner role.
        </div>
      )}

      {/* Inline 409 Conflict Banner */}
      {conflictError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-300 text-sm">
                Cannot Deactivate Category: {conflictError.categoryName}
              </h3>
              <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                {conflictError.message}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-1">
                To deactivate this category, first archive or reassign all active products referencing it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConflictError(null)}
            className="p-1 rounded-lg text-amber-400 hover:text-white hover:bg-amber-500/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Categories
            </div>
            <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center">
            <FolderTree className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Active Categories
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Departments Represented
            </div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{departments.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Table & Filter Controls Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories by name or slug..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500/60"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-medium">Loading categories...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FolderTree className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No categories found</p>
            <p className="text-xs text-slate-500">
              {searchQuery || selectedDeptFilter !== 'ALL'
                ? 'Try resetting search filters'
                : 'Get started by creating your first category'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 sm:px-6">Category</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredCategories.map((cat) => {
                  const isActionLoading = actionLoadingId === cat._id;
                  const deptObj =
                    typeof cat.department === 'object' && cat.department !== null
                      ? (cat.department as Department)
                      : departments.find((d) => d._id === (cat.department as string));

                  return (
                    <tr key={cat._id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Category Name & Image */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0 relative">
                            {cat.image ? (
                              <img
                                src={cat.image}
                                alt={cat.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <FolderTree className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                              {cat.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              ID: {cat._id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        {deptObj ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-950 border border-slate-800 text-amber-300">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {deptObj.name}
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs font-semibold">Unassigned</span>
                        )}
                      </td>

                      {/* Slug */}
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                          {cat.slug}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {cat.active !== false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {cat.createdAt
                          ? new Date(cat.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(cat)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit category"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleDeactivate(cat)}
                              disabled={isActionLoading}
                              className={`p-2 rounded-lg transition-colors ${
                                cat.active !== false
                                  ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                                  : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={cat.active !== false ? 'Deactivate category' : 'Activate category'}
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FolderTree className="w-4 h-4" />
                </div>
                <h2 className="text-base font-display font-bold text-white">
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!editingCategory && !formSlug) {
                      const auto = e.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/[\s_-]+/g, '-');
                      setFormSlug(auto);
                    }
                  }}
                  placeholder="e.g. Graphic Tees, Denim, Sneakers"
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60"
                />
              </div>

              {/* Department (Required Select) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assigned Department <span className="text-amber-400">*</span>
                </label>
                <select
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60"
                >
                  <option value="" disabled>
                    -- Select a Department --
                  </option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} {d.active ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Every category must strictly belong to exactly one department.
                </span>
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  URL Slug <span className="text-[10px] text-slate-500 font-normal">(Lowercase, hyphen-separated)</span>
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="graphic-tees"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-mono focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cover Image URL <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60"
                />
                {formImage && (
                  <div className="mt-2 w-full h-24 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative">
                    <img
                      src={formImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="absolute bottom-1 right-2 text-[10px] bg-slate-950/80 px-1.5 py-0.5 rounded text-slate-400">
                      Preview
                    </span>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-slate-900"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">Active in catalog</span>
                    <span className="text-[11px] text-slate-400 block">
                      Active categories are visible to customers in department browsing.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingCategory ? 'Save Changes' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoriesPage;
