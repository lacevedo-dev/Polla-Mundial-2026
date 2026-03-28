import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
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
  providers: [
    EmailService,
    EmailProviderCryptoService,
    EmailProviderAccountsService,
    EmailProviderConfigService,
    EmailQueueService,
    MatchEmailTemplateService,
    EmailDispatcherScheduler,
  ],
  exports: [
    EmailService,
    EmailProviderCryptoService,
    EmailProviderAccountsService,
    EmailProviderConfigService,
    EmailQueueService,
    MatchEmailTemplateService,
  ],
})
export class EmailModule {}
