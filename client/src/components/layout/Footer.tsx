import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle2,
  Instagram,
  Twitter,
  Facebook,
  Pin as PinterestIcon,
} from 'lucide-react';

const newsletterSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Please enter a valid email address'),
});

type NewsletterFormData = z.infer<typeof newsletterSchema>;

export const Footer: React.FC = () => {
  const [subscribed, setSubscribed] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
  });

  const onSubmit = (data: NewsletterFormData) => {
    console.log('Newsletter subscription stub:', data.email);
    setSubscribed(true);
    reset();
    setTimeout(() => {
      setSubscribed(false);
    }, 5000);
  };

  return (
    <footer className="bg-ink-950 border-t border-ink-900 text-ink-300 mt-auto">
      {/* Top Newsletter Bar */}
      <div className="border-b border-ink-900 bg-ink-900/40">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <h3 className="font-display text-lg font-bold text-white tracking-tight">
                Join the LARVO Privé List
              </h3>
              <p className="text-xs text-ink-400">
                Subscribe for private collection previews, exclusive seasonal lookbooks, and VIP event invitations.
              </p>
            </div>

            <div className="w-full lg:w-auto min-w-[320px] max-w-md">
              {subscribed ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Thank you for subscribing! Check your inbox for your welcome invitation.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-1.5" noValidate>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        {...register('email')}
                        className={`w-full bg-ink-900 border text-xs text-white placeholder:text-ink-500 rounded-lg pl-9 pr-3 py-2.5 transition-colors focus:outline-none focus:ring-1 ${
                          errors.email
                            ? 'border-danger focus:ring-danger'
                            : 'border-ink-700 focus:border-white focus:ring-white'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2.5 bg-white hover:bg-cream-100 text-ink-950 text-xs font-semibold rounded-lg tracking-wider uppercase transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Subscribe</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {errors.email && (
                    <p className="text-[11px] text-danger pl-1 font-medium">{errors.email.message}</p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="container mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-12 border-b border-ink-900">
          {/* Column 1: Brand & Socials & Contact */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-white">
              <span className="w-7 h-7 rounded bg-white text-ink-950 flex items-center justify-center font-display font-semibold text-sm">
                L
              </span>
              <span className="tracking-widest">LARVO</span>
            </div>

            <p className="text-xs text-ink-400 leading-relaxed">
              Curated contemporary fashion, essential silhouettes, and elevated wardrobe staples crafted for timeless style.
            </p>

            {/* Social Icons Row */}
            <div className="flex items-center gap-3 pt-1">
              <a
                href="#instagram"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-full bg-ink-900 hover:bg-white hover:text-ink-950 text-ink-400 flex items-center justify-center transition-colors"
                aria-label="Instagram"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#twitter"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-full bg-ink-900 hover:bg-white hover:text-ink-950 text-ink-400 flex items-center justify-center transition-colors"
                aria-label="Twitter / X"
                title="Twitter / X"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#facebook"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-full bg-ink-900 hover:bg-white hover:text-ink-950 text-ink-400 flex items-center justify-center transition-colors"
                aria-label="Facebook"
                title="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="#pinterest"
                onClick={(e) => e.preventDefault()}
                className="w-8 h-8 rounded-full bg-ink-900 hover:bg-white hover:text-ink-950 text-ink-400 flex items-center justify-center transition-colors"
                aria-label="Pinterest"
                title="Pinterest"
              >
                <PinterestIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Contact Info Block */}
            <div className="space-y-2 pt-2 text-xs text-ink-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                <span>742 Fashion Boulevard, Suite 100, New York, NY</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                <span>+1 (800) 555-LARVO</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-ink-500 shrink-0" />
                <span>concierge@larvofashion.com</span>
              </div>
            </div>
          </div>

          {/* Column 2: Shop Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white mb-4">
              Shop Collections
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-400">
              <li>
                <Link to="/products" className="hover:text-white transition-colors">
                  All Products & Apparel
                </Link>
              </li>
              <li>
                <Link to="/products?category=womens-apparel" className="hover:text-white transition-colors">
                  Women's Apparel
                </Link>
              </li>
              <li>
                <Link to="/products?category=mens-collection" className="hover:text-white transition-colors">
                  Men's Collection
                </Link>
              </li>
              <li>
                <Link to="/products?category=footwear" className="hover:text-white transition-colors">
                  Footwear & Shoes
                </Link>
              </li>
              <li>
                <Link to="/products?category=accessories" className="hover:text-white transition-colors">
                  Accessories & Handbags
                </Link>
              </li>
              <li>
                <Link to="/products?category=new-arrivals" className="hover:text-white transition-colors">
                  New Season Arrivals
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company & Help Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white mb-4">
              Company & Help
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-400">
              <li>
                <span className="text-ink-500 cursor-not-allowed">About LARVO Atelier</span>
              </li>
              <li>
                <span className="text-ink-500 cursor-not-allowed">Editorial Lookbook</span>
              </li>
              <li>
                <span className="text-ink-500 cursor-not-allowed">Sustainability & Ethics</span>
              </li>
              <li>
                <span className="text-ink-500 cursor-not-allowed">Complimentary Shipping & Returns</span>
              </li>
              <li>
                <span className="text-ink-500 cursor-not-allowed">Bank Transfer Payment Guidelines</span>
              </li>
              <li>
                <span className="text-ink-500 cursor-not-allowed">Frequently Asked Questions</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Client Portal & System Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white mb-4">
              Client Portal & Services
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-400">
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Customer Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-white transition-colors">
                  My Profile & Orders
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="hover:text-white transition-colors">
                  Saved Wishlist
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-white transition-colors">
                  Shopping Bag
                </Link>
              </li>
              <li>
                <Link to="/admin" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                  Staff & Admin Portal
                </Link>
              </li>
              <li>
                <Link to="/dev/components" className="text-ink-500 hover:text-ink-300 transition-colors">
                  Design System Primitives
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-500">
          <p>&copy; {new Date().getFullYear()} LARVO Fashion Inc. All rights reserved.</p>
          <p className="text-[11px] tracking-wide text-ink-600">
            Manual Bank Transfer Slip Review • Section 20 Compliance • Responsive Design System
          </p>
        </div>
      </div>
    </footer>
  );
};
