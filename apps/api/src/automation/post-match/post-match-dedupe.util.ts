export const RESULT_NOTIFICATION_KEY_PREFIX = 'result-published';

export function buildMatchResultNotificationKey(match: {
  externalId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  matchDate: Date;
}): string {
  if (match.externalId?.trim()) {
    return `${RESULT_NOTIFICATION_KEY_PREFIX}:fixture:${match.externalId}`;
  }

  return [
    RESULT_NOTIFICATION_KEY_PREFIX,
    'fallback',
    match.homeTeamId ?? 'no-home',
    match.awayTeamId ?? 'no-away',
    match.matchDate.toISOString(),
  ].join(':');
}
