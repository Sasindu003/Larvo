import React from 'react';
import { HeroBanner } from '../components/home/HeroBanner';
import { CategoryGrid } from '../components/home/CategoryGrid';
import { NewArrivals } from '../components/home/NewArrivals';
import { TrendingProducts } from '../components/home/TrendingProducts';
import { SeasonalOffers } from '../components/home/SeasonalOffers';
import { EditorialShowcase } from '../components/home/EditorialShowcase';

/**
 * Home Page Component
 * Assembles the home page sections in exact specified order:
 * 1. Hero Banner (Interactive Editorial Carousel)
 * 2. Categories Showcase (Curated Collections Grid)
 * 3. New Arrivals (Latest Drops Showcase Carousel)
 * 4. 3D Editorial Showcase (Orbit Projects Motion View)
 * 5. Trending Products & Best Sellers (Filterable Product Grid)
 * 6. Seasonal Offers & Promos (Active Coupons & Campaign Cards)
 */
export const Home: React.FC = () => {
  return (
    <div className="space-y-16 py-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* SECTION 1: HERO BANNER */}
      <HeroBanner />

      {/* SECTION 2: CATEGORIES SHOWCASE */}
      <CategoryGrid />

      {/* SECTION 3: NEW ARRIVALS */}
      <NewArrivals />

      {/* SECTION 4: 3D EDITORIAL SHOWCASE */}
      <EditorialShowcase />

      {/* SECTION 5: TRENDING PRODUCTS & BEST SELLERS */}
      <TrendingProducts />

      {/* SECTION 6: SEASONAL OFFERS & PROMOS */}
      <SeasonalOffers />
    </div>
  );
};

// Also export as HomePage for backward compatibility
export const HomePage = Home;
export default Home;
