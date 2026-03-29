import { MatchStatus, MemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CLOSE_PREDICTION_MINUTES = 15;
const REMINDER_WINDOW_START_MINUTES = 55;
const REMINDER_WINDOW_END_MINUTES = 65;
const CLOSING_ALERT_WINDOW_GRACE_MINUTES = 5;
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
    now.getTime() - maxClosePredictionMinutes * 60_000,
  );
  const windowEnd = new Date(
    now.getTime() +
      Math.max(
        REMINDER_WINDOW_END_MINUTES,
        maxClosePredictionMinutes + CLOSING_ALERT_WINDOW_GRACE_MINUTES,
      ) *
        60_000,
  );

  const scheduledMatches = await prisma.match.findMany({
    where: {
      status: MatchStatus.SCHEDULED,
      matchDate: {
        gt: windowStart,
        lte: windowEnd,
      },
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
      predictions: {
        select: {
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
      },
    },
  });

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
  return filterMatchesInFutureWindow(
    context.scheduledMatches,
    context.now,
    REMINDER_WINDOW_START_MINUTES,
    REMINDER_WINDOW_END_MINUTES,
  );
}

export function getClosingAlertMatches(
  context: MatchAutomationSweepContext,
  closeMinutes: number,
): MatchAutomationSweepMatch[] {
  return filterMatchesInFutureWindow(
    context.scheduledMatches,
    context.now,
    closeMinutes,
    closeMinutes + CLOSING_ALERT_WINDOW_GRACE_MINUTES,
  );
}

export function getPendingReportMatches(
  context: MatchAutomationSweepContext,
  leagueId: string,
  closeMinutes: number,
): MatchAutomationSweepMatch[] {
  const lowerBound = new Date(context.now.getTime() - closeMinutes * 60_000);
  const upperBound = new Date(context.now.getTime() + closeMinutes * 60_000);

  return context.scheduledMatches.filter(
    (match) =>
      match.predictionReportSentAt === null &&
      match.matchDate > lowerBound &&
      match.matchDate <= upperBound &&
      match.predictions.some((prediction) => prediction.leagueId === leagueId),
  );
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
