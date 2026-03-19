import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FootballSyncConfigDto, UpdateConfigDto } from '../dto/api-football.dto';
import { SyncAlertType, SyncAlertLevel } from '@prisma/client';
import { MonitoringService } from './monitoring.service';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly DEFAULT_CONFIG_ID = 'default_config';

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
  ) {}

  /**
   * Obtener configuración actual
   */
  async getConfig(): Promise<FootballSyncConfigDto> {
    let config = await this.prisma.footballSyncConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // Si no existe, crear configuración por defecto
    if (!config) {
      config = await this.createDefaultConfig();
    }

    return this.mapToDto(config);
  }

  /**
   * Actualizar configuración
   */
  async updateConfig(
    data: UpdateConfigDto,
    updatedBy: string,
  ): Promise<FootballSyncConfigDto> {
    let config = await this.prisma.footballSyncConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await this.createDefaultConfig();
    }

    // Validaciones
    if (data.minSyncInterval !== undefined && data.minSyncInterval < 1) {
      throw new Error('minSyncInterval debe ser al menos 1 minuto');
    }

    if (
      data.maxSyncInterval !== undefined &&
      data.minSyncInterval !== undefined &&
      data.maxSyncInterval < data.minSyncInterval
    ) {
      throw new Error(
        'maxSyncInterval debe ser mayor o igual a minSyncInterval',
      );
    }

    if (
      data.dailyRequestLimit !== undefined &&
      data.dailyRequestLimit < 10
    ) {
      throw new Error('dailyRequestLimit debe ser al menos 10');
    }

    if (
      data.alertThreshold !== undefined &&
      (data.alertThreshold < 1 || data.alertThreshold > 100)
    ) {
      throw new Error('alertThreshold debe estar entre 1 y 100');
    }

    // Detectar cambios críticos para generar alertas
    const criticalChanges: string[] = [];

    if (data.enabled !== undefined && data.enabled !== config.enabled) {
      criticalChanges.push(
        `Sistema ${data.enabled ? 'habilitado' : 'deshabilitado'}`,
      );
    }

    if (
      data.dailyRequestLimit !== undefined &&
      data.dailyRequestLimit !== config.dailyRequestLimit
    ) {
      criticalChanges.push(
        `Límite diario cambiado de ${config.dailyRequestLimit} a ${data.dailyRequestLimit}`,
      );
    }

    if (
      data.autoSyncEnabled !== undefined &&
      data.autoSyncEnabled !== config.autoSyncEnabled
    ) {
      criticalChanges.push(
        `Sincronización automática ${data.autoSyncEnabled ? 'habilitada' : 'deshabilitada'}`,
      );
    }

    // Actualizar configuración
    const updated = await this.prisma.footballSyncConfig.update({
      where: { id: config.id },
      data: {
        ...data,
        updatedBy,
      },
    });

    this.logger.log(
      `Configuración actualizada por ${updatedBy}: ${JSON.stringify(data)}`,
    );

    // Crear alerta de cambio de configuración
    if (criticalChanges.length > 0) {
      await this.monitoring.createAlert({
        type: SyncAlertType.CONFIGURATION_CHANGE,
        severity: SyncAlertLevel.INFO,
        message: `Configuración actualizada por ${updatedBy}`,
        details: JSON.stringify(
          {
            changes: criticalChanges,
            updatedBy,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      });
    }

    return this.mapToDto(updated);
  }

  /**
   * Resetear configuración a valores por defecto
   */
  async resetConfig(updatedBy: string): Promise<FootballSyncConfigDto> {
    const config = await this.prisma.footballSyncConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      return this.mapToDto(await this.createDefaultConfig());
    }

    const reset = await this.prisma.footballSyncConfig.update({
      where: { id: config.id },
      data: {
        enabled: true,
        minSyncInterval: 5,
        maxSyncInterval: 30,
        dailyRequestLimit: 100,
        alertThreshold: 90,
        autoSyncEnabled: true,
        peakHoursSyncEnabled: true,
        emergencyModeThreshold: 10,
        notifyOnError: true,
        notifyOnLimit: true,
        updatedBy,
      },
    });

    this.logger.warn(
      `Configuración reseteada a valores por defecto por ${updatedBy}`,
    );

    await this.monitoring.createAlert({
      type: SyncAlertType.CONFIGURATION_CHANGE,
      severity: SyncAlertLevel.WARNING,
      message: `Configuración reseteada a valores por defecto por ${updatedBy}`,
      details: JSON.stringify(
        {
          action: 'reset_to_defaults',
          updatedBy,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    });

    return this.mapToDto(reset);
  }

  /**
   * Verificar si el sistema está habilitado
   */
  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  /**
   * Verificar si la sincronización automática está habilitada
   */
  async isAutoSyncEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled && config.autoSyncEnabled;
  }

  /**
   * Obtener límite diario de requests
   */
  async getDailyLimit(): Promise<number> {
    const config = await this.getConfig();
    return config.dailyRequestLimit;
  }

  /**
   * Obtener intervalos de sincronización
   */
  async getSyncIntervals(): Promise<{ min: number; max: number }> {
    const config = await this.getConfig();
    return {
      min: config.minSyncInterval,
      max: config.maxSyncInterval,
    };
  }

  /**
   * Verificar si se debe generar alerta por uso de requests
   */
  async shouldAlertOnUsage(usedRequests: number): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.notifyOnLimit) return false;

    const percentage = (usedRequests / config.dailyRequestLimit) * 100;
    return percentage >= config.alertThreshold;
  }

  /**
   * Verificar si está en modo de emergencia
   */
  async isEmergencyMode(availableRequests: number): Promise<boolean> {
    const config = await this.getConfig();
    return availableRequests <= config.emergencyModeThreshold;
  }

  // === MÉTODOS PRIVADOS ===

  private async createDefaultConfig() {
    const existing = await this.prisma.footballSyncConfig.findUnique({
      where: { id: this.DEFAULT_CONFIG_ID },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.footballSyncConfig.create({
      data: {
        id: this.DEFAULT_CONFIG_ID,
        enabled: true,
        minSyncInterval: 5,
        maxSyncInterval: 30,
        dailyRequestLimit: 100,
        alertThreshold: 90,
        autoSyncEnabled: true,
        peakHoursSyncEnabled: true,
        emergencyModeThreshold: 10,
        notifyOnError: true,
        notifyOnLimit: true,
      },
    });
  }

  private mapToDto(config: any): FootballSyncConfigDto {
    return {
      id: config.id,
      enabled: config.enabled,
      minSyncInterval: config.minSyncInterval,
      maxSyncInterval: config.maxSyncInterval,
      dailyRequestLimit: config.dailyRequestLimit,
      alertThreshold: config.alertThreshold,
      autoSyncEnabled: config.autoSyncEnabled,
      peakHoursSyncEnabled: config.peakHoursSyncEnabled,
      emergencyModeThreshold: config.emergencyModeThreshold,
      notifyOnError: config.notifyOnError,
      notifyOnLimit: config.notifyOnLimit,
      updatedBy: config.updatedBy,
      updatedAt: config.updatedAt.toISOString(),
      createdAt: config.createdAt.toISOString(),
    };
  }
}
