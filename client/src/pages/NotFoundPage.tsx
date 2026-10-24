import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="bg-slate-800 border border-rose-500/30 rounded-xl p-8 text-center space-y-4 max-w-md mx-auto my-12">
      <h1 className="text-4xl font-extrabold text-rose-400">404</h1>
      <h2 className="text-xl font-bold text-white">Page Not Found</h2>
      <p className="text-slate-400 text-sm">The page or resource you requested could not be located.</p>
      <Link to="/" className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-sm font-semibold transition-colors">
        Return to Home
      </Link>
    </div>
  );
};
