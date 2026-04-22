import { Injectable, Logger } from '@nestjs/common';
import { EmailJobPriority, EmailJobType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { MatchEmailTemplateService } from './match-email-template.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { EmailTestType } from './dto/test-email.dto';

export interface ProviderAttempt {
  providerKey: string;
  providerEmail: string;
  status: 'pending' | 'trying' | 'success' | 'failed';
  error?: string;
  timestamp?: Date;
}

export interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  timestamp: Date;
  recipientEmail: string;
  subject: string;
  attempts?: ProviderAttempt[];
  totalProviders?: number;
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
          const token = 'TEST-TOKEN-' + Math.random().toString(36).substring(7).toUpperCase();
          const userName = options?.userName || 'Usuario de Prueba';
          const verificationUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
          
          subject = '🧪 [TEST] Verificación de correo - Polla 2026';
          html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">🧪 TEST - Polla Mundial 2026</h1>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #667eea;">¡Hola ${userName}!</h2>
                <p>Este es un <strong>correo de prueba</strong> del sistema de verificación de email.</p>
                <p>Para verificar tu correo electrónico, haz clic en el siguiente botón:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Verificar Email
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">O copia y pega este enlace en tu navegador:</p>
                <p style="background: white; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${verificationUrl}</p>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                  <strong>Token de prueba:</strong> ${token}
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                  Este es un correo de prueba del sistema. En producción, este enlace sería válido por 24 horas.
                </p>
              </div>
            </body>
            </html>
          `;
          text = `
            ¡Hola ${userName}!
            
            Este es un correo de prueba del sistema de verificación de email.
            
            Para verificar tu correo electrónico, visita este enlace:
            ${verificationUrl}
            
            Token de prueba: ${token}
            
            Este es un correo de prueba del sistema.
          `;
          break;

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
    const errors: string[] = [];

    try {
      // Obtener todos los proveedores disponibles
      const allProviders = await this.providerConfigService.getProviders();
      
      if (allProviders.length === 0) {
        throw new Error('No hay proveedores SMTP configurados en el sistema');
      }

      this.logger.log(`📧 Iniciando envío de prueba a ${recipientEmail} con ${allProviders.length} proveedor(es) disponible(s)`);

      // Inicializar tracking de intentos
      const attempts: ProviderAttempt[] = allProviders.map(p => ({
        providerKey: p.key,
        providerEmail: p.fromEmail,
        status: 'pending' as const,
      }));

      // Intentar con cada proveedor hasta que uno funcione
      for (let attempt = 0; attempt < allProviders.length; attempt++) {
        const provider = allProviders[attempt];
        
        // Actualizar estado a "trying"
        attempts[attempt].status = 'trying';
        attempts[attempt].timestamp = new Date();
        
        this.logger.log(`🔄 Intento ${attempt + 1}/${allProviders.length} usando proveedor: ${provider.key} (${provider.fromEmail})`);

        try {
          // Encolar el correo
          const queued = await this.emailQueue.enqueueEmail({
            type: EmailJobType.MATCH_REMINDER,
            priority: EmailJobPriority.HIGH,
            required: false,
            recipientEmail,
            subject: '🧪 [TEST] ' + subject,
            html,
            text,
            dedupeKey: `test-direct-${Date.now()}-${Math.random()}`,
          });

          if (!queued) {
            throw new Error('No se pudo encolar el correo (posible email en lista negra)');
          }

          // Obtener el trabajo recién creado
          const job = await this.prisma.emailJob.findFirst({
            where: {
              recipientEmail: recipientEmail.trim().toLowerCase(),
              subject: '🧪 [TEST] ' + subject,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (!job) {
            throw new Error('No se pudo encontrar el trabajo encolado');
          }

          // Intentar enviar con este proveedor específico
          const result = await this.emailQueue.dispatchJobById(job.id, {
            providerKey: provider.key,
          });

          // Obtener el trabajo actualizado
          const updatedJob = await this.prisma.emailJob.findUnique({
            where: { id: job.id },
          });

          if (result.sent) {
            this.logger.log(`✅ Correo enviado exitosamente via ${provider.key} (${provider.fromEmail})`);
            
            // Marcar como exitoso
            attempts[attempt].status = 'success';
            
            return {
              success: true,
              messageId: updatedJob?.id || job.id,
              provider: `${provider.key} (${provider.fromEmail})`,
              timestamp,
              recipientEmail,
              subject,
              attempts,
              totalProviders: allProviders.length,
            };
          }

          // Si falló, registrar el error
          const errorMsg = updatedJob?.lastError || result.job.lastError || 'Error desconocido';
          errors.push(`${provider.key}: ${errorMsg}`);
          
          // Marcar como fallido
          attempts[attempt].status = 'failed';
          attempts[attempt].error = errorMsg;
          
          this.logger.warn(`❌ Fallo con ${provider.key}: ${errorMsg}`);

          // Limpiar el trabajo fallido antes de intentar con el siguiente proveedor
          await this.prisma.emailJob.delete({
            where: { id: job.id },
          });

        } catch (providerError) {
          const errorMsg = providerError instanceof Error ? providerError.message : String(providerError);
          errors.push(`${provider.key}: ${errorMsg}`);
          
          // Marcar como fallido
          attempts[attempt].status = 'failed';
          attempts[attempt].error = errorMsg;
          
          this.logger.warn(`❌ Error con ${provider.key}: ${errorMsg}`);
        }

        // Esperar un poco antes del siguiente intento (excepto en el último)
        if (attempt < allProviders.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Si llegamos aquí, todos los proveedores fallaron
      const allErrors = errors.join('\n• ');
      this.logger.error(`❌ Todos los proveedores fallaron para ${recipientEmail}`);
      
      return {
        success: false,
        error: `Probados ${allProviders.length} proveedor(es), todos fallaron:\n• ${allErrors}`,
        provider: 'ninguno (todos fallaron)',
        timestamp,
        recipientEmail,
        subject,
        attempts,
        totalProviders: allProviders.length,
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

      // Obtener información del proveedor que se usará
      const providers = await this.providerConfigService.getProviders();
      const activeProviders = providers.filter(p => !p.blockedUntil || p.blockedUntil < new Date());
      
      // Contar trabajos pendientes en la cola
      const pendingCount = await this.prisma.emailJob.count({
        where: { status: 'PENDING' },
      });

      return {
        success: true,
        jobId: job?.id,
        timestamp,
        queueInfo: {
          status: job?.status || 'PENDING',
          pendingJobs: pendingCount,
          availableProviders: activeProviders.length,
          nextProvider: activeProviders.length > 0 ? activeProviders[0].key : 'ninguno',
          schedulerInterval: '2 minutos',
          message: activeProviders.length > 0 
            ? `Encolado exitosamente. Se procesará automáticamente en los próximos 2 minutos usando el proveedor "${activeProviders[0].key}".`
            : 'Encolado, pero no hay proveedores disponibles actualmente.',
        },
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
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        recipientEmail: true,
        subject: true,
        html: true,
        text: true,
        providerKey: true,
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
