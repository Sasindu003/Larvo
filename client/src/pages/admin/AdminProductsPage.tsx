import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Edit2,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productService, Product, ProductVariant } from '../../services/product.service';
import { departmentService, Department } from '../../services/department.service';
import { categoryService, Category } from '../../services/category.service';
import { supplierService, ISupplier } from '../../services/supplier.service';
import { useAuth } from '../../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductStatus = 'active' | 'draft' | 'archived';
type VariantSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

interface VariantRow {
  id: string; // local key
  size: VariantSize;
  color: string;
  material: string;
  sku: string;
  stock: number;
  supplier?: string | null;
}

interface FormState {
  name: string;
  description: string;
  departmentId: string;
  categoryId: string;
  images: string; // newline-separated URLs
  basePrice: string;
  discountPrice: string;
  status: ProductStatus;
  variants: VariantRow[];
}

const SIZES: VariantSize[] = ['XS', 'S', 'M', 'L', 'XL'];

const blankVariant = (): VariantRow => ({
  id: Math.random().toString(36).slice(2),
  size: 'M',
  color: '',
  material: '',
  sku: '',
  stock: 0,
  supplier: null,
});

const blankForm = (): FormState => ({
  name: '',
  description: '',
  departmentId: '',
  categoryId: '',
  images: '',
  basePrice: '',
  discountPrice: '',
  status: 'draft',
  variants: [blankVariant()],
});

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const map = {
    active: { label: 'Active', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    draft: { label: 'Draft', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    archived: { label: 'Archived', cls: 'bg-slate-500/20 text-slate-400 border-slate-600/40' },
  } as const;
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <CircleDot size={10} />
      {label}
    </span>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

export const AdminProductsPage: React.FC = () => {
  const { user } = useAuth();
  const canArchive = user?.role === 'staff' || user?.role === 'admin' || user?.role === 'owner';

  // List state
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null!);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCats, setFilteredCats] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Archive confirm
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async (pg: number, q: string, st: string) => {
    setLoading(true);
    try {
      const res = await productService.getAdminProducts({
        page: pg,
        limit: 15,
        q: q || undefined,
        status: st || undefined,
      });
      setProducts(res.items);
      setTotal(res.total);
      setPages(res.pages);
      setFetchError('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load products';
      toast.error(msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(page, search, statusFilter);
  }, [page, statusFilter, fetchProducts]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchProducts(1, search, statusFilter);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Load departments + categories + suppliers once for form
  useEffect(() => {
    (async () => {
      const [deps, cats, supRes] = await Promise.all([
        departmentService.getDepartments(true),
        categoryService.getCategories(true),
        supplierService.getSuppliers({ status: 'active', limit: 100 }).catch(() => ({ results: [] })),
      ]);
      setDepartments(deps);
      setCategories(cats);
      setSuppliers(supRes.results || []);
    })();
  }, []);

  // Filter categories when department changes
  useEffect(() => {
    if (!form.departmentId) {
      setFilteredCats([]);
      return;
    }
    const cats = categories.filter((c) => {
      const dept = c.department;
      if (!dept) return false;
      const deptId = typeof dept === 'object' ? (dept as any)._id : dept;
      return deptId === form.departmentId;
    });
    setFilteredCats(cats);
    // If current category no longer belongs to new dept, reset it
    if (form.categoryId && !cats.find((c) => c._id === form.categoryId)) {
      setForm((f) => ({ ...f, categoryId: '' }));
    }
  }, [form.departmentId, categories]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    setForm(blankForm());
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    const cat = typeof p.category === 'object' ? (p.category as Category) : null;
    const catId = cat ? cat._id : typeof p.category === 'string' ? p.category : '';
    const fullCat = cat?.department ? cat : categories.find((c) => c._id === catId);
    const dept = fullCat?.department;
    const deptId =
      dept && typeof dept === 'object'
        ? (dept as any)._id
        : typeof dept === 'string'
        ? dept
        : '';

    if (deptId) {
      const cats = categories.filter((c) => {
        const d = c.department;
        if (!d) return false;
        const dId = typeof d === 'object' ? (d as any)._id : d;
        return dId === deptId;
      });
      setFilteredCats(cats);
    }

    setEditTarget(p);
    setForm({
      name: p.name,
      description: p.description,
      departmentId: deptId,
      categoryId: catId,
      images: p.images.join('\n'),
      basePrice: String(p.basePrice),
      discountPrice: p.discountPrice !== null && p.discountPrice !== undefined ? String(p.discountPrice) : '',
      status: p.status,
      variants: p.variants.map((v) => ({
        id: Math.random().toString(36).slice(2),
        size: v.size as VariantSize,
        color: v.color,
        material: v.material,
        sku: v.sku,
        stock: v.stock,
        supplier: v.supplier ? (typeof v.supplier === 'object' ? (v.supplier as any)._id : v.supplier) : null,
      })),
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setVariant = (idx: number, key: keyof VariantRow, val: string | number | null) =>
    setForm((f) => {
      const vs = [...f.variants];
      vs[idx] = { ...vs[idx], [key]: val };
      return { ...f, variants: vs };
    });

  const addVariant = () => setForm((f) => ({ ...f, variants: [...f.variants, blankVariant()] }));
  const removeVariant = (idx: number) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }));

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const images = form.images
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!form.name.trim()) return setFormError('Product name is required.');
    if (!form.categoryId) return setFormError('Please select a category.');
    if (!images.length) return setFormError('At least one image URL is required.');
    if (!form.basePrice || isNaN(Number(form.basePrice)) || Number(form.basePrice) <= 0)
      return setFormError('Base price must be a positive number.');
    if (!form.variants.length) return setFormError('At least one variant is required.');

    for (const v of form.variants) {
      if (!v.color.trim()) return setFormError(`Color is required for size ${v.size}.`);
      if (!v.material.trim()) return setFormError(`Material is required for size ${v.size}.`);
      if (!v.sku.trim()) return setFormError(`SKU is required for size ${v.size}.`);
      if (isNaN(v.stock) || v.stock < 0) return setFormError(`Stock must be ≥ 0 for ${v.sku}.`);
    }

    const discountPrice = form.discountPrice.trim() !== '' ? Number(form.discountPrice) : null;
    if (discountPrice !== null && !isNaN(discountPrice) && discountPrice >= Number(form.basePrice))
      return setFormError('Discount price must be less than base price.');

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.categoryId,
        images,
        basePrice: Number(form.basePrice),
        discountPrice,
        status: form.status,
        variants: form.variants.map((v) => ({
          size: v.size,
          color: v.color.trim(),
          material: v.material.trim(),
          sku: v.sku.trim(),
          stock: Number(v.stock),
          supplier: v.supplier || null,
        })),
      };

      if (editTarget) {
        await productService.updateProduct(editTarget._id, payload);
      } else {
        await productService.createProduct(payload);
      }

      closeForm();
      fetchProducts(page, search, statusFilter);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || err?.message || 'Something went wrong.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Archive ──────────────────────────────────────────────────────────────────

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await productService.archiveProduct(archiveTarget._id);
      toast.success('Product archived successfully');
      setArchiveTarget(null);
      fetchProducts(page, search, statusFilter);
    } catch (err: any) {
      toast.error(err?.message || 'Archive failed.');
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (product: Product) => {
    try {
      await productService.updateProduct(product._id, { status: 'active' });
      toast.success(`'${product.name}' restored to active status`);
      fetchProducts(page, search, statusFilter);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore product.');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-violet-400" size={24} />
            Products
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {total} product{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className="w-full bg-[#1a1d27] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none bg-[#1a1d27] border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Price</th>
                <th className="px-4 py-3 text-center font-medium">Variants</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                    Loading products…
                  </td>
                </tr>
              )}
              {fetchError && !loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle size={28} className="text-amber-400 opacity-90" />
                      <p className="text-sm font-medium text-slate-300">{fetchError}</p>
                      <button
                        type="button"
                        onClick={() => fetchProducts(page, search, statusFilter)}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !fetchError && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    No products found
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const cat = typeof p.category === 'object' ? (p.category as Category) : null;
                const inStock = p.variants.some((v) => v.stock > 0);
                return (
                  <tr key={p._id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700 bg-slate-800"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <Package size={16} className="text-slate-600" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-200 line-clamp-1">{p.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{cat?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {p.discountPrice ? (
                        <div>
                          <span className="text-violet-400 font-semibold">
                            Rs. {p.discountPrice.toLocaleString()}
                          </span>
                          <span className="text-slate-500 line-through text-xs ml-1">
                            Rs. {p.basePrice.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-semibold">Rs. {p.basePrice.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        {inStock ? (
                          <PackageCheck size={14} className="text-emerald-400" />
                        ) : (
                          <AlertCircle size={14} className="text-rose-400" />
                        )}
                        {p.variants.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(p)}
                          title="Edit"
                          className="p-1.5 rounded-md hover:bg-violet-500/20 text-slate-400 hover:text-violet-400 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        {canArchive && (
                          p.status === 'archived' ? (
                            <button
                              onClick={() => handleRestore(p)}
                              title="Restore to Active"
                              className="p-1.5 rounded-md hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                            >
                              <ArchiveRestore size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setArchiveTarget(p)}
                              title="Archive"
                              className="p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              <Archive size={15} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-sm text-slate-400">
            <span>
              Page {page} of {pages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Product Form Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeForm}
          />

          <div className="relative w-full max-w-3xl bg-[#1a1d27] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">
                {editTarget ? 'Edit Product' : 'New Product'}
              </h2>
              <button
                onClick={closeForm}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {formError && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {formError}
                </div>
              )}

              {/* Name + Status row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Product Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g. Premium Cotton Tee"
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status *
                  </label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(e) => setField('status', e.target.value as ProductStatus)}
                      className="appearance-none w-full bg-[#0f1117] border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Description *
                </label>
                <textarea
                  required
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Describe the product…"
                  rows={3}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                />
              </div>

              {/* Department → Category cascade */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Department *
                  </label>
                  <div className="relative">
                    <select
                      value={form.departmentId}
                      onChange={(e) => setField('departmentId', e.target.value)}
                      className="appearance-none w-full bg-[#0f1117] border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                    >
                      <option value="">Select department…</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Category *
                  </label>
                  <div className="relative">
                    <select
                      value={form.categoryId}
                      onChange={(e) => setField('categoryId', e.target.value)}
                      disabled={!form.departmentId}
                      className="appearance-none w-full bg-[#0f1117] border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <option value="">
                        {form.departmentId ? 'Select category…' : 'Pick a department first'}
                      </option>
                      {filteredCats.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Base Price (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.basePrice}
                    onChange={(e) => setField('basePrice', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Discount Price (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountPrice}
                    onChange={(e) => setField('discountPrice', e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Images */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Image URLs * <span className="normal-case font-normal">(one per line)</span>
                </label>
                <textarea
                  value={form.images}
                  onChange={(e) => setField('images', e.target.value)}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  rows={3}
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors resize-none font-mono text-xs"
                />
              </div>

              {/* Variants */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Variants *
                  </label>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Plus size={12} />
                    Add variant
                  </button>
                </div>

                <div className="space-y-2">
                  {form.variants.map((v, idx) => (
                    <div
                      key={v.id}
                      className="relative bg-[#0f1117] border border-slate-700/60 rounded-xl p-4"
                    >
                      {form.variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="absolute top-3 right-3 p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* Size */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Size</label>
                          <div className="relative">
                            <select
                              value={v.size}
                              onChange={(e) => setVariant(idx, 'size', e.target.value)}
                              className="appearance-none w-full bg-[#1a1d27] border border-slate-700 rounded-lg pl-3 pr-7 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
                            >
                              {SIZES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        {/* Color */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Color</label>
                          <input
                            value={v.color}
                            onChange={(e) => setVariant(idx, 'color', e.target.value)}
                            placeholder="e.g. Navy Blue"
                            className="w-full bg-[#1a1d27] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {/* Material */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Material</label>
                          <input
                            value={v.material}
                            onChange={(e) => setVariant(idx, 'material', e.target.value)}
                            placeholder="e.g. 100% Cotton"
                            className="w-full bg-[#1a1d27] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {/* SKU */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">SKU</label>
                          <input
                            value={v.sku}
                            onChange={(e) => setVariant(idx, 'sku', e.target.value)}
                            placeholder="e.g. TEE-M-NVY"
                            className="w-full bg-[#1a1d27] border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {/* Stock */}
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Stock</label>
                          <input
                            type="number"
                            min="0"
                            value={v.stock}
                            onChange={(e) => setVariant(idx, 'stock', Number(e.target.value))}
                            className="w-full bg-[#1a1d27] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
                          />
                        </div>
                        {/* Supplier */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs text-slate-500">Supplier</label>
                          <div className="relative">
                            <select
                              value={v.supplier || ''}
                              onChange={(e) => setVariant(idx, 'supplier', e.target.value || null)}
                              className="appearance-none w-full bg-[#1a1d27] border border-slate-700 rounded-lg pl-3 pr-7 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
                            >
                              <option value="">None / Unassigned</option>
                              {suppliers.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.companyName || s.name} ({s.email})
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {editTarget ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archive confirm dialog ─────────────────────────────────────────────── */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setArchiveTarget(null)} />
          <div className="relative w-full max-w-sm bg-[#1a1d27] border border-slate-700 rounded-2xl shadow-2xl p-6 text-center">
            <Archive size={36} className="mx-auto mb-3 text-rose-400" />
            <h3 className="text-lg font-bold text-white mb-1">Archive Product?</h3>
            <p className="text-sm text-slate-400 mb-5">
              <span className="text-slate-200 font-medium">{archiveTarget.name}</span> will be hidden
              from the store. This can be undone by setting status to Active.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchive}
                disabled={archiving}
                className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {archiving && <Loader2 size={14} className="animate-spin" />}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
