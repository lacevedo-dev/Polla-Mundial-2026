import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_PREDICTION_REPORT_MINUTES_BEFORE,
  normalizePredictionReportMinutesBefore,
  parsePredictionReportMinutesBeforeConfig,
  PREDICTION_REPORT_MINUTES_BEFORE_KEY,
} from './automation-timing.util';

export type AutomationTimingSettings = {
  predictionReportMinutesBefore: number;
};

@Injectable()
export class AutomationTimingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AutomationTimingSettings> {
    const minutes = await this.getPredictionReportMinutesBefore();
    return { predictionReportMinutesBefore: minutes };
  }

  async getPredictionReportMinutesBefore(): Promise<number> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: PREDICTION_REPORT_MINUTES_BEFORE_KEY },
      select: { value: true },
    });
    return parsePredictionReportMinutesBeforeConfig(row?.value);
  }

  async updateSettings(
    input: Partial<AutomationTimingSettings>,
  ): Promise<AutomationTimingSettings> {
    if (input.predictionReportMinutesBefore !== undefined) {
      const raw = input.predictionReportMinutesBefore;
      if (!Number.isFinite(raw) || raw < 1 || raw > 120) {
        throw new BadRequestException(
          'predictionReportMinutesBefore debe estar entre 1 y 120 minutos',
        );
      }
      const minutes = normalizePredictionReportMinutesBefore(raw);

      await this.prisma.systemConfig.upsert({
        where: { key: PREDICTION_REPORT_MINUTES_BEFORE_KEY },
        create: {
          key: PREDICTION_REPORT_MINUTES_BEFORE_KEY,
          value: JSON.stringify({ minutes }),
        },
        update: {
          value: JSON.stringify({ minutes }),
        },
      });
    }

    return this.getSettings();
  }

  getDefaultPredictionReportMinutesBefore(): number {
    return DEFAULT_PREDICTION_REPORT_MINUTES_BEFORE;
  }
}
