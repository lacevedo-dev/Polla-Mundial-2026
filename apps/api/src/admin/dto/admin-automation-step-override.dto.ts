import { AutomationStep } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';
import { AUTOMATION_STEP_ORDER } from '../../automation/config/automation-step-catalog';

export class AdminAutomationStepOverrideDto {
  @IsEnum(AUTOMATION_STEP_ORDER, {
    message: `step debe ser uno de: ${AUTOMATION_STEP_ORDER.join(', ')}`,
  })
  step!: AutomationStep;

  @IsBoolean()
  enabled!: boolean;
}
