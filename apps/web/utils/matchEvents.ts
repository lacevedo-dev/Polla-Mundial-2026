import type { MatchEventItem } from '../hooks/useLiveSyncEvents';

function normalizePlayerKey(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '';
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
}

function buildGoalDedupeKey(event: MatchEventItem): string {
    const extra = event.extraMin ?? '';
    const team = event.teamId ?? '';
    const player = normalizePlayerKey(event.playerName);
    return `${event.minute}|${extra}|${team}|${player}`;
}

/** Evita mostrar el mismo gol dos veces por variaciones en el nombre del jugador. */
export function dedupeGoalEvents(events: MatchEventItem[]): MatchEventItem[] {
    const byKey = new Map<string, MatchEventItem>();
    for (const event of events) {
        if (event.type !== 'GOAL') continue;
        byKey.set(buildGoalDedupeKey(event), event);
    }
    return Array.from(byKey.values()).sort(
        (a, b) => a.minute - b.minute || (a.extraMin ?? 0) - (b.extraMin ?? 0),
    );
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
