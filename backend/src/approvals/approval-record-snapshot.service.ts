import { Injectable } from '@nestjs/common';
import {
  ApprovalStatus,
  Prisma,
  type ApprovalModuleName,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isHttpReplayPayload, normalizeRoute } from './staff-mutation-approval';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ApprovalRecordSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async capture(
    _moduleName: ApprovalModuleName,
    recordId: string,
    path: string,
  ): Promise<Record<string, unknown> | null> {
    if (!UUID_RE.test(recordId)) return null;
    const route = normalizeRoute(path);

    try {
      const row = await this.loadRow(route, recordId);
      if (!row) return null;
      const safe = jsonSafe(row);
      return isPlainObject(safe) ? safe : null;
    } catch {
      return null;
    }
  }

  private loadRow(route: string, id: string) {
    if (
      route.startsWith('/expenses/') &&
      !route.startsWith('/expense-categories')
    ) {
      return this.prisma.expense.findUnique({
        where: { id },
        include: {
          category: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          property: { select: { name: true } },
        },
      });
    }
    if (route.startsWith('/expense-categories/')) {
      return this.prisma.expenseCategory.findUnique({ where: { id } });
    }
    if (route.startsWith('/properties/')) {
      return this.prisma.property.findUnique({ where: { id } });
    }
    if (route.startsWith('/units/')) {
      return this.prisma.unit.findUnique({
        where: { id },
        include: { property: { select: { name: true } } },
      });
    }
    if (route.startsWith('/guests/')) {
      return this.prisma.guest.findUnique({ where: { id } });
    }
    if (route.startsWith('/bookings/')) {
      return this.prisma.booking.findUnique({
        where: { id },
        include: {
          guest: { select: { fullName: true } },
          unit: { select: { unitNumber: true } },
        },
      });
    }
    if (route.startsWith('/monthly-tenants/')) {
      return this.prisma.monthlyTenant.findUnique({ where: { id } });
    }
    if (route.startsWith('/monthly-tenancies/')) {
      return this.prisma.monthlyTenancy.findUnique({ where: { id } });
    }
    if (route.startsWith('/monthly-agreements/')) {
      return this.prisma.monthlyAgreement.findUnique({ where: { id } });
    }
    if (route.startsWith('/monthly-bills/')) {
      return this.prisma.monthlyBill.findUnique({ where: { id } });
    }
    if (route.startsWith('/payments/')) {
      return this.prisma.payment.findUnique({ where: { id } });
    }
    if (route.startsWith('/electricity-readings/')) {
      return this.prisma.electricityReading.findUnique({ where: { id } });
    }
    if (route.startsWith('/owners/')) {
      return this.prisma.owner.findUnique({ where: { id } });
    }
    if (route.startsWith('/employees/')) {
      return this.prisma.employee.findUnique({ where: { id } });
    }
    if (route.startsWith('/inventory-items/')) {
      return this.prisma.inventoryItem.findUnique({ where: { id } });
    }
    if (route.startsWith('/inventory-categories/')) {
      return this.prisma.inventoryCategory.findUnique({ where: { id } });
    }
    if (route.startsWith('/room-assets/')) {
      return this.prisma.roomAsset.findUnique({ where: { id } });
    }
    if (route.startsWith('/tenant-unit-hotel-use/')) {
      return this.prisma.tenantUnitHotelUse.findUnique({ where: { id } });
    }
    return Promise.resolve(null);
  }

  async backfillPending(row: {
    id: string;
    status: ApprovalStatus;
    oldData: Prisma.JsonValue | null;
    newData: Prisma.JsonValue | null;
    moduleName: ApprovalModuleName;
    recordId: string;
  }): Promise<Prisma.JsonValue | null> {
    if (row.oldData || row.status !== ApprovalStatus.PENDING) {
      return row.oldData;
    }
    if (!isHttpReplayPayload(row.newData)) return row.oldData;
    const snapshot = await this.capture(
      row.moduleName,
      row.recordId,
      row.newData.path,
    );
    if (!snapshot) return row.oldData;
    await this.prisma.approvalRequest.update({
      where: { id: row.id },
      data: { oldData: snapshot as Prisma.InputJsonValue },
    });
    return snapshot as Prisma.JsonValue;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, nested: unknown) => {
      if (typeof nested === 'bigint') return nested.toString();
      if (
        nested &&
        typeof nested === 'object' &&
        typeof (nested as { toNumber?: () => number }).toNumber === 'function' &&
        'd' in (nested as object)
      ) {
        return (nested as { toString: () => string }).toString();
      }
      return nested;
    }),
  ) as unknown;
}
