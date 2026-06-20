import type { MatchEventItem } from '../../hooks/useLiveSyncEvents';
import type { GoalScorerStickerProps } from './GoalScorerStickerCard';

export const DEFAULT_STICKER_THEME = {
    primary: '#3ebdb4',
    secondary: '#f5c518',
    accent: '#ef4444',
    pillFrom: '#ea580c',
    pillTo: '#dc2626',
};

export type StickerTheme = typeof DEFAULT_STICKER_THEME;

export function resolveStickerTheme(event: MatchEventItem): StickerTheme {
    const t = event.teamStickerTheme;
    if (t?.primary && t.secondary && t.accent && t.pillFrom && t.pillTo) {
        return {
            primary: t.primary,
            secondary: t.secondary,
            accent: t.accent,
            pillFrom: t.pillFrom,
            pillTo: t.pillTo,
        };
    }
    return DEFAULT_STICKER_THEME;
}

export function resolveStickerCountryCode(event: MatchEventItem, teamName: string): string {
    const fromTheme = event.teamStickerTheme?.countryCode;
    if (fromTheme?.trim()) return fromTheme.trim().toUpperCase().slice(0, 3);
    const words = teamName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'GOL';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

export function resolveJerseyDigits(jerseyNumber?: number | null): [string, string] {
    const raw = jerseyNumber != null ? String(jerseyNumber).padStart(2, '0').slice(-2) : '10';
    return [raw[0] ?? '1', raw[1] ?? '0'];
}

export function formatClassicStatsLine(
    event: MatchEventItem,
    props: GoalScorerStickerProps,
    minuteLabel: string,
    detailLabel: string,
): string {
    const profile = event.playerProfile;
    const parts: string[] = [];
    if (profile?.birthDate) parts.push(profile.birthDate);
    if (profile?.height?.trim()) parts.push(profile.height.trim());
    if (profile?.weight?.trim()) parts.push(profile.weight.trim());
    if (parts.length > 0) return parts.join(' | ');
    return `${detailLabel} · ${minuteLabel} · ${props.homeScore}–${props.awayScore}`;
}

export function formatPremiumStatsParts(event: MatchEventItem): string[] {
    const profile = event.playerProfile;
    const parts: string[] = [];
    if (profile?.birthDate) parts.push(profile.birthDate);
    if (profile?.height?.trim()) parts.push(profile.height.trim());
    if (profile?.weight?.trim()) parts.push(profile.weight.trim());
    return parts;
}

export function buildPremiumFooterCode(countryCode: string, jerseyNumber?: number | null): string {
    const jersey = String(jerseyNumber ?? 0).padStart(2, '0');
    return `${countryCode}${jersey}`.slice(0, 5).toUpperCase();
}

export function buildPremiumCatalogNumber(jerseyNumber?: number | null, minute?: number | null): string {
    const jersey = String(jerseyNumber ?? 10).padStart(2, '0');
    const min = String(minute ?? 0).padStart(1, '0');
    return `${jersey}${min}`.slice(0, 3);
}

export function splitPlayerName(name: string): { first: string; last: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { first: '', last: parts[0] ?? '' };
    return {
        first: parts.slice(0, -1).join(' '),
        last: parts[parts.length - 1] ?? '',
    };
}
