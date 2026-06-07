import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '@corp-api/users/users.module';
import { PrismaModule } from '@corp-api/prisma/prisma.module';
import { EmailModule } from '@corp-api/email/email.module';
import { AuthService } from '@corp-api/auth/auth.service';
import { JwtStrategy } from '@corp-api/auth/strategies/jwt.strategy';
import { GoogleStrategy } from '@corp-api/auth/strategies/google.strategy';
import { GithubStrategy } from '@corp-api/auth/strategies/github.strategy';
import { AvatarStorageService } from './avatar-storage.service';
import { CorpAuthController } from './corp-auth.controller';
import { CorpAuthService } from './corp-auth.service';

const oauthProviders = [
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []),
    ...(process.env.GITHUB_CLIENT_ID ? [GithubStrategy] : []),
];

@Module({
    imports: [
        UsersModule,
        PrismaModule,
        EmailModule,
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET?.trim() ?? '',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    providers: [AuthService, CorpAuthService, AvatarStorageService, JwtStrategy, ...oauthProviders],
    controllers: [CorpAuthController],
    exports: [AuthService],
})
export class AuthModule {}
