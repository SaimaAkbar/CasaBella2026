import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, Unit } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { QueryUnitsDto } from './dto/query-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

const ADMIN_UNIT_UPDATE_FIELDS = [
  'unitNumber',
  'floor',
  'bedrooms',
  'monthlyRent',
  'dailyRate',
  'hourlyRate',
  'status',
  'notes',
] as const;

type SerializedUnit = Omit<Unit, 'monthlyRent' | 'dailyRate' | 'hourlyRate'> & {
  monthlyRent: string | null;
  dailyRate: string | null;
  hourlyRate: string | null;
};

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
  ) {}

  async create(createUnitDto: CreateUnitDto): Promise<SerializedUnit> {
    const property = await this.propertiesService.ensureExists(
      createUnitDto.propertyId,
    );

    if (!property.isActive) {
      throw new BadRequestException(
        'Cannot create a unit under an inactive property',
      );
    }

    try {
      const unit = await this.prisma.unit.create({
        data: {
          propertyId: createUnitDto.propertyId,
          unitNumber: createUnitDto.unitNumber,
          unitType: createUnitDto.unitType,
          floor: createUnitDto.floor,
          bedrooms: createUnitDto.bedrooms,
          monthlyRent: this.toDecimal(createUnitDto.monthlyRent),
          dailyRate: this.toDecimal(createUnitDto.dailyRate),
          hourlyRate: this.toDecimal(createUnitDto.hourlyRate),
          status: createUnitDto.status,
          notes: createUnitDto.notes,
          displayName: createUnitDto.displayName?.trim() || null,
          description: createUnitDto.description?.trim() || null,
          maxGuests: createUnitDto.maxGuests,
          bedConfiguration: createUnitDto.bedConfiguration?.trim() || null,
          ...(createUnitDto.amenitiesText !== undefined
            ? { amenities: this.parseAmenities(createUnitDto.amenitiesText) }
            : {}),
          ...(createUnitDto.imageUrl !== undefined
            ? { imageUrls: this.parseImageUrls(createUnitDto.imageUrl) }
            : {}),
          isActive: createUnitDto.isActive,
        },
      });

      return this.serializeUnit(unit);
    } catch (error) {
      this.handlePrismaError(error, 'Unable to create unit');
    }
  }

  async findAll(query: QueryUnitsDto): Promise<SerializedUnit[]> {
    const where: Prisma.UnitWhereInput = {};

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }

    if (query.unitType) {
      where.unitType = query.unitType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search?.trim()) {
      where.unitNumber = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const units = await this.prisma.unit.findMany({
      where,
      orderBy: [{ propertyId: 'asc' }, { unitNumber: 'asc' }],
      include: {
        property: {
          select: {
            id: true,
            name: true,
            city: true,
            isActive: true,
          },
        },
      },
    });

    return units.map((unit) => this.serializeUnit(unit));
  }

  async findOne(id: string): Promise<SerializedUnit> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            isActive: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with id "${id}" not found`);
    }

    return this.serializeUnit(unit);
  }

  async update(
    id: string,
    updateUnitDto: UpdateUnitDto,
    role: Role,
  ): Promise<SerializedUnit> {
    await this.findOne(id);

    const data = await this.buildUpdateData(updateUnitDto, role);

    try {
      const unit = await this.prisma.unit.update({
        where: { id },
        data,
      });

      return this.serializeUnit(unit);
    } catch (error) {
      this.handlePrismaError(error, 'Unable to update unit');
    }
  }

  async archive(id: string): Promise<SerializedUnit> {
    await this.findOne(id);

    try {
      const unit = await this.prisma.unit.update({
        where: { id },
        data: { isActive: false },
      });

      return this.serializeUnit(unit);
    } catch {
      throw new InternalServerErrorException('Unable to archive unit');
    }
  }

  private async buildUpdateData(updateUnitDto: UpdateUnitDto, role: Role) {
    if (role === Role.SUPER_ADMIN) {
      if (updateUnitDto.propertyId) {
        const property = await this.propertiesService.ensureExists(
          updateUnitDto.propertyId,
        );

        if (!property.isActive) {
          throw new BadRequestException(
            'Cannot move a unit to an inactive property',
          );
        }
      }

      return {
        propertyId: updateUnitDto.propertyId,
        unitNumber: updateUnitDto.unitNumber,
        unitType: updateUnitDto.unitType,
        floor: updateUnitDto.floor,
        bedrooms: updateUnitDto.bedrooms,
        monthlyRent:
          updateUnitDto.monthlyRent !== undefined
            ? this.toDecimal(updateUnitDto.monthlyRent)
            : undefined,
        dailyRate:
          updateUnitDto.dailyRate !== undefined
            ? this.toDecimal(updateUnitDto.dailyRate)
            : undefined,
        hourlyRate:
          updateUnitDto.hourlyRate !== undefined
            ? this.toDecimal(updateUnitDto.hourlyRate)
            : undefined,
        status: updateUnitDto.status,
        notes: updateUnitDto.notes,
        displayName:
          updateUnitDto.displayName !== undefined
            ? updateUnitDto.displayName.trim() || null
            : undefined,
        description:
          updateUnitDto.description !== undefined
            ? updateUnitDto.description.trim() || null
            : undefined,
        maxGuests: updateUnitDto.maxGuests,
        bedConfiguration:
          updateUnitDto.bedConfiguration !== undefined
            ? updateUnitDto.bedConfiguration.trim() || null
            : undefined,
        amenities:
          updateUnitDto.amenitiesText !== undefined
            ? this.parseAmenities(updateUnitDto.amenitiesText)
            : undefined,
        imageUrls:
          updateUnitDto.imageUrl !== undefined
            ? this.parseImageUrls(updateUnitDto.imageUrl)
            : undefined,
        isActive: updateUnitDto.isActive,
      };
    }

    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const data: Prisma.UnitUpdateInput = {};

    for (const field of ADMIN_UNIT_UPDATE_FIELDS) {
      if (updateUnitDto[field] === undefined) {
        continue;
      }

      if (
        field === 'monthlyRent' ||
        field === 'dailyRate' ||
        field === 'hourlyRate'
      ) {
        data[field] = this.toDecimal(updateUnitDto[field]);
      } else {
        data[field] = updateUnitDto[field];
      }
    }

    if (Object.keys(data).length === 0) {
      // Still allow website marketing fields for Admin.
    }

    if (updateUnitDto.displayName !== undefined) {
      data.displayName = updateUnitDto.displayName.trim() || null;
    }
    if (updateUnitDto.description !== undefined) {
      data.description = updateUnitDto.description.trim() || null;
    }
    if (updateUnitDto.maxGuests !== undefined) {
      data.maxGuests = updateUnitDto.maxGuests;
    }
    if (updateUnitDto.bedConfiguration !== undefined) {
      data.bedConfiguration = updateUnitDto.bedConfiguration.trim() || null;
    }
    if (updateUnitDto.amenitiesText !== undefined) {
      data.amenities = this.parseAmenities(updateUnitDto.amenitiesText);
    }
    if (updateUnitDto.imageUrl !== undefined) {
      data.imageUrls = this.parseImageUrls(updateUnitDto.imageUrl);
    }

    if (Object.keys(data).length === 0) {
      throw new ForbiddenException(
        'Admins can only update operational unit fields',
      );
    }

    return data;
  }

  private toDecimal(value?: number): Prisma.Decimal | undefined {
    if (value === undefined) {
      return undefined;
    }

    return new Prisma.Decimal(value);
  }

  private parseAmenities(text: string): string[] {
    return text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private parseImageUrls(imageUrl: string): string[] {
    const trimmed = imageUrl.trim();
    return trimmed ? [trimmed] : [];
  }

  private serializeUnit<T extends Unit>(unit: T): SerializedUnit & T {
    return {
      ...unit,
      monthlyRent: unit.monthlyRent?.toString() ?? null,
      dailyRate: unit.dailyRate?.toString() ?? null,
      hourlyRate: unit.hourlyRate?.toString() ?? null,
    };
  }

  private handlePrismaError(error: unknown, fallbackMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Unit number already exists for this property',
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException('Invalid property reference');
    }

    throw new InternalServerErrorException(fallbackMessage);
  }
}
