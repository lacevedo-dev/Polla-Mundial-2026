import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MatchStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from './notifications.service';
import { TwilioService } from './twilio.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
    private readonly notificationsService: NotificationsService,
    private readonly twilio: TwilioService,
  ) {}

  /** Envía notificación a todos los canales disponibles para un usuario */
  private async notifyUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.notificationsService.createInAppNotification({ userId, type, title, body, data });
    await this.push.sendToUser(userId, { title, body, data });

    if (this.twilio.isEnabled()) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, countryCode: true },
      });
      if (user?.phone) {
        const fullPhone = `${user.countryCode ?? '+57'}${user.phone}`;
        await this.twilio.sendWhatsApp(fullPhone, `${title}\n${body}`);
      }
    }
  }

  /**
   * Cada minuto: partidos que empiezan en ~60 minutos → recordatorio.
   * Parte desde leagues activas (igual que sendPredictionClosingAlerts) para
   * garantizar que el traversal retorne miembros aunque tournamentId esté seteado.
   */
  @Cron('* * * * *')
  async sendMatchReminders(): Promise<void> {
    try {
      const now = new Date();
      const from = new Date(now.getTime() + 55 * 60 * 1000);
      const to = new Date(now.getTime() + 65 * 60 * 1000);

      const leagues = await this.prisma.league.findMany({
        where: {
          status: 'ACTIVE',
          leagueTournaments: {
            some: {
              tournament: {
                matches: {
                  some: {
                    status: MatchStatus.SCHEDULED,
                    matchDate: { gte: from, lte: to },
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
          members: {
            where: { status: 'ACTIVE' },
            select: { userId: true },
          },
          leagueTournaments: {
            select: {
              tournament: {
                select: {
                  matches: {
                    where: {
                      status: MatchStatus.SCHEDULED,
                      matchDate: { gte: from, lte: to },
                    },
                    select: {
                      id: true,
                      matchDate: true,
                      homeTeam: { select: { name: true } },
                      awayTeam: { select: { name: true } },
                      predictions: { select: { userId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Collect unique matchId+userId pairs to avoid duplicate sends per match
      const notified = new Set<string>(); // `${matchId}:${userId}`

      for (const league of leagues) {
        const matches = league.leagueTournaments.flatMap(lt => lt.tournament.matches);

        for (const match of matches) {
          const home = match.homeTeam.name;
          const away = match.awayTeam.name;
          const predictedUserIds = new Set(match.predictions.map(p => p.userId));

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
            if (alreadySent) { notified.add(key); continue; }

            const hasPrediction = predictedUserIds.has(userId);
            const body = hasPrediction
              ? `⚽ En 1 hora: ${home} vs ${away} — ya tienes tu pronóstico guardado`
              : `⚽ 1 hora para ${home} vs ${away} — ¡aún puedes pronosticar!`;

            await this.notifyUser(
              userId,
              NotificationType.MATCH_REMINDER,
              '⏰ Recordatorio de partido',
              body,
              { matchId: match.id, leagueId: league.id },
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
   * Cada minuto: partidos cuyas predicciones cierran en ~5 minutos
   */
  @Cron('* * * * *')
  async sendPredictionClosingAlerts(): Promise<void> {
    try {
      const now = new Date();

      // Get all active leagues with their closePredictionMinutes
      const leagues = await this.prisma.league.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          closePredictionMinutes: true,
          members: {
            where: { status: 'ACTIVE' },
            select: { userId: true },
          },
          leagueTournaments: {
            select: {
              tournament: {
                select: {
                  matches: {
                    where: { status: MatchStatus.SCHEDULED },
                    select: {
                      id: true,
                      matchDate: true,
                      homeTeam: true,
                      awayTeam: true,
                      predictions: { select: { userId: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const league of leagues) {
        const closeMinutes = league.closePredictionMinutes ?? 15;
        const allMatches = league.leagueTournaments.flatMap(lt =>
          lt.tournament.matches,
        );

        for (const match of allMatches) {
          const closeTime = new Date(match.matchDate.getTime() - closeMinutes * 60 * 1000);
          const diffMs = closeTime.getTime() - now.getTime();

          // Close window is within the next 5 minutes
          if (diffMs < 0 || diffMs > 5 * 60 * 1000) continue;

          const predictedUserIds = new Set(match.predictions.map(p => p.userId));
          const home = (match as any).homeTeam?.name ?? '';
          const away = (match as any).awayTeam?.name ?? '';

          for (const member of league.members) {
            const userId = member.userId;
            if (predictedUserIds.has(userId)) continue;

            // Check duplicate
            const alreadySent = await this.prisma.notification.findFirst({
              where: {
                userId,
                type: NotificationType.PREDICTION_CLOSED,
                data: { contains: match.id },
              },
            });
            if (alreadySent) continue;

            const body = `⚠️ ¡Quedan ${closeMinutes} min! ${home} vs ${away} — haz tu pronóstico ahora`;

            await this.notifyUser(
              userId,
              NotificationType.PREDICTION_CLOSED,
              '⚠️ ¡Predicciones cerrando pronto!',
              body,
              { matchId: match.id, leagueId: league.id },
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`sendPredictionClosingAlerts failed: ${error.message}`);
    }
  }

  /**
   * Cada minuto: partidos terminados → notificar resultado + puntos
   */
  @Cron('* * * * *')
  async sendMatchResultNotifications(): Promise<void> {
    try {
      const matches = await this.prisma.match.findMany({
        where: {
          status: MatchStatus.FINISHED,
          resultNotificationSentAt: null,
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          predictions: { select: { userId: true, points: true } },
        },
        take: 20,
      });

      for (const match of matches) {
        const home = match.homeTeam.name;
        const away = match.awayTeam.name;
        const score = `${match.homeScore ?? '-'}-${match.awayScore ?? '-'}`;

        for (const prediction of match.predictions) {
          const pts = Math.round(prediction.points ?? 0);

          const alreadySent = await this.prisma.notification.findFirst({
            where: {
              userId: prediction.userId,
              type: NotificationType.RESULT_PUBLISHED,
              data: { contains: match.id },
            },
          });
          if (alreadySent) continue;

          const isExact = pts >= 5;
          const title = isExact ? '🎯 ¡Acertaste el marcador exacto!' : '✅ Resultado publicado';
          const body = isExact
            ? `${home} ${score} ${away} — ¡Acertaste! +${pts} pts`
            : `${home} ${score} ${away} — ganaste ${pts} pts`;

          await this.notifyUser(
            prediction.userId,
            NotificationType.RESULT_PUBLISHED,
            title,
            body,
            { matchId: match.id, points: pts },
          );
        }

        // Mark as sent
        await this.prisma.match.update({
          where: { id: match.id },
          data: { resultNotificationSentAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.error(`sendMatchResultNotifications failed: ${error.message}`);
    }
  }
}
