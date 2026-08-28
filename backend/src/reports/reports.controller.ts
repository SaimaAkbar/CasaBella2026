import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  ExportReportQueryDto,
  isReportType,
  QueryReportDto,
} from './dto/query-report.dto';
import { ReportExportService } from './export.service';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ReportExportService,
  ) {}

  @Get('catalog')
  catalog(@CurrentUser() user: AuthUser) {
    return this.reportsService.catalog(user);
  }

  @Get(':reportType/export')
  async export(
    @Param('reportType') reportType: string,
    @Query() query: ExportReportQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (!isReportType(reportType)) {
      throw new BadRequestException('Invalid report type');
    }
    if (!query.format) {
      throw new BadRequestException('format is required (pdf|xlsx|csv)');
    }

    const report = await this.reportsService.generate(
      reportType,
      query,
      user,
      { allRows: true },
    );
    const file = await this.exportService.export(report, query.format, user);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @Get(':reportType')
  getReport(
    @Param('reportType') reportType: string,
    @Query() query: QueryReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!isReportType(reportType)) {
      throw new BadRequestException('Invalid report type');
    }
    return this.reportsService.generate(reportType, query, user);
  }
}
