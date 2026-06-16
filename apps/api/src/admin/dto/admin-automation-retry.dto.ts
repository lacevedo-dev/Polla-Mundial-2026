import { AutomationStep } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { MANUAL_RETRY_STEPS } from '../../automation/config/automation-step-scheduler.util';

export type RetryableStep = (typeof MANUAL_RETRY_STEPS)[number];

export class AdminAutomationRetryDto {
  @IsString()
  matchId!: string;

  @IsIn(MANUAL_RETRY_STEPS, {
    message: `step debe ser uno de: ${MANUAL_RETRY_STEPS.join(', ')}`,
  })
  step!: RetryableStep;

  @IsOptional()
  @IsString()
  leagueId?: string;
}
