import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GoalStickerConfigService } from './goal-sticker-config.service';
import { LiveDisplayConfigService } from './live-display-config.service';

@Module({
  imports: [PrismaModule],
  providers: [LiveDisplayConfigService, GoalStickerConfigService],
  exports: [LiveDisplayConfigService, GoalStickerConfigService],
})
export class AutomationLiveConfigModule {}
