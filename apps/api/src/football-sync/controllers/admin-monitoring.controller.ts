import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SystemRole } from '@prisma/client';
import { MonitoringService } from '../services/monitoring.service';
import { ConfigService } from '../services/config.service';
import { AdaptiveSyncScheduler } from '../schedulers/adaptive-sync.scheduler';
import { SyncOptimizationService } from '../services/sync-optimization.service';
import {
  SyncHistoryFilterDto,
  AlertsFilterDto,
} from '../dto/api-football.dto';
import type {
  MonitoringDashboardDto,
  SyncHistoryResponseDto,
  AlertsResponseDto,
  SyncStatsDto,
  FootballSyncConfigDto,
  UpdateConfigDto,
  ResolveAlertDto,
  OptimizationSummaryDto,
} from '../dto/api-football.dto';
import { CurrentUser } from '../../auth/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Admin - Football Sync Monitoring')
@ApiBearerAuth()
@Controller('admin/football/monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SystemRole.SUPERADMIN)
export class AdminMonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly config: ConfigService,
    private readonly scheduler: AdaptiveSyncScheduler,
    private readonly optimization: SyncOptimizationService,
    private readonly prisma: PrismaService,
  ) {}

  // === DASHBOARD Y MÉTRICAS ===

  @Get('dashboard')
  @ApiOperation({
    summary: 'Obtener dashboard de monitoreo con métricas en tiempo real',
    description:
      'Dashboard completo con estado del sistema, estadísticas del día, logs recientes, alertas activas y gráficas de sincronización.',
  })
  async getDashboard(): Promise<MonitoringDashboardDto> {
    return this.monitoring.getDashboard();
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtener estadísticas detalladas de sincronización',
    description:
      'Estadísticas completas con tasa de éxito, requests por día, horas más activas, desglose por tipo y estado.',
  })
  @ApiQuery({
    name: 'period',
    enum: ['today', 'week', 'month'],
    required: false,
  })
  async getStats(
    @Query('period') period: 'today' | 'week' | 'month' = 'today',
  ): Promise<SyncStatsDto> {
    return this.monitoring.getSyncStats(period);
  }

  // === HISTORIAL DE SINCRONIZACIONES ===

  @Get('logs')
  @ApiOperation({
    summary: 'Obtener historial de sincronizaciones con filtros',
    description:
      'Historial completo de todas las sincronizaciones realizadas con filtros por tipo, estado, partido y fecha. Incluye paginación y resumen.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'matchId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getSyncHistory(
    @Query() filter: SyncHistoryFilterDto,
  ): Promise<SyncHistoryResponseDto> {
    return this.monitoring.getSyncHistory(filter);
  }

  @Get('logs/:logId')
  @ApiOperation({
    summary: 'Obtener detalle de un log específico',
    description: 'Información detallada de una sincronización específica.',
  })
  async getLogDetails(@Param('logId') logId: string) {
    const result = await this.monitoring.getSyncHistory({ page: 1, limit: 1 });
    const log = result.logs.find((l) => l.id === logId);
    if (!log) {
      throw new Error('Log no encontrado');
    }
    return log;
  }

  // === ALERTAS ===

  @Get('alerts')
  @ApiOperation({
    summary: 'Obtener alertas del sistema con filtros',
    description:
      'Listado de todas las alertas generadas por el sistema con filtros por tipo, severidad y estado. Incluye paginación y resumen.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'severity', required: false, type: String })
  @ApiQuery({ name: 'resolved', required: false, type: Boolean })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAlerts(@Query() filter: AlertsFilterDto): Promise<AlertsResponseDto> {
    return this.monitoring.getAlerts(filter);
  }

  @Patch('alerts/:alertId/resolve')
  @ApiOperation({
    summary: 'Resolver una alerta',
    description:
      'Marca una alerta como resuelta. Solo disponible para superadministradores.',
  })
  async resolveAlert(
    @Param('alertId') alertId: string,
    @CurrentUser() user: any,
  ): Promise<{ message: string }> {
    await this.monitoring.resolveAlert(alertId, user.id);
    return { message: 'Alerta resuelta exitosamente' };
  }

  // === CONFIGURACIÓN ===

  @Get('config')
  @ApiOperation({
    summary: 'Obtener configuración actual del sistema',
    description:
      'Configuración completa del sistema de sincronización con todos los parámetros ajustables.',
  })
  async getConfig(): Promise<FootballSyncConfigDto> {
    return this.config.getConfig();
  }

  @Patch('config')
  @ApiOperation({
    summary: 'Actualizar configuración del sistema',
    description:
      'Actualizar parámetros de configuración del sistema. Genera alertas automáticas para cambios críticos. Solo disponible para superadministradores.',
  })
  async updateConfig(
    @Body() data: UpdateConfigDto,
    @CurrentUser() user: any,
  ): Promise<FootballSyncConfigDto> {
    return this.config.updateConfig(data, user.id);
  }

  @Post('config/reset')
  @ApiOperation({
    summary: 'Resetear configuración a valores por defecto',
    description:
      'Restaura todos los parámetros de configuración a sus valores por defecto. Solo disponible para superadministradores.',
  })
  async resetConfig(
    @CurrentUser() user: any,
  ): Promise<FootballSyncConfigDto> {
    return this.config.resetConfig(user.id);
  }

  // === ACCIONES ADMINISTRATIVAS ===

  @Post('sync/force')
  @ApiOperation({
    summary: 'Forzar sincronización inmediata (ignora límites)',
    description:
      'Ejecuta una sincronización inmediata ignorando los límites de requests. Usar solo en emergencias. Solo disponible para superadministradores.',
  })
  async forceSync(@CurrentUser() user: any): Promise<{ message: string }> {
    const result = await this.scheduler.triggerManualSync();

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      message: result.matchesUpdated !== undefined
        ? `Sincronización ejecutada. ${result.matchesUpdated} partido(s) actualizado(s).`
        : result.message,
    };
  }

  @Post('sync/calibrate')
  @ApiOperation({
    summary: 'Calibrar contador de requests con valor real de la API',
    description:
      'Corrige el contador interno de requests usados con el valor real reportado por API-Football. Usar cuando hay discrepancia entre el dashboard de la API y el sistema.',
  })
  async calibrateRequests(
    @Body() body: { used: number },
  ): Promise<{ message: string; used: number; available: number }> {
    const limit = await this.monitoring.getDailyLimit();
    const available = Math.max(0, limit - body.used);
    await this.monitoring.calibrateRequestCount(body.used, available);
    return {
      message: `Contador calibrado: ${body.used} usados, ${available} disponibles.`,
      used: body.used,
      available,
    };
  }

  @Post('sync/pause')
  @ApiOperation({
    summary: 'Pausar todas las sincronizaciones automáticas',
    description:
      'Detiene temporalmente todas las sincronizaciones automáticas. Solo disponible para superadministradores.',
  })
  async pauseSync(@CurrentUser() user: any): Promise<{ message: string }> {
    await this.config.updateConfig({ autoSyncEnabled: false }, user.id);
    return { message: 'Sincronizaciones automáticas pausadas' };
  }

  @Post('sync/resume')
  @ApiOperation({
    summary: 'Reanudar sincronizaciones automáticas',
    description:
      'Reanuda las sincronizaciones automáticas. Solo disponible para superadministradores.',
  })
  async resumeSync(@CurrentUser() user: any): Promise<{ message: string }> {
    await this.config.updateConfig({ autoSyncEnabled: true }, user.id);
    return { message: 'Sincronizaciones automáticas reanudadas' };
  }

  @Post('alerts/resolve-all')
  @ApiOperation({
    summary: 'Resolver todas las alertas activas',
    description:
      'Marca todas las alertas no resueltas como resueltas. Solo disponible para superadministradores.',
  })
  async resolveAllAlerts(@CurrentUser() user: any): Promise<{ message: string; count: number }> {
    const alerts = await this.monitoring.getAlerts({ resolved: false });
    let count = 0;

    for (const alert of alerts.alerts) {
      await this.monitoring.resolveAlert(alert.id, user.id);
      count++;
    }

    return {
      message: `${count} alertas resueltas exitosamente`,
      count,
    };
  }

  // === SISTEMA AUTO-ADAPTABLE ===

  @Get('optimization/summary')
  @ApiOperation({
    summary: 'Resumen de optimizaciones activas',
    description:
      'Obtiene métricas de ahorro de requests, hits de caché, syncs deduplicados y recomendaciones.',
  })
  async getOptimizationSummary(): Promise<OptimizationSummaryDto> {
    return this.optimization.getOptimizationSummary();
  }

  @Get('optimization/metrics')
  @ApiOperation({
    summary: 'Métricas de optimización por fecha',
    description: 'Métricas detalladas de ahorro de requests y eficiencia del sistema.',
  })
  @ApiQuery({ name: 'date', required: false, type: String })
  async getOptimizationMetrics(@Query('date') date?: string) {
    return this.optimization.getMetrics(date);
  }

  @Get('optimization/adjustment-logs')
  @ApiOperation({
    summary: 'Historial de ajustes automáticos',
    description: 'Lista de todos los ajustes automáticos realizados por el sistema.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAdjustmentLogs(
    @Query('limit') limit: number = 20,
  ) {
    return this.prisma.autoAdjustmentLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
  }

  @Post('optimization/clear-cache')
  @ApiOperation({
    summary: 'Limpiar caché de respuestas API',
    description: 'Limpia el caché en memoria de respuestas de la API de fútbol.',
  })
  async clearOptimizationCache(): Promise<{ message: string }> {
    this.optimization.clearStates();
    return { message: 'Caché y estados de optimización limpiados' };
  }

  @Post('optimization/mode')
  @ApiOperation({
    summary: 'Cambiar modo de operación del sistema',
    description:
      'Cambia el modo entre MANUAL (control total), SEMI_AUTO (sistema calcula, admin puede sobrescribir) y AUTO (sistema gestiona todo).',
  })
  async setSyncMode(
    @Body() body: { mode: 'MANUAL' | 'SEMI_AUTO' | 'AUTO' },
    @CurrentUser() user: any,
  ): Promise<{ message: string; mode: string }> {
    if (!['MANUAL', 'SEMI_AUTO', 'AUTO'].includes(body.mode)) {
      throw new BadRequestException('Modo inválido. Usar: MANUAL, SEMI_AUTO o AUTO');
    }
    await this.config.updateConfig({ syncMode: body.mode }, user.id);
    const descriptions = {
      MANUAL: 'Control total del administrador. El sistema calcula pero no ejecuta ajustes automáticos.',
      SEMI_AUTO: 'El sistema calcula y ajusta según parámetros, el admin puede sobrescribir en cualquier momento.',
      AUTO: 'El sistema gestiona todo automáticamente. Notifica todos los ajustes realizados.',
    };
    return {
      message: `Modo cambiado a ${body.mode}: ${descriptions[body.mode]}`,
      mode: body.mode,
    };
  }

  // === EXPORTACIÓN DE DATOS ===

  @Get('export/logs')
  @ApiOperation({
    summary: 'Exportar logs a formato JSON',
    description:
      'Exporta todos los logs de sincronización en formato JSON para análisis externo.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async exportLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.monitoring.getSyncHistory({
      startDate,
      endDate,
      limit: 10000,
    });
    return {
      exportDate: new Date().toISOString(),
      totalRecords: result.logs.length,
      filters: { startDate, endDate },
      data: result.logs,
    };
  }

  @Get('export/alerts')
  @ApiOperation({
    summary: 'Exportar alertas a formato JSON',
    description:
      'Exporta todas las alertas en formato JSON para análisis externo.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async exportAlerts(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.monitoring.getAlerts({
      startDate,
      endDate,
      limit: 10000,
    });
    return {
      exportDate: new Date().toISOString(),
      totalRecords: result.alerts.length,
      filters: { startDate, endDate },
      data: result.alerts,
    };
  }
}
