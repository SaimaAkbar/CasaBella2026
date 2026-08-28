import { IsEnum, IsNotEmpty } from 'class-validator';
import { Status } from '../../../generated/prisma/client';

export class ChangeUserStatusDto {
  @IsEnum(Status)
  @IsNotEmpty()
  status: Status;
}
