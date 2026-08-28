import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalPriority } from '../../../generated/prisma/client';
import { CreateExpenseDto } from './create-expense.dto';

export class UpdateExpenseDto extends PartialType(
  OmitType(CreateExpenseDto, [] as const),
) {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalReason?: string;

  @IsOptional()
  @IsEnum(ApprovalPriority)
  approvalPriority?: ApprovalPriority;
}
