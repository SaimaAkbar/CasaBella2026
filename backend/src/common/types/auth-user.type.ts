import { Role, Status } from '../../../generated/prisma/client';

/** Authenticated user attached to request.user (never includes password). */
export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: Status;
  canAccessSalary: boolean;
  canAccessProfitLoss: boolean;
  forcePasswordChange?: boolean;
  passwordChangedAt?: Date | null;
  tokenVersion?: number;
  createdAt: Date;
  updatedAt: Date;
};
