import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

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
  ) {}

  /** Estado de canales y schedulers */
  @Get('status')
  async getStatus() {
    const [pushCount, notifLast24h, userWithPhone] = await Promise.all([
      this.prisma.pushSubscription.count(),
      this.prisma.notification.count({
        where: { sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.user.count({ where: { phone: { not: null } } }),
    ]);

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
          ? `${pushCount} dispositivos suscritos`
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
    };

    const schedulers = [
      {
        id: 'match_reminder',
        name: 'Recordatorio de partido',
        cron: '* * * * *',
        description: 'Cada minuto — partidos que empiezan en ~60 min',
        notifType: 'MATCH_REMINDER',
        icon: '⏰',
        audience: 'Todos los miembros activos de ligas con ese partido',
        channels: ['inApp', 'push', 'whatsapp'],
      },
      {
        id: 'prediction_closing',
        name: 'Cierre de predicciones',
        cron: '* * * * *',
        description: 'Cada minuto — predicciones que cierran en ≤5 min',
        notifType: 'PREDICTION_CLOSED',
        icon: '⚠️',
        audience: 'Miembros activos que aún no han pronosticado',
        channels: ['inApp', 'push', 'whatsapp'],
      },
      {
        id: 'match_result',
        name: 'Resultado de partido',
        cron: '* * * * *',
        description: 'Cada minuto — partidos finalizados sin notificación enviada',
        notifType: 'RESULT_PUBLISHED',
        icon: '✅',
        audience: 'Usuarios con predicción en el partido',
        channels: ['inApp', 'push', 'whatsapp'],
      },
    ];

    return {
      channels,
      schedulers,
      stats: { notifLast24h, pushSubscribers: pushCount, usersWithPhone: userWithPhone },
    };
  }

  /**
   * Matriz del día: partidos de hoy con estado de cada automatización.
   * Cuenta notificaciones por tipo usando el campo JSON `data` que contiene { matchId }.
   */
  @Get('today-matrix')
  async getTodayMatrix() {
    // Hoy en zona COT (UTC-5)
    const nowCOT = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const todayCOT = nowCOT.toISOString().split('T')[0];
    const [yr, mo, dy] = todayCOT.split('-').map(Number);

    // Medianoche COT = 05:00 UTC; fin del día COT = día siguiente 04:59:59 UTC
    const dayStart = new Date(Date.UTC(yr, mo - 1, dy, 5, 0, 0));
    const dayEnd = new Date(Date.UTC(yr, mo - 1, dy + 1, 4, 59, 59));

    const matches = await this.prisma.match.findMany({
      where: { matchDate: { gte: dayStart, lte: dayEnd } },
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

    // Obtener closePredictionMinutes de cada liga activa que tenga estos partidos
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

    // Notificaciones en ventana amplia (2h antes del primero al +4h del último)
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

    // Agrupar en memoria por matchId (extraído del JSON en data)
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

      const notifs = byMatch.get(match.id) ?? [];
      const byType = (t: NotificationType) => notifs.filter(n => n.type === t);

      const rem = byType(NotificationType.MATCH_REMINDER);
      const clo = byType(NotificationType.PREDICTION_CLOSED);
      const res = byType(NotificationType.RESULT_PUBLISHED);

      const isFinished = match.status === 'FINISHED';
      const isScheduled = match.status === 'SCHEDULED';

      return {
        id: match.id,
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
            scheduledAt: isFinished ? match.matchDate.toISOString() : null,
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

  /**
   * Historial paginado con filtro por tipo y por partido.
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

    const [byType, recent, total] = await Promise.all([
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

    return { countByType, recent, total, page, limit };
  }
}
