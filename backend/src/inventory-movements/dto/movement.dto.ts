import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class PurchaseMovementDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost: number;

  @IsDateString()
  movementDate: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class IssueMovementDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsDateString()
  movementDate: string;

  @IsOptional()
  @IsUUID()
  destinationPropertyId?: string;

  @IsOptional()
  @IsUUID()
  destinationUnitId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsUUID()
  monthlyTenancyId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnMovementDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsDateString()
  movementDate: string;

  @IsOptional()
  @IsUUID()
  sourcePropertyId?: string;

  @IsOptional()
  @IsUUID()
  sourceUnitId?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TransferMovementDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsDateString()
  movementDate: string;

  @IsUUID()
  sourcePropertyId: string;

  @IsOptional()
  @IsUUID()
  sourceUnitId?: string;

  @IsUUID()
  destinationPropertyId: string;

  @IsOptional()
  @IsUUID()
  destinationUnitId?: string;

  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustMovementDto {
  @IsUUID()
  itemId: string;

  /** Positive increases stock; negative decreases. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @IsDateString()
  movementDate: string;

  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DamageOrLossMovementDto {
  @IsUUID()
  itemId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsDateString()
  movementDate: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsString()
  @MinLength(3)
  reason: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  replacementCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryInventoryMovementsDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  movementType?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsUUID()
  monthlyTenancyId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @ValidateIf((q: QueryInventoryMovementsDto) => q.month !== undefined)
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
