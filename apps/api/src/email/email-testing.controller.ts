import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailTestingService } from './email-testing.service';
import { DispatchEmailJobDto, TestEmailDto, TestEmailQueueDto } from './dto/test-email.dto';
import { EmailQueueService } from './email-queue.service';

@Controller('email-testing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class EmailTestingController {
  constructor(
    private readonly emailTestingService: EmailTestingService,
    private readonly emailQueueService: EmailQueueService,
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
}
