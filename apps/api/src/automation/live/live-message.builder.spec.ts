import {
  buildGoalImpactWaCaption,
  buildLiveUserMessage,
  goalImpactDedupeKey,
  liveEventNotificationDataKey,
} from './live-message.builder';
import { GoalImpactAnalyzerService } from './goal-impact-analyzer.service';
import type { ProvisionalLeagueImpact } from '../../predictions/predictions.service';

describe('live-message.builder', () => {
  it('genera clave de dedupe por marcador para impacto de gol', () => {
    expect(goalImpactDedupeKey('m1', 'l1', 2, 1)).toBe(
      'GOAL_IMPACT:m1:l1:2-1',
    );
  });

  it('genera data key para dedupe in-app', () => {
    expect(liveEventNotificationDataKey('MATCH_START', 'm1')).toContain(
      '"liveEvent":"MATCH_START"',
    );
    expect(liveEventNotificationDataKey('MATCH_START', 'm1')).toContain(
      '"matchId":"m1"',
    );
  });

  it('construye mensaje de inicio de partido', () => {
    const { title, body } = buildLiveUserMessage({
      event: 'MATCH_START',
      homeTeam: 'Colombia',
      awayTeam: 'Ecuador',
      homeScore: 0,
      awayScore: 0,
      elapsed: 1,
    });
    expect(title).toBe('¡Arrancó el partido!');
    expect(body).toContain('Colombia 0-0 Ecuador');
  });

  it('construye caption WA de impacto con acertadores exactos', () => {
    const caption = buildGoalImpactWaCaption({
      leagueName: 'Polla Test',
      homeTeam: 'Colombia',
      awayTeam: 'Ecuador',
      homeScore: 2,
      awayScore: 1,
      elapsed: 67,
      scoringTeam: 'Colombia',
      scorerName: 'Luis Díaz',
      summary: {
        leagueId: 'l1',
        leagueName: 'Polla Test',
        exactScoreCount: 2,
        exactScoreNames: ['Ana', 'Luis'],
        scoringCount: 8,
        topScorers: [{ displayName: 'Ana', points: 7.5 }],
        popularPredictions: [{ score: '2-1', count: 4 }],
        provisionalRanking: [],
      },
    });

    expect(caption).toContain('Impacto en la polla');
    expect(caption).toContain('Marcador exacto ahora: 2');
    expect(caption).toContain('Luis Díaz');
    expect(caption).toContain('2-1 (4)');
  });
});

describe('GoalImpactAnalyzerService.summarizeOneLeague', () => {
  const analyzer = new GoalImpactAnalyzerService({} as never);

  it('resume conteos y top provisional', () => {
    const impact: ProvisionalLeagueImpact = {
      leagueId: 'l1',
      leagueName: 'Liga',
      entries: [
        {
          userId: 'u1',
          displayName: 'Ana',
          predictedHome: 2,
          predictedAway: 1,
          points: 7.5,
          detailType: 'EXACT_SCORE',
        },
        {
          userId: 'u2',
          displayName: 'Bob',
          predictedHome: 2,
          predictedAway: 1,
          points: 7.5,
          detailType: 'EXACT_SCORE',
        },
        {
          userId: 'u3',
          displayName: 'Carlos',
          predictedHome: 1,
          predictedAway: 0,
          points: 2,
          detailType: 'CORRECT_WINNER',
        },
        {
          userId: 'u4',
          displayName: 'Diana',
          predictedHome: 0,
          predictedAway: 0,
          points: 0,
          detailType: 'NONE',
        },
      ],
    };

    const summary = analyzer.summarizeOneLeague(impact);

    expect(summary.exactScoreCount).toBe(2);
    expect(summary.scoringCount).toBe(3);
    expect(summary.popularPredictions[0]).toEqual({ score: '2-1', count: 2 });
    expect(summary.topScorers[0].displayName).toBe('Ana');
  });
});
