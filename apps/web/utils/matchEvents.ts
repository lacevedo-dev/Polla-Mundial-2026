import type { MatchEventItem } from '../hooks/useLiveSyncEvents';

function normalizePlayerKey(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '';
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
}

function eventInformativeness(event: MatchEventItem): number {
    let score = 0;
    if (event.teamId) score += 4;
    if ((event.playerName ?? '').trim()) score += 2;
    if ((event.assistName ?? '').trim()) score += 1;
    if ((event.detail ?? '').trim()) score += 1;
    if (event.annulled) score += 8;
    if (event.annulledReason) score += 2;
    return score;
}

function eventsAreSameMatchEvent(a: MatchEventItem, b: MatchEventItem): boolean {
    if (a.type.toUpperCase() !== b.type.toUpperCase()) return false;
    if (a.minute !== b.minute) return false;
    if ((a.extraMin ?? 0) !== (b.extraMin ?? 0)) return false;

    const playerA = normalizePlayerKey(a.playerName);
    const playerB = normalizePlayerKey(b.playerName);
    if (playerA && playerB && playerA !== playerB) return false;
    if (a.teamId && b.teamId && a.teamId !== b.teamId) return false;
    return true;
}

function goalsAreNearDuplicate(
    a: MatchEventItem,
    b: MatchEventItem,
    maxMinuteDelta = 2,
): boolean {
    if (a.type.toUpperCase() !== 'GOAL' || b.type.toUpperCase() !== 'GOAL') {
        return false;
    }
    if ((a.extraMin ?? 0) !== (b.extraMin ?? 0)) return false;

    const playerA = normalizePlayerKey(a.playerName);
    const playerB = normalizePlayerKey(b.playerName);
    if (!playerA || !playerB || playerA !== playerB) return false;
    if (a.teamId && b.teamId && a.teamId !== b.teamId) return false;
    return Math.abs(a.minute - b.minute) <= maxMinuteDelta;
}

function eventsShouldMerge(a: MatchEventItem, b: MatchEventItem): boolean {
    return eventsAreSameMatchEvent(a, b) || goalsAreNearDuplicate(a, b);
}

function pickRicherEvent(existing: MatchEventItem, incoming: MatchEventItem): MatchEventItem {
    return eventInformativeness(incoming) > eventInformativeness(existing)
        ? incoming
        : existing;
}

/** Deduplica eventos del partido (goles con teamId, nombre o minuto vecino). */
export function dedupeMatchEvents(events: MatchEventItem[]): MatchEventItem[] {
    const merged: MatchEventItem[] = [];
    for (const event of events) {
        const idx = merged.findIndex((existing) => eventsShouldMerge(existing, event));
        if (idx === -1) {
            merged.push(event);
            continue;
        }
        merged[idx] = pickRicherEvent(merged[idx], event);
    }
    return merged.sort(
        (a, b) => a.minute - b.minute || (a.extraMin ?? 0) - (b.extraMin ?? 0),
    );
}

export function dedupeGoalEvents(events: MatchEventItem[]): MatchEventItem[] {
    return dedupeMatchEvents(events.filter((event) => event.type === 'GOAL'));
}

export function splitGoalEvents(events: MatchEventItem[]): {
    active: MatchEventItem[];
    annulled: MatchEventItem[];
} {
    const deduped = dedupeGoalEvents(events);
    return {
        active: deduped.filter((event) => !event.annulled),
        annulled: deduped.filter((event) => event.annulled),
    };
}

export function partitionGoalsByTeam(
    goals: MatchEventItem[],
    homeTeamId: string,
    awayTeamId: string,
    finalHome: number,
    finalAway: number,
): { homeGoals: MatchEventItem[]; awayGoals: MatchEventItem[] } {
    const sorted = [...goals].sort(
        (a, b) => a.minute - b.minute || (a.extraMin ?? 0) - (b.extraMin ?? 0),
    );
    const homeGoals: MatchEventItem[] = [];
    const awayGoals: MatchEventItem[] = [];
    let runningHome = 0;
    let runningAway = 0;

    for (const goal of sorted) {
        if (goal.teamId === homeTeamId) {
            if (runningHome >= finalHome) continue;
            homeGoals.push(goal);
            runningHome++;
            continue;
        }
        if (goal.teamId === awayTeamId) {
            if (runningAway >= finalAway) continue;
            awayGoals.push(goal);
            runningAway++;
            continue;
        }

        const canHome = runningHome < finalHome;
        const canAway = runningAway < finalAway;
        if (canHome && !canAway) {
            homeGoals.push(goal);
            runningHome++;
        } else if (!canHome && canAway) {
            awayGoals.push(goal);
            runningAway++;
        } else if (finalHome - runningHome >= finalAway - runningAway) {
            if (runningHome >= finalHome) continue;
            homeGoals.push(goal);
            runningHome++;
        } else {
            if (runningAway >= finalAway) continue;
            awayGoals.push(goal);
            runningAway++;
        }
    }

    return { homeGoals, awayGoals };
}

export function formatAnnulledGoalLabel(reason?: string | null): string {
    const trimmed = reason?.trim();
    return trimmed ? `Anulado · ${trimmed}` : 'Anulado';
}

export function buildMatchEventRowKey(event: MatchEventItem): string {
    return `${event.type}|${event.minute}|${event.extraMin ?? ''}|${event.teamId ?? ''}|${normalizePlayerKey(event.playerName)}`;
}
