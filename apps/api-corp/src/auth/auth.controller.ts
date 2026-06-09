import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Redirect, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import type { AvatarUploadFile } from './avatar-storage.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { UsersService } from '../users/users.service';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { parseSystemConfigValue } from '@corp-api/system-config/system-config.util';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private usersService: UsersService,
        private prisma: PrismaService,
    ) { }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('register')
    @UseInterceptors(
        FileInterceptor('avatar', {
            storage: memoryStorage(),
            fileFilter: (_request, file, callback) => {
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
                    return callback(
                        new BadRequestException('El avatar debe ser una imagen JPG, PNG o WebP.'),
                        false,
                    );
                }

                return callback(null, true);
            },
        }),
    )
    async register(
        @Body() registerDto: RegisterDto,
        @UploadedFile()
        avatarFile?: AvatarUploadFile,
    ) {
        return this.authService.register(registerDto, avatarFile);
    }

    @HttpCode(HttpStatus.OK)
    @Post('verify-email')
    async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
        return this.authService.verifyEmail(verifyEmailDto.token);
    }

    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Get('resend-verification')
    async resendVerification(@Request() req) {
        return this.authService.resendVerificationEmail(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getProfile(@Request() req) {
        const user = await this.usersService.findById(req.user.userId);
        if (!user) {
            throw new Error('User not found');
        }
        const { passwordHash, ...result } = user;
        const creditResetsRecord = await (this.prisma as unknown as {
            systemConfig?: {
                findUnique(args: { where: { key: string } }): Promise<{ value: string | null } | null>;
            };
        }).systemConfig?.findUnique({ where: { key: 'user_credit_resets' } });
        const creditResetAt = parseSystemConfigValue<Record<string, string> | null>(creditResetsRecord?.value)?.[user.id] ?? null;
        return { ...result, creditResetAt };
    }

    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    @UseInterceptors(
        FileInterceptor('avatar', {
            storage: memoryStorage(),
            fileFilter: (_req, file, cb) => {
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
                    return cb(new BadRequestException('El avatar debe ser JPG, PNG o WebP.'), false);
                }
                return cb(null, true);
            },
            limits: { fileSize: 5 * 1024 * 1024 },
        }),
    )
    async updateProfile(
        @Body() dto: UpdateProfileDto,
        @Request() req,
        @UploadedFile() avatarFile?: AvatarUploadFile,
    ) {
        return this.authService.updateProfile(req.user.userId, dto, avatarFile);
    }

    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    async changePassword(@Body() dto: ChangePasswordDto, @Request() req) {
        return this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    }

    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.identifier, dto.appUrl);
    }

    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Get('google')
    @UseGuards(GoogleAuthGuard)
    googleAuth() {
    }

    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    @Redirect()
    async googleCallback(@Request() req) {
        const appUrl = process.env.CORP_APP_URL || process.env.APP_URL || 'http://localhost:5173';
        const { accessToken } = req.user;
        return { url: `${appUrl}/oauth/callback?token=${accessToken}` };
    }

    @Get('github')
    @UseGuards(GithubAuthGuard)
    githubAuth() {
    }

    @Get('github/callback')
    @UseGuards(GithubAuthGuard)
    @Redirect()
    async githubCallback(@Request() req) {
        const appUrl = process.env.CORP_APP_URL || process.env.APP_URL || 'http://localhost:5173';
        const { accessToken } = req.user;
        return { url: `${appUrl}/oauth/callback?token=${accessToken}` };
    }
}
