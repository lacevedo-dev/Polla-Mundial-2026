import { AutomationStep } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const RETRYABLE_STEPS = [
  AutomationStep.MATCH_REMINDER,
  AutomationStep.PREDICTION_CLOSING,
  AutomationStep.RESULT_NOTIFICATION,
  AutomationStep.PREDICTION_REPORT,
  AutomationStep.RESULT_REPORT,
] as const;

export type RetryableStep = (typeof RETRYABLE_STEPS)[number];

export class AdminAutomationRetryDto {
  @IsString()
  matchId!: string;

  @IsEnum(RETRYABLE_STEPS, {
    message: `step debe ser uno de: ${RETRYABLE_STEPS.join(', ')}`,
  })
  step!: RetryableStep;

  @IsOptional()
  @IsString()
  leagueId?: string;
}
