import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { QueryGuestsDto } from './dto/query-guests.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { mapGuestForRole } from './guests.mapper';

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGuestDto, role: Role) {
    this.assertCanWrite(role);

    try {
      const guest = await this.prisma.guest.create({ data: dto });
      return mapGuestForRole(guest, role);
    } catch (error) {
      this.handlePrismaError(error, 'Unable to create guest');
    }
  }

  async findAll(query: QueryGuestsDto, role: Role) {
    const where: Prisma.GuestWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { cnicOrPassport: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const guests = await this.prisma.guest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return guests.map((guest) => mapGuestForRole(guest, role));
  }

  async findOne(id: string, role: Role) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            bookingNumber: true,
            bookingStatus: true,
            checkInDateTime: true,
            checkOutDateTime: true,
            unit: {
              select: {
                id: true,
                unitNumber: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!guest) {
      throw new NotFoundException(`Guest with id "${id}" not found`);
    }

    return {
      ...mapGuestForRole(guest, role),
      bookings: guest.bookings,
    };
  }

  async update(id: string, dto: UpdateGuestDto, role: Role) {
    this.assertCanWrite(role);
    await this.ensureExists(id);

    if (role === Role.ADMIN) {
      const sensitive = ['cnicOrPassport', 'fullName', 'address'] as const;
      if (sensitive.some((key) => dto[key] !== undefined)) {
        throw new ForbiddenException(
          'Sensitive guest identity edits require Super Admin or a future approval workflow',
        );
      }
    }

    try {
      const guest = await this.prisma.guest.update({
        where: { id },
        data: dto,
      });
      return mapGuestForRole(guest, role);
    } catch (error) {
      this.handlePrismaError(error, 'Unable to update guest');
    }
  }

  async archive(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive guests');
    }

    await this.ensureExists(id);

    const activeStay = await this.prisma.booking.findFirst({
      where: {
        guestId: id,
        bookingStatus: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
          ],
        },
      },
    });

    if (activeStay) {
      throw new ConflictException(
        'Cannot archive a guest with an active or upcoming booking',
      );
    }

    const guest = await this.prisma.guest.update({
      where: { id },
      data: { isActive: false },
    });

    return mapGuestForRole(guest, role);
  }

  async ensureActive(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });

    if (!guest) {
      throw new NotFoundException(`Guest with id "${id}" not found`);
    }

    if (!guest.isActive) {
      throw new ConflictException('Guest is inactive');
    }

    return guest;
  }

  /**
   * Match guest for online checkout: cnicOrPassport (exact trim) → phone → email.
   * Updates non-empty fields on match; creates when none found. No role check.
   */
  async findOrCreateForOnline(dto: CreateGuestDto) {
    const cnic = dto.cnicOrPassport?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    const email = dto.email?.trim() || undefined;

    let guest =
      (cnic
        ? await this.prisma.guest.findFirst({
            where: { cnicOrPassport: cnic },
          })
        : null) ??
      (phone
        ? await this.prisma.guest.findFirst({ where: { phone } })
        : null) ??
      (email
        ? await this.prisma.guest.findFirst({ where: { email } })
        : null);

    const patch: Prisma.GuestUpdateInput = {};
    const assignIfPresent = (
      key: keyof CreateGuestDto,
      value: string | undefined,
    ) => {
      if (value !== undefined && value !== '') {
        (patch as Record<string, string>)[key] = value;
      }
    };

    assignIfPresent('fullName', dto.fullName?.trim());
    assignIfPresent('phone', phone);
    assignIfPresent('alternatePhone', dto.alternatePhone?.trim());
    assignIfPresent('email', email);
    assignIfPresent('cnicOrPassport', cnic);
    assignIfPresent('address', dto.address?.trim());
    assignIfPresent('nationality', dto.nationality?.trim());
    assignIfPresent('emergencyContactName', dto.emergencyContactName?.trim());
    assignIfPresent('emergencyContactPhone', dto.emergencyContactPhone?.trim());
    assignIfPresent('vehicleNumber', dto.vehicleNumber?.trim());
    assignIfPresent('notes', dto.notes?.trim());

    try {
      if (guest) {
        if (Object.keys(patch).length > 0) {
          guest = await this.prisma.guest.update({
            where: { id: guest.id },
            data: { ...patch, isActive: true },
          });
        } else if (!guest.isActive) {
          guest = await this.prisma.guest.update({
            where: { id: guest.id },
            data: { isActive: true },
          });
        }
        return guest;
      }

      if (!dto.fullName?.trim() || !phone) {
        throw new BadRequestException(
          'fullName and phone are required to create a guest',
        );
      }

      return await this.prisma.guest.create({
        data: {
          fullName: dto.fullName.trim(),
          phone,
          alternatePhone: dto.alternatePhone?.trim() || null,
          email: email || null,
          cnicOrPassport: cnic || null,
          address: dto.address?.trim() || null,
          nationality: dto.nationality?.trim() || null,
          emergencyContactName: dto.emergencyContactName?.trim() || null,
          emergencyContactPhone: dto.emergencyContactPhone?.trim() || null,
          vehicleNumber: dto.vehicleNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          isActive: true,
        },
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.handlePrismaError(error, 'Unable to find or create guest');
    }
  }

  private assertCanWrite(role: Role) {
    if (
      role !== Role.SUPER_ADMIN &&
      role !== Role.ADMIN &&
      role !== Role.RECEPTIONIST
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async ensureExists(id: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!guest) {
      throw new NotFoundException(`Guest with id "${id}" not found`);
    }
  }

  private handlePrismaError(error: unknown, fallback: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A guest with this unique field already exists');
    }

    throw new InternalServerErrorException(fallback);
  }
}
