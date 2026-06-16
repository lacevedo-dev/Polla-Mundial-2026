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

const STEP_OVERRIDES_KEY = 'automation:step_overrides';

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
