import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, ArrowRight, Layers, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { departmentService, Department } from '../services/department.service';
import { categoryService, Category } from '../services/category.service';

export const DepartmentPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    setError(null);

    Promise.all([
      departmentService.getDepartments(),
      categoryService.getCategories(),
    ])
      .then(([allDepts, allCats]) => {
        if (!isCurrent) return;

        const currentDept = allDepts.find((d) => d.slug.toLowerCase() === slug?.toLowerCase());
        if (!currentDept) {
          setError(`Department "${slug}" not found.`);
          setLoading(false);
          return;
        }

        setDepartment(currentDept);

        // Filter categories belonging to this department
        const deptCats = allCats.filter((cat) => {
          if (!cat.department) return false;
          if (typeof cat.department === 'object') {
            return (
              cat.department.slug?.toLowerCase() === currentDept.slug.toLowerCase() ||
              cat.department._id === currentDept._id
            );
          }
          return cat.department === currentDept._id;
        });

        setCategories(deptCats);
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Failed to load department categories:', err);
        setError('Failed to load department. Please try again later.');
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-ink-900 animate-spin" />
        <p className="text-xs text-ink-500 font-medium">Loading department collections...</p>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink-950 mb-2">Department Not Found</h1>
        <p className="text-sm text-ink-600 mb-6">{error || 'The requested department could not be located.'}</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ink-950 text-white text-xs font-semibold hover:bg-ink-800 transition-colors"
        >
          <span>Browse All Products</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-cream-50/50 min-h-screen pb-16">
      {/* Breadcrumbs */}
      <div className="bg-white border-b border-sand-200">
        <div className="container mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-2 text-xs font-medium text-ink-500">
          <Link to="/" className="hover:text-ink-950 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-ink-300" />
          <Link to="/products" className="hover:text-ink-950 transition-colors">Catalog</Link>
          <ChevronRight className="w-3.5 h-3.5 text-ink-300" />
          <span className="text-ink-950 font-semibold">{department.name}</span>
        </div>
      </div>

      {/* Hero Banner */}
      <section className="bg-white border-b border-sand-200">
        <div className="container mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-100 border border-sand-300 text-ink-800 text-[11px] font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Curated Department</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink-950 mb-4">
              {department.name} Department
            </h1>
            <p className="text-sm sm:text-base text-ink-600 leading-relaxed max-w-2xl">
              Explore our hand-selected apparel, footwear, and essentials designed exclusively for {department.name.toLowerCase()}’s modern wardrobes.
            </p>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="container mx-auto px-4 sm:px-6 py-10 lg:py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink-950">
              Explore Categories
            </h2>
            <p className="text-xs sm:text-sm text-ink-500 mt-1">
              Showing {categories.length} category collection{categories.length === 1 ? '' : 's'} in {department.name}
            </p>
          </div>
          <Link
            to="/products"
            className="text-xs font-semibold text-ink-700 hover:text-ink-950 flex items-center gap-1 group"
          >
            <span>All Catalog</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {categories.map((cat) => (
              <Link
                key={cat._id || cat.slug}
                to={`/departments/${department.slug}/categories/${cat.slug}`}
                className="group relative flex flex-col bg-white border border-sand-300 rounded-2xl overflow-hidden shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-sand-400 hover:-translate-y-1"
              >
                {/* Category Image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-sand-100">
                  <img
                    src={cat.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'}
                    alt={cat.name}
                    loading="lazy"
                    className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-ink-950/20 to-transparent" />
                  
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cream-200">
                      {department.name} Collection
                    </span>
                    <h3 className="font-display text-xl font-bold leading-tight mt-0.5">
                      {cat.name}
                    </h3>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="p-4 flex items-center justify-between bg-white text-ink-900">
                  <span className="text-xs font-semibold group-hover:text-ink-600 transition-colors">
                    Shop {cat.name}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-sand-100 flex items-center justify-center text-ink-700 group-hover:bg-ink-950 group-hover:text-white transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-sand-300 p-12 text-center max-w-lg mx-auto shadow-sm">
            <Layers className="w-12 h-12 text-ink-300 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-ink-950 mb-1">No Categories Found</h3>
            <p className="text-xs text-ink-500 mb-6">
              There are currently no active categories listed under the {department.name} department.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-4 py-2 bg-ink-950 text-white rounded-lg text-xs font-semibold hover:bg-ink-800 transition-colors"
            >
              Browse All Products
            </Link>
          </div>
        )}
      </section>
    </div>
  );
};

export default DepartmentPage;
