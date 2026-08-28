import { IsString, MinLength } from 'class-validator';

export class ReverseSalaryTransactionDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
