import { AutomationStep } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { MANUAL_RETRY_STEPS } from '../../automation/config/automation-step-scheduler.util';

const PREVIEW_CHANNELS = ['push', 'inApp', 'email', 'waGroup'] as const;

export class AdminAutomationMessagePreviewQueryDto {
  @IsString()
  matchId!: string;

  @IsIn(MANUAL_RETRY_STEPS, {
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
