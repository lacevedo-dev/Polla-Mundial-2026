import { Injectable, Logger } from '@nestjs/common';
import { EmailJobPriority, EmailJobType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { MatchEmailTemplateService } from './match-email-template.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { EmailTestType } from './dto/test-email.dto';

export interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  timestamp: Date;
  recipientEmail: string;
  subject: string;
}

export interface EmailQueueTestResult {
  success: boolean;
  jobId?: string;
  error?: string;
  timestamp: Date;
}

@Injectable()
export class EmailTestingService {
  private readonly logger = new Logger(EmailTestingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly emailQueue: EmailQueueService,
    private readonly matchEmailTemplates: MatchEmailTemplateService,
    private readonly providerConfigService: EmailProviderConfigService,
  ) {}

  async sendTestEmail(
    recipientEmail: string,
    type: EmailTestType,
    options?: {
      userName?: string;
      matchId?: string;
      subject?: string;
      htmlContent?: string;
      textContent?: string;
    },
  ): Promise<EmailTestResult> {
    const timestamp = new Date();

    try {
      let subject: string;
      let html: string;
      let text: string;

      switch (type) {
        case EmailTestType.VERIFICATION:
          subject = '🧪 [TEST] Verificación de correo - Polla 2026';
          const token = 'TEST-TOKEN-' + Math.random().toString(36).substring(7).toUpperCase();
          const userName = options?.userName || 'Usuario de Prueba';
          await this.emailService.sendVerificationEmail(
            recipientEmail,
            token,
            userName,
          );
          return {
            success: true,
            timestamp,
            recipientEmail,
            subject,
            messageId: 'sent-via-email-service',
          };

        case EmailTestType.MATCH_REMINDER:
          const reminderContent = this.matchEmailTemplates.buildReminderEmail({
            homeTeam: 'Colombia',
            awayTeam: 'Argentina',
            matchDate: new Date(Date.now() + 60 * 60 * 1000),
            venue: 'Estadio de Prueba',
            hasPrediction: false,
          });
          subject = '🧪 [TEST] ' + reminderContent.subject;
          html = reminderContent.html;
          text = reminderContent.text;
          break;

        case EmailTestType.PREDICTION_CLOSING:
          const closingContent = this.matchEmailTemplates.buildPredictionClosingEmail({
            homeTeam: 'Brasil',
            awayTeam: 'Uruguay',
            matchDate: new Date(Date.now() + 15 * 60 * 1000),
            venue: 'Estadio de Prueba',
            closeMinutes: 15,
            hasPrediction: false,
          });
          subject = '🧪 [TEST] ' + closingContent.subject;
          html = closingContent.html;
          text = closingContent.text;
          break;

        case EmailTestType.MATCH_RESULT:
          const resultContent = this.matchEmailTemplates.buildResultSummaryEmail({
            homeTeam: 'México',
            awayTeam: 'Chile',
            homeScore: 2,
            awayScore: 1,
            points: 10,
            matchDate: new Date(),
          });
          subject = '🧪 [TEST] ' + resultContent.subject;
          html = resultContent.html;
          text = resultContent.text;
          break;

        case EmailTestType.CUSTOM:
          subject = options?.subject || '🧪 [TEST] Correo de prueba personalizado';
          html = options?.htmlContent || '<p>Este es un correo de prueba personalizado.</p>';
          text = options?.textContent || 'Este es un correo de prueba personalizado.';
          break;

        default:
          throw new Error(`Tipo de correo de prueba no soportado: ${type}`);
      }

      const result = await this.sendDirectEmail(recipientEmail, subject, html, text);
      return result;
    } catch (error) {
      this.logger.error(`Error enviando correo de prueba: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        recipientEmail,
        subject: 'Error',
      };
    }
  }

  async sendDirectEmail(
    recipientEmail: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<EmailTestResult> {
    const timestamp = new Date();

    try {
      const providers = await this.providerConfigService.getProviders();
      if (providers.length === 0) {
        throw new Error('No hay proveedores de correo configurados');
      }

      const provider = providers[0];
      const transporter = nodemailer.createTransport({
        host: provider.host,
        port: provider.port,
        secure: provider.secure,
        auth: provider.user && provider.pass ? { user: provider.user, pass: provider.pass } : undefined,
      } as nodemailer.TransportOptions);

      const from = provider.fromName ? `${provider.fromName} <${provider.fromEmail}>` : provider.fromEmail;

      const result = await transporter.sendMail({
        from,
        to: recipientEmail,
        subject,
        html,
        text,
      });

      this.logger.log(`Correo de prueba enviado a ${recipientEmail} (messageId: ${result.messageId})`);

      return {
        success: true,
        messageId: result.messageId,
        provider: provider.key,
        timestamp,
        recipientEmail,
        subject,
      };
    } catch (error) {
      this.logger.error(`Error enviando correo directo: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        recipientEmail,
        subject,
      };
    }
  }

  async testEmailQueue(
    recipientEmail: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<EmailQueueTestResult> {
    const timestamp = new Date();

    try {
      const queued = await this.emailQueue.enqueueEmail({
        type: EmailJobType.MATCH_REMINDER,
        priority: EmailJobPriority.HIGH,
        required: false,
        recipientEmail,
        subject: '🧪 [TEST QUEUE] ' + subject,
        html,
        text,
        dedupeKey: `test-queue-${Date.now()}-${Math.random()}`,
      });

      if (!queued) {
        throw new Error('No se pudo encolar el correo (posible duplicado o email en lista negra)');
      }

      const job = await this.prisma.emailJob.findFirst({
        where: {
          recipientEmail: recipientEmail.trim().toLowerCase(),
          subject: '🧪 [TEST QUEUE] ' + subject,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        jobId: job?.id,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Error probando cola de correos: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp,
      };
    }
  }

  async getQueueStatus() {
    const [pending, deferred, sending, sent, failed, dropped] = await Promise.all([
      this.prisma.emailJob.count({ where: { status: 'PENDING' } }),
      this.prisma.emailJob.count({ where: { status: 'DEFERRED' } }),
      this.prisma.emailJob.count({ where: { status: 'SENDING' } }),
      this.prisma.emailJob.count({ where: { status: 'SENT' } }),
      this.prisma.emailJob.count({ where: { status: 'FAILED' } }),
      this.prisma.emailJob.count({ where: { status: 'DROPPED' } }),
    ]);

    const recentJobs = await this.prisma.emailJob.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        recipientEmail: true,
        subject: true,
        createdAt: true,
        sentAt: true,
        lastError: true,
        attemptCount: true,
      },
    });

    return {
      stats: {
        pending,
        deferred,
        sending,
        sent,
        failed,
        dropped,
        total: pending + deferred + sending + sent + failed + dropped,
      },
      recentJobs,
    };
  }

  async getProviderStatus() {
    const providers = await this.providerConfigService.getProviders();
    const now = new Date();

    const providerStats = await Promise.all(
      providers.map(async (provider) => {
        const usage = await this.prisma.emailProviderUsage.findFirst({
          where: {
            providerKey: provider.key,
          },
          orderBy: { quotaWindowStart: 'desc' },
        });

        const account = await this.prisma.emailProviderAccount.findFirst({
          where: {
            key: provider.key,
            deletedAt: null,
          },
        });

        return {
          key: provider.key,
          fromEmail: provider.fromEmail,
          fromName: provider.fromName,
          host: provider.host,
          port: provider.port,
          dailyLimit: provider.dailyLimit,
          reservedHighPriority: provider.reservedHighPriority,
          sentToday: usage?.sentCount ?? 0,
          remainingQuota: provider.dailyLimit - (usage?.sentCount ?? 0),
          isBlocked: (provider.blockedUntil && provider.blockedUntil > now) || (usage?.blockedUntil && usage.blockedUntil > now),
          blockedUntil: provider.blockedUntil || usage?.blockedUntil || null,
          lastError: usage?.lastError || account?.lastError || null,
          lastUsedAt: account?.lastUsedAt || null,
        };
      }),
    );

    return {
      providers: providerStats,
      totalProviders: providers.length,
      activeProviders: providerStats.filter((p) => !p.isBlocked).length,
      blockedProviders: providerStats.filter((p) => p.isBlocked).length,
    };
  }

  async validateEmailConfiguration(): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    const providers = await this.providerConfigService.getProviders();

    if (providers.length === 0) {
      issues.push('No hay proveedores de correo configurados');
    }

    for (const provider of providers) {
      if (!provider.host) {
        issues.push(`Proveedor ${provider.key}: falta configurar host SMTP`);
      }
      if (!provider.port) {
        issues.push(`Proveedor ${provider.key}: falta configurar puerto SMTP`);
      }
      if (!provider.fromEmail) {
        issues.push(`Proveedor ${provider.key}: falta configurar email de origen`);
      }
      if (!provider.user || !provider.pass) {
        warnings.push(`Proveedor ${provider.key}: no tiene credenciales de autenticación configuradas`);
      }
      if (provider.dailyLimit <= 0) {
        warnings.push(`Proveedor ${provider.key}: límite diario es 0 o negativo`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }
}
