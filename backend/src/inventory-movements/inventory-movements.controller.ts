import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import {
  AdjustMovementDto,
  DamageOrLossMovementDto,
  IssueMovementDto,
  PurchaseMovementDto,
  QueryInventoryMovementsDto,
  ReturnMovementDto,
  TransferMovementDto,
} from './dto/movement.dto';
import { InventoryMovementsService } from './inventory-movements.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('inventory-movements')
export class InventoryMovementsController {
  constructor(
    private readonly inventoryMovementsService: InventoryMovementsService,
  ) {}

  @Post('purchase')
  purchase(@Body() dto: PurchaseMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.purchase(dto, user.role, user.id);
  }

  @Post('issue')
  issue(@Body() dto: IssueMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.issue(dto, user.role, user.id);
  }

  @Post('return')
  returnStock(@Body() dto: ReturnMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.returnStock(dto, user.role, user.id);
  }

  @Post('transfer')
  transfer(@Body() dto: TransferMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.transfer(dto, user.role, user.id);
  }

  @Post('adjust')
  adjust(@Body() dto: AdjustMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.adjust(dto, user.role, user.id);
  }

  @Post('damage')
  damage(@Body() dto: DamageOrLossMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.damage(dto, user.role, user.id);
  }

  @Post('loss')
  loss(@Body() dto: DamageOrLossMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventoryMovementsService.loss(dto, user.role, user.id);
  }

  @Get()
  findAll(
    @Query() query: QueryInventoryMovementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryMovementsService.findAll(query, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryMovementsService.findOne(id, user.role);
  }
}
