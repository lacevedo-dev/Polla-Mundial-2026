import { AutomationStep } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { MANUAL_RETRY_STEPS } from '../../automation/config/automation-step-scheduler.util';

const PREVIEW_CHANNELS = ['waGroup', 'push', 'inApp'] as const;

export class AdminAutomationMessagePreviewQueryDto {
  @IsString()
  matchId!: string;

  @IsEnum(MANUAL_RETRY_STEPS, {
    message: `step debe ser uno de: ${MANUAL_RETRY_STEPS.join(', ')}`,
  })
  step!: AutomationStep;

  @IsOptional()
  @IsString()
  leagueId?: string;

  @IsOptional()
  @IsIn(PREVIEW_CHANNELS)
  channel?: (typeof PREVIEW_CHANNELS)[number];
}
