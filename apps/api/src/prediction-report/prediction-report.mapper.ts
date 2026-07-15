import {
  PredictorEntry,
  ReportMatchInfo,
  ResultEntry,
  ResultOutcome,
} from './prediction-report-email.service';
import {
  formatReportPhaseLabel,
  isAdvancePickCorrect,
  isKnockoutReportPhase,
  resolveAdvanceTeamName,
} from './prediction-report.util';

export type ReportMatchSource = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  matchDate: Date;
  venue?: string | null;
  round?: string | null;
  phase: string;
  homeScore?: number | null;
  awayScore?: number | null;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  advancingTeamId?: string | null;
  advancingTeam?: { name: string } | null;
};

export type PredictionSource = {
  userId: string;
  homeScore: number;
  awayScore: number;
  submittedAt: Date;
  advanceTeamId?: string | null;
  advanceTeam?: { name: string } | null;
  points?: number | null;
  pointDetail?: string | null;
  user: { id: string; name: string | null; email?: string | null };
};

export type AdvancePickByUser = Map<
  string,
  { advanceTeamId: string | null; advanceTeamName: string | null }
>;

export function buildReportMatchInfo(
  match: ReportMatchSource,
  options?: { includeResult?: boolean },
): ReportMatchInfo {
  const isKnockout = isKnockoutReportPhase(match.phase);
  const round = match.round ?? formatReportPhaseLabel(match.phase);
  const advancingTeamName =
    options?.includeResult && isKnockout
      ? match.advancingTeam?.name ??
        (match.advancingTeamId === match.homeTeamId
          ? match.homeTeam.name
          : match.advancingTeamId === match.awayTeamId
            ? match.awayTeam.name
            : undefined)
      : undefined;

  return {
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    matchDate: match.matchDate,
    venue: match.venue ?? undefined,
    round: round ?? undefined,
    phase: match.phase,
    isKnockout,
    advancingTeamName,
  };
}

export function mapPredictorEntry(
  prediction: PredictionSource,
  member: { role: string } | undefined,
  match: ReportMatchSource,
  resolveName: (user: PredictionSource['user'], userId: string) => string,
  advancePick?: { advanceTeamId: string | null; advanceTeamName: string | null },
): PredictorEntry {
  const isKnockout = isKnockoutReportPhase(match.phase);
  const advanceTeamId = prediction.advanceTeamId ?? advancePick?.advanceTeamId ?? null;
  const advanceTeamNameFromRelation =
    prediction.advanceTeam?.name ?? advancePick?.advanceTeamName ?? null;

  return {
    userId: prediction.userId,
    name: resolveName(prediction.user, prediction.userId),
    email: prediction.user.email ?? undefined,
    isAdmin: member?.role === 'ADMIN',
    homeScore: prediction.homeScore,
    awayScore: prediction.awayScore,
    submittedAt: prediction.submittedAt,
    ...(isKnockout
      ? {
          advanceTeamName: resolveAdvanceTeamName({
            advanceTeamId,
            advanceTeamName: advanceTeamNameFromRelation,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeTeamName: match.homeTeam.name,
            awayTeamName: match.awayTeam.name,
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
          }),
        }
      : {}),
  };
}

export function mapResultEntry(
  prediction: PredictionSource,
  member: { role: string } | undefined,
  match: ReportMatchSource,
  resolveName: (user: PredictionSource['user'], userId: string) => string,
  parseOutcome: (pointDetail: string | null, points: number | null) => ResultOutcome,
  standings: {
    pointsEarned: number;
    totalPoints: number;
    prevPosition: number;
    newPosition: number;
  },
  advancePick?: { advanceTeamId: string | null; advanceTeamName: string | null },
): ResultEntry {
  const base = mapPredictorEntry(prediction, member, match, resolveName, advancePick);
  const isKnockout = isKnockoutReportPhase(match.phase);
  const advanceCorrect = isKnockout
    ? isAdvancePickCorrect({
        advanceTeamId: prediction.advanceTeamId ?? advancePick?.advanceTeamId ?? null,
        advancingTeamId: match.advancingTeamId ?? null,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        matchHomeScore: match.homeScore,
        matchAwayScore: match.awayScore,
        penaltyHomeScore: match.penaltyHomeScore,
        penaltyAwayScore: match.penaltyAwayScore,
      })
    : undefined;

  return {
    ...base,
    outcome: parseOutcome(prediction.pointDetail ?? null, prediction.points ?? null),
    pointsEarned: standings.pointsEarned,
    totalPoints: standings.totalPoints,
    prevPosition: standings.prevPosition,
    newPosition: standings.newPosition,
    ...(isKnockout ? { advanceCorrect } : {}),
  };
}
