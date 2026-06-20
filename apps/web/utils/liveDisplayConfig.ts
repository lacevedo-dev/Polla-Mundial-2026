import type { MatchEventItem } from '../hooks/useLiveSyncEvents';

export type LiveDisplaySettings = {
    goals: boolean;
    yellowCards: boolean;
    redCards: boolean;
    substitutions: boolean;
};

export const DEFAULT_LIVE_DISPLAY_SETTINGS: LiveDisplaySettings = {
    goals: true,
    yellowCards: true,
    redCards: true,
    substitutions: true,
};

export function isYellowCardEvent(event: MatchEventItem): boolean {
    if (event.type === 'YELLOW_CARD') return true;
    return event.type === 'CARD' && (event.detail?.toLowerCase().includes('yellow') ?? false);
}

export function isRedCardEvent(event: MatchEventItem): boolean {
    if (event.type === 'RED_CARD') return true;
    const detail = event.detail?.toLowerCase() ?? '';
    return event.type === 'CARD' && (detail.includes('red') || detail.includes('second yellow'));
}

export function isSubstitutionEvent(event: MatchEventItem): boolean {
    return event.type === 'SUBSTITUTION';
}

export function isVarGoalEvent(event: MatchEventItem): boolean {
    return event.type === 'VAR';
}

export function isGoalEvent(event: MatchEventItem): boolean {
    return event.type === 'GOAL';
}

/** Filtra eventos según la configuración de pantalla en vivo. */
export function filterEventsForLiveDisplay(
    events: MatchEventItem[],
    settings: LiveDisplaySettings,
): MatchEventItem[] {
    return events.filter((event) => {
        if (isGoalEvent(event) || (isVarGoalEvent(event) && event.annulled !== undefined)) {
            return settings.goals;
        }
        if (isVarGoalEvent(event)) return settings.goals;
        if (isYellowCardEvent(event)) return settings.yellowCards;
        if (isRedCardEvent(event)) return settings.redCards;
        if (isSubstitutionEvent(event)) return settings.substitutions;
        return false;
    });
}

export function eventTypesForLiveFetch(settings: LiveDisplaySettings): string[] {
    const types: string[] = [];
    if (settings.goals) types.push('GOAL', 'VAR');
    if (settings.yellowCards || settings.redCards) types.push('CARD', 'YELLOW_CARD', 'RED_CARD');
    if (settings.substitutions) types.push('SUBSTITUTION');
    return types;
}
