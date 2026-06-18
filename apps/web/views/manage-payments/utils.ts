const CATEGORY_LABELS: Record<string, string> = {
    PRINCIPAL: 'General',
    MATCH: 'Partido',
    GROUP: 'Grupo',
    ROUND: 'Ronda',
    PHASE: 'Fase',
};

export function avatarUrl(name: string, avatar?: string | null): string {
    return avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=64748b&size=40`;
}

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
