import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@corp-api/prisma/prisma.module';
import { EmailBacklogAuditService } from '@corp-api/email/email-backlog-audit.service';
import { EmailBlacklistController } from '@corp-api/email/email-blacklist.controller';
import { EmailBlacklistService } from '@corp-api/email/email-blacklist.service';
import { EmailDispatcherScheduler } from '@corp-api/email/email-dispatcher.scheduler';
import { EmailProviderAccountsService } from '@corp-api/email/email-provider-accounts.service';
import { EmailProviderCryptoService } from '@corp-api/email/email-provider-crypto.service';
import { EmailProviderConfigService } from '@corp-api/email/email-provider-config.service';
import { EmailQueueService } from '@corp-api/email/email-queue.service';
import { EmailService } from '@corp-api/email/email.service';
import { MatchEmailTemplateService } from '@corp-api/email/match-email-template.service';
import { EmailTestingController } from '@corp-api/email/email-testing.controller';
import { EmailTestingService } from '@corp-api/email/email-testing.service';

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
        EmailDispatcherScheduler,
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
