import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
import { USER_STATUS } from '../users/user-status.constants';

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
        const user = await this.usersService.findByDocumentNumber(identifier);

        if (user && user.passwordHash && await bcrypt.compare(pass, user.passwordHash)) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(loginDto: LoginDto) {
        await this.verifyRecaptcha(loginDto.recaptchaToken, 'login');
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
                mustChangePassword: (user as any).mustChangePassword ?? false,
            },
        };
    }

    async register(registerDto: RegisterDto, avatarFile?: AvatarUploadFile) {
        const existingEmail = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findByEmail(registerDto.email, { includeInactive: true }),
        );
        if (existingEmail) {
            throw new ConflictException('El correo electrónico ya está registrado');
        }

        const existingUsername = await this.wrapRegisterDatabaseOperation(() =>
            this.usersService.findByUsername(registerDto.username, { includeInactive: true }),
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

        if (verificationToken.user.status !== USER_STATUS.ACTIVE) {
            throw new UnauthorizedException('La cuenta está inactiva');
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

    /**
     * Cambia la contraseña del usuario autenticado.
     * También borra el flag `mustChangePassword` si estaba activo (provisión corporativa).
     */
    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        if (newPassword.length < 8) {
            throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
        }
        if (currentPassword === newPassword) {
            throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException('Usuario no encontrado');

        if (!user.passwordHash) throw new BadRequestException('Esta cuenta usa login social. Usa Google o GitHub para ingresar.');
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) throw new UnauthorizedException('La contraseña actual es incorrecta');

        const newHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash, mustChangePassword: false },
        });

        return { ok: true, message: 'Contraseña actualizada exitosamente' };
    }

    async forgotPassword(identifier: string, appUrl?: string) {
        const user = await this.usersService.findByDocumentNumber(identifier);
        if (!user) {
            return { ok: true, message: 'Si el correo existe, recibirás las instrucciones en breve.' };
        }

        const token = generateVerificationToken();
        const expiresAt = calculateTokenExpiration(1);

        await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

        await this.prisma.passwordResetToken.create({
            data: { token, userId: user.id, expiresAt },
        });

        const resetBaseUrl = appUrl || process.env.CORP_APP_URL || process.env.APP_URL || 'https://polla2026.com';
        const firstName = user.name?.split(' ')[0] ?? user.username ?? 'Usuario';
        await this.emailService.sendPasswordResetEmail(user.email, token, firstName, resetBaseUrl);

        return { ok: true, message: 'Si el correo existe, recibirás las instrucciones en breve.' };
    }

    async resetPassword(token: string, newPassword: string) {
        if (newPassword.length < 8) {
            throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
        }

        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetToken) throw new BadRequestException('Token inválido o expirado');
        if (resetToken.usedAt) throw new BadRequestException('Este enlace ya fue utilizado');
        if (new Date() > resetToken.expiresAt) throw new BadRequestException('El enlace ha expirado. Solicita uno nuevo');

        const newHash = await bcrypt.hash(newPassword, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash: newHash, mustChangePassword: false },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
        ]);

        return { ok: true, message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' };
    }

    async validateOAuthUser(profile: {
        provider: 'google' | 'github';
        providerId: string;
        email: string;
        name: string;
        avatar?: string;
    }) {
        const { provider, providerId, email, name, avatar } = profile;
        const providerField = provider === 'google' ? 'googleId' : 'githubId';

        let user = await this.prisma.user.findFirst({
            where: { [providerField]: providerId },
        });

        if (!user && email) {
            user = await this.usersService.findByEmail(email);
            if (user) {
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { [providerField]: providerId },
                });
            }
        }

        if (!user) {
            const base = name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
            let username = base.slice(0, 15);
            const exists = await this.usersService.findByUsername(username);
            if (exists) username = `${username}${Date.now().toString().slice(-4)}`;

            user = await this.prisma.user.create({
                data: {
                    name: name || 'Usuario',
                    email: email || `${providerId}@${provider}.oauth`,
                    username,
                    [providerField]: providerId,
                    avatar: avatar ?? null,
                    emailVerified: true,
                    passwordHash: null,
                },
            });
        }

        const { passwordHash: _, ...result } = user as any;
        const payload = {
            username: result.username,
            sub: result.id,
            email: result.email,
            emailVerified: result.emailVerified,
            systemRole: result.systemRole ?? 'USER',
        };

        return {
            accessToken: this.jwtService.sign(payload),
            user: { ...result },
        };
    }

    async updateProfile(
        userId: string,
        data: { name?: string; username?: string; phone?: string; countryCode?: string; birthDate?: string },
        avatarFile?: AvatarUploadFile,
    ) {
        if (data.username) {
            const existing = await this.usersService.findByUsername(data.username);
            if (existing && existing.id !== userId) {
                throw new BadRequestException('El nombre de usuario ya está en uso');
            }
        }

        let avatar: string | undefined;
        if (avatarFile) {
            avatar = await this.avatarStorageService.save(avatarFile);
        }

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.username !== undefined) updateData.username = data.username;
        if (data.phone !== undefined) updateData.phone = data.phone || null;
        if (data.countryCode !== undefined) updateData.countryCode = data.countryCode || null;
        if (data.birthDate !== undefined) updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
        if (avatar) updateData.avatar = avatar;

        const updated = await this.prisma.user.update({ where: { id: userId }, data: updateData });
        const { passwordHash: _, ...result } = updated as any;
        return result;
    }

    private async wrapRegisterDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw mapRegisterOperationalError(error);
        }
    }

    private async verifyRecaptcha(token: string | undefined, expectedAction: string) {
        const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
        const isRequired = process.env.RECAPTCHA_REQUIRED === 'true';
        if (!secret) {
            if (isRequired) {
                this.logger.error('RECAPTCHA_REQUIRED=true pero RECAPTCHA_SECRET_KEY no está configurado en la API');
                throw new UnauthorizedException('reCAPTCHA no está configurado');
            }
            this.logger.warn('reCAPTCHA omitido porque RECAPTCHA_SECRET_KEY no está configurado');
            return;
        }
        if (!token) {
            if (isRequired) {
                this.logger.warn('RECAPTCHA_REQUIRED=true pero el cliente no envió recaptchaToken; verifica que VITE_RECAPTCHA_SITE_KEY se haya pasado como build arg del frontend y que el bundle cargue reCAPTCHA v3');
                throw new UnauthorizedException('Verificación reCAPTCHA requerida');
            }
            this.logger.warn('reCAPTCHA omitido porque el cliente no envió token');
            return;
        }

        const params = new URLSearchParams();
        params.set('secret', secret);
        params.set('response', token);

        let result: any;
        try {
            const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params,
            });
            result = await response.json();
        } catch (error) {
            this.logger.warn(`No se pudo verificar reCAPTCHA: ${error instanceof Error ? error.message : String(error)}`);
            throw new UnauthorizedException('No se pudo validar reCAPTCHA');
        }

        const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.5');
        if (!result?.success || result.action !== expectedAction || typeof result.score !== 'number' || result.score < minScore) {
            this.logger.warn(`reCAPTCHA rechazado action=${result?.action} score=${result?.score} errors=${JSON.stringify(result?.['error-codes'] ?? [])}`);
            throw new UnauthorizedException('No pudimos validar que seas una persona. Intenta de nuevo.');
        }
    }
}
