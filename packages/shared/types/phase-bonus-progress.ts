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

export interface PhaseBonusProgressItem {
    phase: string;
    label: string;
    correctCount: number;
    totalMatches: number;
    maxBonusPoints: number;
    awardedPoints: number;
    isPhaseComplete: boolean;
    isAwarded: boolean;
    /** Formato `aciertos/total:pts`, ej. `1/8:0` o `8/8:8`. */
    progressLabel: string;
}
