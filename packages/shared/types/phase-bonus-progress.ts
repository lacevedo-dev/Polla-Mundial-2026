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
    ROUND_OF_32: 'Quién clasifica en cada dieciseisavo (16 partidos · 32→16)',
    ROUND_OF_16: 'Quién clasifica en cada partido de octavos (8 partidos · 16→8)',
    QUARTER: 'Los 4 clasificados en cuartos',
    SEMI: 'Los 2 clasificados en semifinal',
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
    'En cada fase eliminatoria debes acertar quién clasifica en todos los partidos de esa ronda (dieciseisavos 16, octavos 8, etc.). Si predices empate, el pick de penales solo cuenta si el partido real también se definió en penales. El bono se suma solo cuando cierra la fase completa.';

/** Partidos esperados por fase en un cuadro completo (Mundial 48 equipos). */
export const PHASE_KNOCKOUT_EXPECTED_MATCHES: Record<string, number> = {
    ROUND_OF_32: 16,
    ROUND_OF_16: 8,
    QUARTER: 4,
    SEMI: 2,
    FINAL: 1,
};

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
    const fullyCorrect = item.totalMatches > 0 && item.correctCount >= item.totalMatches;
    // No mostrar bono verde si el recuento vivo ya no es perfecto (p. ej. empate sin penales).
    if (item.isAwarded && fullyCorrect) return 'awarded';
    if (item.isPhaseComplete && !(item.isAwarded && fullyCorrect)) return 'missed';
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

/** Texto corto para chips: `1/8` → muestra aciertos sobre total de la fase. */
export function getPhaseBonusChipFraction(item: PhaseBonusProgressItem): string {
    return `${item.correctCount}/${item.totalMatches}`;
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
    if (item.maxBonusPoints <= 0) {
        return 'Seguimiento de aciertos (sin bono en esta fase)';
    }
    return `+${item.maxBonusPoints} pts al cerrar la fase`;
}
