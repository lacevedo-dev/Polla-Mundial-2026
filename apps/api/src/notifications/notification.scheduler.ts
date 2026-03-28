import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MatchStatus, NotificationType } from '@prisma/client';
import { tryRunExclusiveBackgroundJob } from '../prisma/background-job-lock.util';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from './notifications.service';
import { TwilioService } from './twilio.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);
  private static readonly BACKGROUND_DB_JOB_KEY = 'background-db-job';
  private static readonly RESULT_NOTIFICATION_KEY_PREFIX = 'result-published';

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * Envía notificación a todos los canales y registra el resultado en el campo
   * `data` del registro in-app: _trigger, _pushSent, _pushDevices, _whatsapp.
   */
  private async notifyUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown>,
    trigger?: string,
  ): Promise<void> {
    // Push primero para capturar resultado antes de guardar en DB
    const pushResult = await this.push.sendToUser(userId, { title, body, data });

    let whatsappSent = false;
    if (this.twilio.isEnabled()) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, countryCode: true },
      });
      if (user?.phone) {
        const fullPhone = `${user.countryCode ?? '+57'}${user.phone}`;
        try {
          await this.twilio.sendWhatsApp(fullPhone, `${title}\n${body}`);
          whatsappSent = true;
        } catch {
          /* continúa aunque WhatsApp falle */
        }
      }
    }

    // Guardar en DB con metadatos de entrega embebidos en data
    const enrichedData: Record<string, unknown> = {
      ...data,
      _trigger: trigger ?? null,
      _pushSent: pushResult.sent,
      _pushFailed: pushResult.failed,
      _pushDevices: pushResult.devices,
      _whatsapp: whatsappSent,
    };
    await this.notificationsService.createInAppNotification({ userId, type, title, body, data: enrichedData });

    this.logger.log(
      `[${type}] ${title} ? user:${userId} | ` +
        `push:${pushResult.sent}/${pushResult.devices} wa:${whatsappSent} | ` +
        (trigger ? `trigger:"${trigger}"` : ''),
    );
  }

  /**
   * Resuelve qué ligas "ven" un partido dado su tournamentId.
   *
   * Regla idéntica al fallback de MatchesService.findByLeague:
   *   - Ligas con torneos asignados ? solo ven partidos de esos torneos.
   *   - Ligas SIN torneos asignados ? ven TODOS los partidos.
   */
  private async getLeaguesForMatch(tournamentId: string | null): Promise<
    Array<{ id: string; members: Array<{ userId: string }> }>
  > {
    const [leaguesWithTournament, leaguesWithoutTournament] = await Promise.all([
      // Ligas que tienen este torneo asignado
      tournamentId
        ? this.prisma.league.findMany({
            where: {
              status: 'ACTIVE',
              leagueTournaments: { some: { tournamentId } },
            },
            select: {
              id: true,
              members: { where: { status: 'ACTIVE' }, select: { userId: true } },
            },
          })
        : [],
      // Ligas sin ningún torneo asignado (ven todos los partidos por fallback)
      this.prisma.league.findMany({
        where: {
          status: 'ACTIVE',
          leagueTournaments: { none: {} },
        },
        select: {
          id: true,
          members: { where: { status: 'ACTIVE' }, select: { userId: true } },
        },
      }),
    ]);

    // Deduplicar por leagueId (una liga no debería estar en ambas listas, pero por seguridad)
    const seen = new Set<string>();
    const result: Array<{ id: string; members: Array<{ userId: string }> }> = [];
    for (const l of [...leaguesWithTournament, ...leaguesWithoutTournament]) {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        result.push(l);
      }
    }
    return result;
  }

  /**
   * Cada minuto: partidos que empiezan en ~60 minutos ? recordatorio.
   */
  @Cron('* * * * *')
  async sendMatchReminders(): Promise<void> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      () => this.runSendMatchReminders(),
    );

    if (!execution.ran) {
      this.logger.warn('sendMatchReminders skipped because another DB-heavy background job is running');
      return;
    }
  }

  private async runSendMatchReminders(): Promise<void> {
    try {
      const now = new Date();
      const from = new Date(now.getTime() + 55 * 60 * 1000);
      const to = new Date(now.getTime() + 65 * 60 * 1000);

      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.SCHEDULED,
          matchDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          matchDate: true,
          tournamentId: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
          predictions: { select: { userId: true } },
        },
      });

      if (matches.length === 0) return;

      const notified = new Set<string>(); // `${matchId}:${userId}`

      for (const match of matches) {
        const leagues = await this.getLeaguesForMatch(match.tournamentId ?? null);
        if (leagues.length === 0) continue;

        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const predictedUserIds = new Set(match.predictions.map((p) => p.userId));

        for (const league of leagues) {
          for (const member of league.members) {
            const userId = member.userId;
            const key = `${match.id}:${userId}`;
            if (notified.has(key)) continue;

            const alreadySent = await this.prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.MATCH_REMINDER,
                data: { contains: match.id },
              },
            });
            if (alreadySent) {
              notified.add(key);
              continue;
            }

            const hasPrediction = predictedUserIds.has(userId);
            const body = hasPrediction
              ? `? En 1 hora: ${home} vs ${away} — ya tienes tu pronóstico guardado`
              : `? 1 hora para ${home} vs ${away} — ¡aún puedes pronosticar!`;

            await this.notifyUser(
              userId,
              NotificationType.MATCH_REMINDER,
              '? Recordatorio de partido',
              body,
              { matchId: match.id, leagueId: league.id },
              `Partido en ~60min: ${home} vs ${away}`,
            );
            notified.add(key);
          }
        }
      }
    } catch (error) {
      this.logger.error(`sendMatchReminders failed: ${error.message}`);
    }
  }

  /**
   * Cada minuto: partidos cuyo cierre de predicción ocurre en los próximos 5 min.
   * Notifica a TODOS los miembros: si ya predijeron, les recuerda el cierre;
   * si aún no, los urge a hacerlo.
   */
  @Cron('* * * * *')
  async sendPredictionClosingAlerts(): Promise<void> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      () => this.runSendPredictionClosingAlerts(),
    );

    if (!execution.ran) {
      this.logger.warn('sendPredictionClosingAlerts skipped because another DB-heavy background job is running');
      return;
    }
  }

  private async runSendPredictionClosingAlerts(): Promise<void> {
    try {
      const now = new Date();

      // Obtener ligas activas con su closePredictionMinutes
      const allLeagues = await this.prisma.league.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          closePredictionMinutes: true,
          members: { where: { status: 'ACTIVE' }, select: { userId: true } },
          leagueTournaments: { select: { tournamentId: true } },
        },
      });

      // Agrupar ligas por ventana de cierre (closeMinutes)
      const closeGroups = new Map<number, typeof allLeagues>();
      for (const league of allLeagues) {
        const cm = league.closePredictionMinutes ?? 15;
        if (!closeGroups.has(cm)) closeGroups.set(cm, []);
        closeGroups.get(cm)!.push(league);
      }

      for (const [closeMinutes, leagues] of closeGroups) {
        // Ventana de cierre: [matchDate - closeMin - 5min, matchDate - closeMin]
        const windowStart = new Date(now.getTime() + closeMinutes * 60 * 1000);
        const windowEnd = new Date(now.getTime() + (closeMinutes + 5) * 60 * 1000);

        const tournamentIds = [...new Set(leagues.flatMap((l) => l.leagueTournaments.map((lt) => lt.tournamentId)))];
        const leaguesWithoutTournament = leagues.filter((l) => l.leagueTournaments.length === 0);

        // Partidos dentro de la ventana
        const whereMatch =
          tournamentIds.length > 0
            ? {
                status: MatchStatus.SCHEDULED,
                matchDate: { gte: windowStart, lte: windowEnd },
                OR: [
                  { tournamentId: { in: tournamentIds } },
                  // También incluye matches sin torneo si hay ligas sin torneo
                  ...(leaguesWithoutTournament.length > 0 ? [{ tournamentId: null as null }] : []),
                ],
              }
            : {
                status: MatchStatus.SCHEDULED,
                matchDate: { gte: windowStart, lte: windowEnd },
              };

        const matches = await this.prisma.match.findMany({
          where: whereMatch,
          select: {
            id: true,
            matchDate: true,
            tournamentId: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
            predictions: { select: { userId: true } },
          },
        });

        for (const match of matches) {
          const predictedUserIds = new Set(match.predictions.map((p) => p.userId));
          const home = match.homeTeam.name;
          const away = match.awayTeam.name;

          // Determinar qué ligas de este grupo "ven" este partido
          const relevantLeagues = leagues.filter(
            (l) => l.leagueTournaments.length === 0 || l.leagueTournaments.some((lt) => lt.tournamentId === match.tournamentId),
          );

          for (const league of relevantLeagues) {
            for (const member of league.members) {
              const userId = member.userId;

              const alreadySent = await this.prisma.notification.findFirst({
                where: {
                  userId,
                  type: NotificationType.PREDICTION_CLOSED,
                  data: { contains: match.id },
                },
              });
              if (alreadySent) continue;

              const hasPrediction = predictedUserIds.has(userId);
              // Notificar a TODOS: los que no han predicho con urgencia, los que sí con aviso
              const body = hasPrediction
                ? `?? Cierre en ${closeMinutes} min: ${home} vs ${away} — pronóstico guardado ?`
                : `?? ¡Quedan ${closeMinutes} min! ${home} vs ${away} — haz tu pronóstico ahora`;

              await this.notifyUser(
                userId,
                NotificationType.PREDICTION_CLOSED,
                hasPrediction ? '?? Predicciones cerrando' : '?? ¡Predicciones cerrando pronto!',
                body,
                { matchId: match.id, leagueId: league.id },
                `Cierre en ${closeMinutes}min: ${home} vs ${away} | ${hasPrediction ? 'ya predijo' : 'sin pronóstico'}`,
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`sendPredictionClosingAlerts failed: ${error.message}`);
    }
  }

  /**
   * Cada minuto: partidos terminados ? notificar resultado + puntos
   */
  @Cron('* * * * *')
  async sendMatchResultNotifications(): Promise<void> {
    const execution = await tryRunExclusiveBackgroundJob(
      NotificationScheduler.BACKGROUND_DB_JOB_KEY,
      () => this.runSendMatchResultNotifications(),
    );

    if (!execution.ran) {
      this.logger.warn('sendMatchResultNotifications skipped because another DB-heavy background job is running');
      return;
    }
  }

  private async runSendMatchResultNotifications(): Promise<void> {
    try {
      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.FINISHED,
          resultNotificationSentAt: null,
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          predictions: {
            select: { userId: true, points: true, leagueId: true },
          },
        },
        take: 20,
      });

      const processedNotificationKeys = new Set<string>();

      for (const match of matches) {
        const notificationKey = this.buildMatchResultNotificationKey(match);
        const claimTimestamp = new Date();

        if (processedNotificationKeys.has(notificationKey)) {
          await this.markResultNotificationsAsSent(match.id, match.externalId ?? null, claimTimestamp);
          this.logger.warn(
            `Skipping duplicate finished match ${match.id} for RESULT_PUBLISHED (notificationKey=${notificationKey})`,
          );
          continue;
        }

        const claimed = await this.claimResultNotifications(match.id, match.externalId ?? null, claimTimestamp);
        if (!claimed) {
          continue;
        }

        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const score = `${match.homeScore ?? '-'}-${match.awayScore ?? '-'}`;

        // Agrupar predicciones por usuario para evitar notificaciones duplicadas
        // cuando el usuario está en varias ligas con el mismo partido
        const byUser = new Map<string, { points: number; leagueId: string | null }>();
        for (const pred of match.predictions) {
          if (!byUser.has(pred.userId)) {
            byUser.set(pred.userId, {
              points: Math.round(pred.points ?? 0),
              leagueId: pred.leagueId ?? null,
            });
          }
        }

        processedNotificationKeys.add(notificationKey);

        try {
          for (const [userId, { points: pts, leagueId }] of byUser) {
            const alreadySent = await this.prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.RESULT_PUBLISHED,
                OR: [{ data: { contains: match.id } }, { data: { contains: notificationKey } }],
              },
            });
            if (alreadySent) continue;

            const isExact = pts >= 5;
            const title = isExact ? '?? ¡Acertaste el marcador exacto!' : '? Resultado publicado';
            const body = isExact
              ? `${home} ${score} ${away} — ¡Acertaste! +${pts} pts`
              : `${home} ${score} ${away} — ganaste ${pts} pts`;

            await this.notifyUser(
              userId,
              NotificationType.RESULT_PUBLISHED,
              title,
              body,
              { matchId: match.id, leagueId, points: pts, matchNotificationKey: notificationKey },
              `Partido finalizado: ${home} ${score} ${away} | ${pts}pts`,
            );
          }
        } catch (error) {
          await this.releaseResultNotificationClaim(match.id);
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(`sendMatchResultNotifications failed: ${error.message}`);
    }
  }

  private buildMatchResultNotificationKey(match: {
    externalId: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    matchDate: Date;
  }): string {
    if (match.externalId?.trim()) {
      return `${NotificationScheduler.RESULT_NOTIFICATION_KEY_PREFIX}:fixture:${match.externalId}`;
    }

    return [
      NotificationScheduler.RESULT_NOTIFICATION_KEY_PREFIX,
      'fallback',
      match.homeTeamId ?? 'no-home',
      match.awayTeamId ?? 'no-away',
      match.matchDate.toISOString(),
    ].join(':');
  }

  private async claimResultNotifications(
    matchId: string,
    externalId: string | null,
    claimedAt: Date,
  ): Promise<boolean> {
    const claim = await this.prisma.match.updateMany({
      where: externalId?.trim()
        ? {
            resultNotificationSentAt: null,
            OR: [{ id: matchId }, { externalId }],
          }
        : {
            id: matchId,
            resultNotificationSentAt: null,
          },
      data: { resultNotificationSentAt: claimedAt },
    });

    return claim.count > 0;
  }

  private async markResultNotificationsAsSent(
    matchId: string,
    externalId: string | null,
    sentAt: Date,
  ): Promise<void> {
    await this.prisma.match.updateMany({
      where: externalId?.trim()
        ? {
            resultNotificationSentAt: null,
            OR: [{ id: matchId }, { externalId }],
          }
        : {
            id: matchId,
            resultNotificationSentAt: null,
          },
      data: { resultNotificationSentAt: sentAt },
    });
  }

  private async releaseResultNotificationClaim(matchId: string): Promise<void> {
    await this.prisma.match.update({
      where: { id: matchId },
      data: { resultNotificationSentAt: null },
    });
  }
}
