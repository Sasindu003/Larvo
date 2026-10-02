import React, { useEffect, useState } from 'react';
import { productService, Product } from '../../services/product.service';
import { OrbitProjects, OrbitProjectItem } from '../ui/OrbitProjects';
import { Sparkles } from 'lucide-react';

export const EditorialShowcase: React.FC = () => {
  const [items, setItems] = useState<OrbitProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchEditorialProducts = async () => {
      try {
        setLoading(true);
        const res = await productService.getProducts({ limit: 6, sort: 'popular' });
        const productList: Product[] = res?.items || [];

        if (isMounted && productList.length > 0) {
          const mapped: OrbitProjectItem[] = productList.map((product) => ({
            image: product.images?.[0] || '',
            label: product.name,
            link: `/products/${product.slug || product._id}`,
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.error('Failed to load editorial items:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEditorialProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section aria-label="Editorial Showcase" className="relative -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-500">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Seasonal Editorial Experience</span>
        </div>
      </div>

      <OrbitProjects
        items={items.length > 0 ? items : undefined}
        background="transparent"
        content={{
          showCopy: true,
          textColor: '#0d0d0d',
          leftTitle: 'EDITORIAL',
          rightTitle: 'SHOWCASE',
          centerText: 'Sculptural forms, fluid tailoring, and architectural drape defining the new season.',
          compactTextColor: '#525252',
        }}
        cards={{
          background: '#ece3d4',
          radius: 12,
          aspect: 1.4,
          imageFit: 'cover',
          depthOpacity: 25,
          depthScale: 82,
        }}
        motion={{
          scrollLength: 380,
          perspective: 1200,
          smoothness: 8,
        }}
      />
    </section>
  );
};

export default EditorialShowcase;
