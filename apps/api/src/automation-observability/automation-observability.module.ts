import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AutomationObservabilityService } from './automation-observability.service';

@Module({
  imports: [PrismaModule, WhatsappModule],
  providers: [AutomationObservabilityService],
  exports: [AutomationObservabilityService],
})
export class AutomationObservabilityModule {}
