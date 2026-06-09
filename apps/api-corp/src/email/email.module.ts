import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@corp-api/prisma/prisma.module';
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
import { EmailTestingController } from './email-testing.controller';
import { EmailTestingService } from './email-testing.service';

const enableEmailDispatcher = process.env.CORP_EMAIL_DISPATCHER_ENABLED === 'true';

@Global()
@Module({
  imports: [ScheduleModule, PrismaModule],
  controllers: [EmailBlacklistController, EmailTestingController],
  providers: [
    EmailService,
    EmailBacklogAuditService,
    EmailBlacklistService,
    EmailProviderCryptoService,
    EmailProviderAccountsService,
    EmailProviderConfigService,
    EmailQueueService,
    MatchEmailTemplateService,
    ...(enableEmailDispatcher ? [EmailDispatcherScheduler, EmailBacklogAuditScheduler] : []),
    EmailTestingService,
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
    EmailTestingService,
  ],
})
export class EmailModule {}
