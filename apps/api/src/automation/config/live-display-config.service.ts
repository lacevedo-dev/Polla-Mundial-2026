import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_LIVE_DISPLAY_SETTINGS,
  LIVE_DISPLAY_CONFIG_KEY,
  LiveDisplaySettings,
  normalizeLiveDisplaySettings,
  parseLiveDisplayConfig,
} from './live-display-config.util';

@Injectable()
export class LiveDisplayConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<LiveDisplaySettings> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: LIVE_DISPLAY_CONFIG_KEY },
      select: { value: true },
    });
    return parseLiveDisplayConfig(row?.value);
  }

  async updateSettings(
    input: Partial<LiveDisplaySettings>,
  ): Promise<LiveDisplaySettings> {
    if (
      input.goals === undefined &&
      input.yellowCards === undefined &&
      input.redCards === undefined &&
      input.substitutions === undefined
    ) {
      throw new BadRequestException('Se requiere al menos un campo de pantalla en vivo');
    }

    const current = await this.getSettings();
    const next = normalizeLiveDisplaySettings({ ...current, ...input });

    await this.prisma.systemConfig.upsert({
      where: { key: LIVE_DISPLAY_CONFIG_KEY },
      create: {
        key: LIVE_DISPLAY_CONFIG_KEY,
        value: JSON.stringify(next),
      },
      update: {
        value: JSON.stringify(next),
      },
    });

    return next;
  }

  getDefaultSettings(): LiveDisplaySettings {
    return { ...DEFAULT_LIVE_DISPLAY_SETTINGS };
  }
}
