import { PartialType } from '@nestjs/mapped-types';
import { CreateRoomAssetDto } from './create-room-asset.dto';

export class UpdateRoomAssetDto extends PartialType(CreateRoomAssetDto) {}
