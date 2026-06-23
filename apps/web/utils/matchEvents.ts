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
    if (event.playerExternalId != null) score += 3;
    if (event.playerProfile?.photoUrl?.trim()) score += 2;
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
    const normalized = events.map((event) => ({
        ...event,
        type: event.type.trim().toUpperCase(),
    }));
    const merged: MatchEventItem[] = [];
    for (const event of normalized) {
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

function isOwnGoalDetail(detail: string | null | undefined): boolean {
    return (detail ?? '').toLowerCase().includes('own goal');
}

/** Equipo del jugador en UI (en autogol, teamId del evento = beneficiario en marcador). */
export function resolveGoalScorerTeamId(
    goal: MatchEventItem,
    homeTeamId: string,
    awayTeamId: string,
): string | null {
    if (!isOwnGoalDetail(goal.detail)) {
        return goal.teamId;
    }
    if (goal.teamId === homeTeamId) return awayTeamId;
    if (goal.teamId === awayTeamId) return homeTeamId;
    return goal.teamId;
}

/** Equipo que suma en el marcador (teamId almacenado; en autogol = beneficiario). */
export function resolveGoalBeneficiaryTeamId(
    goal: MatchEventItem,
    homeTeamId: string,
    awayTeamId: string,
): string | null {
    if (!isOwnGoalDetail(goal.detail)) {
        return goal.teamId;
    }
    return goal.teamId;
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
        const beneficiaryId = resolveGoalBeneficiaryTeamId(goal, homeTeamId, awayTeamId);
        const scorerTeamId = resolveGoalScorerTeamId(goal, homeTeamId, awayTeamId);

        if (beneficiaryId === homeTeamId) {
            if (runningHome >= finalHome) continue;
            runningHome++;
            if (scorerTeamId === homeTeamId) homeGoals.push(goal);
            else if (scorerTeamId === awayTeamId) awayGoals.push(goal);
            else homeGoals.push(goal);
            continue;
        }
        if (beneficiaryId === awayTeamId) {
            if (runningAway >= finalAway) continue;
            runningAway++;
            if (scorerTeamId === homeTeamId) homeGoals.push(goal);
            else if (scorerTeamId === awayTeamId) awayGoals.push(goal);
            else awayGoals.push(goal);
            continue;
        }

        if (runningHome < finalHome) {
            homeGoals.push(goal);
            runningHome++;
        } else if (runningAway < finalAway) {
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

function formatGoalMinute(event: MatchEventItem): string {
    return `${event.minute}'${event.extraMin ? `+${event.extraMin}` : ''}`;
}

/** Agrupa goles por jugador: "Brobbey 5', 17'" */
export function formatGoalScorersByPlayer(goals: MatchEventItem[]): string[] {
    const byPlayer = new Map<string, string[]>();

    for (const goal of goals) {
        const isOG = goal.detail?.toLowerCase().includes('own goal');
        const label = isOG
            ? 'AG'
            : (goal.playerName?.trim() || '—');
        const displayName = isOG ? 'AG' : (label.split(/\s+/).pop() ?? label);
        const mins = byPlayer.get(displayName) ?? [];
        mins.push(formatGoalMinute(goal));
        byPlayer.set(displayName, mins);
    }

    return [...byPlayer.entries()].map(
        ([name, mins]) => `${name} ${mins.join(', ')}`,
    );
}
