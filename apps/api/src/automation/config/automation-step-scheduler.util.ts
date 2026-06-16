import { AutomationStep } from '@prisma/client';

/** Mapeo paso de automatización → schedulerId (mismo id que usa el frontend y WA overrides). */
export const AUTOMATION_STEP_TO_SCHEDULER_ID: Partial<
  Record<AutomationStep, string>
> = {
  [AutomationStep.MATCH_REMINDER]: 'match_reminder',
  [AutomationStep.ESCALATION_T45]: 'pre_match_escalation',
  [AutomationStep.ESCALATION_T30]: 'pre_match_escalation',
  [AutomationStep.ESCALATION_FINAL]: 'pre_match_escalation',
  [AutomationStep.PREDICTION_CLOSING]: 'prediction_closing',
  [AutomationStep.MATCH_START]: 'live_match_start',
  [AutomationStep.HALFTIME]: 'live_halftime',
  [AutomationStep.SECOND_HALF_START]: 'live_second_half',
  [AutomationStep.MATCH_LIVE_END]: 'live_match_end',
  [AutomationStep.GOAL_IMPACT]: 'live_goal_impact',
  [AutomationStep.RESULT_NOTIFICATION]: 'match_result',
  [AutomationStep.PREDICTION_REPORT]: 'prediction_report',
  [AutomationStep.RESULT_REPORT]: 'result_report',
};

export function getSchedulerIdForStep(step: AutomationStep): string | null {
  return AUTOMATION_STEP_TO_SCHEDULER_ID[step] ?? null;
}

/** Pasos reintentables manualmente desde admin (full step, no solo un canal). */
export const MANUAL_RETRY_STEPS: AutomationStep[] = [
  AutomationStep.MATCH_REMINDER,
  AutomationStep.PREDICTION_CLOSING,
  AutomationStep.ESCALATION_T45,
  AutomationStep.ESCALATION_T30,
  AutomationStep.ESCALATION_FINAL,
  AutomationStep.MATCH_START,
  AutomationStep.HALFTIME,
  AutomationStep.SECOND_HALF_START,
  AutomationStep.MATCH_LIVE_END,
  AutomationStep.RESULT_NOTIFICATION,
  AutomationStep.PREDICTION_REPORT,
  AutomationStep.RESULT_REPORT,
];

/** Pasos con reintento de canal WA Grupo. GOAL_IMPACT usa dedupe por marcador. */
export const WA_GROUP_RETRY_STEPS: AutomationStep[] = [
  AutomationStep.MATCH_REMINDER,
  AutomationStep.PREDICTION_CLOSING,
  AutomationStep.ESCALATION_T45,
  AutomationStep.ESCALATION_T30,
  AutomationStep.ESCALATION_FINAL,
  AutomationStep.MATCH_START,
  AutomationStep.HALFTIME,
  AutomationStep.SECOND_HALF_START,
  AutomationStep.MATCH_LIVE_END,
  AutomationStep.GOAL_IMPACT,
  AutomationStep.RESULT_NOTIFICATION,
  AutomationStep.PREDICTION_REPORT,
  AutomationStep.RESULT_REPORT,
];

export function automationStepToLiveEvent(
  step: AutomationStep,
): 'MATCH_START' | 'HALFTIME' | 'SECOND_HALF_START' | 'MATCH_LIVE_END' | null {
  switch (step) {
    case AutomationStep.MATCH_START:
      return 'MATCH_START';
    case AutomationStep.HALFTIME:
      return 'HALFTIME';
    case AutomationStep.SECOND_HALF_START:
      return 'SECOND_HALF_START';
    case AutomationStep.MATCH_LIVE_END:
      return 'MATCH_LIVE_END';
    default:
      return null;
  }
}
