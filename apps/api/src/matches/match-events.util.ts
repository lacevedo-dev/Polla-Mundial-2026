export interface MatchEventRecord {
  id?: string;
  type: string;
  detail?: string | null;
  playerName?: string | null;
  assistName?: string | null;
  minute: number;
  extraMin?: number | null;
  teamId?: string | null;
  annulled?: boolean;
  annulledReason?: string | null;
}

export interface ApiFixtureEvent {
  type?: string;
  detail?: string | null;
  time?: { elapsed?: number; extra?: number | null };
  team?: { id?: number };
  player?: { name?: string | null };
  assist?: { name?: string | null };
  comments?: string | null;
}

/** Apellido normalizado para comparar variantes del nombre del jugador. */
export function normalizeEventPlayerKey(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/** Clave lógica de un evento de gol/tarjeta para detectar duplicados. */
export function buildMatchEventDedupeKey(event: MatchEventRecord): string {
  const type = event.type.toUpperCase();
  const extra = event.extraMin ?? '';
  const team = event.teamId ?? '';
  const player = normalizeEventPlayerKey(event.playerName);
  return `${type}|${event.minute}|${extra}|${team}|${player}`;
}

function parseDedupeKey(key: string): {
  teamId: string;
  playerKey: string;
} {
  const parts = key.split('|');
  return {
    teamId: parts[3] ?? '',
    playerKey: parts[4] ?? '',
  };
}

/** Elimina duplicados conservando el registro más informativo (anulado > vigente). */
export function dedupeMatchEvents<T extends MatchEventRecord>(events: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const event of events) {
    const key = buildMatchEventDedupeKey(event);
    const existing = byKey.get(key);
    if (!existing || event.annulled || (event.annulledReason && !existing.annulledReason)) {
      byKey.set(key, event);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.minute - b.minute || (a.extraMin ?? 0) - (b.extraMin ?? 0),
  );
}

export function isVarGoalCancelledDetail(detail: string | null | undefined): boolean {
  const normalized = (detail ?? '').toLowerCase();
  return (
    normalized.includes('goal cancelled') ||
    normalized.includes('goal canceled') ||
    normalized.includes('goal disallowed') ||
    normalized.includes('goal overturned')
  );
}

export function formatAnnulledReason(detail: string | null | undefined): string {
  const raw = (detail ?? '').trim();
  if (!raw) return 'VAR';

  const cleaned = raw
    .replace(/^var\s+/i, '')
    .replace(/^goal\s+(cancelled|canceled|disallowed)\s*[-–:]?\s*/i, '')
    .trim();

  return cleaned || 'VAR';
}

export function sortApiFixtureEvents(events: ApiFixtureEvent[]): ApiFixtureEvent[] {
  return [...events].sort(
    (a, b) =>
      (a.time?.elapsed ?? 0) - (b.time?.elapsed ?? 0) ||
      (a.time?.extra ?? 0) - (b.time?.extra ?? 0),
  );
}

/** Goles anulados según la línea temporal de API-Football (eventos Var). */
export function computeAnnulledGoalKeysFromTimeline(
  rawEvents: ApiFixtureEvent[],
  resolveTeamId: (apiTeamId: number | undefined | null) => string | null,
): Map<string, string> {
  const sorted = sortApiFixtureEvents(rawEvents);
  const goalKeysOrdered: string[] = [];
  const annulled = new Map<string, string>();

  for (const ev of sorted) {
    const type = ev.type ?? '';

    if (type === 'Goal' && ev.detail !== 'Missed Penalty') {
      goalKeysOrdered.push(
        buildMatchEventDedupeKey({
          type: 'GOAL',
          minute: ev.time?.elapsed ?? 0,
          extraMin: ev.time?.extra ?? null,
          teamId: resolveTeamId(ev.team?.id),
          playerName: ev.player?.name ?? null,
        }),
      );
    }

    if (type === 'Var' && isVarGoalCancelledDetail(ev.detail)) {
      const teamId = resolveTeamId(ev.team?.id);
      const playerKey = normalizeEventPlayerKey(ev.player?.name);
      const reason = formatAnnulledReason(ev.detail ?? ev.comments);

      for (let i = goalKeysOrdered.length - 1; i >= 0; i--) {
        const key = goalKeysOrdered[i];
        if (annulled.has(key)) continue;

        const parsed = parseDedupeKey(key);
        if (teamId && parsed.teamId && parsed.teamId !== teamId) continue;
        if (playerKey && parsed.playerKey && parsed.playerKey !== playerKey) continue;

        annulled.set(key, reason);
        break;
      }
    }
  }

  return annulled;
}

/** Anula goles sobrantes cuando el marcador baja o hay más eventos que goles válidos. */
export function computeScoreExcessAnnulments(
  goals: MatchEventRecord[],
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  alreadyAnnulled: Set<string>,
): Map<string, string> {
  const excess = new Map<string, string>();

  const annulExcessForTeam = (
    teamId: string,
    allowed: number,
    fallbackReason: string,
  ) => {
    const teamGoals = goals
      .filter((goal) => goal.teamId === teamId)
      .sort(
        (a, b) =>
          a.minute - b.minute ||
          (a.extraMin ?? 0) - (b.extraMin ?? 0),
      );

    let kept = 0;
    for (const goal of teamGoals) {
      const key = buildMatchEventDedupeKey(goal);
      if (alreadyAnnulled.has(key) || excess.has(key)) continue;
      kept++;
      if (kept > allowed) {
        excess.set(key, fallbackReason);
      }
    }
  };

  annulExcessForTeam(homeTeamId, homeScore, 'Marcador corregido');
  annulExcessForTeam(awayTeamId, awayScore, 'Marcador corregido');

  return excess;
}

export function resolveGoalAnnulments(
  rawEvents: ApiFixtureEvent[],
  dbGoals: MatchEventRecord[],
  resolveTeamId: (apiTeamId: number | undefined | null) => string | null,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
): Map<string, string> {
  const annulled = computeAnnulledGoalKeysFromTimeline(rawEvents, resolveTeamId);
  const annulledKeys = new Set(annulled.keys());

  const scoreExcess = computeScoreExcessAnnulments(
    dbGoals,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    annulledKeys,
  );

  for (const [key, reason] of scoreExcess) {
    if (!annulled.has(key)) {
      annulled.set(key, reason);
    }
  }

  return annulled;
}

/** Equipo que suma en el marcador (autogol → rival del jugador). */
export function resolveGoalBeneficiaryIsHome(
  ev: ApiFixtureEvent,
  homeTeamApiId: number,
  awayTeamApiId: number,
): boolean {
  const teamId = ev.team?.id;
  if ((ev.detail ?? '') === 'Own Goal') {
    if (teamId === homeTeamApiId) return false;
    if (teamId === awayTeamApiId) return true;
    return false;
  }
  return teamId === homeTeamApiId;
}

/** Goles válidos para notificaciones (excluye anulados en la línea temporal). */
export function filterActiveGoalEventsFromTimeline(
  rawEvents: ApiFixtureEvent[],
  resolveTeamId: (apiTeamId: number | undefined | null) => string | null,
  count: number,
  homeTeamApiId: number,
  awayTeamApiId: number,
): Array<{
  isHomeGoal: boolean;
  minute: number;
  extraMin: number | null;
  playerName: string | null;
  assistName: string | null;
  detail: string | null;
}> {
  const annulledKeys = computeAnnulledGoalKeysFromTimeline(rawEvents, resolveTeamId);
  const goals = sortApiFixtureEvents(rawEvents)
    .filter((ev) => ev.type === 'Goal' && ev.detail !== 'Missed Penalty')
    .map((ev) => ({
      key: buildMatchEventDedupeKey({
        type: 'GOAL',
        minute: ev.time?.elapsed ?? 0,
        extraMin: ev.time?.extra ?? null,
        teamId: resolveTeamId(ev.team?.id),
        playerName: ev.player?.name ?? null,
      }),
      isHomeGoal: resolveGoalBeneficiaryIsHome(ev, homeTeamApiId, awayTeamApiId),
      minute: ev.time?.elapsed ?? 0,
      extraMin: ev.time?.extra ?? null,
      playerName: ev.player?.name ?? null,
      assistName: ev.assist?.name ?? null,
      detail: ev.detail ?? null,
    }))
    .filter((goal) => !annulledKeys.has(goal.key));

  return goals.slice(-count).map(({ key: _key, ...goal }) => goal);
}
