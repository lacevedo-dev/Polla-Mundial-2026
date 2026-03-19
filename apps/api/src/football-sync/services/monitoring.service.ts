import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FootballSyncLogDto,
  FootballSyncAlertDto,
  MonitoringDashboardDto,
  SyncHistoryFilterDto,
  SyncHistoryResponseDto,
  AlertsFilterDto,
  AlertsResponseDto,
  SyncStatsDto,
} from '../dto/api-football.dto';
import {
  SyncLogType,
  SyncLogStatus,
  SyncAlertType,
  SyncAlertLevel,
} from '@prisma/client';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener dashboard de monitoreo con métricas en tiempo real
   */
  async getDashboard(): Promise<MonitoringDashboardDto> {
    const today = this.getTodayStart();
    const config = await this.getConfig();

    // Obtener plan del día
    const plan = await this.prisma.dailySyncPlan.findUnique({
      where: { date: new Date().toISOString().split('T')[0] },
    });

    // Estadísticas del día
    const todayLogs = await this.prisma.footballSyncLog.findMany({
      where: {
        createdAt: { gte: today },
      },
    });

    const requestsUsed = await this.prisma.apiFootballRequest.count({
      where: {
        createdAt: { gte: today },
      },
    });

    const successfulSyncs = todayLogs.filter(
      (log) => log.status === SyncLogStatus.SUCCESS,
    ).length;
    const failedSyncs = todayLogs.filter(
      (log) => log.status === SyncLogStatus.FAILED,
    ).length;

    const matchesSynced = todayLogs.reduce(
      (sum, log) => sum + log.matchesUpdated,
      0,
    );

    const durations = todayLogs
      .filter((log) => log.duration)
      .map((log) => log.duration as number);
    const averageDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Logs recientes (últimos 10)
    const recentLogs = await this.prisma.footballSyncLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
    });

    // Alertas activas
    const activeAlerts = await this.prisma.footballSyncAlert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Gráfica de sincronizaciones (últimas 24 horas)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyLogs = await this.prisma.footballSyncLog.findMany({
      where: {
        createdAt: { gte: last24Hours },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupar por hora
    const hourlyData = this.groupByHour(hourlyLogs);

    return {
      status: {
        isEnabled: config?.enabled ?? true,
        isEmergencyMode: (plan?.requestsBudget ?? 100) < 10,
        lastSyncAt: plan?.lastSyncAt?.toISOString(),
        nextSyncIn: await this.getSecondsUntilNextSync(plan?.lastSyncAt),
      },
      todayStats: {
        requestsUsed,
        requestsLimit: config?.dailyRequestLimit ?? 100,
        requestsPercentage: (requestsUsed / (config?.dailyRequestLimit ?? 100)) * 100,
        matchesSynced,
        successfulSyncs,
        failedSyncs,
        averageDuration: Math.round(averageDuration),
      },
      recentLogs: recentLogs.map(this.mapToLogDto),
      activeAlerts: activeAlerts.map(this.mapToAlertDto),
      syncChart: hourlyData,
    };
  }

  /**
   * Obtener historial de sincronizaciones con filtros y paginación
   */
  async getSyncHistory(
    filter: SyncHistoryFilterDto,
  ): Promise<SyncHistoryResponseDto> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter.type) {
      where.type = filter.type as SyncLogType;
    }
    if (filter.status) {
      where.status = filter.status as SyncLogStatus;
    }
    if (filter.matchId) {
      where.matchId = filter.matchId;
    }
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.createdAt.lte = new Date(filter.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.footballSyncLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
      }),
      this.prisma.footballSyncLog.count({ where }),
    ]);

    // Calcular summary
    const allLogs = await this.prisma.footballSyncLog.findMany({ where });
    const summary = {
      totalSyncs: allLogs.length,
      successfulSyncs: allLogs.filter(
        (log) => log.status === SyncLogStatus.SUCCESS,
      ).length,
      failedSyncs: allLogs.filter(
        (log) => log.status === SyncLogStatus.FAILED,
      ).length,
      totalRequestsUsed: allLogs.reduce(
        (sum, log) => sum + log.requestsUsed,
        0,
      ),
      totalMatchesUpdated: allLogs.reduce(
        (sum, log) => sum + log.matchesUpdated,
        0,
      ),
    };

    return {
      logs: logs.map(this.mapToLogDto),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  /**
   * Obtener alertas con filtros y paginación
   */
  async getAlerts(filter: AlertsFilterDto): Promise<AlertsResponseDto> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter.type) {
      where.type = filter.type as SyncAlertType;
    }
    if (filter.severity) {
      where.severity = filter.severity as SyncAlertLevel;
    }
    if (filter.resolved !== undefined) {
      where.resolved = filter.resolved;
    }
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.createdAt.lte = new Date(filter.endDate);
      }
    }

    const [alerts, total] = await Promise.all([
      this.prisma.footballSyncAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.footballSyncAlert.count({ where }),
    ]);

    // Calcular summary
    const allAlerts = await this.prisma.footballSyncAlert.findMany();
    const summary = {
      totalAlerts: allAlerts.length,
      unresolvedAlerts: allAlerts.filter((a) => !a.resolved).length,
      criticalAlerts: allAlerts.filter(
        (a) => a.severity === SyncAlertLevel.CRITICAL && !a.resolved,
      ).length,
      warningAlerts: allAlerts.filter(
        (a) => a.severity === SyncAlertLevel.WARNING && !a.resolved,
      ).length,
    };

    return {
      alerts: alerts.map(this.mapToAlertDto),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    };
  }

  /**
   * Obtener estadísticas de sincronización
   */
  async getSyncStats(period: 'today' | 'week' | 'month'): Promise<SyncStatsDto> {
    const startDate = this.getStartDate(period);

    const logs = await this.prisma.footballSyncLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    const successfulSyncs = logs.filter(
      (log) => log.status === SyncLogStatus.SUCCESS,
    ).length;
    const successRate = logs.length > 0 ? (successfulSyncs / logs.length) * 100 : 0;

    const durations = logs.filter((log) => log.duration).map((log) => log.duration as number);
    const averageDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Calcular requests por día
    const days = Math.ceil((Date.now() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const totalRequests = logs.reduce((sum, log) => sum + log.requestsUsed, 0);
    const averageRequestsPerDay = days > 0 ? totalRequests / days : 0;

    // Horas más activas
    const hourCounts = new Map<number, number>();
    logs.forEach((log) => {
      const hour = new Date(log.createdAt).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    const mostActiveHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Sincronizaciones por tipo
    const typeCounts = new Map<string, number>();
    logs.forEach((log) => {
      typeCounts.set(log.type, (typeCounts.get(log.type) || 0) + 1);
    });
    const syncsByType = Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count }));

    // Sincronizaciones por estado
    const statusCounts = new Map<string, number>();
    logs.forEach((log) => {
      statusCounts.set(log.status, (statusCounts.get(log.status) || 0) + 1);
    });
    const syncsByStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }));

    // Desglose diario
    const dailyBreakdown = this.getDailyBreakdown(logs, startDate);

    return {
      period,
      totalSyncs: logs.length,
      successRate: Math.round(successRate * 100) / 100,
      averageRequestsPerDay: Math.round(averageRequestsPerDay * 100) / 100,
      averageDuration: Math.round(averageDuration),
      mostActiveHours,
      syncsByType,
      syncsByStatus,
      dailyBreakdown,
    };
  }

  /**
   * Crear un log de sincronización
   */
  async createLog(data: {
    type: SyncLogType;
    status: SyncLogStatus;
    message: string;
    matchId?: string;
    externalId?: string;
    details?: string;
    requestsUsed?: number;
    matchesUpdated?: number;
    duration?: number;
    error?: string;
    triggeredBy?: string;
  }): Promise<void> {
    await this.prisma.footballSyncLog.create({
      data: {
        type: data.type,
        status: data.status,
        message: data.message,
        matchId: data.matchId,
        externalId: data.externalId,
        details: data.details,
        requestsUsed: data.requestsUsed ?? 0,
        matchesUpdated: data.matchesUpdated ?? 0,
        duration: data.duration,
        error: data.error,
        triggeredBy: data.triggeredBy,
      },
    });

    this.logger.log(
      `Log created: ${data.type} - ${data.status} - ${data.message}`,
    );
  }

  /**
   * Crear una alerta
   */
  async createAlert(data: {
    type: SyncAlertType;
    severity: SyncAlertLevel;
    message: string;
    details?: string;
  }): Promise<void> {
    await this.prisma.footballSyncAlert.create({
      data: {
        type: data.type,
        severity: data.severity,
        message: data.message,
        details: data.details,
      },
    });

    this.logger.warn(
      `Alert created: [${data.severity}] ${data.type} - ${data.message}`,
    );
  }

  /**
   * Resolver una alerta
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    await this.prisma.footballSyncAlert.update({
      where: { id: alertId },
      data: {
        resolved: true,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(`Alert ${alertId} resolved by ${resolvedBy}`);
  }

  // === MÉTODOS PRIVADOS ===

  private async getConfig() {
    return this.prisma.footballSyncConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getSecondsUntilNextSync(lastSyncAt: Date | null | undefined): Promise<number> {
    if (!lastSyncAt) return 0;

    const config = await this.getConfig();
    const intervalMs = (config?.minSyncInterval ?? 5) * 60 * 1000;
    const elapsed = Date.now() - lastSyncAt.getTime();
    const remaining = intervalMs - elapsed;

    return Math.max(0, Math.ceil(remaining / 1000));
  }

  private groupByHour(logs: any[]): {
    labels: string[];
    requestsUsed: number[];
    matchesUpdated: number[];
  } {
    const hourlyMap = new Map<string, { requests: number; matches: number }>();

    logs.forEach((log) => {
      const hour = new Date(log.createdAt).toISOString().slice(0, 13) + ':00';
      const current = hourlyMap.get(hour) || { requests: 0, matches: 0 };
      hourlyMap.set(hour, {
        requests: current.requests + log.requestsUsed,
        matches: current.matches + log.matchesUpdated,
      });
    });

    const sortedEntries = Array.from(hourlyMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    return {
      labels: sortedEntries.map(([hour]) => hour),
      requestsUsed: sortedEntries.map(([, data]) => data.requests),
      matchesUpdated: sortedEntries.map(([, data]) => data.matches),
    };
  }

  private getStartDate(period: 'today' | 'week' | 'month'): Date {
    const now = new Date();
    switch (period) {
      case 'today':
        return this.getTodayStart();
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }

  private getDailyBreakdown(logs: any[], startDate: Date) {
    const dailyMap = new Map<
      string,
      {
        syncs: number;
        requests: number;
        matches: number;
        success: number;
        failed: number;
      }
    >();

    logs.forEach((log) => {
      const date = new Date(log.createdAt).toISOString().split('T')[0];
      const current = dailyMap.get(date) || {
        syncs: 0,
        requests: 0,
        matches: 0,
        success: 0,
        failed: 0,
      };

      dailyMap.set(date, {
        syncs: current.syncs + 1,
        requests: current.requests + log.requestsUsed,
        matches: current.matches + log.matchesUpdated,
        success:
          current.success + (log.status === SyncLogStatus.SUCCESS ? 1 : 0),
        failed: current.failed + (log.status === SyncLogStatus.FAILED ? 1 : 0),
      });
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private mapToLogDto(log: any): FootballSyncLogDto {
    return {
      id: log.id,
      type: log.type,
      status: log.status,
      matchId: log.matchId,
      externalId: log.externalId,
      message: log.message,
      details: log.details,
      requestsUsed: log.requestsUsed,
      matchesUpdated: log.matchesUpdated,
      duration: log.duration,
      error: log.error,
      triggeredBy: log.triggeredBy,
      createdAt: log.createdAt.toISOString(),
      match: log.match
        ? {
            id: log.match.id,
            homeTeam: log.match.homeTeam.name,
            awayTeam: log.match.awayTeam.name,
            matchDate: log.match.matchDate.toISOString(),
          }
        : undefined,
    };
  }

  private mapToAlertDto(alert: any): FootballSyncAlertDto {
    return {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
      resolved: alert.resolved,
      resolvedBy: alert.resolvedBy,
      resolvedAt: alert.resolvedAt?.toISOString(),
      createdAt: alert.createdAt.toISOString(),
    };
  }
}
