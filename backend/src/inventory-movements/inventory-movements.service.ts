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
import { ExpensesService } from '../expenses/expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustMovementDto,
  DamageOrLossMovementDto,
  IssueMovementDto,
  PurchaseMovementDto,
  QueryInventoryMovementsDto,
  ReturnMovementDto,
  TransferMovementDto,
} from './dto/movement.dto';
import { mapInventoryMovement } from './inventory-movements.mapper';

const movementInclude = {
  item: {
    select: {
      id: true,
      itemCode: true,
      name: true,
      unitOfMeasure: true,
    },
  },
  sourceProperty: { select: { id: true, name: true } },
  sourceUnit: { select: { id: true, unitNumber: true } },
  destinationProperty: { select: { id: true, name: true } },
  destinationUnit: { select: { id: true, unitNumber: true } },
  expense: { select: { id: true, expenseNumber: true } },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryMovementInclude;

@Injectable()
export class InventoryMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensesService: ExpensesService,
  ) {}

  async purchase(dto: PurchaseMovementDto, role: Role, userId: string) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot record purchases');
    }
    const qty = this.positiveQty(dto.quantity);
    const unitCost = new Prisma.Decimal(dto.unitCost);
    const totalCost = qty.mul(unitCost).toDecimalPlaces(2);

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, dto.itemId);
      const newQty = item.currentQuantity.plus(qty);
      const newAvg = this.weightedAverage(
        item.currentQuantity,
        item.averageUnitCost,
        qty,
        unitCost,
      );

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentQuantity: newQty,
          averageUnitCost: newAvg,
          supplierName: dto.supplierName?.trim() || item.supplierName,
        },
      });

      return tx.inventoryMovement.create({
        data: {
          movementNumber: await this.nextMovementNumber(tx),
          itemId: item.id,
          movementType: InventoryMovementType.PURCHASE,
          quantity: qty,
          unitCost,
          totalCost,
          movementDate: new Date(dto.movementDate),
          destinationPropertyId: dto.propertyId,
          referenceNumber: dto.referenceNumber?.trim(),
          notes: dto.notes?.trim(),
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: movementInclude,
      });
    });

    return mapInventoryMovement(movement, role);
  }

  async issue(dto: IssueMovementDto, role: Role, userId: string) {
    if (
      role === Role.RECEPTIONIST &&
      (!dto.destinationUnitId || dto.employeeId)
    ) {
      // Receptionist may issue guest supplies to a room only
      if (!dto.destinationUnitId) {
        throw new ForbiddenException(
          'Receptionist may only issue items to a room/unit',
        );
      }
    }

    const qty = this.positiveQty(dto.quantity);

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, dto.itemId);
      if (item.currentQuantity.lessThan(qty)) {
        throw new ConflictException('Insufficient stock for this issue');
      }

      let propertyId = dto.destinationPropertyId ?? null;
      let unitId = dto.destinationUnitId ?? null;

      if (dto.destinationUnitId) {
        const unit = await tx.unit.findUnique({
          where: { id: dto.destinationUnitId },
        });
        if (!unit || !unit.isActive) {
          throw new NotFoundException('Unit not found');
        }
        if (
          dto.destinationPropertyId &&
          unit.propertyId !== dto.destinationPropertyId
        ) {
          throw new BadRequestException(
            'Unit does not belong to the selected property',
          );
        }
        propertyId = unit.propertyId;
        unitId = unit.id;
      }

      if (dto.bookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: dto.bookingId },
          include: { unit: true },
        });
        if (!booking) throw new NotFoundException('Booking not found');
        propertyId = booking.unit.propertyId;
        unitId = booking.unitId;
      }

      if (dto.monthlyTenancyId) {
        const tenancy = await tx.monthlyTenancy.findUnique({
          where: { id: dto.monthlyTenancyId },
          include: { unit: true },
        });
        if (!tenancy) throw new NotFoundException('Monthly tenancy not found');
        propertyId = tenancy.unit.propertyId;
        unitId = tenancy.unitId;
      }

      const unitCost = item.averageUnitCost;
      const totalCost = qty.mul(unitCost).toDecimalPlaces(2);

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentQuantity: item.currentQuantity.minus(qty) },
      });

      let expenseId: string | undefined;
      if (item.isConsumable && unitId && propertyId && totalCost.greaterThan(0)) {
        const unit = await tx.unit.findUnique({ where: { id: unitId } });
        const expense = await this.expensesService.createLinkedInventoryExpense(
          tx,
          {
            amount: totalCost,
            expenseDate: new Date(dto.movementDate),
            userId,
            description: `${qty.toString()} x ${item.name} issued to Room ${unit?.unitNumber ?? unitId}`,
            categoryName: 'Inventory',
            propertyId,
            unitId,
            bookingId: dto.bookingId,
            monthlyTenancyId: dto.monthlyTenancyId,
            employeeId: dto.employeeId,
            metadata: {
              inventoryItemId: item.id,
              itemCode: item.itemCode,
              quantity: qty.toString(),
              unitCost: unitCost.toString(),
            },
            markPaid: true,
          },
        );
        expenseId = expense.id;
      }

      return tx.inventoryMovement.create({
        data: {
          movementNumber: await this.nextMovementNumber(tx),
          itemId: item.id,
          movementType: InventoryMovementType.ISSUE,
          quantity: qty,
          unitCost,
          totalCost,
          movementDate: new Date(dto.movementDate),
          destinationPropertyId: propertyId,
          destinationUnitId: unitId,
          bookingId: dto.bookingId,
          monthlyTenancyId: dto.monthlyTenancyId,
          employeeId: dto.employeeId,
          expenseId,
          reason: dto.reason?.trim(),
          notes: dto.notes?.trim(),
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: movementInclude,
      });
    });

    return mapInventoryMovement(movement, role);
  }

  async returnStock(dto: ReturnMovementDto, role: Role, userId: string) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot record returns');
    }
    const qty = this.positiveQty(dto.quantity);

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, dto.itemId);
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentQuantity: item.currentQuantity.plus(qty) },
      });

      return tx.inventoryMovement.create({
        data: {
          movementNumber: await this.nextMovementNumber(tx),
          itemId: item.id,
          movementType: InventoryMovementType.RETURN,
          quantity: qty,
          unitCost: item.averageUnitCost,
          totalCost: qty.mul(item.averageUnitCost).toDecimalPlaces(2),
          movementDate: new Date(dto.movementDate),
          sourcePropertyId: dto.sourcePropertyId,
          sourceUnitId: dto.sourceUnitId,
          referenceNumber: dto.referenceNumber?.trim(),
          reason: dto.reason.trim(),
          notes: dto.notes?.trim(),
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: movementInclude,
      });
    });

    return mapInventoryMovement(movement, role);
  }

  async transfer(dto: TransferMovementDto, role: Role, userId: string) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot transfer stock');
    }
    if (
      dto.sourcePropertyId === dto.destinationPropertyId &&
      (dto.sourceUnitId ?? null) === (dto.destinationUnitId ?? null)
    ) {
      throw new BadRequestException(
        'Source and destination cannot be the same',
      );
    }

    const qty = this.positiveQty(dto.quantity);

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, dto.itemId);
      if (item.currentQuantity.lessThan(qty)) {
        throw new ConflictException('Insufficient stock for transfer');
      }

      // Transfer does not change global quantity
      return tx.inventoryMovement.create({
        data: {
          movementNumber: await this.nextMovementNumber(tx),
          itemId: item.id,
          movementType: InventoryMovementType.TRANSFER,
          quantity: qty,
          unitCost: item.averageUnitCost,
          totalCost: qty.mul(item.averageUnitCost).toDecimalPlaces(2),
          movementDate: new Date(dto.movementDate),
          sourcePropertyId: dto.sourcePropertyId,
          sourceUnitId: dto.sourceUnitId,
          destinationPropertyId: dto.destinationPropertyId,
          destinationUnitId: dto.destinationUnitId,
          reason: dto.reason.trim(),
          notes: dto.notes?.trim(),
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: movementInclude,
      });
    });

    return mapInventoryMovement(movement, role);
  }

  async adjust(dto: AdjustMovementDto, role: Role, userId: string) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin may record inventory adjustments',
      );
    }
    if (dto.quantity === 0) {
      throw new BadRequestException('Adjustment quantity cannot be zero');
    }

    const delta = new Prisma.Decimal(dto.quantity);

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, dto.itemId);
      const newQty = item.currentQuantity.plus(delta);
      if (newQty.lessThan(0)) {
        throw new ConflictException('Adjustment would make stock negative');
      }

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentQuantity: newQty },
      });

      return tx.inventoryMovement.create({
        data: {
          movementNumber: await this.nextMovementNumber(tx),
          itemId: item.id,
          movementType: InventoryMovementType.ADJUSTMENT,
          quantity: delta.abs(),
          unitCost: item.averageUnitCost,
          totalCost: delta.abs().mul(item.averageUnitCost).toDecimalPlaces(2),
          movementDate: new Date(dto.movementDate),
          reason: dto.reason.trim(),
          notes: `${delta.greaterThan(0) ? 'INCREASE' : 'DECREASE'}: ${dto.notes?.trim() ?? ''}`.trim(),
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: movementInclude,
      });
    });

    return mapInventoryMovement(movement, role);
  }

  async damage(dto: DamageOrLossMovementDto, role: Role, userId: string) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Receptionist cannot record damage');
    }
    return this.reduceWithOptionalExpense(
      dto,
      InventoryMovementType.DAMAGE,
      role,
      userId,
    );
  }

  async loss(dto: DamageOrLossMovementDto, role: Role, userId: string) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Inventory loss requires Super Admin approval',
      );
    }
    return this.reduceWithOptionalExpense(
      dto,
      InventoryMovementType.LOSS,
      role,
      userId,
    );
  }

  async findAll(query: QueryInventoryMovementsDto, role: Role) {
    const where: Prisma.InventoryMovementWhereInput = {};
    if (query.itemId) where.itemId = query.itemId;
    if (query.movementType) {
      where.movementType = query.movementType as InventoryMovementType;
    }
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.monthlyTenancyId) where.monthlyTenancyId = query.monthlyTenancyId;
    if (query.employeeId) where.employeeId = query.employeeId;

    if (query.propertyId) {
      where.OR = [
        { sourcePropertyId: query.propertyId },
        { destinationPropertyId: query.propertyId },
      ];
    }
    if (query.unitId) {
      where.OR = [
        ...(where.OR ?? []),
        { sourceUnitId: query.unitId },
        { destinationUnitId: query.unitId },
      ];
    }

    if (query.date) {
      where.movementDate = {
        gte: new Date(`${query.date}T00:00:00.000Z`),
        lte: new Date(`${query.date}T23:59:59.999Z`),
      };
    } else if (query.startDate || query.endDate) {
      where.movementDate = {};
      if (query.startDate) {
        where.movementDate.gte = new Date(`${query.startDate}T00:00:00.000Z`);
      }
      if (query.endDate) {
        where.movementDate.lte = new Date(`${query.endDate}T23:59:59.999Z`);
      }
    } else if (query.year !== undefined && query.month !== undefined) {
      where.movementDate = {
        gte: new Date(Date.UTC(query.year, query.month - 1, 1)),
        lte: new Date(Date.UTC(query.year, query.month, 0, 23, 59, 59, 999)),
      };
    } else if (query.month !== undefined) {
      throw new BadRequestException('year is required when month is provided');
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { movementNumber: { contains: term, mode: 'insensitive' } },
            { referenceNumber: { contains: term, mode: 'insensitive' } },
            { item: { name: { contains: term, mode: 'insensitive' } } },
            { item: { itemCode: { contains: term, mode: 'insensitive' } } },
            {
              destinationUnit: {
                unitNumber: { contains: term, mode: 'insensitive' },
              },
            },
          ],
        },
      ];
    }

    const rows = await this.prisma.inventoryMovement.findMany({
      where,
      include: movementInclude,
      orderBy: { movementDate: 'desc' },
    });

    return rows.map((row) => mapInventoryMovement(row, role));
  }

  async findOne(id: string, role: Role) {
    const row = await this.prisma.inventoryMovement.findUnique({
      where: { id },
      include: movementInclude,
    });
    if (!row) throw new NotFoundException('Inventory movement not found');
    return mapInventoryMovement(row, role);
  }

  private async reduceWithOptionalExpense(
    dto: DamageOrLossMovementDto,
    type: InventoryMovementType,
    role: Role,
    userId: string,
  ) {
    const qty = this.positiveQty(dto.quantity);

    const movement = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, dto.itemId);
      if (item.currentQuantity.lessThan(qty)) {
        throw new ConflictException('Insufficient stock');
      }

      const unitCost = item.averageUnitCost;
      const totalCost =
        dto.replacementCost !== undefined
          ? new Prisma.Decimal(dto.replacementCost)
          : qty.mul(unitCost).toDecimalPlaces(2);

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentQuantity: item.currentQuantity.minus(qty) },
      });

      let expenseId: string | undefined;
      if (totalCost.greaterThan(0)) {
        const expense = await this.expensesService.createLinkedInventoryExpense(
          tx,
          {
            amount: totalCost,
            expenseDate: new Date(dto.movementDate),
            userId,
            description: `${type} — ${qty.toString()} x ${item.name}`,
            categoryName: 'Inventory',
            propertyId: dto.propertyId,
            unitId: dto.unitId,
            metadata: {
              inventoryItemId: item.id,
              movementType: type,
              reason: dto.reason.trim(),
            },
            markPaid: true,
          },
        );
        expenseId = expense.id;
      }

      return tx.inventoryMovement.create({
        data: {
          movementNumber: await this.nextMovementNumber(tx),
          itemId: item.id,
          movementType: type,
          quantity: qty,
          unitCost,
          totalCost,
          movementDate: new Date(dto.movementDate),
          destinationPropertyId: dto.propertyId,
          destinationUnitId: dto.unitId,
          expenseId,
          reason: dto.reason.trim(),
          notes: dto.notes?.trim(),
          createdByUserId: userId,
          approvedByUserId: userId,
          approvedAt: new Date(),
        },
        include: movementInclude,
      });
    });

    return mapInventoryMovement(movement, role);
  }

  private weightedAverage(
    currentQty: Prisma.Decimal,
    currentAvg: Prisma.Decimal,
    purchaseQty: Prisma.Decimal,
    purchaseCost: Prisma.Decimal,
  ) {
    const totalQty = currentQty.plus(purchaseQty);
    if (totalQty.equals(0)) return new Prisma.Decimal(0);
    return currentQty
      .mul(currentAvg)
      .plus(purchaseQty.mul(purchaseCost))
      .div(totalQty)
      .toDecimalPlaces(2);
  }

  private positiveQty(value: number) {
    const qty = new Prisma.Decimal(value);
    if (qty.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    return qty;
  }

  private async lockItem(tx: Prisma.TransactionClient, itemId: string) {
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) {
      throw new NotFoundException('Inventory item not found');
    }
    return item;
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
}
