const CATEGORY_LABELS: Record<string, string> = {
    PRINCIPAL: 'General',
    MATCH: 'Partido',
    GROUP: 'Grupo',
    ROUND: 'Ronda',
    PHASE: 'Fase',
};


export function fmtCurrency(n: number, currency = 'COP'): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}

export function categoryLabel(cat: string): string {
    return CATEGORY_LABELS[cat] ?? cat;
}
