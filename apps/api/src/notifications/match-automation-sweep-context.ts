import { MatchStatus, MemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE,
  getPredictionReportDueAt,
  PREDICTION_REPORT_CATCHUP_GRACE_MINUTES,
} from '../automation/config/automation-timing.util';

const DEFAULT_CLOSE_PREDICTION_MINUTES = 15;
/** Más cercano al kickoff: aún se envía recordatorio si no se hizo antes */
export const REMINDER_WINDOW_START_MINUTES = 45;
/** Más lejano del kickoff: primer intento de recordatorio (~75 min antes) */
export const REMINDER_WINDOW_END_MINUTES = 75;
const CLOSING_ALERT_WINDOW_GRACE_MINUTES = 5;
/** Lookback del sweep: T-60 + catch-up de escaladas/cierre */
export const SWEEP_LOOKBACK_MINUTES = 120;
/** Partidos LIVE siguen en contexto hasta ~130 min post kickoff */
export const SWEEP_LIVE_RETENTION_MINUTES = 130;
/** Fechas cero de MariaDB (0000-00-00) rompen el mapeo Date de Prisma. */
export const MIN_VALID_MYSQL_DATETIME = new Date('1970-01-01T00:00:00.000Z');
const REPORTABLE_MEMBER_STATUSES = [
  MemberStatus.ACTIVE,
  MemberStatus.PENDING_PAYMENT,
] as const;
type ReportableMemberStatus = (typeof REPORTABLE_MEMBER_STATUSES)[number];

const isReportableMemberStatus = (
  status: MemberStatus,
): status is ReportableMemberStatus =>
  status === MemberStatus.ACTIVE || status === MemberStatus.PENDING_PAYMENT;

export type MatchAutomationSweepLeagueMember = {
  userId: string;
  status: MemberStatus;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type MatchAutomationSweepLeague = {
  id: string;
  name: string;
  code: string;
  closePredictionMinutes: number;
  leagueTournaments: Array<{ tournamentId: string }>;
  members: MatchAutomationSweepLeagueMember[];
};

export type MatchAutomationSweepPrediction = {
  userId: string;
  leagueId: string;
  homeScore: number | null;
  awayScore: number | null;
  submittedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export type MatchAutomationSweepMatch = {
  id: string;
  status: MatchStatus;
  matchDate: Date;
  tournamentId: string | null;
  venue: string | null;
  round: string | null;
  predictionReportSentAt: Date | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  predictions: MatchAutomationSweepPrediction[];
};

export type MatchAutomationSweepContext = {
  now: Date;
  activeLeagues: MatchAutomationSweepLeague[];
  scheduledMatches: MatchAutomationSweepMatch[];
  maxClosePredictionMinutes: number;
};

export async function buildMatchAutomationSweepContext(
  prisma: PrismaService,
  now = new Date(),
): Promise<MatchAutomationSweepContext> {
  const leagues = await prisma.league.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      code: true,
      closePredictionMinutes: true,
      leagueTournaments: { select: { tournamentId: true } },
      members: {
        where: {
          status: { in: [...REPORTABLE_MEMBER_STATUSES] },
        },
        select: {
          userId: true,
          status: true,
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const activeLeagues: MatchAutomationSweepLeague[] = leagues.map((league) => ({
    id: league.id,
    name: league.name,
    code: league.code,
    closePredictionMinutes: normalizeClosePredictionMinutes(
      league.closePredictionMinutes,
    ),
    leagueTournaments: league.leagueTournaments,
    members: league.members,
  }));

  const maxClosePredictionMinutes = Math.max(
    DEFAULT_CLOSE_PREDICTION_MINUTES,
    ...activeLeagues.map((league) => league.closePredictionMinutes),
  );
  const windowStart = new Date(
    now.getTime() -
      Math.max(SWEEP_LOOKBACK_MINUTES, maxClosePredictionMinutes) * 60_000,
  );
  const windowEnd = new Date(
    now.getTime() +
      Math.max(
        REMINDER_WINDOW_END_MINUTES,
        SWEEP_LIVE_RETENTION_MINUTES,
        maxClosePredictionMinutes + CLOSING_ALERT_WINDOW_GRACE_MINUTES,
      ) *
        60_000,
  );

  const scheduledMatchRows = await prisma.match.findMany({
    where: {
      status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] },
      matchDate: {
        gt: windowStart,
        lte: windowEnd,
        gte: MIN_VALID_MYSQL_DATETIME,
      },
      OR: [
        { predictionReportSentAt: null },
        { predictionReportSentAt: { gte: MIN_VALID_MYSQL_DATETIME } },
      ],
    },
    select: {
      id: true,
      status: true,
      matchDate: true,
      tournamentId: true,
      venue: true,
      round: true,
      predictionReportSentAt: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  const matchIds = scheduledMatchRows.map((match) => match.id);
  const predictionRows =
    matchIds.length === 0
      ? []
      : await prisma.prediction.findMany({
          where: {
            matchId: { in: matchIds },
            submittedAt: { gte: MIN_VALID_MYSQL_DATETIME },
          },
          select: {
            matchId: true,
            userId: true,
            leagueId: true,
            homeScore: true,
            awayScore: true,
            submittedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

  const predictionsByMatchId = new Map<string, MatchAutomationSweepPrediction[]>();
  for (const row of predictionRows) {
    const { matchId, ...prediction } = row;
    const bucket = predictionsByMatchId.get(matchId) ?? [];
    bucket.push(prediction);
    predictionsByMatchId.set(matchId, bucket);
  }

  const scheduledMatches: MatchAutomationSweepMatch[] = scheduledMatchRows.map(
    (match) => ({
      ...match,
      predictions: predictionsByMatchId.get(match.id) ?? [],
    }),
  );

  return {
    now,
    activeLeagues,
    scheduledMatches,
    maxClosePredictionMinutes,
  };
}

export function getReminderMatches(
  context: MatchAutomationSweepContext,
): MatchAutomationSweepMatch[] {
  const primary = filterMatchesInFutureWindow(
    context.scheduledMatches,
    context.now,
    REMINDER_WINDOW_START_MINUTES,
    REMINDER_WINDOW_END_MINUTES,
  );
  const catchUp = getCatchUpReminderMatches(context);
  const seen = new Set<string>();
  const merged: MatchAutomationSweepMatch[] = [];
  for (const match of [...primary, ...catchUp]) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    merged.push(match);
  }
  return merged;
}

/** Partidos cuyo recordatorio (T-60) ya debió dispararse pero el partido aún no empieza. */
export function getCatchUpReminderMatches(
  context: MatchAutomationSweepContext,
): MatchAutomationSweepMatch[] {
  const now = context.now.getTime();
  const latestKickoffMs = now + REMINDER_WINDOW_START_MINUTES * 60_000;

  return context.scheduledMatches.filter((match) => {
    const kickoffMs = match.matchDate.getTime();
    if (kickoffMs <= now) return false;
    if (kickoffMs > latestKickoffMs) return false;
    const reminderDueAt = kickoffMs - 60 * 60_000;
    return now >= reminderDueAt;
  });
}

/** Partidos cuyo cierre ya debió dispararse pero el kickoff aún no pasó. */
export function getCatchUpClosingAlertMatches(
  context: MatchAutomationSweepContext,
  closeMinutes: number,
): MatchAutomationSweepMatch[] {
  const now = context.now.getTime();

  return context.scheduledMatches.filter((match) => {
    const kickoffMs = match.matchDate.getTime();
    if (kickoffMs <= now) return false;
    const closingDueAt = kickoffMs - closeMinutes * 60_000;
    return now >= closingDueAt;
  });
}

export function getClosingAlertMatches(
  context: MatchAutomationSweepContext,
  closeMinutes: number,
): MatchAutomationSweepMatch[] {
  const primary = filterMatchesInFutureWindow(
    context.scheduledMatches,
    context.now,
    closeMinutes,
    closeMinutes + CLOSING_ALERT_WINDOW_GRACE_MINUTES,
  );
  const catchUp = getCatchUpClosingAlertMatches(context, closeMinutes);
  const seen = new Set<string>();
  const merged: MatchAutomationSweepMatch[] = [];
  for (const match of [...primary, ...catchUp]) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    merged.push(match);
  }
  return merged;
}

export function getPendingReportMatches(
  context: MatchAutomationSweepContext,
  leagueId: string,
  closePredictionMinutes: number,
  minutesAfterClose: number = DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE,
): MatchAutomationSweepMatch[] {
  return context.scheduledMatches.filter((match) =>
    isPredictionReportPendingForLeague(
      context.now,
      match,
      leagueId,
      closePredictionMinutes,
      minutesAfterClose,
    ),
  );
}

/** Partidos cuyo reporte ya debió enviarse (post-cierre) pero el kickoff aún no pasó (+ gracia). */
export function getCatchUpPredictionReportMatches(
  context: MatchAutomationSweepContext,
  leagueId: string,
  closePredictionMinutes: number,
  minutesAfterClose: number = DEFAULT_PREDICTION_REPORT_MINUTES_AFTER_CLOSE,
): MatchAutomationSweepMatch[] {
  return getPendingReportMatches(
    context,
    leagueId,
    closePredictionMinutes,
    minutesAfterClose,
  );
}

function isPredictionReportPendingForLeague(
  now: Date,
  match: MatchAutomationSweepMatch,
  leagueId: string,
  closePredictionMinutes: number,
  minutesAfterClose: number,
): boolean {
  if (match.predictionReportSentAt !== null) return false;
  if (!match.predictions.some((prediction) => prediction.leagueId === leagueId)) {
    return false;
  }

  const kickoffMs = match.matchDate.getTime();
  const nowMs = now.getTime();
  if (kickoffMs <= nowMs) return false;

  const dueAt = getPredictionReportDueAt(
    match.matchDate,
    closePredictionMinutes,
    minutesAfterClose,
  );
  const catchUpUntil =
    kickoffMs + PREDICTION_REPORT_CATCHUP_GRACE_MINUTES * 60_000;

  if (nowMs < dueAt.getTime()) return false;
  if (nowMs >= catchUpUntil) return false;
  return true;
}

export function getRelevantLeaguesForScheduledMatch(
  context: MatchAutomationSweepContext,
  tournamentId: string | null,
): MatchAutomationSweepLeague[] {
  return context.activeLeagues.filter(
    (league) =>
      league.leagueTournaments.length === 0 ||
      league.leagueTournaments.some(
        (entry) => entry.tournamentId === tournamentId,
      ),
  );
}

/** Ligas por torneo + ligas con pronósticos en el partido (evita audiencia vacía). */
export function getRelevantLeaguesForMatchReminder(
  context: MatchAutomationSweepContext,
  match: {
    tournamentId: string | null;
    predictions: Array<{ leagueId: string }>;
  },
): MatchAutomationSweepLeague[] {
  const byTournament = getRelevantLeaguesForScheduledMatch(
    context,
    match.tournamentId,
  );
  const predictionLeagueIds = new Set(
    match.predictions.map((prediction) => prediction.leagueId),
  );
  const byPrediction = context.activeLeagues.filter((league) =>
    predictionLeagueIds.has(league.id),
  );

  const seen = new Set<string>();
  const merged: MatchAutomationSweepLeague[] = [];
  for (const league of [...byTournament, ...byPrediction]) {
    if (seen.has(league.id)) continue;
    seen.add(league.id);
    merged.push(league);
  }
  return merged;
}

export function getNotificationLeagueMembers(
  league: MatchAutomationSweepLeague,
): Array<{ userId: string }> {
  return league.members
    .filter((member) => member.status === MemberStatus.ACTIVE)
    .map((member) => ({ userId: member.userId }));
}

export function getReportAudienceFromLeague(
  league: MatchAutomationSweepLeague,
): {
  members: MatchAutomationSweepLeagueMember[];
  recipients: string[];
} {
  const members = league.members.filter((member): member is MatchAutomationSweepLeagueMember =>
    isReportableMemberStatus(member.status),
  );
  const recipients = [
    ...new Set(
      members
        .map((member) => member.user.email)
        .filter((email): email is string => Boolean(email)),
    ),
  ];

  return { members, recipients };
}

export function normalizeClosePredictionMinutes(
  closePredictionMinutes: number | null | undefined,
): number {
  return closePredictionMinutes ?? DEFAULT_CLOSE_PREDICTION_MINUTES;
}

function filterMatchesInFutureWindow(
  matches: MatchAutomationSweepMatch[],
  now: Date,
  windowStartMinutes: number,
  windowEndMinutes: number,
): MatchAutomationSweepMatch[] {
  const windowStart = new Date(now.getTime() + windowStartMinutes * 60_000);
  const windowEnd = new Date(now.getTime() + windowEndMinutes * 60_000);

  return matches.filter(
    (match) => match.matchDate >= windowStart && match.matchDate <= windowEnd,
  );
}
