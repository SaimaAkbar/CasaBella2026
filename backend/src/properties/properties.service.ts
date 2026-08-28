import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

const ADMIN_PROPERTY_UPDATE_FIELDS = [
  'name',
  'address',
  'city',
  'description',
] as const;

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPropertyDto: CreatePropertyDto) {
    try {
      return await this.prisma.property.create({
        data: createPropertyDto,
      });
    } catch {
      throw new InternalServerErrorException('Unable to create property');
    }
  }

  async findAll() {
    return this.prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { units: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        units: {
          orderBy: { unitNumber: 'asc' },
        },
      },
    });

    if (!property) {
      throw new NotFoundException(`Property with id "${id}" not found`);
    }

    return {
      ...property,
      units: property.units.map((unit) => this.serializeUnit(unit)),
    };
  }

  async update(
    id: string,
    updatePropertyDto: UpdatePropertyDto,
    role: Role,
  ) {
    await this.ensureExists(id);

    const data = this.pickUpdateFields(updatePropertyDto, role);

    try {
      return await this.prisma.property.update({
        where: { id },
        data,
      });
    } catch {
      throw new InternalServerErrorException('Unable to update property');
    }
  }

  async archive(id: string) {
    await this.ensureExists(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.unit.updateMany({
          where: { propertyId: id, isActive: true },
          data: { isActive: false },
        });

        return tx.property.update({
          where: { id },
          data: { isActive: false },
        });
      });
    } catch {
      throw new InternalServerErrorException('Unable to archive property');
    }
  }

  async ensureExists(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!property) {
      throw new NotFoundException(`Property with id "${id}" not found`);
    }

    return property;
  }

  private pickUpdateFields(updatePropertyDto: UpdatePropertyDto, role: Role) {
    if (role === Role.SUPER_ADMIN) {
      return updatePropertyDto;
    }

    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const data: Prisma.PropertyUpdateInput = {};

    for (const field of ADMIN_PROPERTY_UPDATE_FIELDS) {
      if (updatePropertyDto[field] !== undefined) {
        data[field] = updatePropertyDto[field];
      }
    }

    if (Object.keys(data).length === 0) {
      throw new ForbiddenException(
        'Admins can only update name, address, city, and description',
      );
    }

    return data;
  }

  private serializeUnit(unit: {
    monthlyRent: Prisma.Decimal | null;
    dailyRate: Prisma.Decimal | null;
    hourlyRate: Prisma.Decimal | null;
  } & Record<string, unknown>) {
    return {
      ...unit,
      monthlyRent: unit.monthlyRent?.toString() ?? null,
      dailyRate: unit.dailyRate?.toString() ?? null,
      hourlyRate: unit.hourlyRate?.toString() ?? null,
    };
  }
}
