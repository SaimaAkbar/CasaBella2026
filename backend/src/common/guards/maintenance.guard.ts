import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Role } from '../../../generated/prisma/client';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';
import { SettingsService } from '../../settings/settings.service';
import { UsersService } from '../../users/users.service';
import type { AuthUser } from '../types/auth-user.type';

const ALLOWED_PREFIXES = [
  '/health',
  '/auth/login',
  '/system/maintenance',
  '/backups',
  '/settings/public',
];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settings: SettingsService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path || req.url || '';

    if (
      ALLOWED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      )
    ) {
      return true;
    }

    const enabled = await this.settings.getBoolean(
      'system.maintenanceMode',
      false,
    );
    if (!enabled) return true;

    const user =
      (req.user as AuthUser | undefined) ??
      (await this.resolveUserFromAuthorization(req));

    if (user?.role === Role.SUPER_ADMIN) return true;

    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return true;
    }

    const message = await this.settings.getString(
      'system.maintenanceMessage',
      'System is under maintenance. Please try again later.',
    );
    throw new ServiceUnavailableException(message);
  }

  private async resolveUserFromAuthorization(
    req: Request,
  ): Promise<AuthUser | undefined> {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return undefined;
    }

    try {
      const token = authorization.slice('Bearer '.length).trim();
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.usersService.findOne(payload.sub);

      if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        return undefined;
      }

      return user;
    } catch {
      return undefined;
    }
  }
}
