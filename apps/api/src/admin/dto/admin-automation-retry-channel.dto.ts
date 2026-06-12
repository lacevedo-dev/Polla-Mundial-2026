import { AutomationStep } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const RETRYABLE_STEPS = [
  AutomationStep.MATCH_REMINDER,
  AutomationStep.PREDICTION_CLOSING,
  AutomationStep.RESULT_NOTIFICATION,
  AutomationStep.PREDICTION_REPORT,
  AutomationStep.RESULT_REPORT,
] as const;

const RETRYABLE_CHANNELS = ['waGroup'] as const;

export class AdminAutomationRetryChannelDto {
  @IsString()
  matchId!: string;

  @IsEnum(RETRYABLE_STEPS, {
    message: `step debe ser uno de: ${RETRYABLE_STEPS.join(', ')}`,
  })
  step!: (typeof RETRYABLE_STEPS)[number];

  @IsString()
  leagueId!: string;

  @IsEnum(RETRYABLE_CHANNELS, {
    message: `channel debe ser uno de: ${RETRYABLE_CHANNELS.join(', ')}`,
  })
  channel!: (typeof RETRYABLE_CHANNELS)[number];
}
