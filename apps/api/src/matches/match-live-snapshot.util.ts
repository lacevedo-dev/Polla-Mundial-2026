import { PrismaService } from '../prisma/prisma.service';

export type LiveGoalEventSnapshot = {
  type: string;
  detail: string | null;
  playerName: string | null;
  assistName: string | null;
  playerExternalId?: number | null;
  minute: number;
  extraMin: number | null;
  teamId: string | null;
  annulled?: boolean;
  annulledReason?: string | null;
};

export async function countStoredActiveGoals(
  prisma: PrismaService,
  matchId: string,
): Promise<number> {
  const rows = await prisma.matchEvent.findMany({
    where: { matchId },
    select: { type: true, annulled: true },
  });
  return rows.filter(
    (row) => String(row.type).toUpperCase() === 'GOAL' && !row.annulled,
  ).length;
}

export async function buildMatchEventsRevision(
  prisma: PrismaService,
  matchId: string,
): Promise<string> {
  const events = await prisma.matchEvent.findMany({
    where: { matchId },
    select: { type: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const goalCount = events.filter((e) => String(e.type).toUpperCase() === 'GOAL').length;
  const latest = events[0];

  return `${goalCount}:${latest?.updatedAt?.getTime() ?? 0}`;
}

export async function fetchLiveGoalEventSnapshots(
  prisma: PrismaService,
  matchId: string,
): Promise<LiveGoalEventSnapshot[]> {
  const rows = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: [{ minute: 'asc' }, { extraMin: 'asc' }, { updatedAt: 'asc' }],
    select: {
      type: true,
      detail: true,
      playerName: true,
      assistName: true,
      playerExternalId: true,
      minute: true,
      extraMin: true,
      teamId: true,
      annulled: true,
      annulledReason: true,
    },
  });

  return rows
    .filter((row) => String(row.type).toUpperCase() === 'GOAL')
    .map((row) => ({
      ...row,
      type: 'GOAL',
    }));
}
