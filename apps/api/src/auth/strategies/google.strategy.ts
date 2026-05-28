import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            callbackURL: `${process.env.API_URL ?? 'http://localhost:3004'}/auth/google/callback`,
            scope: ['email', 'profile'],
        });
    }

    async validate(
        _accessToken: string,
        _refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const { id, emails, displayName, photos } = profile;
        const email = emails?.[0]?.value;
        const avatar = photos?.[0]?.value;

        try {
            const result = await this.authService.validateOAuthUser({
                provider: 'google',
                providerId: id,
                email,
                name: displayName,
                avatar,
            });
            done(null, result);
        } catch (err) {
            done(err, false);
        }
    }
}
