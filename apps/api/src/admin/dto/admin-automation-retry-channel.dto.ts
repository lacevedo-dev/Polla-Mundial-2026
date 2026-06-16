import { AutomationStep } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { WA_GROUP_RETRY_STEPS } from '../../automation/config/automation-step-scheduler.util';

const RETRYABLE_CHANNELS = ['waGroup'] as const;

export class AdminAutomationRetryChannelDto {
  @IsString()
  matchId!: string;

  @IsEnum(WA_GROUP_RETRY_STEPS, {
    message: `step debe ser uno de: ${WA_GROUP_RETRY_STEPS.join(', ')}`,
  })
  step!: AutomationStep;

  @IsString()
  leagueId!: string;

  @IsEnum(RETRYABLE_CHANNELS, {
    message: `channel debe ser uno de: ${RETRYABLE_CHANNELS.join(', ')}`,
  })
  channel!: (typeof RETRYABLE_CHANNELS)[number];
}
