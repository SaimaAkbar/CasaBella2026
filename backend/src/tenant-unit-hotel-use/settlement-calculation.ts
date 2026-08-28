import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role, SettlementType } from '../../generated/prisma/client';

export type SettlementCalculationInput = {
  settlementType: SettlementType;
  totalGuestCharge: number | string | Prisma.Decimal;
  tenantShare?: number | string | Prisma.Decimal | null;
  organizationShare?: number | string | Prisma.Decimal | null;
  tenantSharePercentage?: number | string | Prisma.Decimal | null;
  organizationSharePercentage?: number | string | Prisma.Decimal | null;
  reason?: string | null;
  role: Role;
};

export type SettlementCalculationResult = {
  totalGuestCharge: Prisma.Decimal;
  tenantShare: Prisma.Decimal;
  organizationShare: Prisma.Decimal;
  tenantSharePercentage: Prisma.Decimal | null;
  organizationSharePercentage: Prisma.Decimal | null;
  rentCreditAmount: Prisma.Decimal;
  reason: string | null;
};

function toDec(
  value: number | string | Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(value);
}

function money2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Backend-authoritative settlement share calculation.
 * Never trust frontend-computed organization/tenant totals.
 */
export function calculateSettlementShares(
  input: SettlementCalculationInput,
): SettlementCalculationResult {
  const totalGuestCharge = money2(toDec(input.totalGuestCharge));

  if (totalGuestCharge.lessThan(0)) {
    throw new BadRequestException('totalGuestCharge cannot be negative');
  }

  switch (input.settlementType) {
    case SettlementType.FIXED_AMOUNT: {
      if (
        input.tenantShare === null ||
        input.tenantShare === undefined ||
        input.tenantShare === ''
      ) {
        throw new BadRequestException(
          'tenantShare is required for FIXED_AMOUNT settlement',
        );
      }
      const tenantShare = money2(toDec(input.tenantShare));
      if (tenantShare.lessThan(0)) {
        throw new BadRequestException('tenantShare cannot be negative');
      }
      if (tenantShare.greaterThan(totalGuestCharge)) {
        throw new BadRequestException(
          'tenantShare cannot exceed totalGuestCharge',
        );
      }
      const organizationShare = money2(totalGuestCharge.minus(tenantShare));
      return {
        totalGuestCharge,
        tenantShare,
        organizationShare,
        tenantSharePercentage: null,
        organizationSharePercentage: null,
        rentCreditAmount: new Prisma.Decimal(0),
        reason: input.reason?.trim() || null,
      };
    }

    case SettlementType.PERCENTAGE: {
      const tenantPct = money2(toDec(input.tenantSharePercentage));
      const orgPct = money2(toDec(input.organizationSharePercentage));
      if (tenantPct.lessThan(0) || orgPct.lessThan(0)) {
        throw new BadRequestException('Share percentages cannot be negative');
      }
      if (!tenantPct.plus(orgPct).equals(100)) {
        throw new BadRequestException(
          'tenantSharePercentage and organizationSharePercentage must total 100',
        );
      }
      const tenantShare = money2(totalGuestCharge.mul(tenantPct).div(100));
      const organizationShare = money2(totalGuestCharge.minus(tenantShare));
      return {
        totalGuestCharge,
        tenantShare,
        organizationShare,
        tenantSharePercentage: tenantPct,
        organizationSharePercentage: orgPct,
        rentCreditAmount: new Prisma.Decimal(0),
        reason: input.reason?.trim() || null,
      };
    }

    case SettlementType.NO_TENANT_SHARE: {
      return {
        totalGuestCharge,
        tenantShare: new Prisma.Decimal(0),
        organizationShare: totalGuestCharge,
        tenantSharePercentage: null,
        organizationSharePercentage: null,
        rentCreditAmount: new Prisma.Decimal(0),
        reason: input.reason?.trim() || null,
      };
    }

    case SettlementType.RENT_CREDIT: {
      if (
        input.tenantShare === null ||
        input.tenantShare === undefined ||
        input.tenantShare === ''
      ) {
        throw new BadRequestException(
          'tenantShare is required for RENT_CREDIT settlement',
        );
      }
      const tenantShare = money2(toDec(input.tenantShare));
      if (tenantShare.lessThan(0)) {
        throw new BadRequestException('tenantShare cannot be negative');
      }
      if (tenantShare.greaterThan(totalGuestCharge)) {
        throw new BadRequestException(
          'tenantShare cannot exceed totalGuestCharge',
        );
      }
      const organizationShare = money2(totalGuestCharge.minus(tenantShare));
      return {
        totalGuestCharge,
        tenantShare,
        organizationShare,
        tenantSharePercentage: null,
        organizationSharePercentage: null,
        rentCreditAmount: tenantShare,
        reason: input.reason?.trim() || null,
      };
    }

    case SettlementType.CUSTOM: {
      if (input.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'CUSTOM settlement is restricted to Super Admin',
        );
      }
      const reason = input.reason?.trim();
      if (!reason) {
        throw new BadRequestException(
          'reason is required for CUSTOM settlement',
        );
      }
      if (
        input.tenantShare === null ||
        input.tenantShare === undefined ||
        input.tenantShare === '' ||
        input.organizationShare === null ||
        input.organizationShare === undefined ||
        input.organizationShare === ''
      ) {
        throw new BadRequestException(
          'tenantShare and organizationShare are required for CUSTOM settlement',
        );
      }
      const tenantShare = money2(toDec(input.tenantShare));
      const organizationShare = money2(toDec(input.organizationShare));
      if (tenantShare.lessThan(0) || organizationShare.lessThan(0)) {
        throw new BadRequestException('Shares cannot be negative');
      }
      if (!tenantShare.plus(organizationShare).equals(totalGuestCharge)) {
        throw new BadRequestException(
          'tenantShare + organizationShare must equal totalGuestCharge',
        );
      }
      return {
        totalGuestCharge,
        tenantShare,
        organizationShare,
        tenantSharePercentage: null,
        organizationSharePercentage: null,
        rentCreditAmount: new Prisma.Decimal(0),
        reason,
      };
    }

    default: {
      const _exhaustive: never = input.settlementType;
      throw new BadRequestException(
        `Unsupported settlement type: ${String(_exhaustive)}`,
      );
    }
  }
}

export function serializeSettlementMoney(value: Prisma.Decimal): string {
  return money2(value).toFixed(2);
}
