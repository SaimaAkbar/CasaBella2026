import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RestoreBackupDto {
  @IsString()
  @IsNotEmpty()
  confirmationText!: string;

  @IsString()
  @MinLength(5)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  currentPassword!: string;
}
