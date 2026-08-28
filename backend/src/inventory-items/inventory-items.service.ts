import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { QueryInventoryItemsDto } from './dto/query-inventory-items.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { mapInventoryItem } from './inventory-items.mapper';

@Injectable()
export class InventoryItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInventoryItemDto, role: Role, userId: string) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const category = await this.prisma.inventoryCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || !category.isActive) {
      throw new NotFoundException('Inventory category not found');
    }

    const openingQty = new Prisma.Decimal(dto.openingQuantity ?? 0);
    const openingCost = new Prisma.Decimal(dto.openingUnitCost ?? 0);

    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const itemCode = await this.nextItemCode(tx);
        const created = await tx.inventoryItem.create({
          data: {
            itemCode,
            categoryId: dto.categoryId,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            unitOfMeasure: dto.unitOfMeasure.trim(),
            currentQuantity: openingQty,
            averageUnitCost: openingQty.greaterThan(0) ? openingCost : 0,
            reorderLevel: new Prisma.Decimal(dto.reorderLevel ?? 0),
            supplierName: dto.supplierName?.trim(),
            isConsumable: dto.isConsumable ?? true,
            isActive: true,
          },
          include: { category: { select: { id: true, name: true } } },
        });

        if (openingQty.greaterThan(0)) {
          const movementNumber = await this.nextMovementNumber(tx);
          await tx.inventoryMovement.create({
            data: {
              movementNumber,
              itemId: created.id,
              movementType: InventoryMovementType.PURCHASE,
              quantity: openingQty,
              unitCost: openingCost,
              totalCost: openingQty.mul(openingCost).toDecimalPlaces(2),
              movementDate: new Date(),
              notes: 'Opening stock',
              createdByUserId: userId,
              approvedByUserId: userId,
              approvedAt: new Date(),
            },
          });
        }

        return created;
      });

      return mapInventoryItem(item, role);
    } catch (error) {
      this.handleUnique(error);
    }
  }

  async findAll(query: QueryInventoryItemsDto, role: Role) {
    const where: Prisma.InventoryItemWhereInput = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isConsumable !== undefined) where.isConsumable = query.isConsumable;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    else where.isActive = true;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { itemCode: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { supplierName: { contains: term, mode: 'insensitive' } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    let items = await this.prisma.inventoryItem.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });

    if (query.lowStock) {
      items = items.filter((item) =>
        item.currentQuantity.lessThanOrEqualTo(item.reorderLevel),
      );
    }

    return items.map((item) => mapInventoryItem(item, role));
  }

  async findOne(id: string, role: Role) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return mapInventoryItem(item, role);
  }

  async update(id: string, dto: UpdateInventoryItemDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }
    await this.findOne(id, role);

    if (dto.openingQuantity !== undefined || dto.openingUnitCost !== undefined) {
      throw new BadRequestException(
        'Opening stock can only be set on create. Use purchase/adjustment movements.',
      );
    }

    if (dto.categoryId) {
      const category = await this.prisma.inventoryCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category || !category.isActive) {
        throw new NotFoundException('Inventory category not found');
      }
    }

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        categoryId: dto.categoryId,
        description: dto.description?.trim(),
        unitOfMeasure: dto.unitOfMeasure?.trim(),
        reorderLevel:
          dto.reorderLevel === undefined
            ? undefined
            : new Prisma.Decimal(dto.reorderLevel),
        supplierName: dto.supplierName?.trim(),
        isConsumable: dto.isConsumable,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return mapInventoryItem(item, role);
  }

  async archive(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive inventory items');
    }
    await this.findOne(id, role);
    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false },
      include: { category: { select: { id: true, name: true } } },
    });
    return mapInventoryItem(item, role);
  }

  async getSummary(role: Role) {
    const [totalItems, activeItems, allItems, purchased, issued, inventoryExpense] =
      await Promise.all([
        this.prisma.inventoryItem.count(),
        this.prisma.inventoryItem.count({ where: { isActive: true } }),
        this.prisma.inventoryItem.findMany({
          where: { isActive: true },
          select: {
            currentQuantity: true,
            reorderLevel: true,
            averageUnitCost: true,
          },
        }),
        this.sumMovementsThisMonth(InventoryMovementType.PURCHASE),
        this.sumMovementsThisMonth(InventoryMovementType.ISSUE),
        this.sumInventoryExpenseThisMonth(),
      ]);

    let totalQty = new Prisma.Decimal(0);
    let lowStock = 0;
    for (const item of allItems) {
      totalQty = totalQty.plus(item.currentQuantity);
      if (item.currentQuantity.lessThanOrEqualTo(item.reorderLevel)) {
        lowStock += 1;
      }
    }

    const roomAssets = await this.prisma.roomAsset.count({
      where: { isActive: true },
    });
    const damagedAssets = await this.prisma.roomAsset.count({
      where: {
        isActive: true,
        condition: { in: ['DAMAGED', 'MISSING'] },
      },
    });

    const summary: Record<string, string | number> = {
      totalInventoryItems: totalItems,
      activeInventoryItems: activeItems,
      totalStockQuantity: totalQty.toString(),
      lowStockItems: lowStock,
      stockPurchasedThisMonth: purchased,
      stockIssuedThisMonth: issued,
      roomAssets,
      damagedAssets,
    };

    if (role !== Role.RECEPTIONIST) {
      summary.inventoryExpenseThisMonth = inventoryExpense;
    }

    return summary;
  }

  private async sumMovementsThisMonth(type: InventoryMovementType) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const agg = await this.prisma.inventoryMovement.aggregate({
      where: {
        movementType: type,
        movementDate: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    });
    return (agg._sum.quantity ?? new Prisma.Decimal(0)).toString();
  }

  private async sumInventoryExpenseThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const agg = await this.prisma.expense.aggregate({
      where: {
        isActive: true,
        expenseDate: { gte: start, lte: end },
        category: { name: { in: ['Inventory', 'Repair'] } },
      },
      _sum: { amount: true },
    });
    return (agg._sum.amount ?? new Prisma.Decimal(0)).toString();
  }

  private async nextItemCode(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES ('inventory_item_seq', '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;
    return `INV-${String(rows[0]?.value ?? '1').padStart(4, '0')}`;
  }

  private async nextMovementNumber(tx: Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const dateKey = `${yyyy}${mm}${dd}`;
    const key = `inventory_movement_seq_${dateKey}`;
    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES (${key}, '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;
    return `MOV-${dateKey}-${String(rows[0]?.value ?? '1').padStart(4, '0')}`;
  }

  private handleUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Inventory item code conflict. Please retry.');
    }
    throw error;
  }
}
