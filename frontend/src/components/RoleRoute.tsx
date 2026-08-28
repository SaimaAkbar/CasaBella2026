import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

type RoleRouteProps = {
  roles: UserRole[];
};

export function RoleRoute({ roles }: RoleRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
