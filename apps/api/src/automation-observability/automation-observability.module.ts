import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationObservabilityService } from './automation-observability.service';
import { AutomationSchemaHealthService } from './automation-schema-health.service';

@Module({
  imports: [PrismaModule],
  providers: [AutomationObservabilityService, AutomationSchemaHealthService],
  exports: [AutomationObservabilityService],
})
export class AutomationObservabilityModule {}
