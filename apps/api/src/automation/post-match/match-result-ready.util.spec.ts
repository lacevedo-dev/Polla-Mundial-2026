import { describe, expect, it } from 'vitest';
import { MatchStatus } from '@prisma/client';
import { isMatchReadyForResultNotification } from './match-result-ready.util';

describe('isMatchReadyForResultNotification', () => {
  it('requires FINISHED status and final score', () => {
    expect(
      isMatchReadyForResultNotification({
        status: MatchStatus.LIVE,
        homeScore: 1,
        awayScore: 0,
        predictions: [{ pointDetail: '{"type":"EXACT_SCORE"}' }],
      }),
    ).toBe(false);

    expect(
      isMatchReadyForResultNotification({
        status: MatchStatus.FINISHED,
        homeScore: null,
        awayScore: 1,
        predictions: [],
      }),
    ).toBe(false);
  });

  it('allows finished matches without predictions', () => {
    expect(
      isMatchReadyForResultNotification({
        status: MatchStatus.FINISHED,
        homeScore: 0,
        awayScore: 1,
        predictions: [],
      }),
    ).toBe(true);
  });

  it('waits until every prediction has pointDetail', () => {
    expect(
      isMatchReadyForResultNotification({
        status: MatchStatus.FINISHED,
        homeScore: 0,
        awayScore: 1,
        predictions: [{ pointDetail: null }, { pointDetail: '{"type":"WINNER"}' }],
      }),
    ).toBe(false);

    expect(
      isMatchReadyForResultNotification({
        status: MatchStatus.FINISHED,
        homeScore: 0,
        awayScore: 1,
        predictions: [
          { pointDetail: '{"type":"WINNER"}' },
          { pointDetail: '{"type":"EXACT_SCORE"}' },
        ],
      }),
    ).toBe(true);
  });
});
