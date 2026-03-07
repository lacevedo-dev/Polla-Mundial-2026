import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter: nodemailer.Transporter;

    constructor() {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'localhost';
        const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
        const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
        const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
        const emailFrom = process.env.EMAIL_FROM || 'noreply@polla2026.com';

        // Development logging
        if (process.env.NODE_ENV !== 'production') {
            this.logger.log(`Email service initialized with host: ${emailHost}, port: ${emailPort}`);
        }

        this.transporter = nodemailer.createTransport({
            host: emailHost,
            port: emailPort,
            secure: emailPort === 465, // TLS for 587, SSL for 465
            auth: emailUser && emailPass ? {
                user: emailUser,
                pass: emailPass,
            } : undefined,
        });
    }

    /**
     * Sends a verification email to the user
     * @param email User's email address
     * @param token Verification token
     * @param userName User's first name
     * @param appUrl Frontend app URL for verification link
     */
    async sendVerificationEmail(
        email: string,
        token: string,
        userName: string,
        appUrl: string = process.env.APP_URL || 'https://polla2026.com',
    ): Promise<void> {
        try {
            const verificationLink = `${appUrl}/verify-email?token=${token}`;

            const htmlContent = this.getEmailTemplate(userName, verificationLink, token);
            const textContent = this.getPlainTextTemplate(userName, verificationLink, token);

            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@polla2026.com',
                to: email,
                subject: 'Verifica tu email para Polla 2026',
                html: htmlContent,
                text: textContent,
            };

            const result = await this.transporter.sendMail(mailOptions);

            this.logger.log(`Verification email sent to ${email} (messageId: ${result.messageId})`);
        } catch (error) {
            this.logger.error(
                `Failed to send verification email to ${email}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
            // Non-blocking: don't throw, just log
            // This allows registration to succeed even if email sending fails
        }
    }

    /**
     * Sends a resend verification email
     * @param email User's email address
     * @param token New verification token
     * @param userName User's first name
     * @param appUrl Frontend app URL
     */
    async sendResendVerificationEmail(
        email: string,
        token: string,
        userName: string,
        appUrl: string = process.env.APP_URL || 'https://polla2026.com',
    ): Promise<void> {
        try {
            const verificationLink = `${appUrl}/verify-email?token=${token}`;

            const htmlContent = this.getEmailTemplate(
                userName,
                verificationLink,
                token,
                'Nuevo código de verificación',
            );
            const textContent = this.getPlainTextTemplate(
                userName,
                verificationLink,
                token,
                'Nuevo código de verificación',
            );

            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@polla2026.com',
                to: email,
                subject: 'Nuevo código de verificación para Polla 2026',
                html: htmlContent,
                text: textContent,
            };

            const result = await this.transporter.sendMail(mailOptions);

            this.logger.log(`Resend verification email sent to ${email} (messageId: ${result.messageId})`);
        } catch (error) {
            this.logger.error(
                `Failed to send resend verification email to ${email}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw error; // For resend, we want to inform the user of failure
        }
    }

    private getEmailTemplate(
        userName: string,
        verificationLink: string,
        token: string,
        title: string = 'Verifica tu email',
    ): string {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .token-box { background-color: #e5e7eb; padding: 15px; border-radius: 5px; word-break: break-all; margin: 20px 0; font-family: monospace; }
        .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Polla 2026</h1>
        </div>
        <div class="content">
            <p>¡Hola ${userName}!</p>
            <p>Gracias por registrarte en Polla 2026. Para completar tu registro, necesitas verificar tu dirección de correo electrónico.</p>

            <div style="text-align: center;">
                <a href="${verificationLink}" class="button">Verificar Email</a>
            </div>

            <p>Si el botón anterior no funciona, copia y pega este enlace en tu navegador:</p>
            <p><a href="${verificationLink}">${verificationLink}</a></p>

            <p style="margin-top: 30px; font-weight: bold;">O ingresa este código:</p>
            <div class="token-box">${token}</div>

            <p style="color: #999; font-size: 12px;">Este código expira en 72 horas.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

            <div class="footer">
                <p>Este es un email automático. Por favor no responder directamente.</p>
                <p>Si no creaste esta cuenta, ignora este email.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    private getPlainTextTemplate(
        userName: string,
        verificationLink: string,
        token: string,
        title: string = 'Verifica tu email',
    ): string {
        return `
¡Hola ${userName}!

Gracias por registrarte en Polla 2026. Para completar tu registro, necesitas verificar tu dirección de correo electrónico.

Haz clic en el siguiente enlace para verificar tu email:
${verificationLink}

O ingresa este código:
${token}

Este código expira en 72 horas.

---
Este es un email automático. Por favor no responder directamente.
Si no creaste esta cuenta, ignora este email.
        `.trim();
    }
}
