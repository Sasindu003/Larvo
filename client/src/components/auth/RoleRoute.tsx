import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../config/roles';

export interface RoleRouteProps {
  children: React.ReactNode;
  /** The roles that are allowed to access this route */
  roles: readonly UserRole[] | UserRole[];
}

/**
 * RoleRoute — UX guard for role-restricted routes (e.g. /admin/*, /delivery/*).
 * Redirects to / if authenticated but role is not permitted.
 */
export const RoleRoute: React.FC<RoleRouteProps> = ({ children, roles }) => {
  const { user, status } = useAuth();

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ink-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
