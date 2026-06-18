import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsappGroupJobType, WhatsappJobStatus, AutomationStep, MemberStatus } from '@prisma/client';
import { logGoalAutomation } from '../automation/live/goal-automation-observability.util';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappWebService } from './whatsapp-web.service';
import { WhatsappImageService } from './whatsapp-image.service';
import {
  PredictionReportService,
  WA_RESULT_REPORT_EVENT,
  WA_PREDICTION_REPORT_EVENT,
} from '../prediction-report/prediction-report.service';
import type { WhatsappReportEvent } from '../prediction-report/prediction-report.service';
import { automationStepToEscalationCheckpoint } from '../automation/config/automation-timing.util';
import {
  buildT60WaGroupCaption,
  escalationDedupeKey,
} from '../automation/pre-match/pre-match-message.builder';
import {
  BOGOTA_TIME_LABEL,
  formatMatchDateTimeBogota,
} from '../automation/config/automation-datetime.util';
import {
  isTextOnlyWhatsappGroupJob,
  WhatsappDispatcherService,
} from './whatsapp-dispatcher.service';
import {
  formatRedCardReason,
  normalizeEventPlayerKey,
} from '../matches/match-events.util';

/** Reintentos automáticos al fallar envío WA Grupo. */
export const WA_GROUP_MAX_ATTEMPTS = 3;
/** Reintento tras fallo: antes 60s (parecía ~2 min con el cron de 1 min). */
export const WA_GROUP_RETRY_DELAY_MS = 15_000;

/** Mapeo de job type a schedulerId (mismo id que usa el frontend) */
const JOB_TYPE_TO_SCHEDULER: Partial<Record<WhatsappGroupJobType, string>> = {
  [WhatsappGroupJobType.MATCH_REMINDER]:      'match_reminder',
  [WhatsappGroupJobType.PREDICTION_CLOSED]:   'prediction_closing',
  [WhatsappGroupJobType.RESULT_NOTIFICATION]: 'match_result',
  [WhatsappGroupJobType.GOAL_SCORED]:         'live_goal',
  [WhatsappGroupJobType.PREDICTION_REPORT]:   'prediction_report',
  [WhatsappGroupJobType.RESULT_REPORT]:       'result_report',
  [WhatsappGroupJobType.PRE_MATCH_ESCALATION]: 'pre_match_escalation',
  [WhatsappGroupJobType.MATCH_START]: 'live_match_start',
  [WhatsappGroupJobType.HALFTIME]: 'live_halftime',
  [WhatsappGroupJobType.SECOND_HALF_START]: 'live_second_half',
  [WhatsappGroupJobType.MATCH_LIVE_END]: 'live_match_end',
  [WhatsappGroupJobType.GOAL_IMPACT]: 'live_goal_impact',
  [WhatsappGroupJobType.RED_CARD]: 'live_red_card',
  [WhatsappGroupJobType.YELLOW_CARD]: 'live_yellow_card',
  [WhatsappGroupJobType.SUBSTITUTION]: 'live_substitution',
  [WhatsappGroupJobType.PAYMENT_REMINDER]: 'payment_reminder',
};

@Injectable()
export class WhatsappGroupService {
  private readonly logger = new Logger(WhatsappGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waWeb: WhatsappWebService,
    private readonly waImage: WhatsappImageService,
    private readonly reportService: PredictionReportService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private scheduleTextJobDispatch(jobId: string, type: WhatsappGroupJobType): void {
    if (!isTextOnlyWhatsappGroupJob(type)) return;
    try {
      const dispatcher = this.moduleRef.get(WhatsappDispatcherService, { strict: false });
      dispatcher?.schedule(jobId);
    } catch {
      // Dispatcher aún no registrado (arranque).
    }
  }

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
  private async isChannelEnabledForType(type: WhatsappGroupJobType): Promise<boolean> {
    const schedulerId = JOB_TYPE_TO_SCHEDULER[type];
    if (!schedulerId) return true;
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: 'automation:channel_overrides' },
    });
    if (!row) return true;
    const overrides: Record<string, Record<string, boolean>> = JSON.parse(row.value);
    return overrides[schedulerId]?.['waGroup'] !== false;
  }

  async enqueueForLeague(
    type: WhatsappGroupJobType,
    matchId: string,
    leagueId: string,
  ): Promise<void> {
    if (!(await this.isChannelEnabledForType(type))) {
      this.logger.debug(`WA Grupo deshabilitado para ${type} por override de configuración`);
      return;
    }

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
    const claimed = await this.prisma.whatsappGroupJob.updateMany({
      where: { id: jobId, status: WhatsappJobStatus.PENDING },
      data: { status: WhatsappJobStatus.SENDING, attemptCount: { increment: 1 } },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.whatsappGroupJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (existing?.status === WhatsappJobStatus.SENT || existing?.status === WhatsappJobStatus.SENDING) {
        return;
      }
      return;
    }

    const job = await this.prisma.whatsappGroupJob.findUnique({
      where: { id: jobId },
      include: { league: { select: { name: true, code: true, whatsappGroupId: true } } },
    });

    if (!job) return;

    const isGoalJob =
      job.type === WhatsappGroupJobType.GOAL_SCORED ||
      job.type === WhatsappGroupJobType.GOAL_IMPACT;

    if (isGoalJob) {
      logGoalAutomation(this.logger, 'goal_wa_job_processing', {
        jobId: job.id,
        jobType: job.type,
        matchId: job.matchId,
        leagueId: job.leagueId,
        groupId: job.groupId,
        attempt: job.attemptCount + 1,
      });
    }

    try {
      let caption: string;

      // Types that require image + PDF (full report)
      const isFullReport =
        job.type === WhatsappGroupJobType.RESULT_REPORT ||
        job.type === WhatsappGroupJobType.PREDICTION_REPORT;

      if (isFullReport) {
        let imageBuffer: Buffer;
        let pdfBuffer: Buffer;
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
      } else {
        // Text-only notification messages (no image/PDF)
        caption = job.caption || await this.buildTextCaption(job);
        await this.waWeb.sendTextToGroup(job.groupId, caption);
      }

      await this.prisma.whatsappGroupJob.update({
        where: { id: jobId },
        data: {
          status: WhatsappJobStatus.SENT,
          sentAt: new Date(),
          caption: this.appendSentTimestamp(caption),
          lastError: null,
        },
      });

      this.logger.log(`WhatsApp group job ${jobId} (${job.type}) sent to ${job.groupId}`);

      if (isGoalJob) {
        logGoalAutomation(this.logger, 'goal_wa_job_sent', {
          jobId: job.id,
          jobType: job.type,
          matchId: job.matchId,
          leagueId: job.leagueId,
          groupId: job.groupId,
        });
      }
    } catch (error: unknown) {
      const lastError =
        error instanceof Error ? error.message : String(error);
      const current = await this.prisma.whatsappGroupJob.findUnique({
        where: { id: jobId },
        select: { attemptCount: true },
      });
      const attempts = current?.attemptCount ?? 1;

      if (isGoalJob) {
        logGoalAutomation(this.logger, 'goal_wa_job_failed', {
          jobId,
          jobType: job?.type ?? 'unknown',
          matchId: job?.matchId ?? null,
          leagueId: job?.leagueId ?? null,
          attempt: attempts,
          maxAttempts: WA_GROUP_MAX_ATTEMPTS,
          error: lastError,
          willRetry: attempts < WA_GROUP_MAX_ATTEMPTS,
        }, attempts < WA_GROUP_MAX_ATTEMPTS ? 'warn' : 'error');
      }

      if (attempts < WA_GROUP_MAX_ATTEMPTS) {
        await this.prisma.whatsappGroupJob.update({
          where: { id: jobId },
          data: {
            status: WhatsappJobStatus.PENDING,
            lastError: `[intento ${attempts}/${WA_GROUP_MAX_ATTEMPTS}] ${lastError}`,
          },
        });
        this.logger.warn(
          `WhatsApp group job ${jobId} reintento ${attempts}/${WA_GROUP_MAX_ATTEMPTS}: ${lastError}`,
        );
      } else {
        await this.prisma.whatsappGroupJob.update({
          where: { id: jobId },
          data: {
            status: WhatsappJobStatus.FAILED,
            lastError: `[agotados ${WA_GROUP_MAX_ATTEMPTS} intentos] ${lastError}`,
          },
        });
        this.logger.error(
          `WhatsApp group job ${jobId} failed after ${WA_GROUP_MAX_ATTEMPTS} attempts: ${lastError}`,
        );
      }
      throw error instanceof Error ? error : new Error(lastError);
    }
  }

  private appendSentTimestamp(caption: string): string {
    if (caption.includes('Enviado al grupo:')) {
      return caption;
    }
    const sentAt = new Date();
    return `${caption}\n📤 Enviado al grupo: ${formatMatchDateTimeBogota(sentAt)} (${BOGOTA_TIME_LABEL})`;
  }

  async getPendingJobs(limit = 10) {
    const retryAfter = new Date(Date.now() - WA_GROUP_RETRY_DELAY_MS);
    const staleSendingBefore = new Date(Date.now() - WA_GROUP_RETRY_DELAY_MS * 2);

    await this.prisma.whatsappGroupJob.updateMany({
      where: {
        status: WhatsappJobStatus.SENDING,
        updatedAt: { lte: staleSendingBefore },
      },
      data: { status: WhatsappJobStatus.PENDING },
    });

    return this.prisma.whatsappGroupJob.findMany({
      where: {
        status: WhatsappJobStatus.PENDING,
        OR: [{ attemptCount: 0 }, { updatedAt: { lte: retryAfter } }],
      },
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
      data: {
        status: WhatsappJobStatus.PENDING,
        lastError: null,
        attemptCount: 0,
      },
    });
  }

  /**
   * Encola una notificación de texto para los 3 tipos automáticos.
   * Guarda el caption preconstruido directamente en el job.
   */
  /**
   * Encola un gol en vivo. Dedupe por marcador para permitir múltiples goles por partido.
   */
  async enqueueGoalNotification(
    matchId: string,
    leagueId: string,
    params: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      scoringTeam: string | null;
      elapsed: number | null;
      leagueName: string;
      scorerName?: string | null;
      assistName?: string | null;
      goalDetail?: string | null;
    },
  ): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(WhatsappGroupJobType.GOAL_SCORED))) {
      this.logger.warn(
        `GOAL_SCORED: canal WA Grupo deshabilitado (scheduler live_goal) para liga ${leagueId}`,
      );
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true, name: true },
    });
    if (!league?.whatsappGroupId) {
      this.logger.warn(
        `GOAL_SCORED: liga ${league?.name ?? leagueId} sin whatsappGroupId configurado`,
      );
      return false;
    }

    const caption = buildGoalCaption(params);
    const dedupeKey = `GOAL_SCORED:${matchId}:${leagueId}:${params.homeScore}-${params.awayScore}`;

    const existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT) {
      return true;
    }

    if (existing?.status === WhatsappJobStatus.FAILED) {
      await this.prisma.whatsappGroupJob.update({
        where: { id: existing.id },
        data: {
          status: WhatsappJobStatus.PENDING,
          caption,
          lastError: null,
          attemptCount: 0,
        },
      });
      this.scheduleTextJobDispatch(existing.id, WhatsappGroupJobType.GOAL_SCORED);
      return true;
    }

    if (existing) {
      return true;
    }

    try {
      const job = await this.prisma.whatsappGroupJob.create({
        data: {
          type: WhatsappGroupJobType.GOAL_SCORED,
          matchId,
          leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey,
          caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      this.scheduleTextJobDispatch(job.id, WhatsappGroupJobType.GOAL_SCORED);
      return true;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') {
        this.logger.warn(`GOAL_SCORED: job duplicado ${dedupeKey}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Encola tarjeta roja en vivo. Dedupe por partido, liga, minuto y jugador.
   */
  async enqueueRedCardNotification(
    matchId: string,
    leagueId: string,
    params: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      elapsed: number | null;
      leagueName: string;
      playerName?: string | null;
      teamName?: string | null;
      cardDetail?: string | null;
      minute: number;
      extraMin?: number | null;
    },
  ): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(WhatsappGroupJobType.RED_CARD))) {
      this.logger.warn(
        `RED_CARD: canal WA Grupo deshabilitado (scheduler live_red_card) para liga ${leagueId}`,
      );
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true, name: true },
    });
    if (!league?.whatsappGroupId) {
      this.logger.warn(
        `RED_CARD: liga ${league?.name ?? leagueId} sin whatsappGroupId configurado`,
      );
      return false;
    }

    const caption = buildRedCardCaption(params);
    const playerKey = normalizeEventPlayerKey(params.playerName);
    const extra = params.extraMin ?? 0;
    const dedupeKey =
      `RED_CARD:${matchId}:${leagueId}:${params.minute}:${extra}:${playerKey}`;

    const existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT) {
      return true;
    }

    if (existing?.status === WhatsappJobStatus.FAILED) {
      await this.prisma.whatsappGroupJob.update({
        where: { id: existing.id },
        data: {
          status: WhatsappJobStatus.PENDING,
          caption,
          lastError: null,
          attemptCount: 0,
        },
      });
      this.scheduleTextJobDispatch(existing.id, WhatsappGroupJobType.RED_CARD);
      return true;
    }

    if (existing) {
      return true;
    }

    try {
      const job = await this.prisma.whatsappGroupJob.create({
        data: {
          type: WhatsappGroupJobType.RED_CARD,
          matchId,
          leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey,
          caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      this.scheduleTextJobDispatch(job.id, WhatsappGroupJobType.RED_CARD);
      return true;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') {
        this.logger.warn(`RED_CARD: job duplicado ${dedupeKey}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Encola tarjeta amarilla en vivo. Dedupe por partido, liga, minuto y jugador.
   */
  async enqueueYellowCardNotification(
    matchId: string,
    leagueId: string,
    params: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      elapsed: number | null;
      leagueName: string;
      playerName?: string | null;
      teamName?: string | null;
      minute: number;
      extraMin?: number | null;
    },
  ): Promise<boolean> {
    return this.enqueueLiveTextNotification({
      type: WhatsappGroupJobType.YELLOW_CARD,
      schedulerId: 'live_yellow_card',
      logPrefix: 'YELLOW_CARD',
      matchId,
      leagueId,
      caption: buildYellowCardCaption(params),
      dedupeKey: `YELLOW_CARD:${matchId}:${leagueId}:${params.minute}:${params.extraMin ?? 0}:${normalizeEventPlayerKey(params.playerName)}`,
    });
  }

  /**
   * Encola sustitución en vivo. Dedupe por partido, liga, minuto y jugadores.
   */
  async enqueueSubstitutionNotification(
    matchId: string,
    leagueId: string,
    params: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      elapsed: number | null;
      leagueName: string;
      playerInName?: string | null;
      playerOutName?: string | null;
      teamName?: string | null;
      minute: number;
      extraMin?: number | null;
    },
  ): Promise<boolean> {
    const inKey = normalizeEventPlayerKey(params.playerInName);
    const outKey = normalizeEventPlayerKey(params.playerOutName);
    return this.enqueueLiveTextNotification({
      type: WhatsappGroupJobType.SUBSTITUTION,
      schedulerId: 'live_substitution',
      logPrefix: 'SUBSTITUTION',
      matchId,
      leagueId,
      caption: buildSubstitutionCaption(params),
      dedupeKey: `SUBSTITUTION:${matchId}:${leagueId}:${params.minute}:${params.extraMin ?? 0}:${inKey}:${outKey}`,
    });
  }

  private async enqueueLiveTextNotification(params: {
    type: WhatsappGroupJobType;
    schedulerId: string;
    logPrefix: string;
    matchId: string;
    leagueId: string;
    caption: string;
    dedupeKey: string;
  }): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(params.type))) {
      this.logger.warn(
        `${params.logPrefix}: canal WA Grupo deshabilitado (${params.schedulerId}) para liga ${params.leagueId}`,
      );
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: params.leagueId },
      select: { whatsappGroupId: true, name: true },
    });
    if (!league?.whatsappGroupId) {
      this.logger.warn(
        `${params.logPrefix}: liga ${league?.name ?? params.leagueId} sin whatsappGroupId configurado`,
      );
      return false;
    }

    const existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey: params.dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT) {
      return true;
    }

    if (existing?.status === WhatsappJobStatus.FAILED) {
      await this.prisma.whatsappGroupJob.update({
        where: { id: existing.id },
        data: {
          status: WhatsappJobStatus.PENDING,
          caption: params.caption,
          lastError: null,
          attemptCount: 0,
        },
      });
      this.scheduleTextJobDispatch(existing.id, params.type);
      return true;
    }

    if (existing) {
      return true;
    }

    try {
      const job = await this.prisma.whatsappGroupJob.create({
        data: {
          type: params.type,
          matchId: params.matchId,
          leagueId: params.leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey: params.dedupeKey,
          caption: params.caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      this.scheduleTextJobDispatch(job.id, params.type);
      return true;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') {
        this.logger.warn(`${params.logPrefix}: job duplicado ${params.dedupeKey}`);
        return false;
      }
      throw error;
    }
  }

  async retryStepDelivery(
    matchId: string,
    leagueId: string,
    type: WhatsappGroupJobType,
    options?: {
      automationStep?: AutomationStep;
      forceResend?: boolean;
      caption?: string;
    },
  ): Promise<{ ok: boolean; message: string; jobId?: string }> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true, name: true },
    });

    if (!league?.whatsappGroupId) {
      return {
        ok: false,
        message: `La liga "${league?.name ?? leagueId}" no tiene grupo de WhatsApp asignado.`,
      };
    }

    if (!this.waWeb.isConnected()) {
      return {
        ok: false,
        message: 'WhatsApp Web no está conectado. Ve a Admin → WhatsApp y escanea el QR.',
      };
    }

    const dedupeKey = await this.resolveRetryDedupeKey(
      matchId,
      leagueId,
      type,
      options?.automationStep,
    );

    if (!dedupeKey) {
      return {
        ok: false,
        message:
          'No se encontró un job previo para reintentar. Ejecuta el reintento del paso completo primero.',
      };
    }

    let existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT && !options?.forceResend) {
      return { ok: true, message: 'El mensaje ya fue enviado al grupo.', jobId: existing.id };
    }

    if (existing) {
      if (options?.caption) {
        await this.prisma.whatsappGroupJob.update({
          where: { id: existing.id },
          data: { caption: options.caption, lastError: null },
        });
      }
      await this.resetFailedJob(existing.id);
    } else if (options?.caption) {
      await this.prisma.whatsappGroupJob.create({
        data: {
          type,
          matchId,
          leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey,
          caption: options.caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      existing = await this.prisma.whatsappGroupJob.findUnique({
        where: { dedupeKey },
        select: { id: true, status: true },
      });
    } else {
      await this.enqueueManual(type, matchId, leagueId);
      existing = await this.prisma.whatsappGroupJob.findUnique({
        where: { dedupeKey },
        select: { id: true, status: true },
      });
    }

    const job = existing ?? (await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true },
    }));

    if (!job) {
      return { ok: false, message: 'No se pudo crear el job de reintento.' };
    }

    try {
      await this.processJob(job.id);
      const final = await this.prisma.whatsappGroupJob.findUnique({
        where: { id: job.id },
        select: { status: true, lastError: true },
      });
      if (final?.status === WhatsappJobStatus.SENT) {
        return { ok: true, message: 'Mensaje reenviado al grupo de WhatsApp.', jobId: job.id };
      }
      return {
        ok: false,
        message:
          final?.lastError ??
          'El job no quedó en estado SENT. Revisa Admin → WhatsApp (sesión conectada).',
        jobId: job.id,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: message || 'Falló el reenvío al grupo de WhatsApp.',
        jobId: job.id,
      };
    }
  }

  private async resolveRetryDedupeKey(
    matchId: string,
    leagueId: string,
    type: WhatsappGroupJobType,
    automationStep?: AutomationStep,
  ): Promise<string | null> {
    if (type === WhatsappGroupJobType.PRE_MATCH_ESCALATION && automationStep) {
      const checkpoint = automationStepToEscalationCheckpoint(automationStep);
      if (checkpoint) {
        return escalationDedupeKey(checkpoint, matchId, leagueId);
      }
    }

    if (type === WhatsappGroupJobType.GOAL_IMPACT) {
      const job = await this.prisma.whatsappGroupJob.findFirst({
        where: { matchId, leagueId, type: WhatsappGroupJobType.GOAL_IMPACT },
        orderBy: { createdAt: 'desc' },
        select: { dedupeKey: true },
      });
      return job?.dedupeKey ?? null;
    }

    if (type === WhatsappGroupJobType.GOAL_SCORED) {
      const job = await this.prisma.whatsappGroupJob.findFirst({
        where: { matchId, leagueId, type: WhatsappGroupJobType.GOAL_SCORED },
        orderBy: { createdAt: 'desc' },
        select: { dedupeKey: true },
      });
      return job?.dedupeKey ?? null;
    }

    return `${type}:${matchId}:${leagueId}`;
  }

  async enqueueNotification(
    type: WhatsappGroupJobType,
    matchId: string,
    leagueId: string,
    caption: string,
  ): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(type))) {
      this.logger.debug(`WA Grupo deshabilitado para ${type} por override de configuración`);
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true },
    });
    if (!league?.whatsappGroupId) return false;

    const dedupeKey = `${type}:${matchId}:${leagueId}`;
    const existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT) {
      return true;
    }

    if (existing?.status === WhatsappJobStatus.FAILED) {
      await this.resetFailedJob(existing.id);
      this.scheduleTextJobDispatch(existing.id, type);
      return true;
    }

    if (existing) {
      return true;
    }

    const job = await this.prisma.whatsappGroupJob.create({
      data: {
        type,
        matchId,
        leagueId,
        groupId: league.whatsappGroupId,
        dedupeKey,
        caption,
        status: WhatsappJobStatus.PENDING,
      },
    });
    this.scheduleTextJobDispatch(job.id, type);
    return true;
  }

  /**
   * Escalada pre-partido con dedupeKey por checkpoint (T45/T30/T_FINAL).
   */
  async enqueuePreMatchEscalation(
    matchId: string,
    leagueId: string,
    caption: string,
    dedupeKey: string,
  ): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(WhatsappGroupJobType.PRE_MATCH_ESCALATION))) {
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true },
    });
    if (!league?.whatsappGroupId) return false;

    const existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT) {
      return true;
    }

    if (existing?.status === WhatsappJobStatus.FAILED) {
      await this.resetFailedJob(existing.id);
      this.scheduleTextJobDispatch(existing.id, WhatsappGroupJobType.PRE_MATCH_ESCALATION);
      return true;
    }

    if (existing) {
      return true;
    }

    try {
      const job = await this.prisma.whatsappGroupJob.create({
        data: {
          type: WhatsappGroupJobType.PRE_MATCH_ESCALATION,
          matchId,
          leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey,
          caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      this.scheduleTextJobDispatch(job.id, WhatsappGroupJobType.PRE_MATCH_ESCALATION);
      return true;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') return false;
      throw error;
    }
  }

  /**
   * Mensaje de impacto en la polla tras un gol. Dedupe por marcador (como GOAL_SCORED).
   */
  async enqueueGoalImpact(
    matchId: string,
    leagueId: string,
    caption: string,
    dedupeKey: string,
  ): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(WhatsappGroupJobType.GOAL_IMPACT))) {
      this.logger.warn(
        `GOAL_IMPACT: canal WA Grupo deshabilitado (scheduler live_goal_impact) para liga ${leagueId}`,
      );
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true, name: true },
    });
    if (!league?.whatsappGroupId) {
      this.logger.warn(
        `GOAL_IMPACT: liga ${league?.name ?? leagueId} sin whatsappGroupId configurado`,
      );
      return false;
    }

    const existing = await this.prisma.whatsappGroupJob.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });

    if (existing?.status === WhatsappJobStatus.SENT) {
      return true;
    }

    if (existing?.status === WhatsappJobStatus.FAILED) {
      await this.resetFailedJob(existing.id);
      this.scheduleTextJobDispatch(existing.id, WhatsappGroupJobType.GOAL_IMPACT);
      return true;
    }

    if (existing) {
      return true;
    }

    try {
      const job = await this.prisma.whatsappGroupJob.create({
        data: {
          type: WhatsappGroupJobType.GOAL_IMPACT,
          matchId,
          leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey,
          caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      this.scheduleTextJobDispatch(job.id, WhatsappGroupJobType.GOAL_IMPACT);
      return true;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') return false;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('AutomationStep') || message.includes('WhatsappGroupJobType')) {
        this.logger.error(
          JSON.stringify({
            event: 'goal_automation',
            kind: 'goal_impact_enqueue_failed',
            matchId,
            leagueId,
            reason: 'database_enum_missing',
            error: message,
            hint: 'Ejecutar npx prisma migrate deploy (20260617_automation_live_steps) y redeploy API.',
          }),
        );
        return false;
      }
      throw error;
    }
  }

  private async buildT60ReminderFallbackCaption(
    matchId: string,
    leagueId: string,
    leagueName: string,
    home: string,
    away: string,
    matchDate: Date,
  ): Promise<string> {
    try {
      const league = await this.prisma.league.findUnique({
        where: { id: leagueId },
        select: {
          closePredictionMinutes: true,
          members: {
            where: { status: MemberStatus.ACTIVE },
            select: {
              userId: true,
              user: { select: { name: true } },
            },
          },
        },
      });
      const predictions = await this.prisma.prediction.findMany({
        where: { matchId, leagueId },
        select: { userId: true },
      });
      const predictedIds = new Set(predictions.map((p) => p.userId));
      const missingMembers = (league?.members ?? [])
        .filter((m) => !predictedIds.has(m.userId))
        .map((m) => ({
          userId: m.userId,
          displayName: m.user.name?.trim() || 'Participante',
        }));

      return buildT60WaGroupCaption({
        leagueName,
        homeTeam: home,
        awayTeam: away,
        matchDate,
        closeMinutes: league?.closePredictionMinutes ?? 15,
        missingMembers,
        predictedCount: predictions.length,
        totalMembers: league?.members.length ?? 0,
      });
    } catch {
      return `⏰ *Recordatorio T-60* | ${leagueName}\n⚽ ${home} vs ${away}`;
    }
  }

  private async buildTextCaption(job: {
    type: WhatsappGroupJobType;
    matchId: string;
    leagueId: string;
    league: { name: string; code: string };
  }): Promise<string> {
    const match = await this.prisma.match.findUnique({
      where: { id: job.matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) return `Notificación de partido | ${job.league.name}`;

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;

    switch (job.type) {
      case WhatsappGroupJobType.MATCH_REMINDER:
        return this.buildT60ReminderFallbackCaption(job.matchId, job.leagueId, job.league.name, home, away, match.matchDate);
      case WhatsappGroupJobType.PREDICTION_CLOSED:
        return buildPredictionClosedCaption(home, away, job.league.name);
      case WhatsappGroupJobType.RESULT_NOTIFICATION:
        return buildResultNotifCaption(home, away, match.homeScore, match.awayScore, job.league.name);
      case WhatsappGroupJobType.GOAL_SCORED:
        return buildGoalCaption({
          homeTeam: home,
          awayTeam: away,
          homeScore: match.homeScore ?? 0,
          awayScore: match.awayScore ?? 0,
          scoringTeam: null,
          elapsed: match.elapsed,
          leagueName: job.league.name,
        });
      default:
        return `Notificación | ${job.league.name}: ${home} vs ${away}`;
    }
  }

  async enqueuePaymentReminder(
    leagueId: string,
    caption: string,
    dedupeKey: string,
  ): Promise<boolean> {
    if (!(await this.isChannelEnabledForType(WhatsappGroupJobType.PAYMENT_REMINDER))) {
      this.logger.debug('WA Grupo deshabilitado para PAYMENT_REMINDER por override de configuración');
      return false;
    }

    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { whatsappGroupId: true },
    });
    if (!league?.whatsappGroupId) return false;

    try {
      const job = await this.prisma.whatsappGroupJob.create({
        data: {
          type: WhatsappGroupJobType.PAYMENT_REMINDER,
          matchId: leagueId,
          leagueId,
          groupId: league.whatsappGroupId,
          dedupeKey,
          caption,
          status: WhatsappJobStatus.PENDING,
        },
      });
      this.scheduleTextJobDispatch(job.id, WhatsappGroupJobType.PAYMENT_REMINDER);
      return true;
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') return false;
      throw error;
    }
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

function buildPredictionClosedCaption(home: string, away: string, leagueName: string): string {
  return [
    `🔒 *Pronósticos Cerrados* | ${leagueName}`,
    `⚽ ${home} vs ${away}`,
    '',
    'Ya no se pueden modificar los pronósticos. ¡Mucho éxito! 🤞',
    '',
    '_Los pronósticos completos se publicarán en el reporte adjunto_',
  ].join('\n');
}

function buildResultNotifCaption(
  home: string, away: string,
  homeScore: number | null, awayScore: number | null,
  leagueName: string,
): string {
  const score = homeScore !== null && awayScore !== null
    ? `${homeScore} – ${awayScore}` : '? – ?';
  return [
    `🏁 *Resultado Final* | ${leagueName}`,
    `⚽ ${home} ${score} ${away}`,
    '',
    '¡El partido terminó! Los puntos serán calculados y el reporte completo llegará en breve.',
  ].join('\n');
}

function formatLiveMinuteLabel(params: {
  minute: number;
  extraMin?: number | null;
  elapsed?: number | null;
}): string {
  if (params.minute != null) {
    return params.extraMin ? ` ${params.minute}+${params.extraMin}'` : ` ${params.minute}'`;
  }
  return params.elapsed ? ` ${params.elapsed}'` : '';
}

function buildRedCardCaption(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  leagueName: string;
  playerName?: string | null;
  teamName?: string | null;
  cardDetail?: string | null;
  minute: number;
  extraMin?: number | null;
}): string {
  const minuteLabel = formatLiveMinuteLabel(params);
  const score = `${params.homeScore} – ${params.awayScore}`;
  const reason = formatRedCardReason(params.cardDetail);
  const reasonSuffix = reason ? ` (${reason})` : '';
  const playerLine = params.playerName
    ? params.teamName
      ? `${params.playerName} (${params.teamName})${reasonSuffix}`
      : `${params.playerName}${reasonSuffix}`
    : params.teamName
      ? `${params.teamName}${reasonSuffix}`
      : `Expulsión${reasonSuffix}`;

  return [
    `🟥 *¡Tarjeta roja!* | ${params.leagueName}`,
    `${playerLine} — ${params.homeTeam} ${score} ${params.awayTeam}${minuteLabel}`,
  ].join('\n');
}

function buildYellowCardCaption(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  leagueName: string;
  playerName?: string | null;
  teamName?: string | null;
  minute: number;
  extraMin?: number | null;
}): string {
  const minuteLabel = formatLiveMinuteLabel(params);
  const score = `${params.homeScore} – ${params.awayScore}`;
  const playerLine = params.playerName
    ? params.teamName
      ? `${params.playerName} (${params.teamName})`
      : params.playerName
    : params.teamName ?? 'Jugador';

  return [
    `🟨 *¡Tarjeta amarilla!* | ${params.leagueName}`,
    `${playerLine} — ${params.homeTeam} ${score} ${params.awayTeam}${minuteLabel}`,
  ].join('\n');
}

function buildSubstitutionCaption(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  leagueName: string;
  playerInName?: string | null;
  playerOutName?: string | null;
  teamName?: string | null;
  minute: number;
  extraMin?: number | null;
}): string {
  const minuteLabel = formatLiveMinuteLabel(params);
  const score = `${params.homeScore} – ${params.awayScore}`;
  const teamSuffix = params.teamName ? ` (${params.teamName})` : '';
  const changeLine =
    params.playerInName && params.playerOutName
      ? `${params.playerInName} entra por ${params.playerOutName}${teamSuffix}`
      : params.playerInName
        ? `${params.playerInName} entra${teamSuffix}`
        : params.playerOutName
          ? `Sale ${params.playerOutName}${teamSuffix}`
          : `Cambio${teamSuffix}`;

  return [
    `🔄 *¡Cambio!* | ${params.leagueName}`,
    `${changeLine} — ${params.homeTeam} ${score} ${params.awayTeam}${minuteLabel}`,
  ].join('\n');
}

function buildGoalCaption(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoringTeam: string | null;
  elapsed: number | null;
  leagueName: string;
  scorerName?: string | null;
  assistName?: string | null;
  goalDetail?: string | null;
}): string {
  const minute = params.elapsed ? ` ${params.elapsed}'` : '';
  const score = `${params.homeScore} – ${params.awayScore}`;
  const scorerLine = formatGoalScorerLine({
    scoringTeam: params.scoringTeam,
    scorerName: params.scorerName ?? null,
    assistName: params.assistName ?? null,
    goalDetail: params.goalDetail ?? null,
  });

  return [
    `⚽ *¡GOL!* | ${params.leagueName}`,
    `${scorerLine} — ${params.homeTeam} ${score} ${params.awayTeam}${minute}`,
  ].join('\n');
}

function formatGoalScorerLine(params: {
  scoringTeam: string | null;
  scorerName: string | null;
  assistName: string | null;
  goalDetail: string | null;
}): string {
  if (params.goalDetail === 'Own Goal' && params.scorerName) {
    return `Autogol de ${params.scorerName}`;
  }

  if (params.scorerName) {
    const assist = params.assistName ? ` (asist. ${params.assistName})` : '';
    const penalty = params.goalDetail === 'Penalty' ? ' (penalti)' : '';
    return `${params.scorerName}${assist}${penalty}`;
  }

  if (params.scoringTeam) {
    return params.scoringTeam;
  }

  return 'Gol anotado';
}

function buildPredictionsCaption(
  match: { homeTeam: string; awayTeam: string; matchDate: Date },
  leagueName: string,
  count: number,
): string {
  const dateStr = new Date(match.matchDate).toLocaleString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota',
  });

  return [
    `🔒 *Predicciones Cerradas* | ${leagueName}`,
    `⚽ ${match.homeTeam} vs ${match.awayTeam}`,
    `📅 ${dateStr} (hora Bogotá)`,
    `👥 ${count} pronóstico${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}`,
    '',
    '_Reporte completo en el PDF adjunto_',
  ].join('\n');
}
