import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ApprovalActionType,
  ApprovalModuleName,
  ApprovalPriority,
} from '../../../generated/prisma/client';

export class CreateApprovalRequestDto {
  @IsEnum(ApprovalModuleName)
  moduleName!: ApprovalModuleName;

  @IsUUID()
  recordId!: string;

  @IsEnum(ApprovalActionType)
  actionType!: ApprovalActionType;

  @IsOptional()
  @IsObject()
  oldData?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  newData?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsEnum(ApprovalPriority)
  priority?: ApprovalPriority;
}

/** Shared optional fields modules can accept on mutation DTOs. */
export class ApprovalMetaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  approvalReason?: string;

  @IsOptional()
  @IsEnum(ApprovalPriority)
  approvalPriority?: ApprovalPriority;
}
