import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsappGroupJobType, WhatsappJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappImageService } from './whatsapp-image.service';
import {
  PredictionReportService,
  WA_RESULT_REPORT_EVENT,
  WA_PREDICTION_REPORT_EVENT,
} from '../prediction-report/prediction-report.service';
import type { WhatsappReportEvent } from '../prediction-report/prediction-report.service';

@Injectable()
export class WhatsappGroupService {
  private readonly logger = new Logger(WhatsappGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waWeb: WhatsappWebService,
    private readonly waImage: WhatsappImageService,
    private readonly reportService: PredictionReportService,
  ) {}

  @OnEvent(WA_RESULT_REPORT_EVENT)
  async onResultReport(event: WhatsappReportEvent): Promise<void> {
    try {
      await this.enqueueForLeague(WhatsappGroupJobType.RESULT_REPORT, event.matchId, event.leagueId);
    } catch (e: any) {
      this.logger.warn(`Failed to enqueue WA result report: ${e.message}`);
    }
  }

  @OnEvent(WA_PREDICTION_REPORT_EVENT)
  async onPredictionReport(event: WhatsappReportEvent): Promise<void> {
    try {
      await this.enqueueForLeague(WhatsappGroupJobType.PREDICTION_REPORT, event.matchId, event.leagueId);
    } catch (e: any) {
      this.logger.warn(`Failed to enqueue WA prediction report: ${e.message}`);
    }
  }

  /**
   * Encola una publicación de WhatsApp si la liga tiene groupId configurado.
   * Usa dedupeKey para evitar dobles envíos. Es idempotente y best-effort.
   */
  async enqueueForLeague(
    type: WhatsappGroupJobType,
    matchId: string,
    leagueId: string,
  ): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true, name: true, code: true },
    });

    if (!league?.whatsappGroupId) return;

    const dedupeKey = `${type}:${matchId}:${leagueId}`;

    await this.prisma.whatsappGroupJob.upsert({
      where: { dedupeKey },
      create: {
        type,
        matchId,
        leagueId,
        groupId: league.whatsappGroupId,
        dedupeKey,
        caption: '',
        status: WhatsappJobStatus.PENDING,
      },
      update: {},
    });
  }

  /**
   * Procesa un job pendiente: genera imagen + PDF, publica en el grupo.
   */
  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.whatsappGroupJob.findUnique({
      where: { id: jobId },
      include: { league: { select: { name: true, code: true, whatsappGroupId: true } } },
    });

    if (!job || job.status === WhatsappJobStatus.SENT) return;

    await this.prisma.whatsappGroupJob.update({
      where: { id: jobId },
      data: { status: WhatsappJobStatus.SENDING, attemptCount: { increment: 1 } },
    });

    try {
      let imageBuffer: Buffer;
      let pdfBuffer: Buffer;
      let caption: string;
      let pdfFilename: string;

      if (job.type === WhatsappGroupJobType.RESULT_REPORT) {
        const data = await this.reportService.getResultsDataForLeague(job.matchId, job.leagueId);
        imageBuffer = await this.waImage.buildResultsCard({
          match: data.match,
          leagueName: job.league.name,
          leagueCode: job.league.code,
          results: data.results,
          sentAt: new Date(),
        });
        pdfBuffer = await this.reportService.getResultsPdfBuffer(job.matchId, job.leagueId);
        caption = buildResultCaption(data.match, job.league.name, data.results);
        pdfFilename = `resultado_${slug(data.match.homeTeam)}_vs_${slug(data.match.awayTeam)}.pdf`;
      } else {
        const data = await this.reportService.getPredictionsDataForLeague(job.matchId, job.leagueId);
        imageBuffer = await this.waImage.buildPredictionsCard({
          match: data.match,
          leagueName: job.league.name,
          leagueCode: job.league.code,
          predictors: data.predictors,
          sentAt: new Date(),
        });
        pdfBuffer = await this.reportService.getPredictionsPdfBuffer(job.matchId, job.leagueId);
        caption = buildPredictionsCaption(data.match, job.league.name, data.predictors.length);
        pdfFilename = `pronosticos_${slug(data.match.homeTeam)}_vs_${slug(data.match.awayTeam)}.pdf`;
      }

      await this.waWeb.sendToGroup({
        groupId: job.groupId,
        caption,
        imageBuffer,
        pdfBuffer,
        pdfFilename,
      });

      await this.prisma.whatsappGroupJob.update({
        where: { id: jobId },
        data: {
          status: WhatsappJobStatus.SENT,
          sentAt: new Date(),
          caption,
          lastError: null,
        },
      });

      this.logger.log(`WhatsApp group job ${jobId} (${job.type}) sent to ${job.groupId}`);
    } catch (error: any) {
      const lastError = error?.message ?? 'Unknown error';
      await this.prisma.whatsappGroupJob.update({
        where: { id: jobId },
        data: { status: WhatsappJobStatus.FAILED, lastError },
      });
      this.logger.error(`WhatsApp group job ${jobId} failed: ${lastError}`);
      throw error;
    }
  }

  async getPendingJobs(limit = 10) {
    return this.prisma.whatsappGroupJob.findMany({
      where: { status: WhatsappJobStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getRecentJobs(limit = 50) {
    return this.prisma.whatsappGroupJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { league: { select: { name: true, code: true } } },
    });
  }

  async resetFailedJob(jobId: string): Promise<void> {
    await this.prisma.whatsappGroupJob.update({
      where: { id: jobId },
      data: { status: WhatsappJobStatus.PENDING, lastError: null },
    });
  }

  async enqueueManual(
    type: WhatsappGroupJobType,
    matchId: string,
    leagueId: string,
  ): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true },
    });
    if (!league?.whatsappGroupId) {
      throw new Error(`League ${leagueId} has no whatsappGroupId configured`);
    }

    const dedupeKey = `${type}:${matchId}:${leagueId}`;
    // Delete existing so manual publish always re-queues
    await this.prisma.whatsappGroupJob.deleteMany({ where: { dedupeKey } });
    await this.prisma.whatsappGroupJob.create({
      data: {
        type,
        matchId,
        leagueId,
        groupId: league.whatsappGroupId,
        dedupeKey,
        caption: '',
        status: WhatsappJobStatus.PENDING,
      },
    });
  }
}

function slug(s: string): string {
  return s.replace(/\s+/g, '_').replace(/[^\w_]/g, '');
}

function buildResultCaption(
  match: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number },
  leagueName: string,
  results: Array<{ name: string; newPosition: number; pointsEarned: number; outcome: string }>,
): string {
  const winner = results.find((r) => r.newPosition === 1);
  const top3 = results
    .sort((a, b) => a.newPosition - b.newPosition)
    .slice(0, 3)
    .map((r) => `${r.newPosition}. ${r.name} (+${r.pointsEarned}pts)`)
    .join('\n');

  return [
    `✅ *Resultado Final* | ${leagueName}`,
    `⚽ ${match.homeTeam} ${match.homeScore} – ${match.awayScore} ${match.awayTeam}`,
    winner ? `🏆 Líder: ${winner.name}` : '',
    '',
    `📊 Top 3:`,
    top3,
    '',
    '_Reporte completo en el PDF adjunto_',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

function buildPredictionsCaption(
  match: { homeTeam: string; awayTeam: string; matchDate: Date },
  leagueName: string,
  count: number,
): string {
  const dateStr = new Date(match.matchDate).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    `🔒 *Predicciones Cerradas* | ${leagueName}`,
    `⚽ ${match.homeTeam} vs ${match.awayTeam}`,
    `📅 ${dateStr}`,
    `👥 ${count} pronóstico${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}`,
    '',
    '_Reporte completo en el PDF adjunto_',
  ].join('\n');
}
