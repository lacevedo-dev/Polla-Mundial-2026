import type { Logger } from '@nestjs/common';

export type GoalAutomationEvent =
  | 'goal_detected'
  | 'goal_dispatch_started'
  | 'goal_dispatch_completed'
  | 'goal_dispatch_skipped'
  | 'goal_wa_scored_enqueued'
  | 'goal_wa_scored_skipped'
  | 'goal_impact_summaries_loaded'
  | 'goal_impact_enqueued'
  | 'goal_impact_skipped'
  | 'goal_participants_notified'
  | 'goal_dispatch_service_missing'
  | 'goal_wa_job_processing'
  | 'goal_wa_job_sent'
  | 'goal_wa_job_failed';

export type GoalAutomationPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

type GoalAutomationLevel = 'log' | 'warn' | 'error' | 'debug';

export function logGoalAutomation(
  logger: Logger,
  event: GoalAutomationEvent,
  payload: GoalAutomationPayload,
  level: GoalAutomationLevel = 'log',
): void {
  const line = JSON.stringify({
    event: 'goal_automation',
    kind: event,
    at: new Date().toISOString(),
    ...payload,
  });

  switch (level) {
    case 'warn':
      logger.warn(line);
      break;
    case 'error':
      logger.error(line);
      break;
    case 'debug':
      logger.debug(line);
      break;
    default:
      logger.log(line);
  }
}
