import {
  automationStepToLiveEvent,
  getSchedulerIdForStep,
  MANUAL_RETRY_STEPS,
} from './automation-step-scheduler.util';
import { AutomationStep } from '@prisma/client';

describe('automation-step-scheduler.util', () => {
  it('mapea pasos de escalada al scheduler pre_match_escalation', () => {
    expect(getSchedulerIdForStep(AutomationStep.ESCALATION_T45)).toBe(
      'pre_match_escalation',
    );
    expect(getSchedulerIdForStep(AutomationStep.ESCALATION_FINAL)).toBe(
      'pre_match_escalation',
    );
  });

  it('mapea pasos en vivo a schedulers dedicados', () => {
    expect(getSchedulerIdForStep(AutomationStep.MATCH_START)).toBe(
      'live_match_start',
    );
    expect(getSchedulerIdForStep(AutomationStep.GOAL_IMPACT)).toBe(
      'live_goal_impact',
    );
  });

  it('convierte steps live a event ids', () => {
    expect(automationStepToLiveEvent(AutomationStep.HALFTIME)).toBe('HALFTIME');
    expect(automationStepToLiveEvent(AutomationStep.RESULT_NOTIFICATION)).toBeNull();
  });

  it('incluye escaladas en pasos reintentables', () => {
    expect(MANUAL_RETRY_STEPS).toContain(AutomationStep.ESCALATION_T30);
    expect(MANUAL_RETRY_STEPS).toContain(AutomationStep.MATCH_START);
  });
});
