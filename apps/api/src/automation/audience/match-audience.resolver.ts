import { MemberStatus } from '@prisma/client';
import {
  MatchAutomationSweepContext,
  MatchAutomationSweepLeague,
  MatchAutomationSweepMatch,
  getRelevantLeaguesForMatchReminder,
  normalizeClosePredictionMinutes,
} from '../../notifications/match-automation-sweep-context';
import type { UserMatchAudience, UserMatchLeagueStatus } from '../types/automation.types';
import { CHECKPOINT_WINDOW_GRACE_MINUTES } from '../config/automation-timing.util';

export function getMatchesInMinutesBeforeKickoffWindow(
  context: MatchAutomationSweepContext,
  minutesBeforeKickoff: number,
): MatchAutomationSweepMatch[] {
  const primary = filterCheckpointWindow(context, minutesBeforeKickoff);
  const catchUp = getCatchUpEscalationMatches(context, minutesBeforeKickoff);
  const seen = new Set<string>();
  const merged: MatchAutomationSweepMatch[] = [];
  for (const match of [...primary, ...catchUp]) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    merged.push(match);
  }
  return merged;
}

/** Escalada debía enviarse pero el kickoff aún no pasó (catch-up). */
export function getCatchUpEscalationMatches(
  context: MatchAutomationSweepContext,
  minutesBeforeKickoff: number,
): MatchAutomationSweepMatch[] {
  const now = context.now.getTime();

  return context.scheduledMatches.filter((match) => {
    const kickoffMs = match.matchDate.getTime();
    if (kickoffMs <= now) return false;
    const dueAt = kickoffMs - minutesBeforeKickoff * 60_000;
    return now >= dueAt;
  });
}

function filterCheckpointWindow(
  context: MatchAutomationSweepContext,
  minutesBeforeKickoff: number,
): MatchAutomationSweepMatch[] {
  const windowStart = new Date(
    context.now.getTime() + minutesBeforeKickoff * 60_000,
  );
  const windowEnd = new Date(
    context.now.getTime() +
      (minutesBeforeKickoff + CHECKPOINT_WINDOW_GRACE_MINUTES) * 60_000,
  );

  return context.scheduledMatches.filter(
    (match) => match.matchDate >= windowStart && match.matchDate <= windowEnd,
  );
}

export function getRelevantLeaguesForMatch(
  context: MatchAutomationSweepContext,
  match: MatchAutomationSweepMatch,
): MatchAutomationSweepLeague[] {
  return getRelevantLeaguesForMatchReminder(context, match);
}

export function buildUserMatchAudiences(
  match: MatchAutomationSweepMatch,
  leagues: MatchAutomationSweepLeague[],
): UserMatchAudience[] {
  const userMap = new Map<string, UserMatchLeagueStatus[]>();

  for (const league of leagues) {
    for (const member of league.members.filter(
      (m) => m.status === MemberStatus.ACTIVE,
    )) {
      const hasPrediction = match.predictions.some(
        (p) => p.userId === member.userId && p.leagueId === league.id,
      );
      const entry: UserMatchLeagueStatus = {
        leagueId: league.id,
        leagueName: league.name,
        hasPrediction,
      };
      const existing = userMap.get(member.userId) ?? [];
      existing.push(entry);
      userMap.set(member.userId, existing);
    }
  }

  return [...userMap.entries()].map(([userId, leagueStatuses]) => {
    const pending = leagueStatuses.filter((l) => !l.hasPrediction);
    return {
      userId,
      leagues: leagueStatuses,
      allComplete: pending.length === 0,
      pendingLeagueIds: pending.map((l) => l.leagueId),
      pendingLeagueNames: pending.map((l) => l.leagueName),
    };
  });
}

export function groupLeaguesByCloseMinutes(
  leagues: MatchAutomationSweepLeague[],
): Map<number, MatchAutomationSweepLeague[]> {
  const groups = new Map<number, MatchAutomationSweepLeague[]>();
  for (const league of leagues) {
    const closeMinutes = normalizeClosePredictionMinutes(
      league.closePredictionMinutes,
    );
    if (!groups.has(closeMinutes)) {
      groups.set(closeMinutes, []);
    }
    groups.get(closeMinutes)!.push(league);
  }
  return groups;
}

export type MissingMemberForLeague = {
  userId: string;
  displayName: string;
};

export function getMissingMembersForLeague(
  match: MatchAutomationSweepMatch,
  league: MatchAutomationSweepLeague,
): MissingMemberForLeague[] {
  const missing: MissingMemberForLeague[] = [];

  for (const member of league.members.filter(
    (m) => m.status === MemberStatus.ACTIVE,
  )) {
    const hasPrediction = match.predictions.some(
      (p) => p.userId === member.userId && p.leagueId === league.id,
    );
    if (hasPrediction) continue;

    missing.push({
      userId: member.userId,
      displayName: member.user.name?.trim() || 'Usuario',
    });
  }

  return missing.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'es'),
  );
}

export function countPredictionsForLeague(
  match: MatchAutomationSweepMatch,
  leagueId: string,
): number {
  return match.predictions.filter((p) => p.leagueId === leagueId).length;
}
