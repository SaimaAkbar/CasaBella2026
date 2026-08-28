import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsNotEmpty()
  value!: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
