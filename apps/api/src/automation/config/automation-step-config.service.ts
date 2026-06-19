import { Injectable } from '@nestjs/common';
import { AutomationStep } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AutomationFeatureFlagsService,
} from './automation-feature-flags.service';
import {
  AUTOMATION_STEP_CATALOG,
  AutomationStepCatalogEntry,
  type AutomationStepChannelId,
} from './automation-step-catalog';
import {
  getDefaultChannelEnabled,
  resolveChannelOverride,
} from './automation-channel-defaults.util';

const STEP_OVERRIDES_KEY = 'automation:step_overrides';
const CHANNEL_OVERRIDES_KEY = 'automation:channel_overrides';

export type ResolvedStepCatalogEntry = AutomationStepCatalogEntry & {
  enabled: boolean;
  flagActive: boolean;
  /** Paso operativo: habilitado en config y flag v2 activo (si aplica). */
  operational: boolean;
};

@Injectable()
export class AutomationStepConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: AutomationFeatureFlagsService,
  ) {}

  async getStepOverrides(): Promise<Partial<Record<AutomationStep, boolean>>> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: STEP_OVERRIDES_KEY },
      select: { value: true },
    });
    if (!row) return {};
    try {
      return JSON.parse(row.value) as Partial<Record<AutomationStep, boolean>>;
    } catch {
      return {};
    }
  }

  async setStepEnabled(step: AutomationStep, enabled: boolean): Promise<void> {
    const overrides = await this.getStepOverrides();
    overrides[step] = enabled;
    await this.prisma.systemConfig.upsert({
      where: { key: STEP_OVERRIDES_KEY },
      create: { key: STEP_OVERRIDES_KEY, value: JSON.stringify(overrides) },
      update: { value: JSON.stringify(overrides) },
    });
  }

  async isStepEnabled(step: AutomationStep): Promise<boolean> {
    const overrides = await this.getStepOverrides();
    const entry = AUTOMATION_STEP_CATALOG.find((item) => item.key === step);
    if (!entry) return true;
    return overrides[step] ?? entry.defaultEnabled;
  }

  /** Paso habilitado y flag v2 activo (si aplica). Usar para runtime de automatización. */
  async isStepOperational(step: AutomationStep): Promise<boolean> {
    if (!(await this.isStepEnabled(step))) {
      return false;
    }
    const entry = AUTOMATION_STEP_CATALOG.find((item) => item.key === step);
    if (!entry?.requiresFlag) {
      return true;
    }
    const flags = await this.featureFlags.getAllFlagStates();
    return flags[entry.requiresFlag].enabled;
  }

  async isSchedulerWaGroupEnabled(schedulerId: string): Promise<boolean> {
    return this.readSchedulerChannelOverride(schedulerId, 'waGroup');
  }

  private async readSchedulerChannelOverride(
    schedulerId: string,
    channel: AutomationStepChannelId,
  ): Promise<boolean> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { key: CHANNEL_OVERRIDES_KEY },
      select: { value: true },
    });
    if (!row) {
      return getDefaultChannelEnabled(channel);
    }
    try {
      const overrides = JSON.parse(row.value) as Record<
        string,
        Record<string, boolean>
      >;
      return resolveChannelOverride(
        channel,
        overrides[schedulerId]?.[channel],
      );
    } catch {
      return getDefaultChannelEnabled(channel);
    }
  }

  /** Canal habilitado: paso operativo + catálogo + override de admin. */
  async isSchedulerChannelEnabled(
    schedulerId: string,
    channel: AutomationStepChannelId,
    step?: AutomationStep,
  ): Promise<boolean> {
    if (step) {
      if (!(await this.isStepOperational(step))) {
        return false;
      }
      const entry = AUTOMATION_STEP_CATALOG.find((item) => item.key === step);
      if (entry && !entry.channels.includes(channel)) {
        return false;
      }
    } else {
      if (!(await this.isSchedulerOperational(schedulerId))) {
        return false;
      }
      const entry = AUTOMATION_STEP_CATALOG.find(
        (item) => item.schedulerId === schedulerId,
      );
      if (entry && !entry.channels.includes(channel)) {
        return false;
      }
    }

    return this.readSchedulerChannelOverride(schedulerId, channel);
  }

  /** ¿Algún paso de automatización requiere consultar /fixtures/events? */
  async needsFixtureEventsApi(): Promise<boolean> {
    if (await this.needsSupplementalLiveEventSync()) {
      return true;
    }
    if (await this.isSchedulerOperational('live_goal')) {
      return true;
    }
    return false;
  }

  /** ¿Algún evento live (tarjeta/cambio/VAR) requiere consultar /fixtures/events en el sync? */
  async needsSupplementalLiveEventSync(): Promise<boolean> {
    const schedulerIds = [
      'live_yellow_card',
      'live_red_card',
      'live_substitution',
      'live_goal_annulled',
    ];
    for (const schedulerId of schedulerIds) {
      if (await this.isSchedulerOperational(schedulerId)) {
        return true;
      }
    }
    return false;
  }

  /** Scheduler operativo si algún paso del catálogo con ese schedulerId está activo. */
  async isSchedulerOperational(schedulerId: string): Promise<boolean> {
    const entries = AUTOMATION_STEP_CATALOG.filter(
      (item) => item.schedulerId === schedulerId,
    );
    if (entries.length > 0) {
      for (const entry of entries) {
        if (await this.isStepOperational(entry.key)) {
          return true;
        }
      }
      return false;
    }
    return this.readSchedulerChannelOverride(schedulerId, 'waGroup');
  }

  async getResolvedCatalog(): Promise<ResolvedStepCatalogEntry[]> {
    const [overrides, flags] = await Promise.all([
      this.getStepOverrides(),
      this.featureFlags.getAllFlagStates(),
    ]);

    return AUTOMATION_STEP_CATALOG.map((entry) => {
      const enabled = overrides[entry.key] ?? entry.defaultEnabled;
      const flagActive = entry.requiresFlag
        ? flags[entry.requiresFlag].enabled
        : true;
      return {
        ...entry,
        enabled,
        flagActive,
        operational: enabled && flagActive,
      };
    });
  }

  getChannelsForStep(step: AutomationStep): AutomationStepChannelId[] {
    return (
      AUTOMATION_STEP_CATALOG.find((entry) => entry.key === step)?.channels ?? []
    );
  }
}
