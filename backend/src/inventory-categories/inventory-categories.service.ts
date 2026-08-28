import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';

@Injectable()
export class InventoryCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInventoryCategoryDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }
    try {
      return await this.prisma.inventoryCategory.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isActive: true,
        },
      });
    } catch (error) {
      this.handleUnique(error);
    }
  }

  async findAll(includeInactive = false) {
    return this.prisma.inventoryCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.inventoryCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Inventory category not found');
    }
    return category;
  }

  async update(id: string, dto: UpdateInventoryCategoryDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }
    await this.findOne(id);
    try {
      return await this.prisma.inventoryCategory.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      this.handleUnique(error);
    }
  }

  async archive(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive categories');
    }
    await this.findOne(id);
    return this.prisma.inventoryCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private handleUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'An inventory category with this name already exists',
      );
    }
    throw error;
  }
}
