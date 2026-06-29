import { ScoringType } from '@prisma/client';
import { PHASE_BONUS_HELP_ITEMS } from '@polla-2026/shared';

export const CORP_DEFAULT_SCORING_RULES = [
    { ruleType: ScoringType.EXACT_SCORE, points: 5, description: 'Marcador exacto', multiplier: 1, active: true },
    { ruleType: ScoringType.CORRECT_WINNER, points: 2, description: 'Ganador / empate correcto', multiplier: 1, active: true },
    { ruleType: ScoringType.TEAM_GOALS, points: 1, description: 'Gol acertado (al menos un equipo)', multiplier: 1, active: true },
    { ruleType: ScoringType.UNIQUE_PREDICTION, points: 5, description: 'Predicción única en la liga', multiplier: 1, active: true },
    { ruleType: ScoringType.PHASE_BONUS_R32, points: 12, description: 'Bono clasificados Dieciseisavos', multiplier: 1, active: true },
    { ruleType: ScoringType.PHASE_BONUS_R16, points: 8, description: 'Bono clasificados Octavos', multiplier: 1, active: true },
    { ruleType: ScoringType.PHASE_BONUS_QF, points: 4, description: 'Bono clasificados Cuartos', multiplier: 1, active: true },
    { ruleType: ScoringType.PHASE_BONUS_SF, points: 2, description: 'Bono clasificados Semifinal', multiplier: 1, active: true },
    { ruleType: ScoringType.PHASE_BONUS_FINAL, points: 5, description: 'Bono Campeón (Final)', multiplier: 1, active: true },
] as const;

export const CORP_PHASE_BONUS_HELP = PHASE_BONUS_HELP_ITEMS.map((item) => ({
    label: item.label,
    sub: item.sub,
    ruleType: item.ruleType as ScoringType,
    icon: item.icon,
}));
