import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationObservabilityService } from './automation-observability.service';

@Module({
  imports: [PrismaModule],
  providers: [AutomationObservabilityService],
  exports: [AutomationObservabilityService],
})
export class AutomationObservabilityModule {}
