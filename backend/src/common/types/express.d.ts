import type { AuthUser } from './auth-user.type';

declare global {
  namespace Express {
    // Passport populates request.user from JwtStrategy.validate()
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
  }
}

export {};
