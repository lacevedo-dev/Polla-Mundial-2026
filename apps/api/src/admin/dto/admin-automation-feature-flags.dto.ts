import { IsBoolean, IsIn } from 'class-validator';
import type { AutomationFeatureFlagId } from '../../automation/config/automation-feature-flags.service';

const FLAG_IDS = ['preMatchV2', 'livePhaseV2', 'postMatchV2'] as const satisfies readonly AutomationFeatureFlagId[];

export class AdminAutomationFeatureFlagsDto {
  @IsIn(FLAG_IDS, {
    message: `flag debe ser uno de: ${FLAG_IDS.join(', ')}`,
  })
  flag!: AutomationFeatureFlagId;

  @IsBoolean()
  enabled!: boolean;
}
