import { IsString, MinLength } from 'class-validator';

export class ReversePaymentDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
