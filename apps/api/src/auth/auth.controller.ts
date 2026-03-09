import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import type { AvatarUploadFile } from './avatar-storage.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private usersService: UsersService
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

    // Ruta protegida para comprobar la sesión y obtener el perfil
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getProfile(@Request() req) {
        // req.user contiene lo dictado por el jwt.strategy (userId, username, email)
        const user = await this.usersService.findById(req.user.userId);
        if (!user) {
            throw new Error('User not found');
        }
        const { passwordHash, ...result } = user;
        return result;
    }
}
