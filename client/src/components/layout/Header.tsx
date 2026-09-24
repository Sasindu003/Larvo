import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Heart,
  User,
  Search,
  Menu,
  X,
  ChevronDown,
  Shield,
  LogIn,
  UserPlus,
  Sparkles,
  ArrowRight,
  Loader2,
  LogOut,
  Wallet,
  Package,
  Truck,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { categoryService, Category } from '../../services/category.service';
import { departmentService, Department } from '../../services/department.service';
import { productService, Product } from '../../services/product.service';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';

export const Header: React.FC = () => {
  const { user, status, logout } = useAuth();
  const { totalItems, openDrawer } = useCart();
  const { totalWishlist } = useWishlist();
  const isAuthenticated = status === 'authenticated';
  const isAdminUser = user && ['staff', 'admin', 'owner'].includes(user.role);
  const isDeliveryUser = user && ['delivery_manager', 'admin', 'owner'].includes(user.role);
  const isSupplierUser = user && ['supplier'].includes(user.role);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch {
      toast.error('Logout failed');
    }
  };
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeDeptHover, setActiveDeptHover] = useState<string | null>(null);
  const [expandedMobileDepts, setExpandedMobileDepts] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Mobile search state
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSuggestions, setMobileSuggestions] = useState<Product[]>([]);
  const [mobileSearchLoading, setMobileSearchLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedMobileSearch = useDebounce(mobileSearchQuery, 300);

  const location = useLocation();
  const navigate = useNavigate();
  const categoryRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch departments and categories from live API
  useEffect(() => {
    Promise.all([
      departmentService.getDepartments().catch(() => []),
      categoryService.getCategories().catch(() => []),
    ]).then(([depts, cats]) => {
      if (Array.isArray(depts)) {
        setDepartments(depts);
        if (depts.length > 0) {
          setActiveDeptHover(depts[0].slug);
        }
      }
      if (Array.isArray(cats)) {
        setCategories(cats);
      }
    });
  }, []);

  // Sync search input with URL if already on /products?q=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [location.search]);

  // Debounced desktop search suggestion fetch
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    let isCurrent = true;
    setSearchLoading(true);

    productService
      .getSuggestions(debouncedSearch)
      .then((items) => {
        if (isCurrent) {
          setSuggestions(items);
          setSearchLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch search suggestions:', err);
        if (isCurrent) {
          setSuggestions([]);
          setSearchLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [debouncedSearch]);

  // Debounced mobile search suggestion fetch
  useEffect(() => {
    if (!debouncedMobileSearch.trim()) {
      setMobileSuggestions([]);
      setMobileSearchLoading(false);
      return;
    }

    let isCurrent = true;
    setMobileSearchLoading(true);

    productService
      .getSuggestions(debouncedMobileSearch)
      .then((items) => {
        if (isCurrent) {
          setMobileSuggestions(items);
          setMobileSearchLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch mobile search suggestions:', err);
        if (isCurrent) {
          setMobileSuggestions([]);
          setMobileSearchLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [debouncedMobileSearch]);

  // Close drawer and dropdowns on route change
  useEffect(() => {
    setDrawerOpen(false);
    setCategoryDropdownOpen(false);
    setAccountDropdownOpen(false);
    setSearchFocused(false);
  }, [location.pathname, location.search]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [drawerOpen]);

  // Click outside listener for dropdown menus and search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchFocused(false);
    navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileSearchQuery.trim()) return;
    setDrawerOpen(false);
    navigate(`/products?q=${encodeURIComponent(mobileSearchQuery.trim())}`);
  };

  const showSuggestions = searchFocused && searchQuery.trim().length > 0;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-ink-200 transition-shadow duration-200">
        {/* Top Announcement Bar */}
        <div className="bg-ink-950 text-cream-100 text-[11px] font-medium py-1.5 px-4 text-center tracking-wider uppercase">
          <span>Complimentary domestic express shipping on orders over Rs. 1,500</span>
        </div>

        {/* Main Navigation Bar */}
        <div className="container mx-auto px-4 sm:px-6 h-18 sm:h-20 flex items-center justify-between gap-4">
          {/* Left: Mobile Menu Trigger + Brand Logo */}
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 -ml-2 text-ink-800 hover:text-ink-950 hover:bg-ink-100/60 rounded-md transition-colors"
              aria-label="Open mobile navigation menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="w-6 h-6" />
            </button>

            <Link
              to="/"
              className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink-950 hover:opacity-90 transition-opacity"
            >
              <span className="w-8 h-8 rounded-lg bg-ink-900 text-cream-100 flex items-center justify-center font-display font-semibold text-base shadow-sm">
                L
              </span>
              <span className="tracking-widest">LARVO</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 ml-4 text-xs font-semibold uppercase tracking-wider text-ink-700">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `transition-colors hover:text-ink-950 py-2 border-b-2 ${
                    isActive ? 'border-ink-900 text-ink-950' : 'border-transparent text-ink-600'
                  }`
                }
              >
                Home
              </NavLink>

              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `transition-colors hover:text-ink-950 py-2 border-b-2 ${
                    isActive ? 'border-ink-900 text-ink-950' : 'border-transparent text-ink-600'
                  }`
                }
              >
                All Products
              </NavLink>

              {/* Departments & Categories Dropdown */}
              <div ref={categoryRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-ink-950 ${
                    categoryDropdownOpen ? 'text-ink-950' : 'text-ink-600'
                  }`}
                  aria-expanded={categoryDropdownOpen}
                  aria-haspopup="true"
                >
                  <span>Shop By Department</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      categoryDropdownOpen ? 'rotate-180 text-ink-950' : 'text-ink-400'
                    }`}
                  />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[480px] bg-white rounded-xl shadow-2xl border border-ink-200 py-0 z-50 animate-fade-in flex overflow-hidden divide-x divide-ink-100">
                    {/* Left Column: Departments list */}
                    <div className="w-48 bg-cream-50/60 p-2 space-y-1 flex-shrink-0">
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                        Departments
                      </div>
                      {departments.length > 0 ? (
                        departments.map((dept) => {
                          const isSelected = (activeDeptHover || departments[0]?.slug) === dept.slug;
                          return (
                            <div
                              key={dept._id || dept.slug}
                              onMouseEnter={() => setActiveDeptHover(dept.slug)}
                              className="relative"
                            >
                              <Link
                                to={`/departments/${dept.slug}`}
                                onClick={() => setCategoryDropdownOpen(false)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-ink-950 text-white font-semibold shadow-sm'
                                    : 'text-ink-700 hover:bg-cream-100 hover:text-ink-950'
                                }`}
                              >
                                <span>{dept.name}</span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 -rotate-90 transition-opacity ${
                                    isSelected ? 'opacity-100 text-white' : 'opacity-40'
                                  }`}
                                />
                              </Link>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-xs text-ink-400">Loading...</div>
                      )}
                    </div>

                    {/* Right Column: Category flyout for active department */}
                    <div className="flex-1 p-4 bg-white flex flex-col justify-between">
                      {(() => {
                        const currentDept = departments.find(
                          (d) => d.slug === (activeDeptHover || departments[0]?.slug)
                        );
                        if (!currentDept) return null;

                        const deptCategories = categories.filter((cat) => {
                          if (!cat.department) return false;
                          if (typeof cat.department === 'object') {
                            return (
                              cat.department.slug?.toLowerCase() === currentDept.slug.toLowerCase() ||
                              cat.department._id === currentDept._id
                            );
                          }
                          return cat.department === currentDept._id;
                        });

                        return (
                          <>
                            <div>
                              <div className="flex items-center justify-between pb-2 mb-3 border-b border-ink-100">
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-950">
                                    {currentDept.name} Department
                                  </h4>
                                  <span className="text-[11px] text-ink-400">
                                    {deptCategories.length} Categories
                                  </span>
                                </div>
                                <Link
                                  to={`/departments/${currentDept.slug}`}
                                  onClick={() => setCategoryDropdownOpen(false)}
                                  className="text-[11px] font-semibold text-ink-700 hover:text-ink-950 underline underline-offset-2 flex items-center gap-1"
                                >
                                  <span>View Department</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                {deptCategories.length > 0 ? (
                                  deptCategories.map((cat) => (
                                    <Link
                                      key={cat._id || cat.slug}
                                      to={`/departments/${currentDept.slug}/categories/${cat.slug}`}
                                      onClick={() => setCategoryDropdownOpen(false)}
                                      className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-ink-400" />
                                      <span className="truncate">{cat.name}</span>
                                    </Link>
                                  ))
                                ) : (
                                  <div className="col-span-2 py-4 text-center text-xs text-ink-400">
                                    No categories listed in this department.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-ink-100 bg-cream-50/50 -mx-4 -mb-4 p-3 flex items-center justify-between">
                              <span className="text-[11px] text-ink-500 font-medium">
                                Looking for all items?
                              </span>
                              <Link
                                to={`/departments/${currentDept.slug}`}
                                onClick={() => setCategoryDropdownOpen(false)}
                                className="text-[11px] font-bold text-ink-950 hover:underline"
                              >
                                All {currentDept.name} Categories →
                              </Link>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Center: Search Bar with Debounced Dropdown (Desktop) */}
          <div ref={searchContainerRef} className="hidden lg:flex flex-1 max-w-md mx-4 relative">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search curated fashion, apparel, styles..."
                className="w-full bg-cream-50/80 hover:bg-cream-100 focus:bg-white text-xs text-ink-900 placeholder:text-ink-400 rounded-full pl-10 pr-10 py-2.5 border border-ink-200 focus:border-ink-600 focus:outline-none focus:ring-2 focus:ring-ink-200/50 transition-all"
              />
              {searchLoading ? (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </form>

            {/* Live Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-sand-300 py-2 z-50 overflow-hidden animate-fade-in">
                <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400 border-b border-sand-200 flex items-center justify-between">
                  <span>Product Suggestions</span>
                  {searchLoading && <span className="text-[10px] font-normal text-ink-400">Searching...</span>}
                </div>

                {suggestions.length > 0 ? (
                  <div className="divide-y divide-sand-100 max-h-80 overflow-y-auto">
                    {suggestions.map((item) => (
                      <Link
                        key={item._id}
                        to={`/products/${item.slug}`}
                        onClick={() => setSearchFocused(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-cream-50 transition-colors group"
                      >
                        <img
                          src={item.images?.[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'}
                          alt={item.name}
                          className="w-10 h-12 object-cover rounded bg-sand-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink-900 truncate group-hover:text-ink-700">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {typeof item.category === 'object' && item.category !== null && (
                              <span className="text-[10px] text-ink-400 uppercase tracking-wider">
                                {(item.category as any).name}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-ink-900">
                              Rs. {item.discountPrice || item.basePrice}
                            </span>
                            {item.discountPrice && (
                              <span className="text-[10px] text-ink-400 line-through">
                                Rs. {item.basePrice}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-ink-300 group-hover:text-ink-700 transition-colors" />
                      </Link>
                    ))}
                  </div>
                ) : !searchLoading ? (
                  <div className="px-4 py-4 text-center text-xs text-ink-500">
                    No products found for "{searchQuery}"
                  </div>
                ) : null}

                {/* View All Results Footer Link */}
                <div className="p-2 border-t border-sand-200 bg-sand-50/50">
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="w-full py-2 px-3 text-xs font-semibold text-ink-900 hover:bg-sand-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>View all results for "{searchQuery}"</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions (Wishlist, Cart, Account, Admin) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Wishlist Icon */}
            <Link
              to="/wishlist"
              className="relative p-2 text-ink-700 hover:text-ink-950 hover:bg-ink-100/60 rounded-full transition-colors"
              title="Wishlist"
              aria-label="View Wishlist"
            >
              <Heart className="w-5 h-5" />
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-ink-900 rounded-full px-1 leading-none shadow-sm">
                {totalWishlist}
              </span>
            </Link>

            {/* Cart Icon / Drawer Trigger */}
            <button
              type="button"
              onClick={openDrawer}
              className="relative p-2 text-ink-700 hover:text-ink-950 hover:bg-ink-100/60 rounded-full transition-colors"
              title="Shopping Cart"
              aria-label="View Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-ink-900 rounded-full px-1 leading-none shadow-sm">
                {totalItems}
              </span>
            </button>

            {/* Delivery Portal Shortcut — for delivery_manager / admin / owner */}
            {isDeliveryUser && (
              <Link
                to="/delivery/orders"
                className="hidden sm:inline-flex p-2 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-full transition-colors"
                title="Delivery Portal"
                aria-label="Delivery Portal"
              >
                <Truck className="w-5 h-5" />
              </Link>
            )}

            {/* Supplier Portal Shortcut */}
            {isSupplierUser && (
              <Link
                to="/supplier/purchase-orders"
                className="hidden sm:inline-flex p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full transition-colors"
                title="Supplier Portal"
                aria-label="Supplier Portal"
              >
                <Building2 className="w-5 h-5" />
              </Link>
            )}

            {/* Admin Portal Shortcut — only for staff/admin/owner */}
            {isAdminUser && (
              <Link
                to="/admin"
                className="hidden sm:inline-flex p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-full transition-colors"
                title="Admin Portal"
                aria-label="Admin Portal"
              >
                <Shield className="w-5 h-5" />
              </Link>
            )}

            {/* Desktop Account Dropdown */}
            <div ref={accountRef} className="relative hidden md:block ml-1">
              <button
                type="button"
                onClick={() => setAccountDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 p-1.5 pr-2.5 text-ink-800 hover:bg-ink-100/60 rounded-full border border-ink-200 transition-colors"
                aria-expanded={accountDropdownOpen}
                aria-haspopup="true"
                aria-label="Account menu"
              >
                <div className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center text-ink-700">
                  <User className="w-4 h-4" />
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-ink-500" />
              </button>

              {accountDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-ink-200 py-2 z-50 animate-fade-in">
                  {isAuthenticated && user ? (
                    <>
                      <div className="px-4 py-2 border-b border-ink-100">
                        <p className="text-xs font-semibold text-ink-900 truncate">{user.name}</p>
                        <p className="text-[11px] text-ink-500 truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/profile"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                        >
                          <User className="w-3.5 h-3.5 text-ink-500" />
                          <span>My Profile</span>
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                        >
                          <Package className="w-3.5 h-3.5 text-ink-500" />
                          <span>My Orders</span>
                        </Link>
                        <Link
                          to="/wallet"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                        >
                          <Wallet className="w-3.5 h-3.5 text-ink-500" />
                          <span>Reward Points & Wallet</span>
                        </Link>
                        {isDeliveryUser && (
                          <Link
                            to="/delivery/orders"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-sky-700 hover:bg-sky-50 transition-colors font-medium"
                          >
                            <Truck className="w-3.5 h-3.5 text-sky-600" />
                            <span>Delivery Portal</span>
                          </Link>
                        )}
                        {isSupplierUser && (
                          <Link
                            to="/supplier/purchase-orders"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-indigo-700 hover:bg-indigo-50 transition-colors font-medium"
                          >
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Supplier Portal</span>
                          </Link>
                        )}
                        {isAdminUser && (
                          <Link
                            to="/admin"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-amber-700 hover:bg-amber-50 transition-colors font-medium"
                          >
                            <Shield className="w-3.5 h-3.5 text-amber-600" />
                            <span>Admin Portal</span>
                          </Link>
                        )}
                        <div className="border-t border-ink-100 my-1"></div>
                        <button
                          type="button"
                          onClick={() => { setAccountDropdownOpen(false); handleLogout(); }}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors font-medium w-full text-left"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-ink-100">
                        <p className="text-xs font-semibold text-ink-900">Welcome to Larvo</p>
                        <p className="text-[11px] text-ink-500">Sign in for your orders & wishlist</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/login"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                        >
                          <LogIn className="w-3.5 h-3.5 text-ink-500" />
                          <span>Sign In</span>
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-ink-500" />
                          <span>Create Account</span>
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Login/Register or User Name pill */}
            <div className="hidden lg:flex items-center gap-2 border-l border-ink-200 pl-3">
              {isAuthenticated && user ? (
                <span className="text-xs font-semibold text-ink-800 max-w-[120px] truncate">
                  Hi, {user.name.split(' ')[0]}
                </span>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-3 py-1.5 text-xs font-semibold tracking-wide text-ink-800 hover:text-ink-950 hover:bg-ink-100 rounded transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="px-3.5 py-1.5 text-xs font-semibold tracking-wide bg-ink-900 hover:bg-ink-800 text-white rounded shadow-sm transition-colors"
                  >
                    Join
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-in Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-white shadow-2xl flex flex-col z-50 animate-fade-in border-r border-ink-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 flex items-center justify-between border-b border-ink-100 bg-cream-50/60">
              <Link
                to="/"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-ink-950"
              >
                <span className="w-7 h-7 rounded bg-ink-900 text-cream-100 flex items-center justify-center font-display font-semibold text-sm">
                  L
                </span>
                <span className="tracking-widest">LARVO</span>
              </Link>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-ink-200/60 text-ink-500 hover:text-ink-900 transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Search with Suggestions */}
            <div className="p-4 border-b border-ink-100">
              <form onSubmit={handleMobileSearchSubmit} className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                <input
                  type="search"
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  placeholder="Search styles, categories..."
                  className="w-full bg-cream-50 text-xs text-ink-900 placeholder:text-ink-400 rounded-lg pl-10 pr-10 py-2.5 border border-ink-200 focus:border-ink-600 focus:outline-none"
                />
                {mobileSearchLoading ? (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 animate-spin" />
                ) : mobileSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSearchQuery('');
                      setMobileSuggestions([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </form>

              {/* Mobile Suggestions Preview */}
              {mobileSuggestions.length > 0 && (
                <div className="mt-2 bg-white rounded-lg border border-sand-300 divide-y divide-sand-100 max-h-48 overflow-y-auto">
                  {mobileSuggestions.map((item) => (
                    <Link
                      key={item._id}
                      to={`/products/${item.slug}`}
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2.5 p-2 hover:bg-cream-50"
                    >
                      <img
                        src={item.images?.[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'}
                        alt={item.name}
                        className="w-8 h-10 object-cover rounded bg-sand-100 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ink-900 truncate">{item.name}</p>
                        <p className="text-[11px] font-semibold text-ink-700">Rs. {item.discountPrice || item.basePrice}</p>
                      </div>
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={handleMobileSearchSubmit}
                    className="w-full p-2 text-center text-xs font-semibold text-ink-900 bg-sand-50"
                  >
                    View all results
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Main Links */}
              <div className="space-y-1">
                <NavLink
                  to="/"
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive ? 'bg-ink-900 text-white' : 'text-ink-800 hover:bg-cream-100'
                    }`
                  }
                >
                  <span>Home</span>
                </NavLink>

                <NavLink
                  to="/products"
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive ? 'bg-ink-900 text-white' : 'text-ink-800 hover:bg-cream-100'
                    }`
                  }
                >
                  <span>All Products</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </NavLink>
              </div>

              {/* Departments & Categories Accordion */}
              <div className="border-t border-ink-100 pt-3 space-y-1">
                <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                  Departments & Collections
                </div>

                {departments.length > 0 ? (
                  departments.map((dept) => {
                    const isExpanded = !!expandedMobileDepts[dept.slug];
                    const deptCategories = categories.filter((cat) => {
                      if (!cat.department) return false;
                      if (typeof cat.department === 'object') {
                        return (
                          cat.department.slug?.toLowerCase() === dept.slug.toLowerCase() ||
                          cat.department._id === dept._id
                        );
                      }
                      return cat.department === dept._id;
                    });

                    return (
                      <div key={dept._id || dept.slug} className="rounded-lg border border-sand-200 overflow-hidden bg-cream-50/40">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMobileDepts((prev) => ({
                              ...prev,
                              [dept.slug]: !prev[dept.slug],
                            }))
                          }
                          className="flex items-center justify-between w-full px-3.5 py-2.5 text-xs font-bold text-ink-900 hover:bg-cream-100 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span>{dept.name}</span>
                            <span className="text-[10px] font-normal text-ink-400">
                              ({deptCategories.length})
                            </span>
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-ink-500 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isExpanded && (
                          <div className="p-2 pt-0 space-y-1 bg-white border-t border-sand-200">
                            <Link
                              to={`/departments/${dept.slug}`}
                              onClick={() => setDrawerOpen(false)}
                              className="flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold text-ink-900 bg-sand-100/70 hover:bg-sand-200 transition-colors"
                            >
                              <span>Explore All {dept.name}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>

                            {deptCategories.map((cat) => (
                              <Link
                                key={cat._id || cat.slug}
                                to={`/departments/${dept.slug}/categories/${cat.slug}`}
                                onClick={() => setDrawerOpen(false)}
                                className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-ink-700 hover:text-ink-950 hover:bg-cream-100 transition-colors"
                              >
                                <span>{cat.name}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-xs text-ink-400">Loading departments...</div>
                )}
              </div>

              {/* Shortcuts */}
              <div className="border-t border-ink-100 pt-3 space-y-1">
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink-400">
                  Account & Shortcuts
                </div>

                <Link
                  to="/wishlist"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4" />
                    <span>My Wishlist</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-ink-100 text-ink-800 rounded-full">
                    {totalWishlist}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    openDrawer();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Shopping Cart</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-ink-100 text-ink-800 rounded-full">
                    {totalItems}
                  </span>
                </button>

                <Link
                  to="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>Account Profile</span>
                </Link>

                <Link
                  to="/orders"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <Package className="w-4 h-4 text-ink-600" />
                  <span>My Orders</span>
                </Link>

                <Link
                  to="/wallet"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <Wallet className="w-4 h-4 text-ink-600" />
                  <span>Reward Points & Wallet</span>
                </Link>

                {isDeliveryUser && (
                  <Link
                    to="/delivery/orders"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-sky-800 hover:bg-sky-50 transition-colors"
                  >
                    <Truck className="w-4 h-4 text-sky-600" />
                    <span>Delivery Portal</span>
                  </Link>
                )}

                {isAdminUser && (
                  <Link
                    to="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span>Admin / Staff Portal</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Drawer Footer: Auth Buttons or Logged-in user info */}
            <div className="p-4 border-t border-ink-100 bg-cream-50/50 space-y-2">
              {isAuthenticated && user ? (
                <>
                  <div className="px-1 pb-1">
                    <p className="text-xs font-semibold text-ink-900 truncate">{user.name}</p>
                    <p className="text-[11px] text-ink-500 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDrawerOpen(false); handleLogout(); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full flex items-center justify-center py-2.5 px-4 text-xs font-semibold text-ink-900 border border-ink-300 rounded-md hover:bg-white transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full flex items-center justify-center py-2.5 px-4 text-xs font-semibold text-white bg-ink-900 rounded-md hover:bg-ink-800 transition-colors shadow-sm"
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
