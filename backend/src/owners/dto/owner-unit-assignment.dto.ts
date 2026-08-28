import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  OwnerAccountDirection,
  OwnerAssignmentStatus,
} from '../../../generated/prisma/client';

export class CreateOwnerUnitAssignmentDto {
  @IsUUID()
  ownerId!: string;

  @IsUUID()
  propertyId!: string;

  @IsUUID()
  unitId!: string;

  @IsEnum(OwnerAccountDirection)
  accountDirection!: OwnerAccountDirection;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  ownershipPercentage!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedMonthlyAmount!: number;

  @IsDateString()
  agreementStart!: string;

  @IsOptional()
  @IsDateString()
  agreementEnd?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOwnerUnitAssignmentDto {
  @IsOptional()
  @IsEnum(OwnerAccountDirection)
  accountDirection?: OwnerAccountDirection;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  ownershipPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedMonthlyAmount?: number;

  @IsOptional()
  @IsDateString()
  agreementStart?: string;

  @IsOptional()
  @IsDateString()
  agreementEnd?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Changing unit ends the current assignment and creates a new one.
   * Do not overwrite unitId on the existing row.
   */
  @IsOptional()
  @IsUUID()
  newUnitId?: string;

  @IsOptional()
  @IsUUID()
  newPropertyId?: string;
}

export class EndOwnerUnitAssignmentDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  reason?: string;
}

/** Super Admin only — revises agreed amount from an effective date; past statements unchanged. */
export class ReviseOwnerUnitAssignmentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  newFixedMonthlyAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  newOwnershipPercentage?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

export class QueryOwnerUnitAssignmentsDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsEnum(OwnerAccountDirection)
  accountDirection?: OwnerAccountDirection;

  @IsOptional()
  @IsEnum(OwnerAssignmentStatus)
  status?: OwnerAssignmentStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
