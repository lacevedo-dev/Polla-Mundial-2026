import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from './config.service';
import { createHash } from 'crypto';

interface CachedApiResponse {
  response: any;
  matchIds: string[];
  fetchedAt: Date;
  expiresAt: Date;
  hitCount: number;
}

interface SyncGroup {
  matchIds: string[];
  scheduledAt: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface MatchSyncState {
  matchId: string;
  lastSyncAt: Date | null;
  lastHash: string | null;
  syncCount: number;
}

@Injectable()
export class SyncOptimizationService {
  private readonly logger = new Logger(SyncOptimizationService.name);
  private readonly inMemoryCache = new Map<string, CachedApiResponse>();
  private readonly matchSyncStates = new Map<string, MatchSyncState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // === AGRUPACIÓN INTELIGENTE ===

  /**
   * Agrupa partidos cercanos en el tiempo para reducir requests
   */
  async groupMatchesByWindow(
    matchIds: string[],
    scheduledTimes: Map<string, Date>,
  ): Promise<SyncGroup[]> {
    const config = await this.configService.getAdaptiveConfig();

    if (!config.enableSmartGrouping) {
      // Sin agrupación: cada partido es su propio grupo
      return matchIds.map((id) => ({
        matchIds: [id],
        scheduledAt: scheduledTimes.get(id) || new Date(),
        priority: 'MEDIUM' as const,
      }));
    }

    const windowMs = config.groupingWindowMinutes * 60 * 1000;
    const groups: SyncGroup[] = [];
    const processed = new Set<string>();

    // Ordenar partidos por hora
    const sorted = matchIds
      .map((id) => ({
        id,
        time: scheduledTimes.get(id)?.getTime() || Date.now(),
      }))
      .sort((a, b) => a.time - b.time);

    for (const match of sorted) {
      if (processed.has(match.id)) continue;

      const group: SyncGroup = {
        matchIds: [match.id],
        scheduledAt: new Date(match.time),
        priority: 'MEDIUM',
      };

      // Buscar partidos dentro de la ventana
      for (const other of sorted) {
        if (other.id === match.id || processed.has(other.id)) continue;

        const diff = Math.abs(other.time - match.time);
        if (diff <= windowMs && group.matchIds.length < config.maxMatchesPerGroup) {
          group.matchIds.push(other.id);
          processed.add(other.id);
        }
      }

      processed.add(match.id);
      groups.push(group);
    }

    this.logger.debug(
      `Agrupación: ${matchIds.length} partidos → ${groups.length} grupos ` +
        `(ahorro: ${matchIds.length - groups.length} syncs)`,
    );

    return groups;
  }

  // === DEDUPLICACIÓN ===

  /**
   * Verifica si un sync es redundante y puede omitirse
   */
  async shouldSkipSync(
    matchId: string,
    currentData: any,
  ): Promise<{ skip: boolean; reason?: string }> {
    const config = await this.configService.getAdaptiveConfig();

    if (!config.enableDeduplication) {
      return { skip: false };
    }

    const now = new Date();
    const state = this.matchSyncStates.get(matchId);

    // Si nunca se sincronizó, hacer sync
    if (!state || !state.lastSyncAt) {
      this.updateMatchState(matchId, currentData);
      return { skip: false };
    }

    // Verificar tiempo mínimo entre syncs
    const minutesSinceLastSync = (now.getTime() - state.lastSyncAt.getTime()) / (60 * 1000);
    if (minutesSinceLastSync < config.minMinutesBetweenSyncs) {
      return {
        skip: true,
        reason: `Sync reciente (${minutesSinceLastSync.toFixed(1)} min < ${config.minMinutesBetweenSyncs} min)`,
      };
    }

    // Si los datos no cambiaron y skipUnchangedMatches está activo
    if (config.skipUnchangedMatches) {
      const currentHash = this.hashData(currentData);
      if (state.lastHash === currentHash) {
        return {
          skip: true,
          reason: 'Datos sin cambios desde último sync',
        };
      }
    }

    this.updateMatchState(matchId, currentData);
    return { skip: false };
  }

  private updateMatchState(matchId: string, data: any) {
    this.matchSyncStates.set(matchId, {
      matchId,
      lastSyncAt: new Date(),
      lastHash: this.hashData(data),
      syncCount: (this.matchSyncStates.get(matchId)?.syncCount || 0) + 1,
    });
  }

  private hashData(data: any): string {
    return createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  // === CACHÉ DE RESPUESTAS ===

  /**
   * Obtiene respuesta cacheada de la API
   */
  async getCachedResponse(
    endpoint: string,
    params: Record<string, any>,
  ): Promise<{ data: any; fromCache: boolean }> {
    const config = await this.configService.getAdaptiveConfig();

    if (!config.enableResponseCache) {
      return { data: null, fromCache: false };
    }

    const cacheKey = this.generateCacheKey(endpoint, params);
    const cached = this.inMemoryCache.get(cacheKey);

    if (cached && cached.expiresAt > new Date()) {
      // Actualizar contador de hits
      cached.hitCount++;
      this.inMemoryCache.set(cacheKey, cached);

      // Actualizar en BD de forma asíncrona
      this.prisma.apiResponseCache
        .update({
          where: { id: cacheKey },
          data: { hitCount: { increment: 1 } },
        })
        .catch(() => {});

      return { data: cached.response, fromCache: true };
    }

    return { data: null, fromCache: false };
  }

  /**
   * Guarda respuesta en caché
   */
  async cacheResponse(
    endpoint: string,
    params: Record<string, any>,
    response: any,
    matchIds?: string[],
  ): Promise<void> {
    const config = await this.configService.getAdaptiveConfig();

    if (!config.enableResponseCache) return;

    // Limpiar caché si excede el tamaño máximo
    if (this.inMemoryCache.size >= config.maxCacheSize) {
      this.cleanupCache();
    }

    const cacheKey = this.generateCacheKey(endpoint, params);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.cacheExpirationMinutes * 60 * 1000);

    this.inMemoryCache.set(cacheKey, {
      response,
      matchIds: matchIds || [],
      fetchedAt: now,
      expiresAt,
      hitCount: 0,
    });

    // Guardar en BD de forma asíncrona
    this.prisma.apiResponseCache
      .upsert({
        where: { id: cacheKey },
        update: {
          response: JSON.stringify(response),
          matchIds: matchIds ? JSON.stringify(matchIds) : null,
          fetchedAt: now,
          expiresAt,
          hitCount: 0,
        },
        create: {
          id: cacheKey,
          endpoint,
          paramsHash: cacheKey.split(':')[1] || '',
          response: JSON.stringify(response),
          matchIds: matchIds ? JSON.stringify(matchIds) : null,
          expiresAt,
        },
      })
      .catch(() => {});
  }

  private generateCacheKey(endpoint: string, params: Record<string, any>): string {
    const paramsHash = createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex')
      .substring(0, 16);
    return `${endpoint}:${paramsHash}`;
  }

  private cleanupCache(): void {
    // Eliminar entradas más antiguas (LRU simplificado)
    const entries = Array.from(this.inMemoryCache.entries());
    entries.sort((a, b) => a[1].fetchedAt.getTime() - b[1].fetchedAt.getTime());

    // Eliminar el 20% más antiguo
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.inMemoryCache.delete(entries[i][0]);
    }

    this.logger.debug(`Caché limpiada: ${toRemove} entradas eliminadas`);
  }

  // === MÉTRICAS ===

  /**
   * Registra métricas de optimización para el día actual
   */
  async recordMetrics(metrics: {
    requestsSaved: number;
    duplicateSyncsAvoided: number;
    cacheHitRate: number;
    groupingSavings: number;
    dedupSavings: number;
    cacheSavings: number;
    avgSyncDurationMs?: number;
  }): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await this.prisma.syncOptimizationMetrics.upsert({
      where: { date: today },
      update: {
        requestsSaved: { increment: metrics.requestsSaved },
        duplicateSyncsAvoided: { increment: metrics.duplicateSyncsAvoided },
        cacheHitRate: metrics.cacheHitRate,
        groupingSavings: { increment: metrics.groupingSavings },
        dedupSavings: { increment: metrics.dedupSavings },
        cacheSavings: { increment: metrics.cacheSavings },
        avgSyncDurationMs: metrics.avgSyncDurationMs || 0,
      },
      create: {
        date: today,
        ...metrics,
      },
    });
  }

  /**
   * Obtiene métricas de optimización
   */
  async getMetrics(date?: string): Promise<any> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const today = await this.prisma.syncOptimizationMetrics.findUnique({
      where: { date: targetDate },
    });

    const weekStart = new Date(targetDate);
    weekStart.setDate(weekStart.getDate() - 7);

    const week = await this.prisma.syncOptimizationMetrics.findMany({
      where: {
        date: { gte: weekStart.toISOString().split('T')[0] },
      },
      orderBy: { date: 'desc' },
    });

    return {
      today,
      week: {
        totalRequestsSaved: week.reduce((sum, m) => sum + m.requestsSaved, 0),
        avgCacheHitRate:
          week.length > 0
            ? week.reduce((sum, m) => sum + m.cacheHitRate, 0) / week.length
            : 0,
        totalAutoAdjustments: week.reduce(
          (sum, m) => sum + m.autoAdjustmentsCount,
          0,
        ),
      },
    };
  }

  /**
   * Obtiene resumen de optimización para mostrar en el dashboard
   */
  async getOptimizationSummary(): Promise<any> {
    const config = await this.configService.getAdaptiveConfig();
    const metrics = await this.getMetrics();

    const enabledFeatures: string[] = [];
    if (config.enableSmartGrouping) enabledFeatures.push('smart_grouping');
    if (config.enableResponseCache) enabledFeatures.push('response_cache');
    if (config.enableDeduplication) enabledFeatures.push('deduplication');
    if (config.enableAutoAdjustment) enabledFeatures.push('auto_adjustment');

    const recommendations: string[] = [];

    if (!config.enableSmartGrouping && metrics.today && metrics.today.requestsSaved < 10) {
      recommendations.push(
        'Habilitar agrupación inteligente para reducir requests',
      );
    }

    if (!config.enableDeduplication && metrics.today && metrics.today.duplicateSyncsAvoided < 5) {
      recommendations.push(
        'Habilitar deduplicación para evitar syncs redundantes',
      );
    }

    if (metrics.week && metrics.week.avgCacheHitRate < 0.2) {
      recommendations.push(
        'Considerar aumentar tiempo de expiración del caché',
      );
    }

    return {
      today: metrics.today,
      week: metrics.week,
      enabledFeatures,
      currentMode: config.syncMode,
      recommendations,
    };
  }

  /**
   * Limpia estados internos (útil para testing o reset)
   */
  clearStates(): void {
    this.inMemoryCache.clear();
    this.matchSyncStates.clear();
    this.logger.log('Estados de optimización limpiados');
  }
}
