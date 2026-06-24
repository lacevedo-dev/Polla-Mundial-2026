import { MatchStatus } from '@prisma/client';

export type MatchResultReadinessInput = {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  predictions: Array<{ pointDetail: string | null }>;
};

/** El mensaje de resultado requiere puntos persistidos en cada predicción. */
export function isMatchReadyForResultNotification(
  match: MatchResultReadinessInput,
): boolean {
  if (match.status !== MatchStatus.FINISHED) return false;
  if (match.homeScore === null || match.awayScore === null) return false;
  if (match.predictions.length === 0) return true;
  return match.predictions.every((prediction) => prediction.pointDetail != null);
}
