import { ForbiddenException } from '@nestjs/common';
import { Role } from '../../../generated/prisma/client';

/** Employees & Salaries are Super Admin only. */
export function canAccessSalaryData(
  role: Role,
  canAccessSalary = false,
): boolean {
  return role === Role.SUPER_ADMIN || canAccessSalary;
}

export function assertSuperAdminSalaryAccess(role: Role): void {
  if (role !== Role.SUPER_ADMIN) {
    throw new ForbiddenException(
      'Only Super Admin can access employees and salaries',
    );
  }
}
