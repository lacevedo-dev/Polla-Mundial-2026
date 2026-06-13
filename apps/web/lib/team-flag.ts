/** Prioriza banderas de país (flagcdn) para evitar saturar media.api-sports.io en listas grandes. */
export function resolveTeamFlagUrl(flagUrl?: string | null, code?: string | null): string {
    if (code?.trim()) {
        return `https://flagcdn.com/w80/${code.trim().toLowerCase()}.png`;
    }
    return flagUrl?.trim() || '';
}
