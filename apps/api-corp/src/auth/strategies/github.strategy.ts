import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private authService: AuthService) {
        super({
            clientID: process.env.GITHUB_CLIENT_ID ?? '',
            clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
            callbackURL: `${process.env.API_URL ?? 'http://localhost:3004'}/auth/github/callback`,
            scope: ['user:email'],
        });
    }

    async validate(
        _accessToken: string,
        _refreshToken: string,
        profile: any,
        done: (err: any, user?: any) => void,
    ): Promise<any> {
        const { id, emails, displayName, username, photos } = profile;
        const email = emails?.[0]?.value;
        const avatar = photos?.[0]?.value;

        try {
            const result = await this.authService.validateOAuthUser({
                provider: 'github',
                providerId: String(id),
                email,
                name: displayName || username,
                avatar,
            });
            done(null, result);
        } catch (err) {
            done(err, false);
        }
    }
}
