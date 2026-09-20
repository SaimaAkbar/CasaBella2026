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
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateWebsiteFacilityDto } from './dto/create-website-facility.dto';
import { UpdateWebsiteFacilityDto } from './dto/update-website-facility.dto';
import { WebsiteFacilitiesService } from './website-facilities.service';

const FACILITY_IMAGE_DIR = join(process.cwd(), 'uploads', 'facility-images');
const FACILITY_IMAGE_MAX = 5 * 1024 * 1024;
const FACILITY_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const FACILITY_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function ensureFacilityImageDir() {
  if (!existsSync(FACILITY_IMAGE_DIR)) {
    mkdirSync(FACILITY_IMAGE_DIR, { recursive: true });
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('website-facilities')
export class WebsiteFacilitiesController {
  constructor(private readonly facilitiesService: WebsiteFacilitiesService) {}

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureFacilityImageDir();
          cb(null, FACILITY_IMAGE_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: FACILITY_IMAGE_MAX },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (
          !FACILITY_IMAGE_EXT.has(ext) ||
          !FACILITY_IMAGE_MIME.has(file.mimetype)
        ) {
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
      url: `/uploads/facility-images/${file.filename}`,
      filename: file.filename,
    };
  }

  @Post()
  create(@Body() dto: CreateWebsiteFacilityDto) {
    return this.facilitiesService.create(dto);
  }

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.facilitiesService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.facilitiesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebsiteFacilityDto,
  ) {
    return this.facilitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.facilitiesService.archive(id);
  }
}

/** Public website — no JWT. */
@Controller('public')
export class PublicWebsiteFacilitiesController {
  constructor(private readonly facilitiesService: WebsiteFacilitiesService) {}

  @Get('facilities')
  listPublic() {
    return this.facilitiesService.findPublic();
  }
}
