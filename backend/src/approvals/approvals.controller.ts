import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { extractAuditContext } from '../common/utils/request-meta';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { QueryApprovalRequestsDto } from './dto/query-approval-requests.dto';
import { RejectApprovalRequestDto } from './dto/reject-approval-request.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('approval-requests')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(
    @Body() dto: CreateApprovalRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.approvalsService.createFromApi(
      dto,
      user,
      extractAuditContext(req),
    );
  }

  @Get()
  findAll(
    @Query() query: QueryApprovalRequestsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvalsService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvalsService.findOne(id, user);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.approvalsService.approve(id, user, extractAuditContext(req));
  }

  @Post(':id/reject')
  @Roles(Role.SUPER_ADMIN)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectApprovalRequestDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.approvalsService.reject(
      id,
      dto.rejectionReason,
      user,
      extractAuditContext(req),
    );
  }
}
