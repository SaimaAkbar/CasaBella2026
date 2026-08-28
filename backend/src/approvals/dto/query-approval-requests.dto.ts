import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ApprovalModuleName,
  ApprovalPriority,
  ApprovalStatus,
} from '../../../generated/prisma/client';

export class QueryApprovalRequestsDto {
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @IsOptional()
  @IsEnum(ApprovalModuleName)
  moduleName?: ApprovalModuleName;

  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @IsOptional()
  @IsEnum(ApprovalPriority)
  priority?: ApprovalPriority;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
