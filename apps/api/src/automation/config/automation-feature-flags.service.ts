import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AutomationFeatureFlagId =
  | 'preMatchV2'
  | 'livePhaseV2'
  | 'postMatchV2';

export type AutomationFeatureFlagSource = 'env' | 'db' | 'default';

export type AutomationFeatureFlagState = {
  enabled: boolean;
  source: AutomationFeatureFlagSource;
  /** true cuando una variable de entorno fija el valor (no editable desde admin). */
  locked: boolean;
};

const FLAG_DEFS: Record<
  AutomationFeatureFlagId,
  { configKey: string; envKey: string }
> = {
  preMatchV2: {
    configKey: 'automation:pre_match_v2',
    envKey: 'AUTOMATION_PRE_MATCH_V2',
  },
  livePhaseV2: {
    configKey: 'automation:live_phase_v2',
    envKey: 'AUTOMATION_LIVE_PHASE_V2',
  },
  postMatchV2: {
    configKey: 'automation:post_match_v2',
    envKey: 'AUTOMATION_POST_MATCH_V2',
  },
};

@Injectable()
export class AutomationFeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async isPreMatchV2Enabled(): Promise<boolean> {
    return (await this.getFlagState('preMatchV2')).enabled;
  }

  async isLivePhaseV2Enabled(): Promise<boolean> {
    return (await this.getFlagState('livePhaseV2')).enabled;
  }

  async isPostMatchV2Enabled(): Promise<boolean> {
    return (await this.getFlagState('postMatchV2')).enabled;
  }

  async getAllFlagStates(): Promise<Record<AutomationFeatureFlagId, AutomationFeatureFlagState>> {
    const [preMatchV2, livePhaseV2, postMatchV2] = await Promise.all([
      this.getFlagState('preMatchV2'),
      this.getFlagState('livePhaseV2'),
      this.getFlagState('postMatchV2'),
    ]);
    return { preMatchV2, livePhaseV2, postMatchV2 };
  }

  async setFlag(flagId: AutomationFeatureFlagId, enabled: boolean): Promise<void> {
    const def = FLAG_DEFS[flagId];
    const envOverride = this.readEnvOverride(def.envKey);
    if (envOverride !== null) {
      throw new BadRequestException(
        `${def.envKey} está definido en el entorno (${envOverride ? 'true' : 'false'}). Quita la variable para cambiar el flag desde admin.`,
      );
    }

    await this.prisma.systemConfig.upsert({
      where: { key: def.configKey },
      create: { key: def.configKey, value: enabled ? 'true' : 'false' },
      update: { value: enabled ? 'true' : 'false' },
    });
  }

  private async getFlagState(flagId: AutomationFeatureFlagId): Promise<AutomationFeatureFlagState> {
    const def = FLAG_DEFS[flagId];
    const envOverride = this.readEnvOverride(def.envKey);
    if (envOverride !== null) {
      return {
        enabled: envOverride,
        source: 'env',
        locked: true,
      };
    }

    const row = await this.prisma.systemConfig.findUnique({
      where: { key: def.configKey },
      select: { value: true },
    });
    if (row) {
      return {
        enabled: row.value === 'true',
        source: 'db',
        locked: false,
      };
    }

    // Pre/live v2 ON por defecto para que WA Grupo en vivo funcione sin config manual.
    const enabledByDefault =
      flagId === 'preMatchV2' || flagId === 'livePhaseV2';
    return { enabled: enabledByDefault, source: 'default', locked: false };
  }

  private readEnvOverride(envKey: string): boolean | null {
    const env = process.env[envKey]?.trim().toLowerCase();
    if (env === 'true') return true;
    if (env === 'false') return false;
    return null;
  }
}
