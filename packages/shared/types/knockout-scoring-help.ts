/** Factor aplicado al puntaje base del partido en rondas eliminatorias. */
export const KNOCKOUT_PHASE_MULTIPLIER = 1.5;

export const KNOCKOUT_MULTIPLIER_FORMULA =
    'Puntos del partido = base de aciertos × 1.5';

export const KNOCKOUT_MULTIPLIER_STEPS = [
    'Calcula tus aciertos como en fase de grupos (marcador 5, ganador 2, gol 1).',
    'Si acertaste varios, súmalos primero (ej. ganador 2 + gol 1 = 3 pts base).',
    'En eliminatorias, multiplica esa base completa × 1.5 — no multiplicas cada acierto por separado.',
    'La predicción única (+5) y los bonos clasificados se suman después, sin × 1.5.',
] as const;

/** Ejemplos reales (Sudáfrica vs Canadá 0-1, dieciseisavos). */
export const KNOCKOUT_MULTIPLIER_EXAMPLES = [
    {
        pred: '0-1',
        result: '0-1',
        label: 'Marcador exacto',
        calc: '5 pts × 1.5',
        total: '7.5 pts',
    },
    {
        pred: '1-2',
        result: '0-1',
        label: 'Solo ganador',
        calc: '2 pts × 1.5',
        total: '3 pts',
    },
    {
        pred: '0-2',
        result: '0-1',
        label: 'Ganador + gol',
        calc: '(2 + 1) = 3 pts × 1.5',
        total: '4.5 pts',
        highlight: true,
        note: 'Primero sumas 2 + 1; luego multiplicas el total.',
    },
    {
        pred: '1-1',
        result: '0-1',
        label: 'Solo gol acertado',
        calc: '1 pt × 1.5',
        total: '1.5 pts',
    },
] as const;

export const KNOCKOUT_MULTIPLIER_NOT_APPLIES = [
    'Fase de grupos (siempre puntos normales, sin × 1.5)',
    'Predicción única (+5): se suma al final, sin multiplicar',
    'Bono clasificados por fase (dieciseisavos 12, octavos 8, cuartos 4, etc.)',
] as const;

export const KNOCKOUT_PHASES_LABEL =
    'Dieciseisavos, octavos, cuartos, semifinal, final y tercer lugar';
