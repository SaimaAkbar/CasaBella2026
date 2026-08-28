import { Role } from '../../../generated/prisma/client';

/** Super Admin always; Admin only with explicit canAccessProfitLoss grant. */
export function canAccessProfitLossData(
  role: Role,
  canAccessProfitLoss: boolean,
): boolean {
  return (
    role === Role.SUPER_ADMIN ||
    (role === Role.ADMIN && canAccessProfitLoss)
  );
}
