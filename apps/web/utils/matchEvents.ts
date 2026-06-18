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

function pickRicherEvent(existing: MatchEventItem, incoming: MatchEventItem): MatchEventItem {
    return eventInformativeness(incoming) > eventInformativeness(existing)
        ? incoming
        : existing;
}

/** Deduplica eventos del partido (goles con teamId o nombre variantes). */
export function dedupeMatchEvents(events: MatchEventItem[]): MatchEventItem[] {
    const merged: MatchEventItem[] = [];
    for (const event of events) {
        const idx = merged.findIndex((existing) => eventsAreSameMatchEvent(existing, event));
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

export function formatAnnulledGoalLabel(reason?: string | null): string {
    const trimmed = reason?.trim();
    return trimmed ? `Anulado · ${trimmed}` : 'Anulado';
}

export function buildMatchEventRowKey(event: MatchEventItem): string {
    return `${event.type}|${event.minute}|${event.extraMin ?? ''}|${event.teamId ?? ''}|${normalizePlayerKey(event.playerName)}`;
}
