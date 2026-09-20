import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebsiteFacilityDto } from './dto/create-website-facility.dto';
import { UpdateWebsiteFacilityDto } from './dto/update-website-facility.dto';

@Injectable()
export class WebsiteFacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateWebsiteFacilityDto) {
    return this.prisma.websiteFacility.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl.trim(),
        imageAlt: dto.imageAlt?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findAll(includeInactive = false) {
    return this.prisma.websiteFacility.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findPublic() {
    return this.prisma.websiteFacility.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        imageAlt: true,
        sortOrder: true,
      },
    });
  }

  async findOne(id: string) {
    const facility = await this.prisma.websiteFacility.findUnique({
      where: { id },
    });
    if (!facility) {
      throw new NotFoundException('Website facility not found');
    }
    return facility;
  }

  async update(id: string, dto: UpdateWebsiteFacilityDto) {
    await this.findOne(id);
    return this.prisma.websiteFacility.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl.trim() }
          : {}),
        ...(dto.imageAlt !== undefined
          ? { imageAlt: dto.imageAlt.trim() || null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async archive(id: string) {
    await this.findOne(id);
    return this.prisma.websiteFacility.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
