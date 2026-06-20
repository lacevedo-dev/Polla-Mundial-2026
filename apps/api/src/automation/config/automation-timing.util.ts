import { AutomationStep } from '@prisma/client';
import type { EscalationCheckpointId } from '../types/automation.types';

/** Minutos antes del kickoff en los que cierran las predicciones (por polla). */
export const DEFAULT_CLOSE_PREDICTION_MINUTES = 15;

/** @deprecated Clave legacy; usar PREDICTION_REPORT_MINUTES_AFTER_CLOSE_KEY. */
export const PREDICTION_REPORT_MINUTES_BEFORE_KEY =
  'automation:prediction_report_minutes_before';

/** Clave SystemConfig: minutos después del cierre para enviar el reporte de predicciones. */
export const PREDICTION_REPORT_MINUTES_AFTER_CLOSE_KEY =
  'automation:prediction_report_minutes_after_close';

/** Valor por defecto legacy (solo observabilidad / migración). */
export const DEFAULT_PREDICTION_REPORT_MINUTES_BEFORE = 15;

/** Valor por defecto: reporte 1 min después del cierre de pronósticos. */
export const DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE = 1;

/** Ventana de gracia (min) tras el kickoff para catch-up del reporte si el cron se retrasó. */
export const PREDICTION_REPORT_CATCHUP_GRACE_MINUTES = 10;

/** Ventana de gracia (min) tras el instante programado para tolerar jitter del cron. */
export const PREDICTION_REPORT_WINDOW_GRACE_MINUTES = 2;

export function normalizePredictionReportMinutesBefore(
  value: number | null | undefined,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREDICTION_REPORT_MINUTES_BEFORE;
  }
  return Math.max(1, Math.min(120, Math.round(value)));
}

export function parsePredictionReportMinutesBeforeConfig(
  raw: string | null | undefined,
): number {
  if (!raw) return DEFAULT_PREDICTION_REPORT_MINUTES_BEFORE;
  try {
    const parsed = JSON.parse(raw) as { minutes?: unknown };
    if (typeof parsed.minutes === 'number') {
      return normalizePredictionReportMinutesBefore(parsed.minutes);
    }
  } catch {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      return normalizePredictionReportMinutesBefore(asNumber);
    }
  }
  return DEFAULT_PREDICTION_REPORT_MINUTES_BEFORE;
}

export function normalizePredictionReportMinutesAfterClose(
  value: number | null | undefined,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE;
  }
  return Math.max(0, Math.min(30, Math.round(value)));
}

export function parsePredictionReportMinutesAfterCloseConfig(
  raw: string | null | undefined,
): number {
  if (!raw) return DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE;
  try {
    const parsed = JSON.parse(raw) as { minutes?: unknown };
    if (typeof parsed.minutes === 'number') {
      return normalizePredictionReportMinutesAfterClose(parsed.minutes);
    }
  } catch {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      return normalizePredictionReportMinutesAfterClose(asNumber);
    }
  }
  return DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE;
}

/** Instant programado del reporte = cierre de pronósticos + offset configurable. */
export function getPredictionReportDueAt(
  matchDate: Date,
  closePredictionMinutes: number,
  minutesAfterClose: number = DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE,
): Date {
  const normalizedClose = Math.max(1, Math.round(closePredictionMinutes));
  const normalizedAfter = normalizePredictionReportMinutesAfterClose(minutesAfterClose);
  return new Date(
    matchDate.getTime() -
      (normalizedClose - normalizedAfter) * 60_000,
  );
}

/** Ventana de gracia del cron (minutos) para disparar un checkpoint. */
export const CHECKPOINT_WINDOW_GRACE_MINUTES = 5;

/** Minutos extra antes del cierre para la última escalada personalizada. */
export const FINAL_ESCALATION_BUFFER_MINUTES = 5;

/** Máximo de nombres listados en WA Grupo antes de truncar. */
export const WA_MISSING_NAMES_DISPLAY_LIMIT = 20;

/**
 * Última alerta accionable = cierre + buffer (ej. cierre 15 → alerta T-20).
 */
export function getFinalEscalationMinutesBeforeKickoff(
  closePredictionMinutes: number,
): number {
  return closePredictionMinutes + FINAL_ESCALATION_BUFFER_MINUTES;
}

/**
 * Checkpoints de escalada ordenados de mayor a menor urgencia (más lejos → más cerca).
 * T-60 se maneja aparte como recordatorio inicial.
 */
export function getEscalationCheckpointsMinutes(
  closePredictionMinutes: number,
): number[] {
  const finalMinutes = getFinalEscalationMinutesBeforeKickoff(closePredictionMinutes);
  const candidates = [45, 30, finalMinutes];
  const unique = [...new Set(candidates.filter((m) => m > 0 && m < 60))];
  return unique.sort((a, b) => b - a);
}

export function checkpointMinutesToId(
  minutesBeforeKickoff: number,
  closePredictionMinutes: number,
): EscalationCheckpointId | null {
  const finalMinutes = getFinalEscalationMinutesBeforeKickoff(closePredictionMinutes);
  if (minutesBeforeKickoff === 45) return 'T45';
  if (minutesBeforeKickoff === 30) return 'T30';
  if (minutesBeforeKickoff === finalMinutes) return 'T_FINAL';
  return null;
}

export function escalationCheckpointToAutomationStep(
  checkpoint: EscalationCheckpointId,
): AutomationStep {
  switch (checkpoint) {
    case 'T45':
      return AutomationStep.ESCALATION_T45;
    case 'T30':
      return AutomationStep.ESCALATION_T30;
    case 'T_FINAL':
      return AutomationStep.ESCALATION_FINAL;
  }
}

export function automationStepToEscalationCheckpoint(
  step: AutomationStep,
): EscalationCheckpointId | null {
  switch (step) {
    case AutomationStep.ESCALATION_T45:
      return 'T45';
    case AutomationStep.ESCALATION_T30:
      return 'T30';
    case AutomationStep.ESCALATION_FINAL:
      return 'T_FINAL';
    default:
      return null;
  }
}

export function escalationCheckpointToMinutes(
  checkpoint: EscalationCheckpointId,
  closePredictionMinutes: number,
): number {
  switch (checkpoint) {
    case 'T45':
      return 45;
    case 'T30':
      return 30;
    case 'T_FINAL':
      return getFinalEscalationMinutesBeforeKickoff(closePredictionMinutes);
  }
}

export function formatMinutesBeforeKickoff(minutes: number): string {
  return `T-${minutes}`;
}
