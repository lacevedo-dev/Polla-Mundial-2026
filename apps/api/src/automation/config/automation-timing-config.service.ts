import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE,
  normalizePredictionReportMinutesAfterClose,
  parsePredictionReportMinutesAfterCloseConfig,
  PREDICTION_REPORT_MINUTES_AFTER_CLOSE_KEY,
} from './automation-timing.util';

export type AutomationTimingSettings = {
  /** Minutos después del cierre de pronósticos para publicar el reporte. */
  predictionReportMinutesAfterClose: number;
  /** @deprecated Alias calculado para compatibilidad con UI legacy (T-N). */
  predictionReportMinutesBefore: number;
};

@Injectable()
export class AutomationTimingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AutomationTimingSettings> {
    const minutesAfterClose = await this.getPredictionReportMinutesAfterClose();
    return {
      predictionReportMinutesAfterClose: minutesAfterClose,
      predictionReportMinutesBefore: this.toLegacyMinutesBeforeKickoff(minutesAfterClose),
    };
  }

  async getPredictionReportMinutesAfterClose(): Promise<number> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: PREDICTION_REPORT_MINUTES_AFTER_CLOSE_KEY },
      select: { value: true },
    });
    return parsePredictionReportMinutesAfterCloseConfig(row?.value);
  }

  /** @deprecated Usar getPredictionReportMinutesAfterClose(). */
  async getPredictionReportMinutesBefore(): Promise<number> {
    const afterClose = await this.getPredictionReportMinutesAfterClose();
    return this.toLegacyMinutesBeforeKickoff(afterClose);
  }

  async updateSettings(
    input: Partial<AutomationTimingSettings>,
  ): Promise<AutomationTimingSettings> {
    const rawAfterClose =
      input.predictionReportMinutesAfterClose ??
      input.predictionReportMinutesBefore;

    if (rawAfterClose !== undefined) {
      const minutes = this.resolveMinutesAfterClose(rawAfterClose);
      await this.prisma.systemConfig.upsert({
        where: { key: PREDICTION_REPORT_MINUTES_AFTER_CLOSE_KEY },
        create: {
          key: PREDICTION_REPORT_MINUTES_AFTER_CLOSE_KEY,
          value: JSON.stringify({ minutes }),
        },
        update: {
          value: JSON.stringify({ minutes }),
        },
      });
    }

    return this.getSettings();
  }

  getDefaultPredictionReportMinutesAfterClose(): number {
    return DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE;
  }

  /** @deprecated */
  getDefaultPredictionReportMinutesBefore(): number {
    return this.toLegacyMinutesBeforeKickoff(
      DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE,
    );
  }

  private resolveMinutesAfterClose(raw: number): number {
    if (!Number.isFinite(raw)) {
      throw new BadRequestException(
        'predictionReportMinutesAfterClose debe ser un número válido',
      );
    }
    // Valores legacy >= 5 eran "minutos antes del kickoff"; migrar a 1 min post-cierre.
    if (raw >= 5) {
      return DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE;
    }
    const minutes = normalizePredictionReportMinutesAfterClose(raw);
    if (minutes < 0 || minutes > 30) {
      throw new BadRequestException(
        'predictionReportMinutesAfterClose debe estar entre 0 y 30 minutos',
      );
    }
    return minutes;
  }

  private toLegacyMinutesBeforeKickoff(minutesAfterClose: number): number {
    return Math.max(1, 15 - minutesAfterClose);
  }
}
