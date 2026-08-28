export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  canAccessSalary?: boolean;
  canAccessProfitLoss?: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

/** Matches NestJS AuthService.login() response */
export type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: AuthUser;
};

export type AuthProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  canAccessSalary?: boolean;
  canAccessProfitLoss?: boolean;
};
