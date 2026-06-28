import { Phase } from '@prisma/client';

export function isKnockoutReportPhase(phase: string | null | undefined): boolean {
  return !!phase && phase !== Phase.GROUP && phase !== Phase.THIRD_PLACE;
}

export function formatReportPhaseLabel(phase: string | null | undefined): string | undefined {
  if (!phase) return undefined;
  const labels: Record<string, string> = {
    [Phase.GROUP]: 'Fase de grupos',
    [Phase.ROUND_OF_32]: 'Dieciseisavos de final',
    [Phase.ROUND_OF_16]: 'Octavos de final',
    [Phase.QUARTER]: 'Cuartos de final',
    [Phase.SEMI]: 'Semifinal',
    [Phase.THIRD_PLACE]: 'Tercer puesto',
    [Phase.FINAL]: 'Final',
  };
  return labels[phase] ?? phase;
}

export function resolveAdvanceTeamName(params: {
  advanceTeamId?: string | null;
  advanceTeamName?: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
}): string | null {
  if (params.advanceTeamName) return params.advanceTeamName;
  if (params.advanceTeamId) {
    if (params.advanceTeamId === params.homeTeamId) return params.homeTeamName;
    if (params.advanceTeamId === params.awayTeamId) return params.awayTeamName;
  }
  if (params.homeScore > params.awayScore) return params.homeTeamName;
  if (params.awayScore > params.homeScore) return params.awayTeamName;
  return null;
}

export function isAdvancePickCorrect(params: {
  advanceTeamId?: string | null;
  advancingTeamId?: string | null;
  homeScore: number;
  awayScore: number;
  homeTeamId: string;
  awayTeamId: string;
}): boolean | null {
  if (!params.advancingTeamId) return null;
  const effectiveAdvanceId =
    params.advanceTeamId ??
    (params.homeScore > params.awayScore
      ? params.homeTeamId
      : params.awayScore > params.homeScore
        ? params.awayTeamId
        : null);
  if (!effectiveAdvanceId) return null;
  return effectiveAdvanceId === params.advancingTeamId;
}

export function formatAdvanceCorrectLabel(correct: boolean | null | undefined): string {
  if (correct === true) return '✓';
  if (correct === false) return '✗';
  return '—';
}
