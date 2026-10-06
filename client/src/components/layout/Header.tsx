import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Heart,
  User,
  Search,
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
  const isAdminUser = !!(user && ['staff', 'admin', 'owner'].includes(user.role));
  const isDeliveryUser = !!(user && ['delivery_manager', 'admin', 'owner'].includes(user.role));
  const isSupplierUser = !!(user && ['supplier'].includes(user.role));

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [activeDeptHover, setActiveDeptHover] = useState<string | null>(null);
  const [expandedMobileDepts, setExpandedMobileDepts] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  // Dynamic dropdown positioning offset to prevent screen edge overflow
  const [dropdownOffset, setDropdownOffset] = useState<number>(0);

  // Tab indicator state
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [indicatorInitialized, setIndicatorInitialized] = useState(false);
  const tabRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const navTabsContainerRef = useRef<HTMLDivElement>(null);
  const dropdownCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accessibility focus restoration and modal refs
  const departmentsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownCardRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  // Search state (Desktop)
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search state (Mobile)
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileSuggestions, setMobileSuggestions] = useState<Product[]>([]);
  const [mobileSearchLoading, setMobileSearchLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedMobileSearch = useDebounce(mobileSearchQuery, 300);

  const location = useLocation();
  const navigate = useNavigate();
  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch {
      toast.error('Logout failed');
    }
  };

  // Fetch departments and categories from live API
  useEffect(() => {
    let isMounted = true;
    setLoadingDepartments(true);
    Promise.all([
      departmentService.getDepartments().catch(() => []),
      categoryService.getCategories().catch(() => []),
    ]).then(([depts, cats]) => {
      if (!isMounted) return;
      if (Array.isArray(depts)) {
        setDepartments(depts);
        if (depts.length > 0) {
          setActiveDeptHover(depts[0].slug);
        }
      }
      if (Array.isArray(cats)) {
        setCategories(cats);
      }
      setLoadingDepartments(false);
    }).catch(() => {
      if (isMounted) setLoadingDepartments(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync search inputs with URL if on /products?q=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
      setMobileSearchQuery(q);
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
          setSuggestions(items || []);
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
          setMobileSuggestions(items || []);
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

  // Active tab determination based on current route and dropdown status
  const getActiveTabKey = useCallback((): string | null => {
    if (categoryDropdownOpen) return 'departments';
    if (location.pathname === '/') return 'home';
    if (location.pathname.startsWith('/products')) return 'products';
    if (location.pathname.startsWith('/departments')) return 'departments';
    return null;
  }, [categoryDropdownOpen, location.pathname]);

  // Position animated tab indicator
  const updateIndicator = useCallback((key: string | null) => {
    if (!key || !tabRefs.current[key] || !navTabsContainerRef.current) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = tabRefs.current[key];
    const container = navTabsContainerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - containerRect.left - container.clientLeft,
        width: elRect.width,
        opacity: 1,
      });
    }
  }, []);

  // Update dropdown panel offset to clamp within viewport and prevent horizontal clipping
  const updateDropdownPosition = useCallback(() => {
    if (!categoryContainerRef.current) return;
    const triggerRect = categoryContainerRef.current.getBoundingClientRect();
    const dropdownWidth = 720;
    const viewportWidth = window.innerWidth;
    const padding = 16;

    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let idealScreenLeft = triggerCenter - dropdownWidth / 2;

    if (idealScreenLeft < padding) {
      idealScreenLeft = padding;
    } else if (idealScreenLeft + dropdownWidth > viewportWidth - padding) {
      idealScreenLeft = Math.max(padding, viewportWidth - padding - dropdownWidth);
    }

    const relativeOffset = idealScreenLeft - triggerRect.left;
    setDropdownOffset(relativeOffset);
  }, []);

  // Sync dropdown offset before paint whenever open
  useLayoutEffect(() => {
    if (categoryDropdownOpen) {
      updateDropdownPosition();
    }
  }, [categoryDropdownOpen, updateDropdownPosition]);

  // Update tab indicator before paint, deferring animation transition until after initial render
  useLayoutEffect(() => {
    const key = hoveredTab || getActiveTabKey();
    updateIndicator(key);
    if (!indicatorInitialized) {
      requestAnimationFrame(() => {
        setIndicatorInitialized(true);
      });
    }
  }, [location.pathname, hoveredTab, categoryDropdownOpen, getActiveTabKey, updateIndicator, indicatorInitialized]);

  // Recalibrate indicator on custom web font load
  useEffect(() => {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        updateIndicator(hoveredTab || getActiveTabKey());
      });
    }
  }, [hoveredTab, getActiveTabKey, updateIndicator]);

  // Handle window resizing to keep indicator and dropdown aligned, and dismiss drawer on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setDrawerOpen(false);
      }
      updateIndicator(hoveredTab || getActiveTabKey());
      if (categoryDropdownOpen) {
        updateDropdownPosition();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hoveredTab, categoryDropdownOpen, getActiveTabKey, updateIndicator, updateDropdownPosition]);

  // Close drawer and dropdowns on route change
  useEffect(() => {
    setDrawerOpen(false);
    setCategoryDropdownOpen(false);
    setAccountDropdownOpen(false);
    setSearchFocused(false);
    setHoveredTab(null);
  }, [location.pathname, location.search]);

  // Lock body scroll and set focus when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Autofocus close button for accessible modal announcement
      requestAnimationFrame(() => {
        drawerCloseBtnRef.current?.focus();
      });
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [drawerOpen]);

  // Safe helper to cancel dropdown close countdown
  const clearDropdownTimer = useCallback(() => {
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  }, []);

  // Immediately close dropdown and cancel any pending timeout
  const closeCategoryDropdownImmediately = useCallback(() => {
    clearDropdownTimer();
    setCategoryDropdownOpen(false);
  }, [clearDropdownTimer]);

  // Accessible mobile drawer close with focus restoration
  const closeDrawer = useCallback((restoreFocus: boolean = true) => {
    setDrawerOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => {
        mobileToggleRef.current?.focus();
      });
    }
  }, []);

  // Dropdown hover helpers with delay to prevent unwanted dismissal
  const handleDropdownTriggerEnter = () => {
    clearDropdownTimer();
    setHoveredTab('departments');
    updateDropdownPosition();
    setCategoryDropdownOpen(true);
  };

  const handleDropdownTriggerLeave = () => {
    dropdownCloseTimerRef.current = setTimeout(() => {
      setCategoryDropdownOpen(false);
      setHoveredTab(null);
    }, 160);
  };

  const handleDropdownCardEnter = () => {
    clearDropdownTimer();
    setCategoryDropdownOpen(true);
    setHoveredTab('departments');
  };

  const handleDropdownCardLeave = () => {
    dropdownCloseTimerRef.current = setTimeout(() => {
      setCategoryDropdownOpen(false);
      setHoveredTab(null);
    }, 160);
  };

  // Outside click & escape key dismissals with accessibility focus restoration & modal focus trap
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(event.target as Node)) {
        clearDropdownTimer();
        setCategoryDropdownOpen(false);
        if (hoveredTab === 'departments') {
          setHoveredTab(null);
        }
      }
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (categoryDropdownOpen) {
          clearDropdownTimer();
          setCategoryDropdownOpen(false);
          setHoveredTab(null);
          departmentsTriggerRef.current?.focus();
        }
        if (accountDropdownOpen) {
          setAccountDropdownOpen(false);
          accountTriggerRef.current?.focus();
        }
        if (searchFocused) {
          setSearchFocused(false);
          searchInputRef.current?.focus();
        }
        if (drawerOpen) {
          closeDrawer(true);
        }
      }

      // Modal focus trap for mobile navigation drawer
      if (drawerOpen && event.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!drawerRef.current.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      clearDropdownTimer();
    };
  }, [hoveredTab, categoryDropdownOpen, accountDropdownOpen, searchFocused, drawerOpen, clearDropdownTimer, closeDrawer]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchFocused(false);
    navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleMobileSearchSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!mobileSearchQuery.trim()) return;
    setDrawerOpen(false);
    navigate(`/products?q=${encodeURIComponent(mobileSearchQuery.trim())}`);
  };

  const showSuggestions = searchFocused && searchQuery.trim().length > 0;
  const activeTabKey = getActiveTabKey();
  const currentHoverOrActive = hoveredTab || activeTabKey;

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-ink-950 text-cream-100 text-[11px] font-medium py-1.5 px-4 text-center tracking-wider uppercase">
        <span>Complimentary domestic express shipping on orders over Rs. 1,500</span>
      </div>

      {/* Floating Pill Header Wrapper */}
      <header className="sticky top-2 sm:top-3 z-40 w-full px-3 sm:px-6 pointer-events-none transition-all duration-200">
        <div className="max-w-screen-2xl mx-auto">
          {/* Main Floating Pill Bar */}
          <div className="pointer-events-auto relative bg-white/90 backdrop-blur-xl border border-ink-200/80 rounded-full shadow-lg shadow-ink-950/5 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-all duration-200">
            {/* Left: Brand Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Link
                to="/"
                className="flex items-center gap-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-ink-950 hover:opacity-90 transition-opacity"
              >
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-ink-950 text-cream-100 flex items-center justify-center font-display font-semibold text-xs sm:text-sm shadow-sm ring-2 ring-ink-200/50">
                  L
                </span>
                <span className="tracking-widest hidden sm:inline font-bold">LARVO</span>
              </Link>
            </div>

            {/* Desktop Center: Interactive Tabs with Animated Sliding Pill Highlight */}
            <nav
              ref={navTabsContainerRef}
              aria-label="Main navigation"
              onMouseLeave={() => setHoveredTab(null)}
              className="hidden lg:flex items-center relative p-1 bg-ink-100/70 rounded-full border border-ink-200/60"
            >
              {/* Animated Floating Pill Background Indicator */}
              <span
                className={`absolute top-1 bottom-1 rounded-full bg-ink-950 pointer-events-none shadow-sm ${
                  indicatorInitialized
                    ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
                    : 'transition-none'
                }`}
                style={{
                  left: `${indicatorStyle.left}px`,
                  width: `${indicatorStyle.width}px`,
                  opacity: indicatorStyle.opacity,
                }}
              />

              {/* Tab 1: Home */}
              <NavLink
                to="/"
                ref={(el) => (tabRefs.current['home'] = el)}
                onMouseEnter={() => {
                  closeCategoryDropdownImmediately();
                  setHoveredTab('home');
                }}
                onFocus={() => {
                  closeCategoryDropdownImmediately();
                  setHoveredTab('home');
                }}
                className={`relative z-10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 ${
                  currentHoverOrActive === 'home'
                    ? 'text-white'
                    : 'text-ink-700 hover:text-ink-950'
                }`}
              >
                Home
              </NavLink>

              {/* Tab 2: Departments & Categories (Dropdown trigger) */}
              <div
                ref={categoryContainerRef}
                onMouseEnter={handleDropdownTriggerEnter}
                onMouseLeave={handleDropdownTriggerLeave}
                onBlur={(e) => {
                  if (categoryContainerRef.current && !categoryContainerRef.current.contains(e.relatedTarget as Node)) {
                    clearDropdownTimer();
                    setCategoryDropdownOpen(false);
                    setHoveredTab(null);
                  }
                }}
                className="relative"
              >
                <button
                  type="button"
                  id="departments-dropdown-trigger"
                  ref={(el) => {
                    tabRefs.current['departments'] = el;
                    departmentsTriggerRef.current = el;
                  }}
                  onClick={() => {
                    updateDropdownPosition();
                    setCategoryDropdownOpen((prev) => {
                      const next = !prev;
                      setHoveredTab(next ? 'departments' : null);
                      return next;
                    });
                  }}
                  onFocus={handleDropdownTriggerEnter}
                  className={`relative z-10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 flex items-center gap-1.5 ${
                    currentHoverOrActive === 'departments'
                      ? 'text-white'
                      : 'text-ink-700 hover:text-ink-950'
                  }`}
                  aria-expanded={categoryDropdownOpen}
                  aria-haspopup="true"
                  aria-controls="departments-dropdown-panel"
                >
                  <span>Departments</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      categoryDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Rich Floating Dropdown Sub-Cards Panel */}
                {categoryDropdownOpen && (() => {
                  const selectedDept =
                    departments.find((d) => d.slug === activeDeptHover) || departments[0];

                  return (
                    <div
                      ref={dropdownCardRef}
                      id="departments-dropdown-panel"
                      role="region"
                      aria-labelledby="departments-dropdown-trigger"
                      onMouseEnter={handleDropdownCardEnter}
                      onMouseLeave={handleDropdownCardLeave}
                      style={{ left: `${dropdownOffset}px` }}
                      className="absolute top-[calc(100%+14px)] w-[720px] max-w-[calc(100vw-32px)] bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-ink-200/90 z-50 overflow-hidden animate-fade-in flex divide-x divide-ink-100 before:absolute before:-top-4 before:inset-x-0 before:h-4 before:content-['']"
                    >
                      {/* Column 1: Departments List */}
                      <div className="w-52 bg-cream-50/70 p-3 space-y-1 flex-shrink-0">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                          Departments
                        </div>
                        {loadingDepartments ? (
                          <div className="px-3 py-4 text-xs text-ink-400 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading departments...</span>
                          </div>
                        ) : departments.length > 0 ? (
                          departments.map((dept) => {
                            const isSelected = selectedDept?.slug === dept.slug;
                            return (
                              <button
                                key={dept._id || dept.slug}
                                type="button"
                                onMouseEnter={() => setActiveDeptHover(dept.slug)}
                                onFocus={() => setActiveDeptHover(dept.slug)}
                                onClick={() => {
                                  setCategoryDropdownOpen(false);
                                  navigate(`/departments/${dept.slug}`);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                                  isSelected
                                    ? 'bg-ink-950 text-white shadow-sm'
                                    : 'text-ink-700 hover:bg-cream-200/60 hover:text-ink-950'
                                }`}
                              >
                                <span className="truncate">{dept.name}</span>
                                <ArrowRight
                                  className={`w-3.5 h-3.5 transition-transform ${
                                    isSelected ? 'opacity-100 translate-x-0.5' : 'opacity-40'
                                  }`}
                                />
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-4 text-xs text-ink-400">No departments available</div>
                        )}
                      </div>

                      {/* Column 2: Department Categories Grid */}
                      <div className="flex-1 p-5 bg-white flex flex-col justify-between">
                        {(() => {
                          const currentDept = selectedDept;
                          if (!currentDept) {
                            return (
                              <div className="py-8 text-center text-xs text-ink-400">
                                Select a department to view categories
                              </div>
                            );
                          }

                          const deptCategories = categories.filter((cat) => {
                            if (!cat.department) return false;
                            if (typeof cat.department === 'object' && cat.department !== null) {
                              return (
                                cat.department.slug?.toLowerCase() === currentDept.slug.toLowerCase() ||
                                cat.department._id === currentDept._id
                              );
                            }
                            return cat.department === currentDept._id || cat.department === currentDept.slug;
                          });

                          return (
                            <>
                              <div>
                                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-ink-100">
                                  <div>
                                    <h4 className="text-sm font-bold tracking-tight text-ink-950">
                                      {currentDept.name} Collection
                                    </h4>
                                    <span className="text-[11px] text-ink-400">
                                      {deptCategories.length} categories available
                                    </span>
                                  </div>
                                  <Link
                                    to={`/departments/${currentDept.slug}`}
                                    onClick={() => setCategoryDropdownOpen(false)}
                                    className="text-xs font-semibold text-ink-800 hover:text-ink-950 flex items-center gap-1 group"
                                  >
                                    <span>Explore all</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                  </Link>
                                </div>

                                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                                  {deptCategories.length > 0 ? (
                                    deptCategories.map((cat) => (
                                      <Link
                                        key={cat._id || cat.slug}
                                        to={`/departments/${currentDept.slug}/categories/${cat.slug}`}
                                        onClick={() => setCategoryDropdownOpen(false)}
                                        className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors group"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-ink-300 group-hover:bg-ink-900 transition-colors flex-shrink-0" />
                                        <span className="truncate">{cat.name}</span>
                                      </Link>
                                    ))
                                  ) : (
                                    <div className="col-span-2 py-6 text-center text-xs text-ink-400">
                                      No categories listed in this department.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="pt-3 mt-4 border-t border-ink-100 bg-cream-50/50 -mx-5 -mb-5 px-5 py-3 flex items-center justify-between">
                                <span className="text-[11px] text-ink-500 font-medium">
                                  Looking for the full {currentDept.name} catalogue?
                                </span>
                                <Link
                                  to={`/departments/${currentDept.slug}`}
                                  onClick={() => setCategoryDropdownOpen(false)}
                                  className="text-[11px] font-bold text-ink-950 hover:underline flex items-center gap-1"
                                >
                                  <span>Browse Department Overview</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Column 3: Featured Collections & Brand Highlights */}
                      <div className="w-48 flex-shrink-0 bg-sand-100/60 p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2">
                            Featured
                          </div>
                          <div className="space-y-1">
                            <Link
                              to="/products?sort=newest"
                              onClick={() => setCategoryDropdownOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-ink-800 hover:bg-sand-100 hover:text-ink-950 transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>New Arrivals</span>
                            </Link>
                            <Link
                              to="/products"
                              onClick={() => setCategoryDropdownOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-ink-800 hover:bg-sand-100 hover:text-ink-950 transition-colors"
                            >
                              <Package className="w-3.5 h-3.5 text-ink-500" />
                              <span>All Products</span>
                            </Link>
                          </div>
                        </div>

                        <div className="p-3 bg-white/80 rounded-xl border border-sand-200 text-[11px] text-ink-600">
                          <p className="font-semibold text-ink-900 mb-0.5">Express Delivery</p>
                          <p className="text-[10px] text-ink-500 leading-tight">Fast door-to-door courier service across all regions.</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Tab 3: All Products */}
              <NavLink
                to="/products"
                ref={(el) => (tabRefs.current['products'] = el)}
                onMouseEnter={() => {
                  closeCategoryDropdownImmediately();
                  setHoveredTab('products');
                }}
                onFocus={() => {
                  closeCategoryDropdownImmediately();
                  setHoveredTab('products');
                }}
                className={`relative z-10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 ${
                  currentHoverOrActive === 'products'
                    ? 'text-white'
                    : 'text-ink-700 hover:text-ink-950'
                }`}
              >
                All Products
              </NavLink>
            </nav>

            {/* Desktop Search Bar with Live Suggestions Dropdown */}
            <div
              ref={searchContainerRef}
              onBlur={(e) => {
                if (searchContainerRef.current && !searchContainerRef.current.contains(e.relatedTarget as Node)) {
                  setSearchFocused(false);
                }
              }}
              className="hidden md:flex flex-1 min-w-0 max-w-xs lg:max-w-sm relative"
            >
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Search curated fashion, apparel..."
                  aria-label="Search curated fashion, apparel"
                  className="w-full bg-cream-50/90 hover:bg-cream-100/80 focus:bg-white text-xs text-ink-900 placeholder:text-ink-400 rounded-full pl-9 pr-9 py-2 border border-ink-200/80 focus:border-ink-600 focus:outline-none focus:ring-2 focus:ring-ink-200/50 transition-all shadow-inner [&::-webkit-search-cancel-button]:appearance-none"
                />
                {searchLoading ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 animate-spin" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700"
                    aria-label="Clear search query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </form>

              {/* Suggestions Dropdown Popover */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-sand-300 py-2 z-50 overflow-hidden animate-fade-in">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-400 border-b border-sand-200 flex items-center justify-between">
                    <span>Product Suggestions</span>
                    {searchLoading && <span className="text-[10px] font-normal text-ink-400">Searching...</span>}
                  </div>

                  {suggestions.length > 0 ? (
                    <div className="divide-y divide-sand-100 max-h-72 overflow-y-auto">
                      {suggestions.map((item) => {
                        const hasDiscount =
                          item.discountPrice !== null &&
                          item.discountPrice !== undefined &&
                          item.discountPrice < item.basePrice;
                        return (
                          <Link
                            key={item._id}
                            to={`/products/${item.slug}`}
                            onClick={() => setSearchFocused(false)}
                            className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-cream-50 transition-colors group"
                          >
                            <img
                              src={
                                item.images?.[0] ||
                                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
                              }
                              alt={item.name}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                              }}
                              className="w-9 h-11 object-cover rounded-md bg-sand-100 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-ink-900 truncate group-hover:text-ink-700">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {typeof item.category === 'object' && item.category !== null && (
                                  <span className="text-[10px] text-ink-400 uppercase tracking-wider">
                                    {(item.category as Category).name}
                                  </span>
                                )}
                                <span className="text-xs font-semibold text-ink-900">
                                  Rs. {hasDiscount ? item.discountPrice : item.basePrice}
                                </span>
                                {hasDiscount && (
                                  <span className="text-[10px] text-ink-400 line-through">
                                    Rs. {item.basePrice}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-ink-300 group-hover:text-ink-700 transition-colors" />
                          </Link>
                        );
                      })}
                    </div>
                  ) : !searchLoading ? (
                    <div className="px-4 py-4 text-center text-xs text-ink-500">
                      No products found for "{searchQuery}"
                    </div>
                  ) : null}

                  {/* View All Results Button */}
                  <div className="p-2 border-t border-sand-200 bg-sand-100/50">
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="w-full py-1.5 px-3 text-xs font-semibold text-ink-900 hover:bg-sand-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>View all results for "{searchQuery}"</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Actions (Wishlist, Cart, User Account / Role Shortcuts) */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Wishlist Pill Icon */}
              <Link
                to="/wishlist"
                className="relative p-2 text-ink-700 hover:text-ink-950 hover:bg-ink-100/70 rounded-full transition-colors"
                title="Wishlist"
                aria-label="View Wishlist"
              >
                <Heart className="w-5 h-5" />
                {totalWishlist > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-ink-950 rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
                    {totalWishlist}
                  </span>
                )}
              </Link>

              {/* Cart Drawer Trigger */}
              <button
                type="button"
                onClick={openDrawer}
                className="relative p-2 text-ink-700 hover:text-ink-950 hover:bg-ink-100/70 rounded-full transition-colors"
                title="Shopping Cart"
                aria-label="View Shopping Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-ink-950 rounded-full px-1 leading-none shadow-sm ring-2 ring-white">
                    {totalItems}
                  </span>
                )}
              </button>

              {/* Delivery Portal Shortcut */}
              {isDeliveryUser && (
                <Link
                  to="/delivery/orders"
                  className="hidden xl:inline-flex p-2 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-full transition-colors"
                  title="Delivery Portal"
                  aria-label="Delivery Portal"
                >
                  <Truck className="w-5 h-5" />
                </Link>
              )}

              {/* Supplier Portal Shortcut */}
              {isSupplierUser && (
                <Link
                  to="/supplier"
                  className="hidden xl:inline-flex p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Supplier Portal"
                  aria-label="Supplier Portal"
                >
                  <Building2 className="w-5 h-5" />
                </Link>
              )}

              {/* Admin Portal Shortcut */}
              {isAdminUser && (
                <Link
                  to="/admin"
                  className="hidden xl:inline-flex p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-full transition-colors"
                  title="Admin Portal"
                  aria-label="Admin Portal"
                >
                  <Shield className="w-5 h-5" />
                </Link>
              )}

              {/* Desktop Account Menu Dropdown */}
              <div
                ref={accountRef}
                onBlur={(e) => {
                  if (accountRef.current && !accountRef.current.contains(e.relatedTarget as Node)) {
                    setAccountDropdownOpen(false);
                  }
                }}
                className="relative hidden md:block"
              >
                <button
                  type="button"
                  id="account-dropdown-trigger"
                  ref={accountTriggerRef}
                  onClick={() => setAccountDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 p-1 pl-1 pr-2.5 text-ink-800 hover:bg-ink-100/70 rounded-full border border-ink-200/80 transition-colors"
                  aria-expanded={accountDropdownOpen}
                  aria-haspopup="true"
                  aria-controls="account-dropdown-panel"
                  aria-label="Account menu"
                >
                  <div className="w-6 h-6 rounded-full bg-ink-100 flex items-center justify-center text-ink-700">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold max-w-[80px] truncate hidden lg:inline">
                    {isAuthenticated && user ? user.name.split(' ')[0] : 'Account'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-ink-500 transition-transform ${
                      accountDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {accountDropdownOpen && (
                  <div
                    id="account-dropdown-panel"
                    role="menu"
                    aria-labelledby="account-dropdown-trigger"
                    className="absolute right-0 mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-ink-200 py-2 z-50 animate-fade-in"
                  >
                    {isAuthenticated && user ? (
                      <>
                        <div className="px-4 py-2 border-b border-ink-100 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-900 truncate">{user.name}</p>
                            <p className="text-[11px] text-ink-500 truncate">{user.email}</p>
                          </div>
                          {user.role !== 'customer' && (
                            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded border flex-shrink-0 bg-ink-100 text-ink-800 border-ink-200">
                              {user.role.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <div className="py-1">
                          <Link
                            to="/profile"
                            role="menuitem"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                          >
                            <User className="w-3.5 h-3.5 text-ink-500" />
                            <span>My Profile</span>
                          </Link>
                          <Link
                            to="/orders"
                            role="menuitem"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                          >
                            <Package className="w-3.5 h-3.5 text-ink-500" />
                            <span>My Orders</span>
                          </Link>
                          <Link
                            to="/wallet"
                            role="menuitem"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                          >
                            <Wallet className="w-3.5 h-3.5 text-ink-500" />
                            <span>Reward Points & Wallet</span>
                          </Link>
                          {isDeliveryUser && (
                            <Link
                              to="/delivery/orders"
                              role="menuitem"
                              onClick={() => setAccountDropdownOpen(false)}
                              className="flex items-center gap-2.5 px-4 py-2 text-xs text-sky-700 hover:bg-sky-50 transition-colors font-medium"
                            >
                              <Truck className="w-3.5 h-3.5 text-sky-600" />
                              <span>Delivery Portal</span>
                            </Link>
                          )}
                          {isSupplierUser && (
                            <Link
                              to="/supplier"
                              role="menuitem"
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
                              role="menuitem"
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
                            role="menuitem"
                            onClick={() => {
                              setAccountDropdownOpen(false);
                              handleLogout();
                            }}
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
                            role="menuitem"
                            onClick={() => setAccountDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink-800 hover:bg-cream-100 hover:text-ink-950 transition-colors font-medium"
                          >
                            <LogIn className="w-3.5 h-3.5 text-ink-500" />
                            <span>Sign In</span>
                          </Link>
                          <Link
                            to="/register"
                            role="menuitem"
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

              {/* Quick Login/Join shortcuts on large desktop screens */}
              <div className="hidden 2xl:flex items-center gap-1.5 border-l border-ink-200/70 pl-2">
                {isAuthenticated && user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 py-1 text-xs font-medium text-ink-600 hover:text-red-600 rounded-full transition-colors"
                  >
                    Sign Out
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-2.5 py-1 text-xs font-semibold text-ink-800 hover:text-ink-950 hover:bg-ink-100/70 rounded-full transition-colors"
                    >
                      Log In
                    </Link>
                    <Link
                      to="/register"
                      className="px-3 py-1 text-xs font-semibold bg-ink-950 hover:bg-ink-800 text-white rounded-full shadow-sm transition-colors"
                    >
                      Join
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile Animated 2-Bar Burger-to-X Menu Toggle */}
              <button
                type="button"
                ref={mobileToggleRef}
                onClick={() => (drawerOpen ? closeDrawer(false) : setDrawerOpen(true))}
                className="lg:hidden relative w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-full hover:bg-ink-100/70 transition-colors focus:outline-none focus:ring-2 focus:ring-ink-300"
                aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={drawerOpen}
                aria-controls="mobile-navigation-drawer"
              >
                <span
                  className={`block w-5 h-[2px] bg-ink-900 rounded-full transition-all duration-300 ease-in-out origin-center ${
                    drawerOpen ? 'rotate-45 translate-y-[4px]' : ''
                  }`}
                />
                <span
                  className={`block w-5 h-[2px] bg-ink-900 rounded-full transition-all duration-300 ease-in-out origin-center ${
                    drawerOpen ? '-rotate-45 -translate-y-[4px]' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-in Drawer Sheet */}
      {drawerOpen && (
        <div
          id="mobile-navigation-drawer"
          className="fixed inset-0 z-50 lg:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Mobile Navigation"
        >
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => closeDrawer(true)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div
            ref={drawerRef}
            className="fixed inset-y-0 right-0 w-4/5 max-w-sm bg-white shadow-2xl flex flex-col z-50 animate-fade-in border-l border-ink-200 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-4 flex items-center justify-between border-b border-ink-100 bg-cream-50/70">
              <Link
                to="/"
                onClick={() => closeDrawer(false)}
                className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-ink-950"
              >
                <span className="w-7 h-7 rounded-full bg-ink-950 text-cream-100 flex items-center justify-center font-display font-semibold text-xs">
                  L
                </span>
                <span className="tracking-widest">LARVO</span>
              </Link>
              <button
                type="button"
                ref={drawerCloseBtnRef}
                onClick={() => closeDrawer(true)}
                className="p-1.5 rounded-full hover:bg-ink-200/60 text-ink-500 hover:text-ink-900 transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Search with Live Suggestions */}
            <div className="p-4 border-b border-ink-100">
              <form onSubmit={handleMobileSearchSubmit} className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                <input
                  type="search"
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  placeholder="Search styles, categories..."
                  aria-label="Search styles, categories"
                  className="w-full bg-cream-50 text-xs text-ink-900 placeholder:text-ink-400 rounded-full pl-9 pr-9 py-2 border border-ink-200 focus:border-ink-600 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
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
                    aria-label="Clear mobile search query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </form>

              {/* Mobile Suggestions Preview */}
              {mobileSuggestions.length > 0 ? (
                <div className="mt-2 bg-white rounded-xl border border-sand-300 divide-y divide-sand-100 max-h-48 overflow-y-auto">
                  {mobileSuggestions.map((item) => {
                    const hasDiscount =
                      item.discountPrice !== null &&
                      item.discountPrice !== undefined &&
                      item.discountPrice < item.basePrice;
                    return (
                      <Link
                        key={item._id}
                        to={`/products/${item.slug}`}
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center gap-2.5 p-2 hover:bg-cream-50"
                      >
                        <img
                          src={
                            item.images?.[0] ||
                            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
                          }
                          alt={item.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                          }}
                          className="w-8 h-10 object-cover rounded bg-sand-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink-900 truncate">{item.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-semibold text-ink-700">
                              Rs. {hasDiscount ? item.discountPrice : item.basePrice}
                            </span>
                            {hasDiscount && (
                              <span className="text-[10px] text-ink-400 line-through">
                                Rs. {item.basePrice}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleMobileSearchSubmit}
                    className="w-full p-2 text-center text-xs font-semibold text-ink-900 bg-sand-100 hover:bg-sand-200"
                  >
                    View all results
                  </button>
                </div>
              ) : debouncedMobileSearch.trim().length > 0 && !mobileSearchLoading ? (
                <div className="mt-2 p-3 bg-white rounded-xl border border-sand-300 text-center text-xs text-ink-500">
                  No products found for "{mobileSearchQuery}"
                </div>
              ) : null}
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Primary Links */}
              <div className="space-y-1">
                <NavLink
                  to="/"
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive ? 'bg-ink-950 text-white' : 'text-ink-800 hover:bg-cream-100'
                    }`
                  }
                >
                  <span>Home</span>
                </NavLink>

                <NavLink
                  to="/products"
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive ? 'bg-ink-950 text-white' : 'text-ink-800 hover:bg-cream-100'
                    }`
                  }
                >
                  <span>All Products</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </NavLink>
              </div>

              {/* Departments & Categories Accordion */}
              <div className="border-t border-ink-100 pt-3 space-y-1.5">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Departments & Collections
                </div>

                {loadingDepartments ? (
                  <div className="px-3 py-3 text-xs text-ink-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading departments...</span>
                  </div>
                ) : departments.length > 0 ? (
                  departments.map((dept) => {
                    const isExpanded = !!expandedMobileDepts[dept.slug];
                    const deptCategories = categories.filter((cat) => {
                      if (!cat.department) return false;
                      if (typeof cat.department === 'object' && cat.department !== null) {
                        return (
                          cat.department.slug?.toLowerCase() === dept.slug.toLowerCase() ||
                          cat.department._id === dept._id
                        );
                      }
                      return cat.department === dept._id || cat.department === dept.slug;
                    });

                    return (
                      <div
                        key={dept._id || dept.slug}
                        className="rounded-xl border border-sand-200 overflow-hidden bg-cream-50/40"
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
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
                              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-ink-900 bg-sand-100/70 hover:bg-sand-200 transition-colors"
                            >
                              <span>Explore All {dept.name}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>

                            {deptCategories.length > 0 ? (
                              deptCategories.map((cat) => (
                                <Link
                                  key={cat._id || cat.slug}
                                  to={`/departments/${dept.slug}/categories/${cat.slug}`}
                                  onClick={() => setDrawerOpen(false)}
                                  className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:text-ink-950 hover:bg-cream-100 transition-colors"
                                >
                                  <span>{cat.name}</span>
                                </Link>
                              ))
                            ) : (
                              <div className="px-3 py-1.5 text-[11px] text-ink-400">
                                No subcategories listed
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-xs text-ink-400">No departments available</div>
                )}
              </div>

              {/* Shortcuts */}
              <div className="border-t border-ink-100 pt-3 space-y-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Account & Shortcuts
                </div>

                <Link
                  to="/wishlist"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4" />
                    <span>My Wishlist</span>
                  </span>
                  {totalWishlist > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-ink-100 text-ink-800 rounded-full">
                      {totalWishlist}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    openDrawer();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Shopping Cart</span>
                  </span>
                  {totalItems > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-ink-100 text-ink-800 rounded-full">
                      {totalItems}
                    </span>
                  )}
                </button>

                <Link
                  to="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>Account Profile</span>
                </Link>

                <Link
                  to="/orders"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <Package className="w-4 h-4 text-ink-600" />
                  <span>My Orders</span>
                </Link>

                <Link
                  to="/wallet"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink-700 hover:bg-cream-100 transition-colors"
                >
                  <Wallet className="w-4 h-4 text-ink-600" />
                  <span>Reward Points & Wallet</span>
                </Link>

                {isDeliveryUser && (
                  <Link
                    to="/delivery/orders"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-sky-800 hover:bg-sky-50 transition-colors"
                  >
                    <Truck className="w-4 h-4 text-sky-600" />
                    <span>Delivery Portal</span>
                  </Link>
                )}

                {isSupplierUser && (
                  <Link
                    to="/supplier"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-indigo-800 hover:bg-indigo-50 transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Supplier Portal</span>
                  </Link>
                )}

                {isAdminUser && (
                  <Link
                    to="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span>Admin / Staff Portal</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Drawer Footer: Auth Buttons or Logged-in User Info */}
            <div className="p-4 border-t border-ink-100 bg-cream-50/60 space-y-2">
              {isAuthenticated && user ? (
                <>
                  <div className="px-1 pb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-ink-500 truncate">{user.email}</p>
                    </div>
                    {user.role !== 'customer' && (
                      <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded border flex-shrink-0 bg-ink-100 text-ink-800 border-ink-200">
                        {user.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold text-red-700 border border-red-200 rounded-full hover:bg-red-50 transition-colors"
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
                    className="w-full flex items-center justify-center py-2 px-4 text-xs font-semibold text-ink-900 border border-ink-300 rounded-full hover:bg-white transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full flex items-center justify-center py-2 px-4 text-xs font-semibold text-white bg-ink-950 rounded-full hover:bg-ink-800 transition-colors shadow-sm"
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
