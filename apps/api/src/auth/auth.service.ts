import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { mapRegisterOperationalError } from './auth-error.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from '../email/email.service';
import { generateVerificationToken, calculateTokenExpiration } from './verification-token.utils';
import { PrismaService } from '../prisma/prisma.service';
import { AvatarStorageService, type AvatarUploadFile } from './avatar-storage.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private emailService: EmailService,
        private prisma: PrismaService,
        private avatarStorageService: AvatarStorageService,
    ) { }

    async validateUser(identifier: string, pass: string): Promise<any> {
        let user = await this.usersService.findByEmail(identifier);
        if (!user) {
            user = await this.usersService.findByUsername(identifier);
        }

        if (user && await bcrypt.compare(pass, user.passwordHash)) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(loginDto: LoginDto) {
        const user = await this.validateUser(loginDto.identifier, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('Credenciales inválidas');
        }

        const payload = { username: user.username, sub: user.id, email: user.email, emailVerified: user.emailVerified, systemRole: user.systemRole };
        return {
            accessToken: this.jwtService.sign(payload),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                avatar: user.avatar,
                plan: user.plan,
                systemRole: user.systemRole,
                emailVerified: user.emailVerified,
            },
        };
    }

    async register(registerDto: RegisterDto, avatarFile?: AvatarUploadFile) {
        const existingEmail = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findByEmail(registerDto.email),
        );
        if (existingEmail) {
            throw new ConflictException('El correo electrónico ya está registrado');
        }

        const existingUsername = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findByUsername(registerDto.username),
        );
        if (existingUsername) {
            throw new ConflictException('El nombre de usuario ya está en uso');
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

        const avatar = avatarFile
            ? await this.avatarStorageService.save(avatarFile)
            : undefined;

        let user: Awaited<ReturnType<UsersService['create']>>;
        try {
            user = await this.wrapRegisterDatabaseOperation(() =>
                this.usersService.create({
                    name: registerDto.name,
                    email: registerDto.email,
                    username: registerDto.username,
                    passwordHash,
                    phone: registerDto.phone,
                    countryCode: registerDto.countryCode,
                    avatar,
                }),
            );
        } catch (error) {
            if (avatar) {
                await this.avatarStorageService.remove(avatar);
            }
            throw error;
        }

        // Generate verification token and send email
        const verificationToken = generateVerificationToken();
        const expiresAt = calculateTokenExpiration(72); // 72 hours

        try {
            await this.prisma.verificationToken.create({
                data: {
                    token: verificationToken,
                    userId: user.id,
                    expiresAt,
                },
            });

            // Send verification email (non-blocking)
            const appUrl = process.env.APP_URL || 'https://polla2026.com';
            await this.emailService.sendVerificationEmail(
                user.email,
                verificationToken,
                user.name.split(' ')[0], // First name
                appUrl,
            );
        } catch (error) {
            // Log error but don't fail registration
            this.logger.error(
                `Failed to generate/send verification token for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
        }

        const { passwordHash: _, ...result } = user;
        const payload = { username: user.username, sub: user.id, email: user.email, emailVerified: user.emailVerified, systemRole: 'USER' };

        return {
            message: 'Usuario registrado exitosamente. Por favor, verifica tu correo electrónico',
            accessToken: this.jwtService.sign(payload),
            user: result,
        };
    }

    async verifyEmail(token: string) {
        // Find the verification token
        const verificationToken = await this.wrapRegisterDatabaseOperation(() =>
            this.prisma.verificationToken.findUnique({
                where: { token },
                include: { user: true },
            }),
        );

        if (!verificationToken) {
            throw new UnauthorizedException('Token de verificación inválido o expirado');
        }

        // Check if token has expired
        if (new Date() > verificationToken.expiresAt) {
            throw new UnauthorizedException('El token de verificación ha expirado');
        }

        // Check if token has already been used
        if (verificationToken.usedAt) {
            throw new UnauthorizedException('El token de verificación ya ha sido utilizado');
        }

        // Mark user as verified and token as used
        const user = await this.wrapRegisterDatabaseOperation(() =>
            this.prisma.$transaction([
                this.prisma.user.update({
                    where: { id: verificationToken.userId },
                    data: { emailVerified: true },
                }),
                this.prisma.verificationToken.update({
                    where: { id: verificationToken.id },
                    data: { usedAt: new Date() },
                }),
            ]).then(results => results[0]),
        );

        const { passwordHash: _, ...result } = user;
        const payload = { username: user.username, sub: user.id, email: user.email, emailVerified: user.emailVerified, systemRole: (user as any).systemRole ?? 'USER' };

        return {
            message: 'Email verificado exitosamente',
            accessToken: this.jwtService.sign(payload),
            user: result,
        };
    }

    async resendVerificationEmail(userId: string) {
        // Get user
        const user = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findById(userId),
        );

        if (!user) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        // Check if already verified
        if (user.emailVerified) {
            return {
                message: 'Tu email ya ha sido verificado',
                emailVerified: true,
            };
        }

        // Delete old tokens for this user
        await this.wrapRegisterDatabaseOperation(() =>
            this.prisma.verificationToken.deleteMany({
                where: { userId },
            }),
        );

        // Generate new token
        const verificationToken = generateVerificationToken();
        const expiresAt = calculateTokenExpiration(72); // 72 hours

        try {
            await this.prisma.verificationToken.create({
                data: {
                    token: verificationToken,
                    userId,
                    expiresAt,
                },
            });

            // Send verification email
            const appUrl = process.env.APP_URL || 'https://polla2026.com';
            await this.emailService.sendResendVerificationEmail(
                user.email,
                verificationToken,
                user.name.split(' ')[0], // First name
                appUrl,
            );
        } catch (error) {
            this.logger.error(
                `Failed to resend verification email to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw error;
        }

        return {
            message: 'Nuevo código de verificación enviado a tu email',
            emailVerified: false,
        };
    }

    private async wrapRegisterDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw mapRegisterOperationalError(error);
        }
    }
}
