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
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto';
import { InventoryCategoriesService } from './inventory-categories.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('inventory-categories')
export class InventoryCategoriesController {
  constructor(
    private readonly inventoryCategoriesService: InventoryCategoriesService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateInventoryCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryCategoriesService.create(dto, user.role);
  }

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.inventoryCategoriesService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryCategoriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryCategoriesService.update(id, dto, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryCategoriesService.archive(id, user.role);
  }
}
