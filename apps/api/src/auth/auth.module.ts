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
    providers: [AuthService, AvatarStorageService, JwtStrategy],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }
