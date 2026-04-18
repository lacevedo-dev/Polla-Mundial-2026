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

  @Get('providers-debug')
  async getProvidersDebug() {
    // Obtener TODOS los proveedores de la BD, incluyendo inactivos
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
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const activeCount = allProviders.filter(p => p.active).length;
    const inactiveCount = allProviders.filter(p => !p.active).length;

    return {
      total: allProviders.length,
      active: activeCount,
      inactive: inactiveCount,
      providers: allProviders,
    };
  }
}
