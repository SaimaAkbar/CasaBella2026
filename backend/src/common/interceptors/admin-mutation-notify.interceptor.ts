import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { NotificationPriority, NotificationType, Role } from '../../../generated/prisma/client';
import type { AuthUser } from '../types/auth-user.type';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  describeAdminMutation,
  shouldNotifyAdminMutation,
} from '../utils/admin-mutation-notify';

@Injectable()
export class AdminMutationNotifyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminMutationNotifyInterceptor.name);

  constructor(private readonly notifications: NotificationsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    const method = request.method;
    const path = request.originalUrl || request.url || '';

    if (
      !user ||
      user.role !== Role.ADMIN ||
      !shouldNotifyAdminMutation(method, path)
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.notifySuperAdmin(user, method, path);
        },
      }),
    );
  }

  private async notifySuperAdmin(
    actor: AuthUser,
    method: string,
    path: string,
  ) {
    const { verb, module } = describeAdminMutation(method, path);
    try {
      await this.notifications.notifySuperAdmins({
        type: NotificationType.WARNING,
        title: 'Admin change requires review',
        message: `${actor.fullName} (${actor.email}) ${verb} ${module}.`,
        relatedModule: 'ADMIN_CHANGE',
        relatedId: actor.id,
        actionUrl: '/audit-logs',
        icon: 'warning',
        priority: NotificationPriority.HIGH,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify Super Admin of Admin mutation: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
