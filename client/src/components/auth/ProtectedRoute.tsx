import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../config/roles';

/**
 * ProtectedRoute — UX guard only (security is enforced server-side per P19).
 * Redirects to /login with `?redirect=<currentPath>` when unauthenticated.
 * Shows nothing while the session check is in progress to prevent flashing.
 */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    // Render nothing (or a spinner) during the initial /me check
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <>{children}</>;
};
export { RoleRoute } from './RoleRoute';
export type { RoleRouteProps } from './RoleRoute';
