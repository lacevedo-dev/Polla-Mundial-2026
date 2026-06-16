import { formatMatchDateTimeBogota } from '../config/automation-datetime.util';

export type LeagueResultSummary = {
  leagueId: string;
  leagueName: string;
  topScorers: Array<{ displayName: string; points: number }>;
  exactScoreCount: number;
  exactScoreNames: string[];
  participantsWithPoints: number;
  totalParticipants: number;
};

export function buildResultUserMessage(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchDate: Date;
  totalPoints: number;
  totalPollas: number;
  pollasWithExact: number;
  maxPoints: number;
}): { title: string; body: string } {
  const score = `${params.homeScore}-${params.awayScore}`;
  const kickoff = formatMatchDateTimeBogota(params.matchDate);
  const hasExactScore = params.maxPoints >= 5;

  const title = hasExactScore
    ? 'Acertaste el marcador exacto'
    : 'Resultado publicado';

  if (params.totalPollas === 1) {
    const body = hasExactScore
      ? `${params.homeTeam} ${score} ${params.awayTeam} (${kickoff}, hora Bogotá). Marcador exacto: +${params.totalPoints} pts.`
      : `${params.homeTeam} ${score} ${params.awayTeam} (${kickoff}, hora Bogotá). Sumaste ${params.totalPoints} pts en tu polla.`;
    return { title, body };
  }

  const exactPart =
    params.pollasWithExact > 0
      ? ` Acertaste el marcador en ${params.pollasWithExact} de ${params.totalPollas} pollas.`
      : '';

  const body = `${params.homeTeam} ${score} ${params.awayTeam} (${kickoff}, hora Bogotá). Total: ${params.totalPoints} pts en ${params.totalPollas} pollas.${exactPart}`;

  return { title, body };
}

export function buildResultWaCaption(params: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  summary: LeagueResultSummary;
}): string {
  const score = `${params.homeScore}-${params.awayScore}`;
  const header = `*${params.summary.leagueName}*`;

  const exactLine =
    params.summary.exactScoreCount > 0
      ? `\n🎯 Marcador exacto: ${params.summary.exactScoreNames.join(', ')} (${params.summary.exactScoreCount})`
      : '\n🎯 Sin marcadores exactos en esta polla';

  const topLine =
    params.summary.topScorers.length > 0
      ? `\n⭐ Top del partido: ${params.summary.topScorers
          .map((s) => `${s.displayName} ${s.points} pts`)
          .join(', ')}`
      : '';

  const scoringLine = `\n📊 Sumaron puntos: ${params.summary.participantsWithPoints}/${params.summary.totalParticipants}`;

  return `${header}\n🏁 *Resultado final*\n${params.homeTeam} ${score} ${params.awayTeam}${exactLine}${topLine}${scoringLine}\n\nEl reporte detallado llegará en breve.`;
}

export function summarizeLeagueResults(
  leagueId: string,
  leagueName: string,
  entries: Array<{
    userId: string;
    displayName: string;
    points: number;
    detailType: string;
  }>,
): LeagueResultSummary {
  const exactEntries = entries.filter((e) => e.detailType === 'EXACT_SCORE');
  const scoringEntries = entries.filter((e) => e.points > 0);

  const topScorers = [...scoringEntries]
    .sort(
      (a, b) =>
        b.points - a.points || a.displayName.localeCompare(b.displayName),
    )
    .slice(0, 3)
    .map((e) => ({ displayName: e.displayName, points: e.points }));

  return {
    leagueId,
    leagueName,
    topScorers,
    exactScoreCount: exactEntries.length,
    exactScoreNames: exactEntries.slice(0, 5).map((e) => e.displayName),
    participantsWithPoints: scoringEntries.length,
    totalParticipants: entries.length,
  };
}
