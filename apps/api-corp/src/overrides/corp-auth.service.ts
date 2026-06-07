import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '@corp-api/users/users.service';
import { PrismaService } from '@corp-api/prisma/prisma.service';
import { EmailService } from '@corp-api/email/email.service';
import { generateVerificationToken, calculateTokenExpiration } from '@corp-api/auth/verification-token.utils';

@Injectable()
export class CorpAuthService {
    private readonly logger = new Logger(CorpAuthService.name);

    constructor(
        private usersService: UsersService,
        private prisma: PrismaService,
        private emailService: EmailService,
    ) { }

    async forgotPassword(identifier: string, appUrl?: string) {
        try {
            const user = await this.usersService.findByDocumentNumber(identifier);
            if (!user) {
                return { ok: true, message: 'Si el correo existe, recibirás las instrucciones en breve.' };
            }

            if (!user.email) {
                this.logger.warn(`Usuario ${user.id} no tiene email configurado. No se puede enviar recuperación.`);
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
        } catch (error) {
            this.logger.error(
                `Error en forgotPassword para identifier=${identifier}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
            return { ok: true, message: 'Si el correo existe, recibirás las instrucciones en breve.' };
        }
    }
}
