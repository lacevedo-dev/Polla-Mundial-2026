import { Body, Controller, Get, Post, Query, UseGuards, Param, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailTestingService } from './email-testing.service';
import { DispatchEmailJobDto, TestEmailDto, TestEmailQueueDto } from './dto/test-email.dto';
import { EmailQueueService } from './email-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailBlacklistService } from './email-blacklist.service';

@Controller('email-testing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class EmailTestingController {
  constructor(
    private readonly emailTestingService: EmailTestingService,
    private readonly emailQueueService: EmailQueueService,
    private readonly prisma: PrismaService,
    private readonly blacklistService: EmailBlacklistService,
  ) {}

  @Post('send-test')
  async sendTestEmail(@Body() dto: TestEmailDto) {
    return this.emailTestingService.sendTestEmail(dto.recipientEmail, dto.type, {
      userName: dto.userName,
      matchId: dto.matchId,
      subject: dto.subject,
      htmlContent: dto.htmlContent,
      textContent: dto.textContent,
    });
  }

  @Post('send-direct')
  async sendDirectEmail(@Body() dto: TestEmailQueueDto) {
    return this.emailTestingService.sendDirectEmail(
      dto.recipientEmail,
      dto.subject,
      dto.html,
      dto.text,
    );
  }

  @Post('test-queue')
  async testEmailQueue(@Body() dto: TestEmailQueueDto) {
    return this.emailTestingService.testEmailQueue(
      dto.recipientEmail,
      dto.subject,
      dto.html,
      dto.text,
    );
  }

  @Post('dispatch-job')
  async dispatchEmailJob(@Body() dto: DispatchEmailJobDto) {
    const result = await this.emailQueueService.dispatchJobById(dto.jobId, {
      providerKey: dto.providerKey,
    });

    return {
      success: result.sent,
      processed: result.processed,
      job: {
        id: result.job.id,
        status: result.job.status,
        recipientEmail: result.job.recipientEmail,
        subject: result.job.subject,
        sentAt: result.job.sentAt,
        lastError: result.job.lastError,
        attemptCount: result.job.attemptCount,
      },
    };
  }

  @Post('dispatch-pending')
  async dispatchPendingJobs(@Query('limit') limit?: string) {
    const batchLimit = limit ? parseInt(limit, 10) : 30;
    return this.emailQueueService.dispatchPendingJobs(batchLimit);
  }

  @Get('queue-status')
  async getQueueStatus() {
    return this.emailTestingService.getQueueStatus();
  }

  @Get('provider-status')
  async getProviderStatus() {
    return this.emailTestingService.getProviderStatus();
  }

  @Get('validate-config')
  async validateConfiguration() {
    return this.emailTestingService.validateEmailConfiguration();
  }

  @Get('active-users')
  async getActiveUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
      },
      orderBy: {
        name: 'asc',
      },
      take: 100,
    });

    return { users, total: users.length };
  }

  @Get('blacklist')
  async getBlacklist() {
    const entries = await this.prisma.emailBlacklist.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { entries, total: entries.length };
  }

  @Delete('blacklist/:email')
  async removeFromBlacklist(@Param('email') email: string) {
    await this.blacklistService.removeFromBlacklist(email);
    return { success: true, message: `Email ${email} removido de la lista negra` };
  }

  @Post('unblock-all-providers')
  async unblockAllProviders() {
    const now = new Date();
    
    // Desbloquear todas las cuentas de proveedores
    const accountsUpdated = await this.prisma.emailProviderAccount.updateMany({
      where: {
        deletedAt: null,
        blockedUntil: { not: null },
      },
      data: {
        blockedUntil: null,
        lastError: null,
      },
    });

    // Desbloquear todos los registros de uso
    const usageUpdated = await this.prisma.emailProviderUsage.updateMany({
      where: {
        blockedUntil: { not: null },
      },
      data: {
        blockedUntil: null,
        lastError: null,
      },
    });

    // Invalidar caché de proveedores
    this.emailTestingService['providerConfigService'].invalidateCache();

    return {
      success: true,
      accountsUnblocked: accountsUpdated.count,
      usageRecordsCleared: usageUpdated.count,
      message: 'Todos los proveedores han sido desbloqueados',
    };
  }

  @Get('providers-debug')
  async getProvidersDebug() {
    try {
      // Obtener TODOS los proveedores de la BD
      const allProviders = await this.prisma.emailProviderAccount.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          key: true,
          name: true,
          fromEmail: true,
          smtpHost: true,
          smtpPort: true,
          active: true,
          dailyLimit: true,
          smtpPassEncrypted: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Usar el método público del servicio de testing
      const providerStatus = await this.emailTestingService.getProviderStatus();

      return {
        inDatabase: {
          total: allProviders.length,
          active: allProviders.filter(p => p.active).length,
          inactive: allProviders.filter(p => !p.active).length,
        },
        loaded: {
          total: providerStatus.activeProviders,
          providers: providerStatus.providers.filter(p => !p.isBlocked).map(p => ({
            key: p.key,
            fromEmail: p.fromEmail,
            dailyLimit: p.dailyLimit,
            sentToday: p.sentToday,
          })),
        },
        failed: {
          total: allProviders.filter(p => p.active).length - providerStatus.activeProviders,
          reason: 'Probablemente error de desencriptación de contraseña',
        },
        allProvidersInDB: allProviders.map(p => ({
          key: p.key,
          name: p.name,
          fromEmail: p.fromEmail,
          active: p.active,
          hasEncryptedPassword: !!p.smtpPassEncrypted,
          encryptedValue: p.smtpPassEncrypted?.substring(0, 30) + '...',
        })),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  @Post('test-send-debug')
  async testSendDebug(@Body() dto: TestEmailDto) {
    const result = await this.emailTestingService.sendTestEmail(dto.recipientEmail, dto.type, {
      userName: dto.userName,
      matchId: dto.matchId,
      subject: dto.subject,
      htmlContent: dto.htmlContent,
      textContent: dto.textContent,
    });

    // Retornar la respuesta completa con información de debug
    return {
      ...result,
      debug: {
        hasAttempts: !!result.attempts,
        attemptsLength: result.attempts?.length || 0,
        totalProviders: result.totalProviders,
        attemptsData: result.attempts,
      },
    };
  }

  @Post('re-encrypt-passwords')
  async reEncryptPasswords(@Body() body: { password: string }) {
    const { password } = body;
    
    if (!password) {
      return {
        success: false,
        error: 'Password is required',
      };
    }

    try {
      // Obtener el proveedor "default" que SÍ funciona
      const defaultProvider = await this.prisma.emailProviderAccount.findFirst({
        where: {
          key: 'default',
          deletedAt: null,
        },
      });

      if (!defaultProvider) {
        return {
          success: false,
          error: 'No se encontró el proveedor default',
        };
      }

      // Usar la contraseña encriptada del proveedor default (que SÍ funciona)
      const workingEncryptedPassword = defaultProvider.smtpPassEncrypted;
      
      // Actualizar TODOS los proveedores activos con esta contraseña
      const result = await this.prisma.emailProviderAccount.updateMany({
        where: {
          deletedAt: null,
          active: true,
        },
        data: {
          smtpPassEncrypted: workingEncryptedPassword,
        },
      });

      return {
        success: true,
        totalProviders: result.count,
        message: `Actualizadas ${result.count} contraseñas con la encriptación que funciona`,
        note: 'Todos los proveedores ahora usan la misma contraseña encriptada del proveedor default. Reinicia el servidor para que se recarguen.',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }
}
