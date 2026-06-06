export function isPredictionClosed(matchDate: string, closeMin = 15): boolean {
    return Date.now() > new Date(matchDate).getTime() - closeMin * 60_000;
}

export function isLiveStatus(s: string): boolean {
    return ['LIVE', 'IN_PLAY', 'HALFTIME'].includes(s);
}

export function isFinishedStatus(s: string): boolean {
    return ['FINISHED', 'FT'].includes(s);
}

export function formatMatchTime(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota',
    }).format(new Date(matchDate));
}

export function getDateKey(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Bogota',
    }).format(new Date(matchDate));
}

export function formatDateHeader(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota',
    }).format(new Date(matchDate)).toUpperCase();
}

export function getDaysUntil(matchDate: string): number | null {
    const diff = new Date(matchDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDateShort(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        weekday: 'short', day: '2-digit', month: 'short', timeZone: 'America/Bogota',
    }).format(new Date(matchDate));
}

export function formatPhaseLabel(phase?: string | null): string {
    switch (phase) {
        case 'GROUP': return 'Fase de grupos';
        case 'ROUND_OF_32': return 'R32';
        case 'ROUND_OF_16': return 'Octavos';
        case 'QUARTER': return 'Cuartos';
        case 'SEMI': return 'Semis';
        case 'FINAL': return 'Final';
        default: return phase ?? '';
    }
}
