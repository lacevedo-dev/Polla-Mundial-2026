import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { EmailJobStatus, EmailJobType } from '@prisma/client';

interface EmailLogFilters {
  type?: EmailJobType;
  status?: EmailJobStatus;
  leagueId?: string;
  matchId?: string;
  limit?: number;
  page?: number;
}

interface EmailLogResponse {
  logs: Array<{
    id: string;
    type: EmailJobType;
    status: EmailJobStatus;
    recipientEmail: string;
    subject: string;
    matchId: string | null;
    leagueId: string | null;
    scheduledAt: Date;
    sentAt: Date | null;
    lastAttemptAt: Date | null;
    attemptCount: number;
    lastError: string | null;
    providerKey: string | null;
    // Información enriquecida
    leagueName: string | null;
    leagueCode: string | null;
    matchHomeTeam: string | null;
    matchAwayTeam: string | null;
    blacklistInfo: {
      isBlacklisted: boolean;
      reason: string | null;
      failureCount: number | null;
    } | null;
  }>;
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    dropped: number;
    byLeague: Array<{
      leagueId: string;
      leagueName: string;
      leagueCode: string;
      total: number;
      sent: number;
      failed: number;
    }>;
    byType: Array<{
      type: EmailJobType;
      count: number;
    }>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Controller('admin/email-logs')
@UseGuards(AdminGuard)
export class AdminEmailLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getEmailLogs(@Query() query: EmailLogFilters): Promise<EmailLogResponse> {
    const page = Math.max(1, parseInt(String(query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 50), 10)));
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.leagueId) where.leagueId = query.leagueId;
    if (query.matchId) where.matchId = query.matchId;

    // Obtener logs con información enriquecida
    const [logs, total] = await Promise.all([
      this.prisma.emailJob.findMany({
        where,
        orderBy: [
          { scheduledAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip,
        select: {
          id: true,
          type: true,
          status: true,
          recipientEmail: true,
          subject: true,
          matchId: true,
          leagueId: true,
          scheduledAt: true,
          sentAt: true,
          lastAttemptAt: true,
          attemptCount: true,
          lastError: true,
          providerKey: true,
        },
      }),
      this.prisma.emailJob.count({ where }),
    ]);

    // Enriquecer con información de ligas y partidos
    const leagueIds = [...new Set(logs.filter((l) => l.leagueId).map((l) => l.leagueId!))];
    const matchIds = [...new Set(logs.filter((l) => l.matchId).map((l) => l.matchId!))];
    const emails = [...new Set(logs.map((l) => l.recipientEmail.toLowerCase()))];

    const [leagues, matches, blacklist] = await Promise.all([
      this.prisma.league.findMany({
        where: { id: { in: leagueIds } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.match.findMany({
        where: { id: { in: matchIds } },
        select: { id: true, homeTeam: true, awayTeam: true },
      }),
      this.prisma.emailBlacklist.findMany({
        where: { email: { in: emails } },
        select: { email: true, reason: true, failureCount: true },
      }),
    ]);

    const leagueMap = new Map(leagues.map((l) => [l.id, l]));
    const matchMap = new Map(matches.map((m) => [m.id, m]));
    const blacklistMap = new Map(blacklist.map((b) => [b.email, b]));

    const enrichedLogs = logs.map((log) => {
      const league = log.leagueId ? leagueMap.get(log.leagueId) : null;
      const match = log.matchId ? matchMap.get(log.matchId) : null;
      const blacklistEntry = blacklistMap.get(log.recipientEmail.toLowerCase());

      return {
        ...log,
        leagueName: league?.name || null,
        leagueCode: league?.code || null,
        matchHomeTeam: match?.homeTeam || null,
        matchAwayTeam: match?.awayTeam || null,
        blacklistInfo: blacklistEntry
          ? {
              isBlacklisted: true,
              reason: blacklistEntry.reason,
              failureCount: blacklistEntry.failureCount,
            }
          : { isBlacklisted: false, reason: null, failureCount: null },
      };
    });

    // Calcular estadísticas
    const [statsByStatus, statsByLeague, statsByType] = await Promise.all([
      this.prisma.emailJob.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.emailJob.groupBy({
        by: ['leagueId'],
        where: { ...where, leagueId: { not: null } },
        _count: true,
      }),
      this.prisma.emailJob.groupBy({
        by: ['type'],
        where,
        _count: true,
      }),
    ]);

    const statusMap = new Map(statsByStatus.map((s) => [s.status, s._count]));

    // Enriquecer estadísticas por liga
    const leagueIdsForStats = statsByLeague.map((s) => s.leagueId!);
    const leaguesForStats = await this.prisma.league.findMany({
      where: { id: { in: leagueIdsForStats } },
      select: { id: true, name: true, code: true },
    });
    const leagueStatsMap = new Map(leaguesForStats.map((l) => [l.id, l]));

    const byLeague = await Promise.all(
      statsByLeague.map(async (stat) => {
        const league = leagueStatsMap.get(stat.leagueId!);
        const [sent, failed] = await Promise.all([
          this.prisma.emailJob.count({
            where: { ...where, leagueId: stat.leagueId, status: EmailJobStatus.SENT },
          }),
          this.prisma.emailJob.count({
            where: {
              ...where,
              leagueId: stat.leagueId,
              status: { in: [EmailJobStatus.FAILED, EmailJobStatus.DROPPED] },
            },
          }),
        ]);

        return {
          leagueId: stat.leagueId!,
          leagueName: league?.name || 'Desconocida',
          leagueCode: league?.code || 'N/A',
          total: stat._count,
          sent,
          failed,
        };
      }),
    );

    return {
      logs: enrichedLogs,
      stats: {
        total,
        sent: statusMap.get(EmailJobStatus.SENT) || 0,
        failed:
          (statusMap.get(EmailJobStatus.FAILED) || 0) +
          (statusMap.get(EmailJobStatus.DROPPED) || 0),
        pending: statusMap.get(EmailJobStatus.PENDING) || 0,
        dropped: statusMap.get(EmailJobStatus.DROPPED) || 0,
        byLeague: byLeague.sort((a, b) => b.total - a.total),
        byType: statsByType.map((s) => ({ type: s.type, count: s._count })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
