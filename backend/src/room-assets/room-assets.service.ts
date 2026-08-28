import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, RoomAssetCondition } from '../../generated/prisma/client';
import { ExpensesService } from '../expenses/expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeRoomAssetConditionDto } from './dto/change-condition.dto';
import { CreateRoomAssetDto } from './dto/create-room-asset.dto';
import { QueryRoomAssetsDto } from './dto/query-room-assets.dto';
import { UpdateRoomAssetDto } from './dto/update-room-asset.dto';

function money(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? '0';
}

@Injectable()
export class RoomAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expensesService: ExpensesService,
  ) {}

  private mapAsset(
    asset: {
      id: string;
      assetCode: string;
      propertyId: string;
      unitId: string;
      itemName: string;
      category: string | null;
      quantity: Prisma.Decimal;
      purchaseCost: Prisma.Decimal;
      assignedDate: Date;
      condition: RoomAssetCondition;
      serialNumber: string | null;
      brand: string | null;
      model: string | null;
      notes: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      property?: { id: string; name: string } | null;
      unit?: { id: string; unitNumber: string } | null;
    },
    role: Role,
  ) {
    const base = {
      id: asset.id,
      assetCode: asset.assetCode,
      propertyId: asset.propertyId,
      unitId: asset.unitId,
      itemName: asset.itemName,
      category: asset.category,
      quantity: money(asset.quantity),
      assignedDate: asset.assignedDate,
      condition: asset.condition,
      serialNumber: asset.serialNumber,
      brand: asset.brand,
      model: asset.model,
      notes: asset.notes,
      isActive: asset.isActive,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      property: asset.property ?? null,
      unit: asset.unit ?? null,
    };

    if (role === Role.RECEPTIONIST) {
      return { ...base, purchaseCost: null };
    }
    return { ...base, purchaseCost: money(asset.purchaseCost) };
  }

  async create(dto: CreateRoomAssetDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
    });
    if (!unit || !unit.isActive) {
      throw new NotFoundException('Unit not found');
    }
    if (unit.propertyId !== dto.propertyId) {
      throw new BadRequestException(
        'Unit does not belong to the selected property',
      );
    }

    const asset = await this.prisma.$transaction(async (tx) => {
      const assetCode = await this.nextAssetCode(tx);
      return tx.roomAsset.create({
        data: {
          assetCode,
          propertyId: dto.propertyId,
          unitId: dto.unitId,
          itemName: dto.itemName.trim(),
          category: dto.category?.trim(),
          quantity: new Prisma.Decimal(dto.quantity),
          purchaseCost: new Prisma.Decimal(dto.purchaseCost ?? 0),
          assignedDate: new Date(dto.assignedDate),
          condition: dto.condition ?? RoomAssetCondition.GOOD,
          serialNumber: dto.serialNumber?.trim(),
          brand: dto.brand?.trim(),
          model: dto.model?.trim(),
          notes: dto.notes?.trim(),
          isActive: true,
        },
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
      });
    });

    return this.mapAsset(asset, role);
  }

  async findAll(query: QueryRoomAssetsDto, role: Role) {
    const where: Prisma.RoomAssetWhereInput = {};
    if (query.propertyId) where.propertyId = query.propertyId;
    if (query.unitId) where.unitId = query.unitId;
    if (query.condition) where.condition = query.condition;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    else where.isActive = true;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { assetCode: { contains: term, mode: 'insensitive' } },
        { itemName: { contains: term, mode: 'insensitive' } },
        { serialNumber: { contains: term, mode: 'insensitive' } },
        { property: { name: { contains: term, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.roomAsset.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
      orderBy: [{ property: { name: 'asc' } }, { unit: { unitNumber: 'asc' } }],
    });

    return rows.map((row) => this.mapAsset(row, role));
  }

  async findOne(id: string, role: Role) {
    const asset = await this.prisma.roomAsset.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });
    if (!asset) throw new NotFoundException('Room asset not found');
    return this.mapAsset(asset, role);
  }

  async update(id: string, dto: UpdateRoomAssetDto, role: Role) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }
    await this.findOne(id, role);

    if (dto.unitId || dto.propertyId) {
      const existing = await this.prisma.roomAsset.findUnique({
        where: { id },
      });
      const propertyId = dto.propertyId ?? existing!.propertyId;
      const unitId = dto.unitId ?? existing!.unitId;
      const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
      if (!unit || unit.propertyId !== propertyId) {
        throw new BadRequestException(
          'Unit does not belong to the selected property',
        );
      }
    }

    const asset = await this.prisma.roomAsset.update({
      where: { id },
      data: {
        propertyId: dto.propertyId,
        unitId: dto.unitId,
        itemName: dto.itemName?.trim(),
        category: dto.category?.trim(),
        quantity:
          dto.quantity === undefined
            ? undefined
            : new Prisma.Decimal(dto.quantity),
        purchaseCost:
          dto.purchaseCost === undefined
            ? undefined
            : new Prisma.Decimal(dto.purchaseCost),
        assignedDate: dto.assignedDate
          ? new Date(dto.assignedDate)
          : undefined,
        condition: dto.condition,
        serialNumber: dto.serialNumber?.trim(),
        brand: dto.brand?.trim(),
        model: dto.model?.trim(),
        notes: dto.notes?.trim(),
      },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    return this.mapAsset(asset, role);
  }

  async archive(id: string, role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can archive room assets');
    }
    await this.findOne(id, role);
    const asset = await this.prisma.roomAsset.update({
      where: { id },
      data: { isActive: false },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });
    return this.mapAsset(asset, role);
  }

  async changeCondition(
    id: string,
    dto: ChangeRoomAssetConditionDto,
    role: Role,
    userId: string,
  ) {
    if (role === Role.RECEPTIONIST) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.roomAsset.findUnique({
        where: { id },
        include: { unit: true },
      });
      if (!asset || !asset.isActive) {
        throw new NotFoundException('Room asset not found');
      }

      const repairCost = new Prisma.Decimal(dto.repairCost ?? 0);
      const replacementCost = new Prisma.Decimal(dto.replacementCost ?? 0);
      const expenseAmount = repairCost.plus(replacementCost);

      let expenseId: string | undefined;
      if (expenseAmount.greaterThan(0)) {
        const expense = await this.expensesService.createLinkedInventoryExpense(
          tx,
          {
            amount: expenseAmount,
            expenseDate: new Date(dto.actionDate),
            userId,
            description: `Room asset ${asset.assetCode} (${asset.itemName}) — ${dto.newCondition}`,
            categoryName: 'Repair',
            propertyId: asset.propertyId,
            unitId: asset.unitId,
            metadata: {
              roomAssetId: asset.id,
              assetCode: asset.assetCode,
              previousCondition: asset.condition,
              newCondition: dto.newCondition,
              reason: dto.reason.trim(),
            },
            markPaid: true,
          },
        );
        expenseId = expense.id;
      }

      const history = await tx.roomAssetHistory.create({
        data: {
          roomAssetId: asset.id,
          previousCondition: asset.condition,
          newCondition: dto.newCondition,
          quantityAffected: new Prisma.Decimal(dto.quantityAffected ?? 1),
          actionDate: new Date(dto.actionDate),
          repairCost,
          replacementCost,
          reason: dto.reason.trim(),
          notes: dto.notes?.trim(),
          expenseId,
          createdByUserId: userId,
        },
        include: {
          expense: { select: { id: true, expenseNumber: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      const updated = await tx.roomAsset.update({
        where: { id },
        data: { condition: dto.newCondition },
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, unitNumber: true } },
        },
      });

      return { updated, history };
    });

    return {
      asset: this.mapAsset(result.updated, role),
      history: {
        id: result.history.id,
        previousCondition: result.history.previousCondition,
        newCondition: result.history.newCondition,
        quantityAffected: money(result.history.quantityAffected),
        actionDate: result.history.actionDate,
        repairCost: money(result.history.repairCost),
        replacementCost: money(result.history.replacementCost),
        reason: result.history.reason,
        notes: result.history.notes,
        expense: result.history.expense,
        createdBy: result.history.createdBy,
        createdAt: result.history.createdAt,
      },
    };
  }

  async getHistory(id: string, role: Role) {
    await this.findOne(id, role);
    const rows = await this.prisma.roomAssetHistory.findMany({
      where: { roomAssetId: id },
      orderBy: { actionDate: 'desc' },
      include: {
        expense: { select: { id: true, expenseNumber: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      previousCondition: row.previousCondition,
      newCondition: row.newCondition,
      quantityAffected: money(row.quantityAffected),
      actionDate: row.actionDate,
      repairCost: role === Role.RECEPTIONIST ? null : money(row.repairCost),
      replacementCost:
        role === Role.RECEPTIONIST ? null : money(row.replacementCost),
      reason: row.reason,
      notes: row.notes,
      expense: row.expense,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    }));
  }

  private async nextAssetCode(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
      VALUES ('room_asset_seq', '1', NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = (CAST("SystemSetting".value AS INTEGER) + 1)::text,
        "updatedAt" = NOW()
      RETURNING value
    `;
    return `AST-${String(rows[0]?.value ?? '1').padStart(4, '0')}`;
  }
}
