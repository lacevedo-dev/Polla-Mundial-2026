/** Fases con bono de clasificados (orden de visualización). */
export const TRACKED_PHASE_BONUS_PHASES = [
    'ROUND_OF_32',
    'ROUND_OF_16',
    'QUARTER',
    'SEMI',
    'FINAL',
] as const;

export type TrackedPhaseBonusPhase = (typeof TRACKED_PHASE_BONUS_PHASES)[number];

export const PHASE_BONUS_DISPLAY_LABELS: Record<string, string> = {
    ROUND_OF_32: 'Dieciseisavos',
    ROUND_OF_16: 'Octavos',
    QUARTER: 'Cuartos',
    SEMI: 'Semifinal',
    FINAL: 'Campeón',
};

/** Descripción corta del bono por fase (qué hay que acertar). */
export const PHASE_BONUS_SHORT_HINTS: Record<string, string> = {
    ROUND_OF_32: 'Quién clasifica en cada dieciseisavos',
    ROUND_OF_16: 'Quién clasifica en cada octavo',
    QUARTER: 'Quién clasifica en cada cuarto',
    SEMI: 'Quién clasifica en cada semifinal',
    FINAL: 'Quién gana la final',
};

/** Etiqueta corta para chips compactos (móvil). */
export const PHASE_BONUS_COMPACT_LABELS: Record<string, string> = {
    ROUND_OF_32: '16av',
    ROUND_OF_16: 'Oct',
    QUARTER: '4tos',
    SEMI: 'Semi',
    FINAL: 'Final',
};

export const PHASE_BONUS_GLOBAL_HINT =
    'En cada fase eliminatoria debes acertar quién clasifica en todos los partidos. El bono se suma solo cuando cierra la fase completa.';

export interface PhaseBonusProgressItem {
    phase: string;
    label: string;
    correctCount: number;
    totalMatches: number;
    maxBonusPoints: number;
    awardedPoints: number;
    isPhaseComplete: boolean;
    isAwarded: boolean;
    /** Formato técnico `aciertos/total:pts` (legacy / tooltip). */
    progressLabel: string;
}

export type PhaseBonusVisualState = 'awarded' | 'missed' | 'in_progress' | 'pending';

export function getPhaseBonusVisualState(item: PhaseBonusProgressItem): PhaseBonusVisualState {
    if (item.isAwarded) return 'awarded';
    if (item.isPhaseComplete && !item.isAwarded) return 'missed';
    if (item.correctCount > 0 || item.totalMatches > item.correctCount) return 'in_progress';
    return 'pending';
}

export function getPhaseBonusProgressPercent(item: PhaseBonusProgressItem): number {
    if (item.totalMatches <= 0) return 0;
    return Math.round((item.correctCount / item.totalMatches) * 100);
}

/** Texto principal legible para la UI (sustituye `0/8:0`). */
export function getPhaseBonusStatusHeadline(item: PhaseBonusProgressItem): string {
    const state = getPhaseBonusVisualState(item);
    const n = item.correctCount;
    const total = item.totalMatches;

    if (state === 'awarded') {
        return `¡Bono +${item.awardedPoints} pts!`;
    }
    if (state === 'missed') {
        return `${n} de ${total} aciertos · sin bono`;
    }
    if (n === 0) {
        return `0 de ${total} aciertos`;
    }
    return `${n} de ${total} aciertos`;
}

/** Subtítulo de estado (cuándo se otorga o por qué no). */
export function getPhaseBonusStatusSubline(item: PhaseBonusProgressItem): string {
    const state = getPhaseBonusVisualState(item);

    if (state === 'awarded') {
        return 'Todos los clasificados correctos';
    }
    if (state === 'missed') {
        return 'La fase cerró · hacían falta todos';
    }
    if (item.isPhaseComplete) {
        return 'Fase cerrada';
    }
    return `+${item.maxBonusPoints} pts al cerrar la fase`;
}
