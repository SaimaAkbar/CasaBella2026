import { IsOptional, IsString } from 'class-validator';

export class LogReceiptPrintDto {
  @IsOptional()
  @IsString()
  printerName?: string;
}
