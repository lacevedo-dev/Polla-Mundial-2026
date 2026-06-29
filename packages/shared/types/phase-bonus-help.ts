/** Puntos por defecto del bono al cerrar cada fase (todas las clasificaciones correctas). */
export const DEFAULT_PHASE_BONUS_POINTS: Record<string, number> = {
    PHASE_BONUS_R32: 8,
    PHASE_BONUS_R16: 8,
    PHASE_BONUS_QF: 4,
    PHASE_BONUS_SF: 2,
    PHASE_BONUS_FINAL: 5,
};

export interface PhaseBonusHelpItem {
    label: string;
    sub: string;
    ruleType: string;
    icon: string;
    phase: string;
    /** Texto corto para tablas de ayuda / PDF */
    description: string;
}

export const PHASE_BONUS_HELP_ITEMS: PhaseBonusHelpItem[] = [
    {
        label: 'Dieciseisavos',
        sub: '32 → 16',
        ruleType: 'PHASE_BONUS_R32',
        icon: '🏟️',
        phase: 'ROUND_OF_32',
        description: 'Aciertas los 16 clasificados en dieciseisavos',
    },
    {
        label: 'Octavos',
        sub: '16 → 8',
        ruleType: 'PHASE_BONUS_R16',
        icon: '🥈',
        phase: 'ROUND_OF_16',
        description: 'Aciertas los 8 clasificados en octavos',
    },
    {
        label: 'Cuartos',
        sub: '8 → 4',
        ruleType: 'PHASE_BONUS_QF',
        icon: '🥉',
        phase: 'QUARTER',
        description: 'Aciertas los 4 clasificados en cuartos',
    },
    {
        label: 'Semifinal',
        sub: '4 → 2',
        ruleType: 'PHASE_BONUS_SF',
        icon: '🏅',
        phase: 'SEMI',
        description: 'Aciertas los 2 clasificados en semifinal',
    },
    {
        label: 'Campeón',
        sub: 'El ganador',
        ruleType: 'PHASE_BONUS_FINAL',
        icon: '🏆',
        phase: 'FINAL',
        description: 'Aciertas el campeón del torneo',
    },
];

type ScoringRuleLike = {
    ruleType: string;
    points: number;
    active?: boolean;
};

export function resolvePhaseBonusPoints(
    rules: ScoringRuleLike[] | undefined,
    ruleType: string,
): number {
    const fallback = DEFAULT_PHASE_BONUS_POINTS[ruleType] ?? 0;
    if (!rules?.length) return fallback;
    const rule = rules.find((entry) => entry.ruleType === ruleType && entry.active !== false);
    return rule?.points ?? fallback;
}

export function buildPhaseBonusPointsMap(
    rules: ScoringRuleLike[] | undefined,
): Record<string, number> {
    return Object.fromEntries(
        PHASE_BONUS_HELP_ITEMS.map((item) => [
            item.ruleType,
            resolvePhaseBonusPoints(rules, item.ruleType),
        ]),
    );
}

/** Filas HTML para tablas de ayuda / PDF (bonos clasificados). */
export function renderPhaseBonusHelpTableRowsHtml(): string {
    return PHASE_BONUS_HELP_ITEMS.map((item) => {
        const pts = DEFAULT_PHASE_BONUS_POINTS[item.ruleType] ?? 0;
        const title =
            item.label === 'Campeón'
                ? '🏆 Bono Final / Campeón'
                : `${item.icon} Bono ${item.label}`;
        const ptsClass = item.ruleType === 'PHASE_BONUS_FINAL' ? 'pts-lime' : 'pts-slate';
        return `<tr><td><strong>${title}</strong></td><td>${item.description}</td><td class="${ptsClass}">${pts}</td></tr>`;
    }).join('\n        ');
}

/** Tarjetas HTML para grillas de ayuda / PDF (bonos clasificados). */
export function renderPhaseBonusHelpCardsHtml(): string {
    return PHASE_BONUS_HELP_ITEMS.map((item) => {
        const pts = DEFAULT_PHASE_BONUS_POINTS[item.ruleType] ?? 0;
        return `<div class="bonus-card"><div class="bonus-icon">${item.icon}</div><div class="bonus-phase">${item.label}</div><div class="bonus-sub">${item.sub}</div><div class="bonus-pts">${pts} pts</div></div>`;
    }).join('\n        ');
}
