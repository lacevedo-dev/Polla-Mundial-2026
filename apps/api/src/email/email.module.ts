import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailBacklogAuditScheduler } from './email-backlog-audit.scheduler';
import { EmailBacklogAuditService } from './email-backlog-audit.service';
import { EmailBlacklistController } from './email-blacklist.controller';
import { EmailBlacklistService } from './email-blacklist.service';
import { EmailDispatcherScheduler } from './email-dispatcher.scheduler';
import { EmailProviderAccountsService } from './email-provider-accounts.service';
import { EmailProviderCryptoService } from './email-provider-crypto.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { EmailQueueService } from './email-queue.service';
import { EmailService } from './email.service';
import { MatchEmailTemplateService } from './match-email-template.service';

@Global()
@Module({
  imports: [ScheduleModule, PrismaModule],
  controllers: [EmailBlacklistController],
  providers: [
    EmailService,
    EmailBacklogAuditService,
    EmailBlacklistService,
    EmailProviderCryptoService,
    EmailProviderAccountsService,
    EmailProviderConfigService,
    EmailQueueService,
    MatchEmailTemplateService,
    EmailDispatcherScheduler,
    EmailBacklogAuditScheduler,
  ],
  exports: [
    EmailService,
    EmailBacklogAuditService,
    EmailBlacklistService,
    EmailProviderCryptoService,
    EmailProviderAccountsService,
    EmailProviderConfigService,
    EmailQueueService,
    MatchEmailTemplateService,
  ],
})
export class EmailModule {}
