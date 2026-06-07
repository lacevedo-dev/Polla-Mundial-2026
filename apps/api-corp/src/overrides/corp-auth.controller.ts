import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthController } from '@corp-api/auth/auth.controller';
import { AuthService } from '@corp-api/auth/auth.service';
import { UsersService } from '@corp-api/users/users.service';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { ForgotPasswordDto } from '@corp-api/auth/dto/forgot-password.dto';
import { CorpAuthService } from './corp-auth.service';

@Controller('auth')
export class CorpAuthController extends AuthController {
    constructor(
        authService: AuthService,
        usersService: UsersService,
        prisma: PrismaService,
        private corpAuthService: CorpAuthService,
    ) {
        super(authService, usersService, prisma as any);
    }

    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.corpAuthService.forgotPassword(dto.identifier, dto.appUrl);
    }
}
