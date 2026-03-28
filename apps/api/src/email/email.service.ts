import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProviderConfigService } from './email-provider-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly providerConfigService: EmailProviderConfigService) {
    const provider = this.providerConfigService.getProviders()[0];
    if (!provider) {
      this.transporter = null;
      this.from = 'noreply@polla2026.com';
      this.logger.warn('No SMTP provider configured for EmailService; verification emails will be skipped.');
      return;
    }

    this.from = provider.fromName ? `${provider.fromName} <${provider.fromEmail}>` : provider.fromEmail;
    this.transporter = nodemailer.createTransport({
      host: provider.host,
      port: provider.port,
      secure: provider.secure,
      auth: provider.user && provider.pass ? { user: provider.user, pass: provider.pass } : undefined,
    } as nodemailer.TransportOptions);
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    userName: string,
    appUrl: string = process.env.APP_URL || 'https://polla2026.com',
  ): Promise<void> {
    if (!this.transporter) return;

    try {
      const verificationLink = `${appUrl}/verify-email?token=${token}`;
      const html = this.getEmailTemplate(userName, verificationLink, token);
      const text = this.getPlainTextTemplate(userName, verificationLink, token);

      const result = await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Verifica tu correo para Polla 2026',
        html,
        text,
      });

      this.logger.log(`Verification email sent to ${email} (messageId: ${result.messageId})`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async sendResendVerificationEmail(
    email: string,
    token: string,
    userName: string,
    appUrl: string = process.env.APP_URL || 'https://polla2026.com',
  ): Promise<void> {
    if (!this.transporter) return;

    const verificationLink = `${appUrl}/verify-email?token=${token}`;
    const html = this.getEmailTemplate(userName, verificationLink, token, 'Nuevo código de verificación');
    const text = this.getPlainTextTemplate(userName, verificationLink, token, 'Nuevo código de verificación');

    const result = await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Nuevo código de verificación para Polla 2026',
      html,
      text,
    });

    this.logger.log(`Resend verification email sent to ${email} (messageId: ${result.messageId})`);
  }

  private getEmailTemplate(userName: string, verificationLink: string, token: string, title = 'Verifica tu correo'): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.12)">
    <div style="background:#111827;color:#ffffff;padding:24px 28px;">
      <h1 style="margin:0;font-size:24px;">Polla 2026</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.9">${title}</p>
    </div>
    <div style="padding:28px;line-height:1.7;">
      <p>Hola ${userName},</p>
      <p>Gracias por registrarte. Para activar tu cuenta, verifica tu correo con el siguiente enlace:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${verificationLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Verificar correo</a>
      </p>
      <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p><a href="${verificationLink}">${verificationLink}</a></p>
      <p>También puedes usar este código:</p>
      <div style="padding:14px 16px;background:#eef2ff;border-radius:12px;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:.06em;">${token}</div>
      <p style="margin-top:20px;color:#475569;font-size:13px;">Este código expira en 72 horas.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getPlainTextTemplate(userName: string, verificationLink: string, token: string, title = 'Verifica tu correo'): string {
    return [
      `${title}`,
      '',
      `Hola ${userName},`,
      '',
      'Gracias por registrarte. Para activar tu cuenta, verifica tu correo con este enlace:',
      verificationLink,
      '',
      'También puedes usar este código:',
      token,
      '',
      'Este código expira en 72 horas.',
    ].join('\n');
  }
}
