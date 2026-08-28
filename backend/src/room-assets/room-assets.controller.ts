import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { ChangeRoomAssetConditionDto } from './dto/change-condition.dto';
import { CreateRoomAssetDto } from './dto/create-room-asset.dto';
import { QueryRoomAssetsDto } from './dto/query-room-assets.dto';
import { UpdateRoomAssetDto } from './dto/update-room-asset.dto';
import { RoomAssetsService } from './room-assets.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('room-assets')
export class RoomAssetsController {
  constructor(private readonly roomAssetsService: RoomAssetsService) {}

  @Post()
  create(@Body() dto: CreateRoomAssetDto, @CurrentUser() user: AuthUser) {
    return this.roomAssetsService.create(dto, user.role);
  }

  @Get()
  findAll(@Query() query: QueryRoomAssetsDto, @CurrentUser() user: AuthUser) {
    return this.roomAssetsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.roomAssetsService.findOne(id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.roomAssetsService.update(id, dto, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.roomAssetsService.archive(id, user.role);
  }

  @Post(':id/change-condition')
  changeCondition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoomAssetConditionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.roomAssetsService.changeCondition(
      id,
      dto,
      user.role,
      user.id,
    );
  }

  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.roomAssetsService.getHistory(id, user.role);
  }
}
