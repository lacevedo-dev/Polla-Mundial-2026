import { AutomationStep } from '@prisma/client';
import type { AutomationFeatureFlagId } from './automation-feature-flags.service';

export type AutomationStepPhase = 'PRE_MATCH' | 'LIVE' | 'POST_MATCH';

export type AutomationStepChannelId =
  | 'push'
  | 'inApp'
  | 'waGroup'
  | 'email'
  | 'whatsapp';

export type AutomationStepCatalogEntry = {
  key: AutomationStep;
  phase: AutomationStepPhase;
  label: string;
  shortLabel: string;
  description: string;
  schedulerId: string | null;
  channels: AutomationStepChannelId[];
  /** Si requiere un feature flag v2 para aplicar en runtime. */
  requiresFlag?: AutomationFeatureFlagId;
  /** ON por defecto si no hay override en BD. */
  defaultEnabled: boolean;
};

export const AUTOMATION_STEP_CATALOG: AutomationStepCatalogEntry[] = [
  {
    key: AutomationStep.MATCH_REMINDER,
    phase: 'PRE_MATCH',
    label: 'Recordatorio T-60',
    shortLabel: 'T-60',
    description: 'Alerta general 60 min antes — incluye plazo de modificación',
    schedulerId: 'match_reminder',
    channels: ['push', 'inApp', 'email'],
    defaultEnabled: true,
  },
  {
    key: AutomationStep.ESCALATION_T45,
    phase: 'PRE_MATCH',
    label: 'Escalada T-45',
    shortLabel: 'T-45',
    description: 'Solo pendientes — push, in-app y WA Grupo con nombres',
    schedulerId: 'pre_match_escalation',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'preMatchV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.ESCALATION_T30,
    phase: 'PRE_MATCH',
    label: 'Escalada T-30',
    shortLabel: 'T-30',
    description: 'Segunda escalada a pendientes',
    schedulerId: 'pre_match_escalation',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'preMatchV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.ESCALATION_FINAL,
    phase: 'PRE_MATCH',
    label: 'Escalada final',
    shortLabel: 'T-f',
    description: 'Última alerta = cierre + 5 min antes del kickoff',
    schedulerId: 'pre_match_escalation',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'preMatchV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.PREDICTION_CLOSING,
    phase: 'PRE_MATCH',
    label: 'Cierre predicciones',
    shortLabel: 'Cierre',
    description: 'Cierre duro de pronósticos por polla',
    schedulerId: 'prediction_closing',
    channels: ['push', 'inApp', 'whatsapp', 'waGroup', 'email'],
    defaultEnabled: true,
  },
  {
    key: AutomationStep.MATCH_START,
    phase: 'LIVE',
    label: 'Inicio partido',
    shortLabel: 'Inicio',
    description: 'Al pasar SCHEDULED → LIVE',
    schedulerId: 'live_match_start',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'livePhaseV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.HALFTIME,
    phase: 'LIVE',
    label: 'Medio tiempo',
    shortLabel: 'HT',
    description: 'Detecta status HT',
    schedulerId: 'live_halftime',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'livePhaseV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.SECOND_HALF_START,
    phase: 'LIVE',
    label: '2.ª parte',
    shortLabel: '2H',
    description: 'Al salir de HT',
    schedulerId: 'live_second_half',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'livePhaseV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.MATCH_LIVE_END,
    phase: 'LIVE',
    label: 'Fin partido (live)',
    shortLabel: 'Fin',
    description: 'Teaser antes de calcular puntos',
    schedulerId: 'live_match_end',
    channels: ['push', 'inApp', 'waGroup'],
    requiresFlag: 'livePhaseV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.GOAL_IMPACT,
    phase: 'LIVE',
    label: 'Impacto gol (WA)',
    shortLabel: 'Imp.G',
    description: 'Segundo mensaje WA tras cada gol',
    schedulerId: 'live_goal_impact',
    channels: ['waGroup'],
    requiresFlag: 'livePhaseV2',
    defaultEnabled: true,
  },
  {
    key: AutomationStep.RESULT_NOTIFICATION,
    phase: 'POST_MATCH',
    label: 'Resultado personal',
    shortLabel: 'Result.',
    description: 'Push/in-app/WA con marcador y puntos',
    schedulerId: 'match_result',
    channels: ['push', 'whatsapp', 'waGroup'],
    defaultEnabled: true,
  },
  {
    key: AutomationStep.PREDICTION_REPORT,
    phase: 'POST_MATCH',
    label: 'Reporte predicciones',
    shortLabel: 'P.Rep',
    description: 'Imagen/PDF al grupo WA tras cierre',
    schedulerId: 'prediction_report',
    channels: ['push', 'inApp', 'whatsapp', 'waGroup', 'email'],
    defaultEnabled: true,
  },
  {
    key: AutomationStep.RESULT_REPORT,
    phase: 'POST_MATCH',
    label: 'Reporte resultados',
    shortLabel: 'Rep.F',
    description: 'Imagen/PDF al grupo WA tras finalizar',
    schedulerId: 'result_report',
    channels: ['push', 'inApp', 'whatsapp', 'waGroup', 'email'],
    defaultEnabled: true,
  },
];

export const AUTOMATION_STEP_ORDER = AUTOMATION_STEP_CATALOG.map((s) => s.key);

export function getCatalogEntry(
  step: AutomationStep,
): AutomationStepCatalogEntry | undefined {
  return AUTOMATION_STEP_CATALOG.find((entry) => entry.key === step);
}

export function getStepsForPhase(phase: AutomationStepPhase): AutomationStepCatalogEntry[] {
  return AUTOMATION_STEP_CATALOG.filter((entry) => entry.phase === phase);
}
