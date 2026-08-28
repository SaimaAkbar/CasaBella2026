import type { UserRole } from '../types/auth';
import './RoleBadge.css';

type RoleBadgeProps = {
  role: UserRole;
};

function formatRole(role: UserRole): string {
  return role.replaceAll('_', ' ');
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return <span className="role-badge">{formatRole(role)}</span>;
}
