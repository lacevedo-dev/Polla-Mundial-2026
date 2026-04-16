import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { USER_STATUS } from '../../users/user-status.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
            ExtractJwt.fromAuthHeaderAsBearerToken(),
            (req: any) => (req?.query?.token as string) ?? null,
        ]),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET?.trim() ?? '',
        });
    }

    async validate(payload: any) {
        const user = await this.prisma.user.findFirst({
            where: {
                id: payload.sub,
                status: USER_STATUS.ACTIVE,
            },
            select: {
                id: true,
                username: true,
                email: true,
                systemRole: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Usuario inactivo o no encontrado');
        }

        return {
            id: user.id,
            userId: user.id,  // Keep for backwards compatibility
            username: user.username,
            email: user.email,
            systemRole: user.systemRole ?? 'USER',
        };
    }
}
