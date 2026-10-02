import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  RefreshCw,
  Boxes,
  AlertTriangle,
  Layers,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  supplierPortalService,
  SupplierProductItem,
} from '../../services/supplier.service';

export const SupplierProductsPage: React.FC = () => {
  const [products, setProducts] = useState<SupplierProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await supplierPortalService.getProducts();
      setProducts(res.products || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load supplier catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered by search (product name, slug, or SKU)
  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = p.name.toLowerCase().includes(q);
    const slugMatch = p.slug.toLowerCase().includes(q);
    const skuMatch = (p.variants || []).some((v) => v.sku.toLowerCase().includes(q));
    return nameMatch || slugMatch || skuMatch;
  });

  const totalVariants = products.reduce((sum, p) => sum + (p.variants || []).length, 0);
  const totalStock = products.reduce(
    (sum, p) => sum + (p.variants || []).reduce((vSum, v) => vSum + (v.stock || 0), 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            My Supplied Products
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Active catalog items and variant stock levels associated with your supplier account
          </p>
        </div>

        <button
          type="button"
          onClick={fetchProducts}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Catalog Items
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">{products.length}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Supplied Variants
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">{totalVariants}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Units In Stock
            </span>
            <span className="text-lg font-bold text-white mt-0.5 block">{totalStock}</span>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by product name, slug, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 font-medium"
          />
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          Loading supplier catalog...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <Package className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No products found</p>
          <p className="text-xs text-slate-500">
            {search ? 'Try adjusting your search query.' : 'No catalog items are currently assigned to your vendor profile.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product._id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl hover:border-slate-700/80 transition-colors"
            >
              {/* Product Header */}
              <div className="flex items-start gap-3.5">
                {product.images && product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{product.name}</h3>
                    <span className="text-xs font-bold text-indigo-400 shrink-0">
                      Rs. {product.basePrice.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                    /{product.slug}
                  </p>
                  {product.category && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      {product.category.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Variants Table */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Supplied Variants ({(product.variants || []).length})
                </span>

                <div className="space-y-1.5">
                  {(product.variants || []).map((v, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-300 font-semibold">
                          {v.sku}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">
                          {v.size} / {v.color}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {v.stock < 5 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Low Stock
                          </span>
                        )}
                        <span className="font-mono font-bold text-slate-200">
                          {v.stock} in stock
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SupplierProductsPage;
