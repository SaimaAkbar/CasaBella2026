import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseCategoryDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot create expense categories');
    }

    try {
      return await this.prisma.expenseCategory.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isSystem: false,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleUnique(error);
    }
  }

  async findAll(includeInactive = false) {
    return this.prisma.expenseCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Expense category "${id}" not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateExpenseCategoryDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const existing = await this.findOne(id);

    if (existing.isSystem && role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can rename system expense categories',
      );
    }

    if (existing.isSystem && dto.name && dto.name.trim() !== existing.name) {
      // Spec: Super Admin may rename non-system categories.
      // System categories: allow description update; block rename for safety.
      if (role === Role.SUPER_ADMIN && dto.name.trim() !== existing.name) {
        throw new ForbiddenException(
          'System categories cannot be renamed. Create a custom category instead.',
        );
      }
    }

    try {
      return await this.prisma.expenseCategory.update({
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
      throw new ForbiddenException(
        'Only Super Admin can archive expense categories',
      );
    }

    const existing = await this.findOne(id);

    if (existing.isSystem) {
      throw new ForbiddenException(
        'System categories cannot be permanently deleted or archived',
      );
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async ensureActive(id: string) {
    const category = await this.findOne(id);
    if (!category.isActive) {
      throw new ConflictException('Expense category is inactive');
    }
    return category;
  }

  async findByName(name: string) {
    return this.prisma.expenseCategory.findUnique({
      where: { name },
    });
  }

  /** Find by exact name (case-insensitive), or create a non-system category. */
  async findOrCreateByName(name: string, role: Role) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ConflictException('Expense name is required');
    }

    const existing = await this.prisma.expenseCategory.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      if (!existing.isActive) {
        throw new ConflictException(
          `Expense category "${existing.name}" is inactive`,
        );
      }
      return existing;
    }

    return this.create({ name: trimmed }, role);
  }

  private handleUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('An expense category with this name already exists');
    }
    throw error;
  }
}
