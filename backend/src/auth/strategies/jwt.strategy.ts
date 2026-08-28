import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role, Status } from '../../../generated/prisma/client';
import type { AuthUser } from '../../common/types/auth-user.type';
import { UsersService } from '../../users/users.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  tv?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    try {
      const user = await this.usersService.findOne(payload.sub);

      if (user.status !== Status.ACTIVE) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const tokenVersion = user.tokenVersion ?? 0;
      if ((payload.tv ?? 0) !== tokenVersion) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Invalid credentials');
      }

      throw error;
    }
  }
}
