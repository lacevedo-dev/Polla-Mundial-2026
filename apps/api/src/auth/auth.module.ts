import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AvatarStorageService } from './avatar-storage.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';

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
    providers: [AuthService, AvatarStorageService, JwtStrategy, ...oauthProviders],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }
