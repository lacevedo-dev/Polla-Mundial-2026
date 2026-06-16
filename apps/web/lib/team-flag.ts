/**
 * Resuelve la URL de bandera de un equipo.
 * Prioriza flagcdn (ISO) cuando el código del equipo es mapeable, para no saturar media.api-sports.io.
 * Si no hay mapeo, usa flagUrl almacenado en BD.
 */

/** Códigos FIFA / API-Football → slug ISO de flagcdn.com */
const TEAM_CODE_TO_FLAG_ISO: Record<string, string> = {
    MEX: 'mx',
    RSA: 'za',
    KOR: 'kr',
    CZE: 'cz',
    CAN: 'ca',
    BIH: 'ba',
    BOS: 'ba',
    QAT: 'qa',
    SUI: 'ch',
    SWI: 'ch',
    BRA: 'br',
    MAR: 'ma',
    MOR: 'ma',
    HAI: 'ht',
    SCO: 'gb-sct',
    USA: 'us',
    PAR: 'py',
    AUS: 'au',
    TUR: 'tr',
    GER: 'de',
    CUW: 'cw',
    CUR: 'cw',
    CIV: 'ci',
    IVO: 'ci',
    ECU: 'ec',
    NED: 'nl',
    NET: 'nl',
    JPN: 'jp',
    JAP: 'jp',
    SWE: 'se',
    TUN: 'tn',
    BEL: 'be',
    EGY: 'eg',
    IRN: 'ir',
    IRA: 'ir',
    NZL: 'nz',
    NEW: 'nz',
    ESP: 'es',
    SPA: 'es',
    CPV: 'cv',
    CAP: 'cv',
    KSA: 'sa',
    SAU: 'sa',
    URU: 'uy',
    FRA: 'fr',
    SEN: 'sn',
    IRQ: 'iq',
    NOR: 'no',
    ARG: 'ar',
    ALG: 'dz',
    AUT: 'at',
    JOR: 'jo',
    POR: 'pt',
    COD: 'cd',
    CON: 'cd',
    UZB: 'uz',
    COL: 'co',
    ENG: 'gb-eng',
    CRO: 'hr',
    GHA: 'gh',
    PAN: 'pa',
    DEN: 'dk',
    NGA: 'ng',
    POL: 'pl',
    CHI: 'cl',
};

function normalizeTeamCode(code: string): string {
    let normalized = code.trim().toUpperCase();
    normalized = normalized.normalize('NFD').replace(/\p{M}/gu, '');
    normalized = normalized.replace(/\d+$/, '');
    return normalized;
}

/** Devuelve el slug ISO de flagcdn o null si el código no es reconocible. */
export function codeToFlagIso(code?: string | null): string | null {
    if (!code?.trim()) return null;

    const normalized = normalizeTeamCode(code);

    if (normalized.length === 2) {
        return normalized.toLowerCase();
    }

    return TEAM_CODE_TO_FLAG_ISO[normalized] ?? null;
}

export function resolveTeamFlagUrl(flagUrl?: string | null, code?: string | null): string {
    const iso = codeToFlagIso(code);
    if (iso) {
        return `https://flagcdn.com/w80/${iso}.png`;
    }

    return flagUrl?.trim() || '';
}
