import {
  getCatchUpPredictionReportMatches,
  getPendingReportMatches,
} from './match-automation-sweep-context';

describe('getPendingReportMatches', () => {
  const kickoff = new Date('2026-06-17T20:00:00.000Z');

  const baseMatch = {
    id: 'match-1',
    status: 'SCHEDULED' as const,
    matchDate: kickoff,
    tournamentId: 'tour-1',
    venue: null,
    round: null,
    predictionReportSentAt: null,
    homeTeam: { name: 'A' },
    awayTeam: { name: 'B' },
    predictions: [
      {
        userId: 'user-1',
        leagueId: 'league-1',
        homeScore: 1,
        awayScore: 0,
        submittedAt: new Date('2026-06-17T18:00:00.000Z'),
        user: { id: 'user-1', name: 'Ana', email: 'ana@test.com' },
      },
    ],
  };

  it('excludes match 2 minutes before close (T-17) when close is T-15', () => {
    const now = new Date('2026-06-17T19:43:00.000Z');
    const matches = getPendingReportMatches(
      {
        now,
        activeLeagues: [],
        scheduledMatches: [baseMatch],
        maxClosePredictionMinutes: 15,
      },
      'league-1',
      15,
      1,
    );

    expect(matches).toHaveLength(0);
  });

  it('includes match 1 minute after close (T-14) when close is T-15', () => {
    const now = new Date('2026-06-17T19:46:00.000Z');
    const matches = getPendingReportMatches(
      {
        now,
        activeLeagues: [],
        scheduledMatches: [baseMatch],
        maxClosePredictionMinutes: 15,
      },
      'league-1',
      15,
      1,
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('match-1');
  });

  it('excludes match at exact close time (T-15)', () => {
    const now = new Date('2026-06-17T19:45:00.000Z');
    const matches = getPendingReportMatches(
      {
        now,
        activeLeagues: [],
        scheduledMatches: [baseMatch],
        maxClosePredictionMinutes: 15,
      },
      'league-1',
      15,
      1,
    );

    expect(matches).toHaveLength(0);
  });

  it('excludes match when report was already sent', () => {
    const now = new Date('2026-06-17T19:46:00.000Z');
    const matches = getPendingReportMatches(
      {
        now,
        activeLeagues: [],
        scheduledMatches: [
          {
            ...baseMatch,
            predictionReportSentAt: new Date('2026-06-17T19:44:00.000Z'),
          },
        ],
        maxClosePredictionMinutes: 15,
      },
      'league-1',
      15,
      1,
    );

    expect(matches).toHaveLength(0);
  });

  it('catch-up sends after due time if cron was delayed', () => {
    const now = new Date('2026-06-17T19:50:00.000Z');
    const matches = getCatchUpPredictionReportMatches(
      {
        now,
        activeLeagues: [],
        scheduledMatches: [baseMatch],
        maxClosePredictionMinutes: 15,
      },
      'league-1',
      15,
      1,
    );

    expect(matches).toHaveLength(1);
  });
});
