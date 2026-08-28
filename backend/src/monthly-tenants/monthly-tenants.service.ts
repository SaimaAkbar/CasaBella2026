import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonthlyTenantDto } from './dto/create-monthly-tenant.dto';
import { QueryMonthlyTenantsDto } from './dto/query-monthly-tenants.dto';
import { UpdateMonthlyTenantDto } from './dto/update-monthly-tenant.dto';
import { mapTenantForRole } from './monthly-tenants.mapper';

const tenancySummaryInclude = {
  orderBy: { createdAt: 'desc' as const },
  include: {
    unit: {
      select: {
        id: true,
        unitNumber: true,
        status: true,
        property: { select: { id: true, name: true } },
      },
    },
  },
};

@Injectable()
export class MonthlyTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMonthlyTenantDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const data = this.toCreateData(dto);

    if (data.cnic) {
      await this.assertCnicAvailable(data.cnic);
    }

    try {
      const tenant = await this.prisma.monthlyTenant.create({
        data,
        include: {
          tenancies: tenancySummaryInclude,
          _count: { select: { tenancies: true } },
        },
      });
      return mapTenantForRole(tenant, role);
    } catch (error) {
      this.handlePrismaError(error, 'Unable to create tenant');
    }
  }

  async findAll(query: QueryMonthlyTenantsDto, role: Role) {
    const where: Prisma.MonthlyTenantWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { cnic: { contains: term, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.monthlyTenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tenancies: tenancySummaryInclude,
        _count: { select: { tenancies: true } },
      },
    });

    return tenants.map((tenant) => mapTenantForRole(tenant, role));
  }

  async findOne(id: string, role: Role) {
    const tenant = await this.prisma.monthlyTenant.findUnique({
      where: { id },
      include: {
        tenancies: tenancySummaryInclude,
        _count: { select: { tenancies: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }

    return mapTenantForRole(tenant, role);
  }

  async update(id: string, dto: UpdateMonthlyTenantDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.ensureExists(id);

    if (role === Role.ADMIN) {
      const blockedKeys = ['cnic', 'address', 'email', 'fullName'] as const;
      const attempted = blockedKeys.some((key) => dto[key] !== undefined);

      if (attempted) {
        throw new ForbiddenException(
          'Sensitive tenant identity edits require Super Admin or a future approval workflow',
        );
      }
    }

    const data = this.toUpdateData(dto);

    if (typeof data.cnic === 'string' && data.cnic) {
      await this.assertCnicAvailable(data.cnic, id);
    }

    try {
      const tenant = await this.prisma.monthlyTenant.update({
        where: { id },
        data,
        include: {
          tenancies: tenancySummaryInclude,
          _count: { select: { tenancies: true } },
        },
      });
      return mapTenantForRole(tenant, role);
    } catch (error) {
      this.handlePrismaError(error, 'Unable to update tenant');
    }
  }

  async archive(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive tenants');
    }

    await this.ensureExists(id);

    const activeTenancy = await this.prisma.monthlyTenancy.findFirst({
      where: { tenantId: id, tenancyStatus: 'ACTIVE' },
    });

    if (activeTenancy) {
      throw new ConflictException(
        'Cannot archive a tenant with an active tenancy. End the tenancy first.',
      );
    }

    const tenant = await this.prisma.monthlyTenant.update({
      where: { id },
      data: { isActive: false },
      include: {
        tenancies: tenancySummaryInclude,
        _count: { select: { tenancies: true } },
      },
    });

    return mapTenantForRole(tenant, role);
  }

  async ensureActive(id: string) {
    const tenant = await this.prisma.monthlyTenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }

    if (!tenant.isActive) {
      throw new ConflictException('Tenant is inactive');
    }

    return tenant;
  }

  private toCreateData(dto: CreateMonthlyTenantDto) {
    return {
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      alternatePhone: this.optionalString(dto.alternatePhone),
      email: this.optionalEmail(dto.email),
      cnic: this.optionalString(dto.cnic),
      address: this.optionalString(dto.address),
      emergencyContactName: this.optionalString(dto.emergencyContactName),
      emergencyContactPhone: this.optionalString(dto.emergencyContactPhone),
      notes: this.optionalString(dto.notes),
    };
  }

  private toUpdateData(dto: UpdateMonthlyTenantDto): Prisma.MonthlyTenantUpdateInput {
    const data: Prisma.MonthlyTenantUpdateInput = {};

    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.alternatePhone !== undefined) {
      data.alternatePhone = this.optionalString(dto.alternatePhone);
    }
    if (dto.email !== undefined) data.email = this.optionalEmail(dto.email);
    if (dto.cnic !== undefined) data.cnic = this.optionalString(dto.cnic);
    if (dto.address !== undefined) data.address = this.optionalString(dto.address);
    if (dto.emergencyContactName !== undefined) {
      data.emergencyContactName = this.optionalString(dto.emergencyContactName);
    }
    if (dto.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone = this.optionalString(dto.emergencyContactPhone);
    }
    if (dto.notes !== undefined) data.notes = this.optionalString(dto.notes);

    return data;
  }

  private optionalString(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private optionalEmail(value?: string | null): string | null {
    const trimmed = this.optionalString(value);
    return trimmed ? trimmed.toLowerCase() : null;
  }

  private async assertCnicAvailable(cnic: string, excludeId?: string) {
    const existing = await this.prisma.monthlyTenant.findFirst({
      where: {
        cnic,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A tenant with this CNIC already exists.');
    }
  }

  private async ensureExists(id: string) {
    const tenant = await this.prisma.monthlyTenant.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }
  }

  private handlePrismaError(error: unknown, fallback: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A tenant with this CNIC already exists.');
    }

    throw new InternalServerErrorException(fallback);
  }
}
