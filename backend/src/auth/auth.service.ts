import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { Status } from '../../generated/prisma/client';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    if (user.status !== Status.ACTIVE) {
      return null;
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(
        'Account temporarily locked due to failed login attempts',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await this.registerFailedLogin(user.id);
      return null;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  async login(user: AuthUser) {
    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: fresh?.tokenVersion ?? 0,
    };

    const expiresIn = ((await this.settings.getString(
      'security.jwtExpiresIn',
      '',
    )) ||
      process.env.JWT_EXPIRES_IN ||
      '1d') as StringValue;

    return {
      accessToken: await this.jwtService.signAsync(payload, { expiresIn }),
      tokenType: 'Bearer',
      expiresIn,
      user: this.getProfile(user),
      forcePasswordChange: Boolean(user.forcePasswordChange),
    };
  }

  async changePassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
  ) {
    const full = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!full) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(currentPassword, full.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const minLength = await this.settings.getNumber(
      'security.passwordMinimumLength',
      8,
    );
    if (newPassword.length < minLength) {
      throw new BadRequestException(
        `Password must be at least ${minLength} characters`,
      );
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordChangedAt: new Date(),
        forcePasswordChange: false,
        tokenVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    const updated = await this.usersService.findOne(user.id);
    return this.login(updated);
  }

  async loginWithCredentials(email: string, password: string) {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.login(user);
  }

  getProfile(user: AuthUser) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      canAccessSalary: user.canAccessSalary ?? false,
      canAccessProfitLoss: user.canAccessProfitLoss ?? false,
      forcePasswordChange: Boolean(
        (user as AuthUser & { forcePasswordChange?: boolean }).forcePasswordChange,
      ),
    };
  }

  private async registerFailedLogin(userId: string) {
    const maxAttempts = await this.settings.getNumber(
      'security.maxFailedLoginAttempts',
      5,
    );
    const lockMinutes = await this.settings.getNumber(
      'security.accountLockDurationMinutes',
      30,
    );

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });
    const attempts = (current?.failedLoginAttempts ?? 0) + 1;
    const lockedUntil =
      attempts >= maxAttempts
        ? new Date(Date.now() + lockMinutes * 60 * 1000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });
  }
}
