import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_GOAL_STICKER_SETTINGS,
  GOAL_STICKER_CONFIG_KEY,
  GoalStickerSettings,
  isGoalStickerActiveFor,
  normalizeGoalStickerSettings,
  parseGoalStickerConfig,
} from './goal-sticker-config.util';

@Injectable()
export class GoalStickerConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<GoalStickerSettings> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: GOAL_STICKER_CONFIG_KEY },
      select: { value: true },
    });
    return parseGoalStickerConfig(row?.value);
  }

  async updateSettings(
    input: Partial<GoalStickerSettings>,
  ): Promise<GoalStickerSettings> {
    if (
      input.enabled === undefined &&
      input.dashboard === undefined &&
      input.whatsappGroup === undefined
    ) {
      throw new BadRequestException('Se requiere al menos un campo de sticker de goleador');
    }

    const current = await this.getSettings();
    const next = normalizeGoalStickerSettings({ ...current, ...input });

    await this.prisma.systemConfig.upsert({
      where: { key: GOAL_STICKER_CONFIG_KEY },
      create: {
        key: GOAL_STICKER_CONFIG_KEY,
        value: JSON.stringify(next),
      },
      update: {
        value: JSON.stringify(next),
      },
    });

    return next;
  }

  getDefaultSettings(): GoalStickerSettings {
    return { ...DEFAULT_GOAL_STICKER_SETTINGS };
  }

  async isActiveFor(destination: 'dashboard' | 'whatsappGroup'): Promise<boolean> {
    const settings = await this.getSettings();
    return isGoalStickerActiveFor(settings, destination);
  }
}
