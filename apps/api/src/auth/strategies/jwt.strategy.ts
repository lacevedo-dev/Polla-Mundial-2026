import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'POLLA_2026_SECRET_DEV_KEY_CHANGE_ME',
        });
    }

    async validate(payload: any) {
        // Aquí puedes incluir más info si en el token pusiste un rol, etc.
        return { userId: payload.sub, username: payload.username, email: payload.email };
    }
}
