import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { MatchStatus, SyncStrategy } from '@prisma/client';
import { DailySyncPlanDto } from '../dto/api-football.dto';
import { ConfigService as FootballConfigService } from './config.service';

export interface MatchSyncSlot {
  matchId: string;
  trackingScope: 'TODAY' | 'CARRY_OVER';
  homeTeam: string;
  awayTeam: string;
  homeFlag?: string | null;
  awayFlag?: string | null;
  matchDate: string;
  status: string;
  externalId: string | null;
  syncSlots: string[];        // ISO timestamps when this match will be synced
  notificationSchedule: {
    type: 'MATCH_REMINDER' | 'PREDICTION_CLOSED' | 'RESULT_PUBLISHED';
    label: string;
    scheduledAt: string;
  }[];
  plannedRequests: PlannedSyncRequest[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  requestsAssigned: number;
}

export interface PlannedSyncRequest {
  id: string;
  type:
    | 'STATUS_BATCH'
    | 'STATUS_BATCH_WITH_CARRY_OVER'
    | 'LINK_AND_STATUS'
    | 'EVENTS_HALFTIME'
    | 'EVENTS_FINAL';
  label: string;
  scheduledAt: string;
  requestCost: number;
  matchIds: string[];
  optional?: boolean;
  executionState?: 'enabled' | 'disabled_by_config';
  disabledReason?: 'event_sync_disabled';
  notes?: string;
}

export interface DetailedSyncTimeline {
  date: string;
  strategy: SyncStrategy;
  intervalMinutes: number;
  requestsUsed: number;
  requestsBudget: number;
  requestsLimit: number;
  nextSyncAt: string | null;
  matches: MatchSyncSlot[];
  plannedRequests: PlannedSyncRequest[];
  requestLog: {
    hour: number;        // 0-23
    requests: number;    // calls in that hour
    slots: string[];     // ISO timestamps of calls planned that hour
  }[];
  totalSlotsPlanned: number;
  totalPlannedRequests: number;
}

@Injectable()
export class SyncPlanService {
  private readonly logger = new Logger(SyncPlanService.name);
  private readonly avgMatchDuration = 120; // minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
    private readonly footballConfigService: FootballConfigService,
  ) {}

  /**
   * Calculate optimal daily sync plan based on today's matches
   */
  async calculateDailyPlan(): Promise<DailySyncPlanDto> {
    const today = this.getToday();

    // Get existing plan or create new
    let plan = await this.prisma.dailySyncPlan.findUnique({
      where: { date: today },
    });

    // Get current match counts
    const matches = await this.getMatchesToday();
    const usedRequests = await this.rateLimiter.getUsedRequestsToday();
    const available = await this.rateLimiter.getAvailableRequests();
    const { minInterval, maxInterval } = await this.getIntervalBounds();

    // Calculate optimal interval
    const { intervalMinutes, strategy, estimatedTotal } =
      this.calculateOptimalInterval(
        matches.total,
        matches.live,
        available,
        usedRequests,
        minInterval,
        maxInterval,
      );

    // Upsert plan — avoids unique constraint race condition when two ticks run simultaneously
    plan = await this.prisma.dailySyncPlan.upsert({
      where: { date: today },
      update: {
        totalMatches: matches.total,
        requestsUsed: usedRequests,
        requestsBudget: available,
        intervalMinutes,
        strategy,
      },
      create: {
        date: today,
        totalMatches: matches.total,
        requestsUsed: usedRequests,
        requestsBudget: available,
        intervalMinutes,
        strategy,
      },
    });

    // Calculate next sync time
    const nextSyncIn = this.getSecondsUntilNextSync(
      plan.lastSyncAt,
      intervalMinutes,
    );

    return {
      date: today,
      totalMatches: matches.total,
      requestBudget: available,
      intervalMinutes,
      estimatedRequestsUsed: estimatedTotal,
      strategy,
      hasLiveMatches: matches.live > 0,
      nextSyncIn,
      lastSync: plan.lastSyncAt?.toISOString() || null,
    };
  }

  /**
   * Calculate optimal sync interval based on available resources
   */
  private calculateOptimalInterval(
    totalMatches: number,
    liveMatches: number,
    availableRequests: number,
    usedRequests: number,
    minInterval: number,
    maxInterval: number,
  ): {
    intervalMinutes: number;
    strategy: SyncStrategy;
    estimatedTotal: number;
  } {
    // No matches = no sync needed
    if (totalMatches === 0) {
      return {
        intervalMinutes: maxInterval,
        strategy: SyncStrategy.BALANCED,
        estimatedTotal: usedRequests,
      };
    }

    // Emergency mode: very few requests left
    if (availableRequests <= 5) {
      this.logger.warn(`EMERGENCY MODE: Only ${availableRequests} requests left`);
      return {
        intervalMinutes: maxInterval,
        strategy: SyncStrategy.EMERGENCY,
        estimatedTotal: usedRequests + Math.min(availableRequests, 5),
      };
    }

    // Calculate requests per match — never exceed available budget
    const requestsPerMatch = Math.floor(availableRequests / totalMatches);

    // Tight budget: fewer than 2 requests per match → extend interval to stretch coverage
    if (requestsPerMatch < 2) {
      this.logger.warn(
        `TIGHT BUDGET: Only ${availableRequests} requests for ${totalMatches} matches (${requestsPerMatch}/match). Switching to CONSERVATIVE.`,
      );
      return {
        intervalMinutes: maxInterval,
        strategy: SyncStrategy.CONSERVATIVE,
        estimatedTotal: usedRequests + availableRequests,
      };
    }

    // If we have live matches, prioritize them
    if (liveMatches > 0) {
      const requestsPerLiveMatch = Math.floor(
        availableRequests / liveMatches,
      );

      // Aggressive: lots of requests per match
      if (requestsPerLiveMatch >= 20) {
        const interval = Math.max(
          minInterval,
          Math.ceil(this.avgMatchDuration / requestsPerLiveMatch),
        );
        return {
          intervalMinutes: interval,
          strategy: SyncStrategy.AGGRESSIVE,
          estimatedTotal: usedRequests + liveMatches * 20,
        };
      }

      // Balanced: moderate requests per match
      if (requestsPerLiveMatch >= 10) {
        const interval = Math.max(
          minInterval,
          Math.ceil(this.avgMatchDuration / requestsPerLiveMatch),
        );
        return {
          intervalMinutes: interval,
          strategy: SyncStrategy.BALANCED,
          estimatedTotal: usedRequests + liveMatches * 12,
        };
      }

      // Conservative: few requests per match
      const interval = Math.min(
        maxInterval,
        Math.ceil(this.avgMatchDuration / Math.max(5, requestsPerLiveMatch)),
      );
      return {
        intervalMinutes: interval,
        strategy: SyncStrategy.CONSERVATIVE,
        estimatedTotal: usedRequests + liveMatches * 6,
      };
    }

    // No live matches, use balanced approach
    const interval = Math.max(
      minInterval,
      Math.min(maxInterval, requestsPerMatch * 2),
    );

    return {
      intervalMinutes: interval,
      strategy: SyncStrategy.BALANCED,
      estimatedTotal: usedRequests + Math.ceil(totalMatches * 0.5),
    };
  }

  /**
   * Get today's matches statistics
   */
  async getMatchesToday(): Promise<{
    total: number;
    scheduled: number;
    live: number;
    finished: number;
  }> {
    const todayStart = this.getTodayStart();
    const todayEnd = this.getTodayEnd(todayStart);

    const matches = await this.prisma.match.groupBy({
      by: ['status'],
      where: {
        ...this.buildTrackedMatchesWhere(todayStart, todayEnd),
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] },
      },
      _count: true,
    });

    const stats = {
      total: 0,
      scheduled: 0,
      live: 0,
      finished: 0,
    };

    matches.forEach((group) => {
      const count = group._count;
      stats.total += count;

      if (group.status === MatchStatus.SCHEDULED) {
        stats.scheduled = count;
      } else if (group.status === MatchStatus.LIVE) {
        stats.live = count;
      } else if (group.status === MatchStatus.FINISHED) {
        stats.finished = count;
      }
    });

    return stats;
  }

  /**
   * Update last sync time in plan
   */
  async updateLastSyncTime(): Promise<void> {
    const today = this.getToday();

    await this.prisma.dailySyncPlan.updateMany({
      where: { date: today },
      data: { lastSyncAt: new Date() },
    });
  }

  /**
   * Increment requests used counter
   */
  async incrementRequestsUsed(count = 1): Promise<void> {
    const today = this.getToday();

    await this.prisma.dailySyncPlan.updateMany({
      where: { date: today },
      data: {
        requestsUsed: {
          increment: count,
        },
      },
    });
  }

  /**
   * Check if sync should happen now based on plan
   */
  async shouldSyncNow(): Promise<boolean> {
    if (!(await this.footballConfigService.isAutoSyncEnabled())) {
      this.logger.debug('Auto sync is disabled by configuration');
      return false;
    }

    const plan = await this.calculateDailyPlan();

    // No live matches — check if any SCHEDULED match with externalId already started
    // (chicken-and-egg: they can't become LIVE without a sync)
    if (!plan.hasLiveMatches) {
      const potentiallyLive = await this.countPotentiallyLiveMatches();
      if (potentiallyLive === 0) {
        return false;
      }
      this.logger.debug(`No LIVE matches but ${potentiallyLive} potentially live — triggering sync`);
    }

    // No requests available = can't sync
    if (plan.requestBudget <= 0) {
      this.logger.warn('Cannot sync: no requests available');
      return false;
    }

    // Emergency mode = only sync if critical
    if (plan.strategy === SyncStrategy.EMERGENCY && plan.requestBudget <= 2) {
      this.logger.warn('EMERGENCY: Skipping non-critical sync');
      return false;
    }

    // Check if enough time has passed since last sync
    if (plan.nextSyncIn > 0) {
      return false;
    }

    return true;
  }

  /**
   * Count SCHEDULED matches with externalId that already started (within match duration window).
   * Used to break the chicken-and-egg: no LIVE → no sync → never becomes LIVE.
   */
  async countPotentiallyLiveMatches(): Promise<number> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 130 * 60 * 1000); // match + 10min buffer
    return this.prisma.match.count({
      where: {
        status: MatchStatus.SCHEDULED,
        externalId: { not: null },
        matchDate: { gte: windowStart, lte: now },
      },
    });
  }

  async getCarryOverMatches(): Promise<Array<{ id: string; externalId: string | null }>> {
    const todayStart = this.getTodayStart();
    const yesterdayStart = this.getYesterdayStart(todayStart);

    return this.prisma.match.findMany({
      where: {
        matchDate: {
          gte: yesterdayStart,
          lt: todayStart,
        },
        OR: [
          { status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] } },
          { status: MatchStatus.FINISHED, resultNotificationSentAt: null },
        ],
      },
      select: {
        id: true,
        externalId: true,
      },
    });
  }

  /**
   * Calculate seconds until next sync
   */
  private getSecondsUntilNextSync(
    lastSyncAt: Date | null,
    intervalMinutes: number,
  ): number {
    if (!lastSyncAt) {
      return 0; // Sync immediately if never synced
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    const elapsed = Date.now() - lastSyncAt.getTime();
    const remaining = intervalMs - elapsed;

    return Math.max(0, Math.ceil(remaining / 1000));
  }

  private async getIntervalBounds(): Promise<{
    minInterval: number;
    maxInterval: number;
  }> {
    try {
      const intervals = await this.footballConfigService.getSyncIntervals();
      return {
        minInterval: intervals.min,
        maxInterval: intervals.max,
      };
    } catch (error) {
      return {
        minInterval: parseInt(
          this.configService.get<string>('MIN_SYNC_INTERVAL_MINUTES', '5'),
          10,
        ),
        maxInterval: parseInt(
          this.configService.get<string>('MAX_SYNC_INTERVAL_MINUTES', '30'),
          10,
        ),
      };
    }
  }

  /**
   * Build a detailed per-match sync timeline for today including
   * exact sync slots and notification schedule.
   */
  async getDetailedTimeline(): Promise<DetailedSyncTimeline> {
    const plan = await this.calculateDailyPlan();
    const eventSyncEnabled = await this.footballConfigService.isEventSyncEnabled();
    const [used, limit] = await Promise.all([
      this.rateLimiter.getUsedRequestsToday(),
      this.rateLimiter.getDailyLimit(),
    ]);
    const available = limit - used;

    const todayStart = this.getTodayStart();
    const todayEnd = this.getTodayEnd(todayStart);
    const trackedMatchesWhere = this.buildTrackedMatchesWhere(todayStart, todayEnd);

    const [matches, activeLeagues] = await Promise.all([
      this.prisma.match.findMany({
        where: trackedMatchesWhere,
        include: {
          homeTeam: { select: { id: true, name: true, flagUrl: true, code: true } },
          awayTeam: { select: { id: true, name: true, flagUrl: true, code: true } },
          syncLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, status: true },
          },
        },
        orderBy: { matchDate: 'asc' },
      }),
      this.prisma.league.findMany({
        where: {
          status: 'ACTIVE',
          leagueTournaments: {
            some: {
              tournament: {
                matches: { some: trackedMatchesWhere },
              },
            },
          },
        },
        select: {
          closePredictionMinutes: true,
          leagueTournaments: {
            select: {
              tournament: {
                select: {
                  matches: {
                    where: trackedMatchesWhere,
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Build matchId → minimum closePredictionMinutes across all leagues containing the match
    const closePredictionMap = new Map<string, number>();
    for (const league of activeLeagues) {
      const mins = league.closePredictionMinutes ?? 15;
      for (const lt of league.leagueTournaments) {
        for (const m of lt.tournament.matches) {
          const current = closePredictionMap.get(m.id);
          closePredictionMap.set(m.id, current === undefined ? mins : Math.min(current, mins));
        }
      }
    }

    const intervalMs = plan.intervalMinutes * 60 * 1000;
    const now = new Date();

    // Build sync slots starting from now until end of day
    const buildSyncSlots = (
      matchDate: Date,
      status: MatchStatus,
      trackingScope: MatchSyncSlot['trackingScope'],
    ): string[] => {
      if (this.isClosedStatus(status)) {
        return [];
      }

      if (trackingScope === 'CARRY_OVER') {
        return [now.toISOString()];
      }

      const slots: string[] = [];
      const matchStart = matchDate;
      const matchEnd = new Date(matchDate.getTime() + 130 * 60 * 1000); // match + 10min buffer

      // If the match is past its expected end time but still open, generate one
      // catch-up sync slot so the API can confirm the real result instead of
      // waiting for the 370-min force-close to kick in.
      if (now > matchEnd) {
        return [now.toISOString()];
      }

      let cursor = new Date(Math.max(now.getTime(), matchStart.getTime() - 5 * 60 * 1000));

      while (cursor <= matchEnd && cursor < todayEnd) {
        slots.push(cursor.toISOString());
        cursor = new Date(cursor.getTime() + intervalMs);
      }

      return slots.slice(0, 30); // cap to prevent huge payloads
    };

    const buildNotifications = (
      matchDate: Date,
      status: MatchStatus,
      closePredictionMinutes = 15,
    ) => {
      const notifications: MatchSyncSlot['notificationSchedule'] = [];
      const md = matchDate.getTime();

      if (status !== MatchStatus.CANCELLED) {
        notifications.push({
          type: 'MATCH_REMINDER',
          label: 'Recordatorio 1h antes',
          scheduledAt: new Date(md - 60 * 60 * 1000).toISOString(),
        });
        notifications.push({
          type: 'PREDICTION_CLOSED',
          label: `Cierre de predicciones (${closePredictionMinutes} min antes)`,
          scheduledAt: new Date(md - closePredictionMinutes * 60 * 1000).toISOString(),
        });
        notifications.push({
          type: 'RESULT_PUBLISHED',
          label:
            status === MatchStatus.FINISHED
              ? 'Resultado publicado'
              : 'Resultado estimado tras finalizar',
          scheduledAt: new Date(md + 130 * 60 * 1000).toISOString(),
        });
      }

      return notifications;
    };

    // Distribute available requests across ACTIVE matches only — FINISHED matches
    // have no sync slots and should not dilute the per-match request budget.
    const activeMatchCount = matches.filter(
      (m) => m.status === MatchStatus.SCHEDULED || m.status === MatchStatus.LIVE,
    ).length;
    const requestsPerMatch = activeMatchCount > 0
      ? Math.max(1, Math.floor(available / activeMatchCount))
      : 0;

    const matchDrafts = matches.map((m) => {
      const trackingScope: MatchSyncSlot['trackingScope'] =
        m.matchDate < todayStart ? 'CARRY_OVER' : 'TODAY';
      const slots = buildSyncSlots(m.matchDate, m.status, trackingScope);
      return {
        matchId: m.id,
        trackingScope,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeFlag: m.homeTeam.flagUrl,
        awayFlag: m.awayTeam.flagUrl,
        matchDate: m.matchDate.toISOString(),
        status: m.status,
        externalId: m.externalId,
        syncSlots: slots,
        notificationSchedule: buildNotifications(
          m.matchDate,
          m.status,
          closePredictionMap.get(m.id) ?? 15,
        ),
        plannedRequests: [] as PlannedSyncRequest[],
        lastSyncAt: m.syncLogs[0]?.createdAt?.toISOString() ?? null,
        lastSyncStatus: m.syncLogs[0]?.status ?? null,
        requestsAssigned: Math.min(slots.length, requestsPerMatch),
      };
    });

    const statusRequestMap = new Map<string, PlannedSyncRequest>();
    const matchRequestMap = new Map<string, PlannedSyncRequest[]>();
    const eventCandidates: Array<PlannedSyncRequest & { priority: number }> = [];

    const appendMatchRequest = (matchId: string, request: PlannedSyncRequest) => {
      const existing = matchRequestMap.get(matchId) ?? [];
      existing.push(request);
      matchRequestMap.set(matchId, existing);
    };

    for (const match of matchDrafts) {
      for (const slot of match.syncSlots) {
        const existing = statusRequestMap.get(slot);
        if (existing) {
          if (!existing.matchIds.includes(match.matchId)) {
            existing.matchIds.push(match.matchId);
          }
          if (match.trackingScope === 'CARRY_OVER') {
            existing.type = existing.type === 'LINK_AND_STATUS'
              ? existing.type
              : 'STATUS_BATCH_WITH_CARRY_OVER';
            existing.label =
              'Consulta agrupada de estados (hoy + arrastres)';
            existing.notes =
              'Agrupa partidos del dia y arrastres en una misma consulta planeada.';
          }
          if (!match.externalId) {
            existing.type = 'LINK_AND_STATUS';
            existing.label = 'Vinculo + estado en consulta agrupada';
            existing.notes =
              'Primero resuelve el fixtureId faltante y luego reutiliza la misma respuesta para estado.';
          }
          continue;
        }

        statusRequestMap.set(slot, {
          id: `status-${slot}`,
          type: !match.externalId
            ? 'LINK_AND_STATUS'
            : match.trackingScope === 'CARRY_OVER'
              ? 'STATUS_BATCH_WITH_CARRY_OVER'
              : 'STATUS_BATCH',
          label: !match.externalId
            ? 'Vinculo + estado en consulta agrupada'
            : match.trackingScope === 'CARRY_OVER'
              ? 'Consulta agrupada de estados (hoy + arrastres)'
              : 'Consulta agrupada de estados del dia',
          scheduledAt: slot,
          requestCost: 1,
          matchIds: [match.matchId],
          executionState: 'enabled',
          notes: !match.externalId
            ? 'Primero resuelve el fixtureId faltante y luego reutiliza la misma respuesta para estado.'
            : match.trackingScope === 'CARRY_OVER'
              ? 'Agrupa partidos del dia y arrastres en una misma consulta planeada.'
              : 'Combina varios partidos del mismo bloque horario en una sola consulta.',
        });
      }

      if (this.shouldPlanEventRequests(match)) {
        const halftimeAt = new Date(
          new Date(match.matchDate).getTime() + 50 * 60 * 1000,
        ).toISOString();
        const finalAt = new Date(
          new Date(match.matchDate).getTime() + 130 * 60 * 1000,
        ).toISOString();

        eventCandidates.push({
          id: `events-halftime-${match.matchId}`,
          type: 'EVENTS_HALFTIME',
          label: 'Eventos alternados (opcionales): entretiempo',
          scheduledAt: halftimeAt,
          requestCost: 1,
          matchIds: [match.matchId],
          optional: true,
          executionState: eventSyncEnabled ? 'enabled' : 'disabled_by_config',
          disabledReason: eventSyncEnabled ? undefined : 'event_sync_disabled',
          notes:
            'Consulta de eventos reservada para el entretiempo. Solo se agenda si sobra presupuesto y no se reintenta para el fixture si devuelve sin eventos útiles.',
          priority: 2,
        });
        eventCandidates.push({
          id: `events-final-${match.matchId}`,
          type: 'EVENTS_FINAL',
          label: 'Eventos alternados (opcionales): final',
          scheduledAt: finalAt,
          requestCost: 1,
          matchIds: [match.matchId],
          optional: true,
          executionState: eventSyncEnabled ? 'enabled' : 'disabled_by_config',
          disabledReason: eventSyncEnabled ? undefined : 'event_sync_disabled',
          notes:
            'Consulta final de eventos para cerrar el partido. Solo se agenda si sobra presupuesto y no se reintenta para el fixture si devuelve sin eventos útiles.',
          priority: 1,
        });
      }
    }

    // Sort all status requests by scheduledAt (chronological)
    const allStatusRequests = [...statusRequestMap.values()].sort((left, right) =>
      left.scheduledAt.localeCompare(right.scheduledAt),
    );

    // Hard cap: never plan more requests than what's available.
    // Prioritize the earliest slots (upcoming matches first).
    const statusRequests = allStatusRequests.slice(0, available);

    const remainingBudget = Math.max(0, available - statusRequests.length);
    const selectedEvents = eventCandidates
      .sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }
        return left.scheduledAt.localeCompare(right.scheduledAt);
      })
      .slice(0, remainingBudget)
      .map(({ priority: _priority, ...request }) => request);

    const plannedRequests = [...statusRequests, ...selectedEvents].sort((left, right) =>
      left.scheduledAt.localeCompare(right.scheduledAt),
    );

    for (const request of plannedRequests) {
      for (const matchId of request.matchIds) {
        appendMatchRequest(matchId, request);
      }
    }

    const matchSlots: MatchSyncSlot[] = matchDrafts.map((match) => {
      const planned = (matchRequestMap.get(match.matchId) ?? []).sort((left, right) =>
        left.scheduledAt.localeCompare(right.scheduledAt),
      );
      const activePlanned = planned.filter(isExecutableRequest);
      return {
        ...match,
        plannedRequests: planned,
        syncSlots: planned
          .filter((request) =>
            request.type === 'STATUS_BATCH' ||
            request.type === 'STATUS_BATCH_WITH_CARRY_OVER' ||
            request.type === 'LINK_AND_STATUS',
          )
          .map((request) => request.scheduledAt),
        requestsAssigned: activePlanned.length,
      };
    });

    // Build hourly request distribution
    const hourBuckets: Record<number, string[]> = {};
    for (let h = 0; h < 24; h++) hourBuckets[h] = [];

    const activeRequests = plannedRequests.filter(isExecutableRequest);

    activeRequests.forEach((request) => {
      const h = new Date(request.scheduledAt).getHours();
      hourBuckets[h].push(request.scheduledAt);
    });

    const requestLog = Object.entries(hourBuckets).map(([hour, slots]) => ({
      hour: Number(hour),
      requests: slots.length,
      slots,
    }));

    const totalSlotsPlanned = activeRequests.length;
    const nextSyncAt = activeRequests
      .map((request) => request.scheduledAt)
      .sort()
      .find((s) => s > now.toISOString()) ?? null;

    return {
      date: plan.date,
      strategy: plan.strategy,
      intervalMinutes: plan.intervalMinutes,
      requestsUsed: used,
      requestsBudget: available,
      requestsLimit: limit,
      nextSyncAt,
      matches: matchSlots,
      plannedRequests,
      requestLog,
      totalSlotsPlanned,
      totalPlannedRequests: activeRequests.length,
    };
  }

  /**
   * Get today's date string (YYYY-MM-DD) in Colombia timezone (UTC-5)
   */
  private getToday(): string {
    // Colombia is UTC-5 (no DST). Shift now back 5h to get local COT date.
    const bogotaNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
    return bogotaNow.toISOString().split('T')[0];
  }

  /**
   * Get start of today aligned to the API-Football quota window.
   * The API resets at 00:00 UTC (= 7:00pm Bogotá), so both the sync plan
   * and the request budget must use the same UTC midnight boundary.
   */
  private getTodayStart(): Date {
    const now = new Date(Date.now());
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
      ),
    );
  }

  private getTodayEnd(todayStart: Date): Date {
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    return todayEnd;
  }

  private getYesterdayStart(todayStart: Date): Date {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    return yesterdayStart;
  }

  private buildTrackedMatchesWhere(todayStart: Date, todayEnd: Date) {
    const yesterdayStart = this.getYesterdayStart(todayStart);
    // A match without externalId that started more than 130 min ago cannot be
    // synced — exclude it from carry-over to prevent ghost tracking loops.
    const carryOverCutoff = new Date(Date.now() - 130 * 60 * 1000);
    // A match WITH externalId that started more than 200 min ago is almost
    // certainly finished regardless of status (130 min match + 30 min extra time +
    // 40 min buffer). Exclude it to prevent stale SCHEDULED matches from
    // appearing as active carry-overs indefinitely.
    const carryOverHardCutoff = new Date(Date.now() - 200 * 60 * 1000);

    return {
      OR: [
        {
          // All matches from today's window — FINISHED ones appear in the plan
          // for visibility but get no sync slots (buildSyncSlots returns [] for them).
          // Matches past the hard cutoff are excluded since the stale sweep closes
          // them and they no longer need tracking.
          AND: [
            { matchDate: { gte: todayStart, lt: todayEnd } },
            { matchDate: { gte: carryOverHardCutoff } },
          ],
        },
        {
          // Carry-over: yesterday's matches still needing attention
          matchDate: {
            gte: yesterdayStart,
            lt: todayStart,
          },
          OR: [
            {
              status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] },
              // Differentiate cutoff by whether the match has an external ID:
              // - With externalId: hard cutoff at 370 min (match surely ended by then)
              // - Without externalId: soft cutoff at 130 min (can't be synced anyway)
              OR: [
                {
                  externalId: { not: null },
                  matchDate: { gte: carryOverHardCutoff },
                },
                {
                  externalId: null,
                  matchDate: { gte: carryOverCutoff },
                },
              ],
            },
            { status: MatchStatus.FINISHED, resultNotificationSentAt: null },
          ],
        },
      ],
    };
  }

  /**
   * Force-close stale matches that are still SCHEDULED/LIVE past their expected end:
   * - Unlinked (no externalId): after 24h — can never be synced.
   * - Linked (has externalId): after 370 min — past the carry-over hard cutoff,
   *   the match is certainly over even if the sync never confirmed it.
   * Returns the total number of matches closed.
   */
  async closeStaleUnlinkedMatches(): Promise<number> {
    const unlinkedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
    const unlinked = await this.prisma.match.updateMany({
      where: {
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] },
        externalId: null,
        matchDate: { lt: unlinkedCutoff },
      },
      // resultNotificationSentAt suppresses the notification — no real score to report.
      data: { status: MatchStatus.FINISHED, resultNotificationSentAt: new Date() },
    });

    // 200 min = 130 min match + 30 min extra time + 40 min buffer.
    // Also set resultNotificationSentAt to suppress the result notification — these matches
    // were force-closed without a real score, so sending "- - -" would be misleading.
    const linkedCutoff = new Date(Date.now() - 200 * 60 * 1000);
    const linked = await this.prisma.match.updateMany({
      where: {
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] },
        externalId: { not: null },
        matchDate: { lt: linkedCutoff },
      },
      data: { status: MatchStatus.FINISHED, resultNotificationSentAt: new Date() },
    });

    if (unlinked.count > 0) {
      this.logger.warn(
        `[Stale Cleanup] Force-finished ${unlinked.count} unlinked match(es) older than 24h`,
      );
    }
    if (linked.count > 0) {
      this.logger.warn(
        `[Stale Cleanup] Force-finished ${linked.count} linked match(es) past 370-min carry-over cutoff`,
      );
    }

    return unlinked.count + linked.count;
  }

  private isClosedStatus(status: MatchStatus): boolean {
    return (
      status === MatchStatus.FINISHED ||
      status === MatchStatus.CANCELLED ||
      status === MatchStatus.POSTPONED
    );
  }

  private shouldPlanEventRequests(match: {
    trackingScope: MatchSyncSlot['trackingScope'];
    status: MatchStatus;
  }): boolean {
    return match.trackingScope === 'TODAY' && !this.isClosedStatus(match.status);
  }
}

function isExecutableRequest(request: PlannedSyncRequest): boolean {
  return request.executionState !== 'disabled_by_config';
}
