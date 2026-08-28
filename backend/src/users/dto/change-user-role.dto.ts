import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '../../../generated/prisma/client';

export class ChangeUserRoleDto {
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;
}
