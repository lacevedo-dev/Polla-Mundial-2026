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

function eventInformativeness(event: MatchEventRecord): number {
  let score = 0;
  if (event.teamId) score += 4;
  if ((event.playerName ?? '').trim()) score += 2;
  if ((event.assistName ?? '').trim()) score += 1;
  if ((event.detail ?? '').trim()) score += 1;
  if (event.annulled) score += 8;
  if (event.annulledReason) score += 2;
  return score;
}

/** Mismo evento lógico aunque falte teamId o varíe ligeramente el nombre. */
export function eventsAreSameMatchEvent(
  a: MatchEventRecord,
  b: MatchEventRecord,
): boolean {
  if (a.type.toUpperCase() !== b.type.toUpperCase()) return false;
  if (a.minute !== b.minute) return false;
  if ((a.extraMin ?? 0) !== (b.extraMin ?? 0)) return false;

  const playerA = normalizeEventPlayerKey(a.playerName);
  const playerB = normalizeEventPlayerKey(b.playerName);
  if (playerA && playerB && playerA !== playerB) return false;
  if (a.teamId && b.teamId && a.teamId !== b.teamId) return false;
  return true;
}

/** Mismo jugador/equipo en minutos consecutivos por re-sync de la API (ej. 60' y 61'). */
export function goalsAreNearDuplicate(
  a: MatchEventRecord,
  b: MatchEventRecord,
  maxMinuteDelta = 2,
): boolean {
  if (a.type.toUpperCase() !== 'GOAL' || b.type.toUpperCase() !== 'GOAL') {
    return false;
  }
  if ((a.extraMin ?? 0) !== (b.extraMin ?? 0)) return false;

  const playerA = normalizeEventPlayerKey(a.playerName);
  const playerB = normalizeEventPlayerKey(b.playerName);
  if (!playerA || !playerB || playerA !== playerB) return false;
  if (a.teamId && b.teamId && a.teamId !== b.teamId) return false;
  return Math.abs(a.minute - b.minute) <= maxMinuteDelta;
}

function eventsShouldMerge(a: MatchEventRecord, b: MatchEventRecord): boolean {
  return eventsAreSameMatchEvent(a, b) || goalsAreNearDuplicate(a, b);
}

function pickRicherEvent<T extends MatchEventRecord>(existing: T, incoming: T): T {
  return eventInformativeness(incoming) > eventInformativeness(existing)
    ? incoming
    : existing;
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
  const merged: T[] = [];
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

export type NewRedCardEvent = {
  playerName: string | null;
  teamName: string | null;
  detail: string;
  minute: number;
  extraMin: number | null;
};

export type NewYellowCardEvent = {
  playerName: string | null;
  teamName: string | null;
  detail: string;
  minute: number;
  extraMin: number | null;
};

export type NewSubstitutionEvent = {
  playerInName: string | null;
  playerOutName: string | null;
  teamName: string | null;
  minute: number;
  extraMin: number | null;
};

export type NewVarGoalAnnulmentEvent = {
  playerName: string | null;
  teamName: string | null;
  reason: string;
  minute: number;
  extraMin: number | null;
};

/** Tarjeta roja directa o por doble amarilla (API-Football). */
export function isRedCardDetail(detail: string | null | undefined): boolean {
  const normalized = (detail ?? '').trim().toLowerCase();
  return normalized === 'red card' || normalized.includes('second yellow');
}

/** Tarjeta amarilla simple (excluye doble amarilla → roja). */
export function isYellowCardDetail(detail: string | null | undefined): boolean {
  const normalized = (detail ?? '').trim().toLowerCase();
  if (isRedCardDetail(detail)) return false;
  return normalized === 'yellow card';
}

export function formatRedCardReason(detail: string | null | undefined): string | null {
  const normalized = (detail ?? '').trim().toLowerCase();
  if (normalized.includes('second yellow')) return 'doble amarilla';
  return null;
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

/** Equipo del jugador en el evento (en autogol, rival del beneficiario en team). */
export function resolveGoalPlayerTeamApiId(
  ev: ApiFixtureEvent,
  homeTeamApiId: number,
  awayTeamApiId: number,
): number | undefined {
  const teamId = ev.team?.id;
  if (teamId == null) return undefined;
  if ((ev.detail ?? '') === 'Own Goal') {
    if (teamId === homeTeamApiId) return awayTeamApiId;
    if (teamId === awayTeamApiId) return homeTeamApiId;
    return teamId;
  }
  return teamId;
}

/** Equipo del jugador para UI/álbum (en autogol teamId almacenado = beneficiario). */
export function resolveGoalPlayerTeamIdFromStored(
  goal: GoalEventForTeamResolve,
  match: MatchSidesForGoalTeam,
): string | null {
  if ((goal.detail ?? '') !== 'Own Goal') {
    return goal.teamId;
  }
  if (goal.teamId === match.homeTeamId) return match.awayTeamId;
  if (goal.teamId === match.awayTeamId) return match.homeTeamId;
  return null;
}

/** Equipo que suma en el marcador (en autogol, team del evento = beneficiario). */
export function resolveGoalBeneficiaryIsHome(
  ev: ApiFixtureEvent,
  homeTeamApiId: number,
  awayTeamApiId: number,
): boolean {
  const teamId = ev.team?.id;
  if ((ev.detail ?? '') === 'Own Goal') {
    if (teamId === homeTeamApiId) return true;
    if (teamId === awayTeamApiId) return false;
    return false;
  }
  return teamId === homeTeamApiId;
}

/** Índice 1-based del gol en la secuencia cronológica a partir del marcador tras el gol. */
export function goalIndexFromScore(homeScore: number, awayScore: number): number {
  return homeScore + awayScore;
}

/** Extrae marcador de dedupeKey GOAL_SCORED|GOAL_STICKER:match:league:home-away */
export function parseGoalScoredJobDedupeKey(
  dedupeKey: string,
): { homeScore: number; awayScore: number } | null {
  const match = /^GOAL_(?:SCORED|STICKER):[^:]+:[^:]+:(\d+)-(\d+)$/.exec(dedupeKey);
  if (!match) return null;
  return { homeScore: Number(match[1]), awayScore: Number(match[2]) };
}

export type GoalEventForTeamResolve = {
  teamId: string | null;
  detail: string | null;
  playerName?: string | null;
};

export type MatchSidesForGoalTeam = {
  homeTeamId: string;
  awayTeamId: string;
};

/** Aplica un gol al marcador parcial (en autogol teamId = equipo que suma). */
export function applyStoredGoalToRunningScore(
  goal: GoalEventForTeamResolve,
  match: MatchSidesForGoalTeam,
  score: { home: number; away: number },
): void {
  if ((goal.detail ?? '') === 'Own Goal') {
    if (goal.teamId === match.homeTeamId) {
      score.home += 1;
      return;
    }
    if (goal.teamId === match.awayTeamId) {
      score.away += 1;
      return;
    }
    return;
  }
  if (goal.teamId === match.homeTeamId) score.home += 1;
  else if (goal.teamId === match.awayTeamId) score.away += 1;
}

/**
 * Equipo del jugador para sticker/uniforme.
 * En autogol el beneficiario suma en el marcador; el jugador viste su club (el rival).
 */
export function resolveGoalPlayerTeamIdForSticker(
  goal: GoalEventForTeamResolve,
  match: MatchSidesForGoalTeam,
  context?: {
    allGoals?: GoalEventForTeamResolve[];
    goalIndex?: number;
    scoreAfterGoal?: { homeScore: number; awayScore: number } | null;
  },
): string | null {
  if ((goal.detail ?? '') !== 'Own Goal') {
    if (goal.teamId === match.homeTeamId || goal.teamId === match.awayTeamId) {
      return goal.teamId;
    }
    return null;
  }

  const {
    allGoals = [],
    goalIndex = 0,
    scoreAfterGoal = null,
  } = context ?? {};

  if (scoreAfterGoal) {
    const before = { home: 0, away: 0 };
    for (let i = 0; i < goalIndex; i++) {
      applyStoredGoalToRunningScore(allGoals[i], match, before);
    }
    if (scoreAfterGoal.homeScore > before.home) {
      return match.awayTeamId;
    }
    if (scoreAfterGoal.awayScore > before.away) {
      return match.homeTeamId;
    }
  }

  if (goal.teamId === match.homeTeamId) return match.awayTeamId;
  if (goal.teamId === match.awayTeamId) return match.homeTeamId;
  return null;
}

/** Índice del gol en la línea temporal cuyo marcador acumulado coincide con scoreAfter. */
export function findGoalEventIndexForScore(
  goals: GoalEventForTeamResolve[],
  match: MatchSidesForGoalTeam,
  scoreAfter: { homeScore: number; awayScore: number },
  scorerName?: string | null,
): number | null {
  const running = { home: 0, away: 0 };
  const matches: number[] = [];
  for (let i = 0; i < goals.length; i++) {
    applyStoredGoalToRunningScore(goals[i], match, running);
    if (running.home === scoreAfter.homeScore && running.away === scoreAfter.awayScore) {
      matches.push(i);
    }
  }
  if (matches.length === 0) return null;
  if (matches.length === 1 || !scorerName?.trim()) {
    return matches[matches.length - 1];
  }
  const scorerKey = normalizeEventPlayerKey(scorerName);
  const byScorer = matches.filter(
    (index) => normalizeEventPlayerKey(goals[index].playerName) === scorerKey,
  );
  return byScorer.length > 0 ? byScorer[byScorer.length - 1] : matches[matches.length - 1];
}

/** Goles válidos para notificaciones (excluye anulados en la línea temporal). */
export function filterActiveGoalEventsFromTimeline(
  rawEvents: ApiFixtureEvent[],
  resolveTeamId: (apiTeamId: number | undefined | null) => string | null,
  count: number,
  homeTeamApiId: number,
  awayTeamApiId: number,
  skip = 0,
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

  return goals.slice(skip, skip + count).map(({ key: _key, ...goal }) => goal);
}
