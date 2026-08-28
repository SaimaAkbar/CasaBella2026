import { IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client';

export class MarkSalaryPaidDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
