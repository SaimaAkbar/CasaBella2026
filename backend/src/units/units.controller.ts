import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateUnitDto } from './dto/create-unit.dto';
import { QueryUnitsDto } from './dto/query-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

const UNIT_IMAGE_DIR = join(process.cwd(), 'uploads', 'unit-images');
const UNIT_IMAGE_MAX = 5 * 1024 * 1024;
const UNIT_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const UNIT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function ensureUnitImageDir() {
  if (!existsSync(UNIT_IMAGE_DIR)) {
    mkdirSync(UNIT_IMAGE_DIR, { recursive: true });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post('upload-image')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUnitImageDir();
          cb(null, UNIT_IMAGE_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: UNIT_IMAGE_MAX },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (!UNIT_IMAGE_EXT.has(ext) || !UNIT_IMAGE_MIME.has(file.mimetype)) {
          cb(
            new BadRequestException(
              'Image must be JPG, PNG, or WEBP (max 5MB).',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please choose an image file to upload.');
    }
    return {
      url: `/uploads/unit-images/${file.filename}`,
      filename: file.filename,
    };
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitsService.create(createUnitDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
  findAll(@Query() query: QueryUnitsDto) {
    return this.unitsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.unitsService.update(id, updateUnitDto, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.archive(id);
  }
}
