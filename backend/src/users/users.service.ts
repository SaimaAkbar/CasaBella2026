import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, Status, User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_SALT_ROUNDS = 12;

type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private excludePassword(user: User): SafeUser {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  private async assertSuperAdminCanManageTarget(
    actorId: string,
    targetId: string,
  ) {
    if (actorId === targetId) {
      throw new BadRequestException('Cannot manage your own account');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true },
    });

    if (!target) {
      throw new NotFoundException(`User with id "${targetId}" not found`);
    }

    if (target.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot manage Super Admin accounts');
    }

    return target;
  }

  async create(createUserDto: CreateUserDto): Promise<SafeUser> {
    if (createUserDto.role === Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Cannot create another Super Admin from this form',
      );
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
        },
      });

      return this.excludePassword(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.excludePassword(user));
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return this.excludePassword(user);
  }

  /** Internal auth lookup — includes password hash. Do not expose via controllers. */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<SafeUser> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!current) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    if (current.role === Role.SUPER_ADMIN && updateUserDto.role) {
      throw new BadRequestException('Cannot modify Super Admin role');
    }

    const data: Prisma.UserUpdateInput = { ...updateUserDto };

    if (updateUserDto.password) {
      data.password = await bcrypt.hash(
        updateUserDto.password,
        BCRYPT_SALT_ROUNDS,
      );
      data.tokenVersion = { increment: 1 };
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      return this.excludePassword(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: Status): Promise<SafeUser> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!current) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    if (current.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot change Super Admin status');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    return this.excludePassword(user);
  }

  async updateRole(id: string, role: Role): Promise<SafeUser> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!current) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    if (current.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot change Super Admin role');
    }

    if (role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot assign Super Admin role');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
    });

    return this.excludePassword(user);
  }

  async resetPassword(
    id: string,
    newPassword: string,
    forcePasswordChange: boolean,
  ): Promise<SafeUser> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!current) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    if (current.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot reset Super Admin password');
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        forcePasswordChange: forcePasswordChange ?? false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return this.excludePassword(user);
  }

  async remove(id: string): Promise<SafeUser> {
    await this.findOne(id);

    const user = await this.prisma.user.delete({ where: { id } });
    return this.excludePassword(user);
  }
}
