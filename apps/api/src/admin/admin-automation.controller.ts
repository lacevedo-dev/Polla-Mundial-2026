import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutomationRunTrigger, AutomationStep, NotificationType, Prisma } from '@prisma/client';
import { AutomationObservabilityService } from '../automation-observability/automation-observability.service';
import {
  formatAutomationExcludedLeaguesMessage,
} from '../automation/audience/automation-league-eligibility.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminAutomationOperationsQueryDto } from './dto/admin-automation-operations-query.dto';
import { AdminAutomationRetryDto } from './dto/admin-automation-retry.dto';
import { AdminAutomationRetryChannelDto } from './dto/admin-automation-retry-channel.dto';
import { EmailBacklogAuditService } from '../email/email-backlog-audit.service';
import { NotificationScheduler, type MatchReminderRetrySummary } from '../notifications/notification.scheduler';
import { PredictionReportScheduler } from '../prediction-report/prediction-report.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { WhatsappGroupService } from '../whatsapp/whatsapp-group.service';
import { AdminAutomationMessagePreviewQueryDto } from './dto/admin-automation-message-preview-query.dto';
import { AdminAutomationFeatureFlagsDto } from './dto/admin-automation-feature-flags.dto';
import { AdminAutomationStepOverrideDto } from './dto/admin-automation-step-override.dto';
import { AutomationStepConfigService } from '../automation/config/automation-step-config.service';
import { AutomationTimingConfigService } from '../automation/config/automation-timing-config.service';
import { getFinalEscalationMinutesBeforeKickoff } from '../automation/config/automation-timing.util';
import { AutomationRetryService } from '../automation/retry/automation-retry.service';
import { AutomationMessagePreviewService } from '../automation/preview/automation-message-preview.service';
import { AutomationFeatureFlagsService } from '../automation/config/automation-feature-flags.service';
import { USER_STATUS } from '../users/user-status.constants';

const AUTO_TYPES = [
  NotificationType.MATCH_REMINDER,
  NotificationType.PREDICTION_CLOSED,
  NotificationType.RESULT_PUBLISHED,
] as const;

@Controller('admin/automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class AdminAutomationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly push: PushNotificationsService,
    private readonly emailBacklogAudit: EmailBacklogAuditService,
    private readonly observability: AutomationObservabilityService,
    private readonly notificationScheduler: NotificationScheduler,
    private readonly predictionReportScheduler: PredictionReportScheduler,
    private readonly waWeb: WhatsappWebService,
    private readonly waGroup: WhatsappGroupService,
    private readonly automationRetry: AutomationRetryService,
    private readonly messagePreview: AutomationMessagePreviewService,
    private readonly featureFlags: AutomationFeatureFlagsService,
    private readonly stepConfig: AutomationStepConfigService,
    private readonly timingConfig: AutomationTimingConfigService,
  ) {}

  /** Estado de canales y schedulers */
  @Get('status')
  async getStatus() {
    const [pushCount, notifLast24h, userWithPhone, emailBacklog, leaguesWithWaGroup, pendingWaJobs] = await Promise.all([
      this.prisma.pushSubscription.count(),
      this.prisma.notification.count({
        where: { sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.user.count({ where: { phone: { not: null }, status: USER_STATUS.ACTIVE } }),
      this.emailBacklogAudit.getAutomationStatus(),
      this.prisma.league.count({ where: { whatsappGroupId: { not: null }, status: 'ACTIVE' } }),
      this.prisma.whatsappGroupJob.count({ where: { status: 'PENDING' } }),
    ]);

    const waWebStatus = this.waWeb.getStatus();
    const waWebEnabled = this.config.get<string>('WHATSAPP_WEB_ENABLED') === 'true';

    const twilioSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const vapidKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const smtpHost =
      this.config.get<string>('EMAIL_HOST') ??
      this.config.get<string>('SMTP_HOST') ??
      this.config.get<string>('MAIL_HOST');

    const channels = {
      inApp: { enabled: true, description: 'Siempre activo' },
      push: {
        enabled: !!vapidKey,
        description: vapidKey
          ? `${pushCount} suscripciones push globales`
          : 'VAPID_PUBLIC_KEY no configurado',
        subscriberCount: pushCount,
      },
      whatsapp: {
        enabled: !!(twilioSid && twilioToken),
        description:
          twilioSid && twilioToken
            ? `Twilio activo — ${userWithPhone} usuarios con teléfono`
            : 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN no configurados',
        usersWithPhone: userWithPhone,
      },
      sms: {
        enabled: !!(twilioSid && twilioToken && this.config.get<string>('TWILIO_SMS_FROM')),
        description: this.config.get<string>('TWILIO_SMS_FROM')
          ? 'Twilio SMS activo'
          : 'TWILIO_SMS_FROM no configurado',
      },
      email: {
        enabled: !!smtpHost,
        description: smtpHost ? `SMTP: ${smtpHost}` : 'SMTP no configurado',
      },
      waGroup: {
        enabled: waWebEnabled && waWebStatus === 'CONNECTED',
        description: !waWebEnabled
          ? 'WHATSAPP_WEB_ENABLED no configurado'
          : waWebStatus === 'CONNECTED'
            ? `Sesión activa — ${leaguesWithWaGroup} liga(s) con grupo asignado${pendingWaJobs > 0 ? ` · ${pendingWaJobs} job(s) pendiente(s)` : ''}`
            : `WhatsApp Web: ${waWebStatus} — conecta la sesión en Admin → WhatsApp`,
        leaguesWithGroup: leaguesWithWaGroup,
        pendingJobs: pendingWaJobs,
        sessionStatus: waWebStatus,
      },
    };

    const schedulers = [
      {
        id: 'match_reminder',
        name: 'Recordatorio de partido',
        cron: '* * * * *',
        description: 'Cada minuto — T-60: recordatorio con hora Bogotá y plazo de modificación',
        notifType: 'MATCH_REMINDER',
        icon: '⏰',
        audience: 'Todos los miembros activos de ligas con ese partido',
        channels: ['inApp', 'push'],
      },
      {
        id: 'pre_match_escalation',
        name: 'Escalada pre-partido (T-45 / T-30 / T-final)',
        cron: '* * * * *',
        description: 'Cada minuto — alertas a pendientes + WA Grupo con nombres. T-final = cierre + 5 min',
        notifType: 'PREDICTION_CLOSED',
        icon: '⚠️',
        audience: 'Miembros sin pronóstico + grupos WA de la polla',
        channels: ['inApp', 'push', 'waGroup'],
      },
      {
        id: 'prediction_closing',
        name: 'Cierre de predicciones (legacy)',
        cron: '* * * * *',
        description: 'Solo si pre_match_v2 está desactivado — push/in-app/email + WA Grupo (sin WA personal)',
        notifType: 'PREDICTION_CLOSED',
        icon: '⚠️',
        audience: 'Miembros activos que aún no han pronosticado',
        channels: ['inApp', 'push', 'waGroup', 'email'],
      },
      {
        id: 'match_result',
        name: 'Resultado de partido',
        cron: '* * * * *',
        description:
          'Partidos finalizados — push/in-app/WA Grupo. WA personal opt-in en CONFIG PASOS',
        notifType: 'RESULT_PUBLISHED',
        icon: '✅',
        audience: 'Usuarios con predicción en el partido',
        channels: ['inApp', 'push', 'waGroup', 'whatsapp'],
      },
      {
        id: 'live_goal',
        name: 'Gol en vivo',
        cron: 'Football Sync',
        description: 'Al detectar cambio de marcador vía /fixtures — complementa con /fixtures/events en el mismo ciclo del plan',
        notifType: 'GOAL_SCORED',
        icon: '⚽',
        audience: 'Usuarios con predicción + grupos WA de ligas del partido',
        channels: ['inApp', 'push', 'waGroup'],
      },
      {
        id: 'live_match_start',
        name: 'Inicio partido (live v2)',
        cron: 'Football Sync',
        description: 'Al pasar SCHEDULED → LIVE. Requiere automation:live_phase_v2',
        notifType: 'LEAGUE_UPDATE',
        icon: '▶️',
        audience: 'Usuarios con predicción + grupos WA',
        channels: ['inApp', 'push', 'waGroup'],
      },
      {
        id: 'live_halftime',
        name: 'Medio tiempo (live v2)',
        cron: 'Football Sync',
        description: 'Detecta status HT. Requiere automation:live_phase_v2',
        notifType: 'LEAGUE_UPDATE',
        icon: '⏸️',
        audience: 'Usuarios con predicción + grupos WA',
        channels: ['inApp', 'push', 'waGroup'],
      },
      {
        id: 'live_second_half',
        name: '2.ª parte (live v2)',
        cron: 'Football Sync',
        description: 'Al salir de HT. Requiere automation:live_phase_v2',
        notifType: 'LEAGUE_UPDATE',
        icon: '▶️',
        audience: 'Usuarios con predicción + grupos WA',
        channels: ['inApp', 'push', 'waGroup'],
      },
      {
        id: 'live_match_end',
        name: 'Fin partido teaser (live v2)',
        cron: 'Football Sync',
        description: 'Antes de calcular puntos. Requiere automation:live_phase_v2',
        notifType: 'LEAGUE_UPDATE',
        icon: '🏁',
        audience: 'Usuarios con predicción + grupos WA',
        channels: ['inApp', 'push', 'waGroup'],
      },
      {
        id: 'live_goal_impact',
        name: 'Impacto gol en polla (live v2)',
        cron: 'Football Sync',
        description: 'Segundo mensaje WA tras cada gol con impacto provisional. Requiere automation:live_phase_v2',
        notifType: 'GOAL_SCORED',
        icon: '📈',
        audience: 'Grupos WA de ligas del partido',
        channels: ['waGroup'],
      },
      {
        id: 'live_red_card',
        name: 'Tarjeta roja en vivo',
        cron: 'Football Sync',
        description: 'Al detectar tarjeta roja vía /fixtures/events en el sync programado (Admin → Pasos y canales)',
        notifType: null,
        icon: '🟥',
        audience: 'Grupos WA de ligas con predicciones en el partido',
        channels: ['waGroup'],
      },
      {
        id: 'live_yellow_card',
        name: 'Tarjeta amarilla en vivo',
        cron: 'Football Sync',
        description: 'Al detectar tarjeta amarilla vía /fixtures/events en el sync programado (Admin → Pasos y canales)',
        notifType: null,
        icon: '🟨',
        audience: 'Grupos WA de ligas con predicciones en el partido',
        channels: ['waGroup'],
      },
      {
        id: 'live_substitution',
        name: 'Sustitución en vivo',
        cron: 'Football Sync',
        description: 'Al detectar cambio vía /fixtures/events en el sync programado (Admin → Pasos y canales)',
        notifType: null,
        icon: '🔄',
        audience: 'Grupos WA de ligas con predicciones en el partido',
        channels: ['waGroup'],
      },
      {
        id: 'live_goal_annulled',
        name: 'Gol anulado (VAR)',
        cron: 'Football Sync',
        description: 'Al detectar gol anulado por VAR (requiere event sync + eventWaVarGoalEnabled)',
        notifType: null,
        icon: '🚫',
        audience: 'Grupos WA de ligas con predicciones en el partido',
        channels: ['waGroup'],
      },
      {
        id: 'prediction_report',
        name: 'Reporte de pronósticos',
        cron: '* * * * *',
        description: 'T-N min antes del kickoff (configurable en Ajustes) — imagen + PDF al grupo WA',
        notifType: 'PREDICTION_CLOSED',
        icon: '📋',
        audience: 'Grupos WA de ligas con pronósticos cerrados',
        channels: ['email', 'waGroup'],
      },
      {
        id: 'result_report',
        name: 'Reporte de resultados',
        cron: '* * * * *',
        description: 'Tras finalizar partido — imagen + PDF al grupo WA',
        notifType: 'RESULT_PUBLISHED',
        icon: '📊',
        audience: 'Grupos WA de ligas con predicciones en el partido',
        channels: ['email', 'waGroup'],
      },
      {
        id: 'smtp_backlog_audit',
        name: 'Auditoría backlog SMTP',
        cron: '*/15 * * * *',
        description: 'Cada 15 minutos — audita y sanea backlog SMTP con trazabilidad persistente',
        notifType: null,
        icon: 'SMTP',
        audience: 'Operación / monitoreo de cola SMTP',
        channels: ['email'],
      },
    ];

    const overridesRow = await this.prisma.systemConfig.findUnique({
      where: { key: 'automation:channel_overrides' },
    });
    const channelOverrides: Record<string, Record<string, boolean>> = overridesRow
      ? JSON.parse(overridesRow.value)
      : {};

    const featureFlags = await this.featureFlags.getAllFlagStates();
    const stepCatalog = await this.stepConfig.getResolvedCatalog();
    const defaultCloseMinutes = 15;
    const timingSettings = await this.timingConfig.getSettings();

    return {
      channels,
      schedulers,
      channelOverrides,
      stats: { notifLast24h, pushSubscribers: pushCount, usersWithPhone: userWithPhone },
      featureFlags,
      stepCatalog,
      timingHints: {
        defaultCloseMinutes,
        finalEscalationMinutesBeforeKickoff:
          getFinalEscalationMinutesBeforeKickoff(defaultCloseMinutes),
        predictionReportMinutesAfterClose:
          timingSettings.predictionReportMinutesAfterClose,
        predictionReportMinutesBefore:
          timingSettings.predictionReportMinutesBefore,
        timezone: 'America/Bogota',
      },
      automation: {
        emailBacklogAudit: {
          cron: '*/15 * * * *',
          queue: emailBacklog.queue,
          latestRun: emailBacklog.latestRun,
          recentFailures: emailBacklog.recentFailures,
        },
      },
    };
  }

  @Get('operations')
  async getOperations(
    @Query() query: AdminAutomationOperationsQueryDto,
  ) {
    return this.observability.getDailyOperations(query.date, this.waWeb.isConnected());
  }

  /** Matriz del día: partidos de hoy con estado de cada automatización.
   * Cuenta notificaciones por tipo usando el campo JSON `data` que contiene { matchId }.
   */
  @Get('today-matrix')
  async getTodayMatrix() {
    // Hoy en zona COT (UTC-5)
    const nowCOT = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const todayCOT = nowCOT.toISOString().split('T')[0];
    const [yr, mo, dy] = todayCOT.split('-').map(Number);

    // Medianoche COT = 05:00 UTC; fin del dia COT = dia siguiente 04:59:59 UTC
    const dayStart = new Date(Date.UTC(yr, mo - 1, dy, 5, 0, 0));
    const dayEnd = new Date(Date.UTC(yr, mo - 1, dy + 1, 4, 59, 59));
    const yesterdayStart = new Date(Date.UTC(yr, mo - 1, dy - 1, 5, 0, 0));

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [
          { matchDate: { gte: dayStart, lte: dayEnd } },
          {
            matchDate: { gte: yesterdayStart, lt: dayStart },
            OR: [
              { status: { in: ['SCHEDULED', 'LIVE'] } },
              { status: 'FINISHED', resultNotificationSentAt: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        matchDate: true,
        status: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        tournament: { select: { name: true } },
      },
      orderBy: { matchDate: 'asc' },
    });

    if (matches.length === 0) return { date: todayCOT, matches: [] };

    const matchIds = matches.map(m => m.id);
    const leagueData = await this.prisma.league.findMany({
      where: { status: 'ACTIVE' },
      select: {
        closePredictionMinutes: true,
        leagueTournaments: {
          select: {
            tournament: {
              select: {
                matches: {
                  where: { id: { in: matchIds } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    const closeMinByMatch = new Map<string, number>();
    for (const league of leagueData) {
      const mins = league.closePredictionMinutes ?? 15;
      for (const lt of league.leagueTournaments) {
        for (const m of lt.tournament.matches) {
          const cur = closeMinByMatch.get(m.id);
          if (cur === undefined || mins < cur) closeMinByMatch.set(m.id, mins);
        }
      }
    }

    const earliest = matches[0].matchDate;
    const latest = matches[matches.length - 1].matchDate;
    const wideStart = new Date(earliest.getTime() - 2 * 60 * 60 * 1000);
    const wideEnd = new Date(latest.getTime() + 4 * 60 * 60 * 1000);

    const allNotifs = await this.prisma.notification.findMany({
      where: {
        sentAt: { gte: wideStart, lte: wideEnd },
        type: { in: [...AUTO_TYPES] },
      },
      select: { type: true, data: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
    });

    const byMatch = new Map<string, Array<{ type: NotificationType; sentAt: Date }>>();
    for (const n of allNotifs) {
      if (!n.data) continue;
      try {
        const parsed = JSON.parse(n.data) as { matchId?: string };
        if (!parsed.matchId) continue;
        if (!byMatch.has(parsed.matchId)) byMatch.set(parsed.matchId, []);
        byMatch.get(parsed.matchId)!.push({ type: n.type, sentAt: n.sentAt });
      } catch {
        // dato malformado, ignorar
      }
    }

    const now = new Date();

    const result = matches.map(match => {
      const closeMinutes = closeMinByMatch.get(match.id) ?? 15;
      const reminderAt = new Date(match.matchDate.getTime() - 60 * 60 * 1000);
      const closingAt = new Date(match.matchDate.getTime() - closeMinutes * 60 * 1000);
      const resultAt = new Date(match.matchDate.getTime() + 130 * 60 * 1000);

      const notifs = byMatch.get(match.id) ?? [];
      const byType = (t: NotificationType) => notifs.filter(n => n.type === t);

      const rem = byType(NotificationType.MATCH_REMINDER);
      const clo = byType(NotificationType.PREDICTION_CLOSED);
      const res = byType(NotificationType.RESULT_PUBLISHED);

      const isFinished = match.status === 'FINISHED';
      const isScheduled = match.status === 'SCHEDULED';

      return {
        id: match.id,
        trackingScope: match.matchDate < dayStart ? 'CARRY_OVER' : 'TODAY',
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        matchDate: match.matchDate.toISOString(),
        status: match.status,
        tournament: match.tournament?.name ?? null,
        events: {
          reminder: {
            scheduledAt: reminderAt.toISOString(),
            sentCount: rem.length,
            done: rem.length > 0,
            lastSentAt: rem[0]?.sentAt.toISOString() ?? null,
            overdue: now > reminderAt && rem.length === 0 && isScheduled,
          },
          closing: {
            scheduledAt: closingAt.toISOString(),
            sentCount: clo.length,
            done: clo.length > 0,
            lastSentAt: clo[0]?.sentAt.toISOString() ?? null,
            closeMinutes,
            overdue: now > closingAt && clo.length === 0 && isScheduled,
          },
          result: {
            scheduledAt: resultAt.toISOString(),
            sentCount: res.length,
            done: res.length > 0,
            lastSentAt: res[0]?.sentAt.toISOString() ?? null,
            overdue: isFinished && res.length === 0,
          },
        },
      };
    });

    return { date: todayCOT, matches: result };
  }

  /** Historial paginado con filtro por tipo y por partido.
   * ?type=MATCH_REMINDER &page=1 &limit=20 &matchId=xxx
   */
  @Get('history')
  async getHistory(
    @Query('type') typeParam?: string,
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
    @Query('matchId') matchId?: string,
  ) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const page = Math.max(1, parseInt(pageParam ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10)));
    const skip = (page - 1) * limit;

    const validType =
      typeParam && (AUTO_TYPES as readonly string[]).includes(typeParam)
        ? (typeParam as NotificationType)
        : undefined;

    const where: Prisma.NotificationWhereInput = {
      sentAt: { gte: since },
      type: validType ? validType : { in: [...AUTO_TYPES] },
      ...(matchId ? { data: { contains: matchId } } : {}),
    };

    const [byType, rawRecords, total] = await Promise.all([
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { sentAt: { gte: since }, type: { in: [...AUTO_TYPES] } },
        _count: { id: true },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          channel: true,
          sentAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const countByType: Record<string, number> = {};
    for (const row of byType) countByType[row.type] = row._count.id;

    const recent = rawRecords.map((n) => {
      let parsed: Record<string, unknown> = {};
      try { if (n.data) parsed = JSON.parse(n.data); } catch { /* ignore */ }
      return {
        ...n,
        matchId:     (parsed.matchId as string)   ?? null,
        leagueId:    (parsed.leagueId as string) ?? (Array.isArray(parsed.leagueIds) ? (parsed.leagueIds[0] as string) : null) ?? null,
        trigger:     (parsed._trigger as string)  ?? null,
        pushSent:    typeof parsed._pushSent    === 'number' ? parsed._pushSent    as number : null,
        pushFailed:  typeof parsed._pushFailed  === 'number' ? parsed._pushFailed  as number : null,
        pushDevices: typeof parsed._pushDevices === 'number' ? parsed._pushDevices as number : null,
        whatsapp:    typeof parsed._whatsapp    === 'boolean' ? parsed._whatsapp   as boolean : null,
      };
    });

    return { countByType, recent, total, page, limit };
  }

  @Get('email-backlog/status')
  async getEmailBacklogStatus() {
    return this.emailBacklogAudit.getAutomationStatus();
  }

  @Get('email-backlog/history')
  async getEmailBacklogHistory(
    @Query('page') pageParam?: string,
    @Query('limit') limitParam?: string,
  ) {
    const page = Math.max(1, parseInt(pageParam ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10)));
    return this.emailBacklogAudit.listRuns(page, limit);
  }

  @Post('email-backlog/run')
  async runEmailBacklogAudit(@Query('apply') applyParam?: string) {
    const apply = applyParam === undefined ? false : applyParam === 'true';
    return this.emailBacklogAudit.runAudit({ apply, trigger: 'MANUAL' });
  }

  /**
   * Reintenta manualmente un step de automatización para un partido (y opcionalmente una liga).
   * Útil cuando el scheduler falló y el admin quiere forzar el envío sin esperar el próximo ciclo.
   */
  @Post('retry')
  async retryStep(@Body() dto: AdminAutomationRetryDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: dto.matchId },
      select: {
        id: true,
        status: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    });

    if (!match) {
      throw new NotFoundException(`Partido ${dto.matchId} no encontrado`);
    }

    if (
      (dto.step === AutomationStep.RESULT_NOTIFICATION ||
        dto.step === AutomationStep.RESULT_REPORT) &&
      match.status !== 'FINISHED'
    ) {
      throw new BadRequestException(
        `El step ${dto.step} solo aplica a partidos finalizados. Estado actual: ${match.status}.`,
      );
    }

    const liveSteps: AutomationStep[] = [
      AutomationStep.MATCH_START,
      AutomationStep.HALFTIME,
      AutomationStep.SECOND_HALF_START,
      AutomationStep.MATCH_LIVE_END,
      AutomationStep.GOAL_IMPACT,
    ];
    if (
      liveSteps.includes(dto.step) &&
      match.status === 'SCHEDULED'
    ) {
      throw new BadRequestException(
        `El step ${dto.step} requiere que el partido haya comenzado o finalizado.`,
      );
    }

    const label = `${match.homeTeam.name} vs ${match.awayTeam.name}`;

    const runId = await this.observability.startRun({
      step: dto.step,
      matchId: dto.matchId,
      leagueId: dto.leagueId ?? null,
      trigger: AutomationRunTrigger.MANUAL,
      summary: `Reintento manual de ${dto.step} para ${label}`,
    });

    try {
      switch (dto.step) {
        case AutomationStep.MATCH_REMINDER: {
          const delivery = await this.automationRetry.retryMatchReminder(
            dto.matchId,
            dto.leagueId,
          );
          const ok = this.isMatchReminderRetrySuccessful(delivery);
          await this.observability.finishRun(runId, {
            status: ok
              ? delivery.pushFailed > 0 || delivery.waGroupFailed > 0
                ? 'WARNING'
                : 'SUCCESS'
              : 'FAILED',
            summary: this.buildMatchReminderRetrySummary(label, delivery),
            deliveredCount: delivery.pushSent + delivery.waGroupSent + delivery.whatsappSent,
            failedCount: delivery.pushFailed + delivery.waGroupFailed,
            warningCount: delivery.pushFailed + delivery.waGroupFailed + (delivery.inAppSent > 0 && !ok ? 1 : 0),
            details: {
              channelBreakdown: {
                pushSent: delivery.pushSent,
                pushFailed: delivery.pushFailed,
                pushDevices: delivery.pushDevices,
                whatsappSentCount: delivery.whatsappSent,
                emailQueued: delivery.emailQueued,
                inAppSent: delivery.inAppSent,
                waGroupSent: delivery.waGroupSent,
                waGroupFailed: delivery.waGroupFailed,
              },
              audienceCount: delivery.audienceCount,
            },
          });

          return {
            ok,
            runId,
            summary: this.buildMatchReminderRetrySummary(label, delivery),
            delivery,
          };
        }
        case AutomationStep.PREDICTION_CLOSING:
        case AutomationStep.ESCALATION_T45:
        case AutomationStep.ESCALATION_T30:
        case AutomationStep.ESCALATION_FINAL:
        case AutomationStep.MATCH_START:
        case AutomationStep.HALFTIME:
        case AutomationStep.SECOND_HALF_START:
        case AutomationStep.MATCH_LIVE_END:
        case AutomationStep.RESULT_NOTIFICATION:
        case AutomationStep.PREDICTION_REPORT:
        case AutomationStep.RESULT_REPORT:
          await this.automationRetry.retryStep({
            step: dto.step,
            matchId: dto.matchId,
            leagueId: dto.leagueId,
          });
          break;
        default:
          throw new BadRequestException(`Step no soportado: ${dto.step as string}`);
      }

      await this.observability.finishRun(runId, {
        status: 'SUCCESS',
        summary: `Reintento manual completado para ${label} — step: ${dto.step}`,
      });

      return { ok: true, runId, summary: `Reintento de ${dto.step} completado OK para ${label}.` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.observability.failRun(runId, error, null, `Reintento manual falló: ${message}`);
      return { ok: false, runId, summary: message };
    }
  }

  @Put('step-overrides')
  async setStepOverride(@Body() dto: AdminAutomationStepOverrideDto) {
    await this.stepConfig.setStepEnabled(dto.step, dto.enabled);
    const stepCatalog = await this.stepConfig.getResolvedCatalog();
    return { ok: true, stepCatalog };
  }

  @Put('feature-flags')
  async setFeatureFlag(@Body() dto: AdminAutomationFeatureFlagsDto) {
    await this.featureFlags.setFlag(dto.flag, dto.enabled);
    const featureFlags = await this.featureFlags.getAllFlagStates();
    return { ok: true, featureFlags };
  }

  @Get('message-preview')
  async getMessagePreview(@Query() query: AdminAutomationMessagePreviewQueryDto) {
    return this.messagePreview.getPreview({
      matchId: query.matchId,
      step: query.step,
      leagueId: query.leagueId,
      channel: query.channel,
    });
  }

  /** Reintenta un canal específico (p. ej. WA Grupo) para un paso y liga. */
  @Post('retry-channel')
  async retryChannel(@Body() dto: AdminAutomationRetryChannelDto) {
    if (dto.channel !== 'waGroup') {
      throw new BadRequestException(`Canal no soportado: ${dto.channel}`);
    }

    const result = await this.automationRetry.retryWaGroupChannel({
      step: dto.step,
      matchId: dto.matchId,
      leagueId: dto.leagueId,
    });
    return {
      ok: result.ok,
      jobId: result.jobId ?? null,
      summary: result.message,
    };
  }

  /** Lee ajustes de timing de automatización (reporte de predicciones, etc.) */
  @Get('timing-settings')
  async getTimingSettings() {
    return this.timingConfig.getSettings();
  }

  /** Actualiza minutos después del cierre para el reporte de predicciones */
  @Put('timing-settings')
  async updateTimingSettings(
    @Body()
    dto: {
      predictionReportMinutesAfterClose?: number;
      predictionReportMinutesBefore?: number;
    },
  ) {
    if (
      dto.predictionReportMinutesAfterClose === undefined &&
      dto.predictionReportMinutesBefore === undefined
    ) {
      throw new BadRequestException(
        'predictionReportMinutesAfterClose es requerido',
      );
    }
    return this.timingConfig.updateSettings({
      predictionReportMinutesAfterClose: dto.predictionReportMinutesAfterClose,
      predictionReportMinutesBefore: dto.predictionReportMinutesBefore,
    });
  }

  /** Lee los overrides de canal por scheduler */
  @Get('channel-overrides')
  async getChannelOverrides() {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: 'automation:channel_overrides' },
    });
    return row ? JSON.parse(row.value) : {};
  }

  /** Activa/desactiva un canal para un scheduler específico */
  @Put('channel-overrides')
  async setChannelOverride(
    @Body() dto: { schedulerId: string; channel: string; enabled: boolean },
  ) {
    if (!dto.schedulerId || !dto.channel || typeof dto.enabled !== 'boolean') {
      throw new BadRequestException('schedulerId, channel y enabled son requeridos');
    }

    const row = await this.prisma.systemConfig.findUnique({
      where: { key: 'automation:channel_overrides' },
    });
    const current: Record<string, Record<string, boolean>> = row
      ? JSON.parse(row.value)
      : {};

    if (!current[dto.schedulerId]) current[dto.schedulerId] = {};
    current[dto.schedulerId][dto.channel] = dto.enabled;

    await this.prisma.systemConfig.upsert({
      where: { key: 'automation:channel_overrides' },
      create: { key: 'automation:channel_overrides', value: JSON.stringify(current) },
      update: { value: JSON.stringify(current) },
    });

    return { ok: true, overrides: current };
  }

  /** Envía push de prueba al superadmin para validar configuración VAPID */
  @Post('test-push')
  async testPush(@Req() req: any) {
    const result = await this.push.sendTestToUser(req.user.userId);
    return {
      ok: result.sent > 0,
      sent: result.sent,
      failed: result.failed,
      devices: result.devices,
      message: result.devices === 0
        ? 'Sin dispositivos suscritos. Activa las notificaciones en el menú lateral primero.'
        : result.sent > 0
        ? `✓ Push enviado al usuario actual a ${result.sent}/${result.devices} dispositivo(s).`
        : `✗ Falló en ${result.failed} dispositivo(s). Verifica VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.`,
    };
  }

  private isMatchReminderRetrySuccessful(delivery: MatchReminderRetrySummary): boolean {
    if (delivery.audienceCount === 0) return false;
    return (
      delivery.pushSent > 0 ||
      delivery.waGroupSent > 0 ||
      delivery.whatsappSent > 0
    );
  }

  private buildMatchReminderRetrySummary(
    label: string,
    delivery: MatchReminderRetrySummary,
  ): string {
    if (delivery.audienceCount === 0) {
      const excludedMessage = formatAutomationExcludedLeaguesMessage(
        delivery.excludedLeagues ?? [],
      );
      if (excludedMessage) {
        return excludedMessage;
      }
      return `No hay miembros activos en las ligas de ${label}.`;
    }

    const parts = [
      delivery.inAppSent > 0 ? `${delivery.inAppSent} in-app` : null,
      `${delivery.pushSent}/${delivery.pushDevices} push`,
      delivery.waGroupSent > 0 ? `${delivery.waGroupSent} WA grupo` : null,
      delivery.whatsappSent > 0 ? `${delivery.whatsappSent} WA personal` : null,
      delivery.emailQueued > 0 ? `${delivery.emailQueued} email encolado` : null,
    ].filter(Boolean);

    if (delivery.waGroupFailed > 0 && delivery.waGroupSent === 0) {
      return `Reintento fallido para ${label}: WA grupo no envió (${delivery.waGroupFailed} fallo(s)). ¿WhatsApp Web conectado? ${parts.join(', ')}.`;
    }

    if (delivery.pushFailed > 0 || delivery.waGroupFailed > 0) {
      return `Reintento parcial para ${label}: ${parts.join(', ')}. Fallos: push ${delivery.pushFailed}, WA grupo ${delivery.waGroupFailed}.`;
    }

    if (
      delivery.pushSent === 0 &&
      delivery.waGroupSent === 0 &&
      delivery.whatsappSent === 0
    ) {
      if (delivery.inAppSent > 0) {
        return `Solo in-app (${delivery.inAppSent}) — no hubo push ni WA. Revisa suscripciones push y Admin → WhatsApp.`;
      }
      return `Reintento sin entregas externas para ${label}. Revisa canales y suscripciones push.`;
    }

    return `Reintento completado para ${label}: ${parts.join(', ')}.`;
  }
}
