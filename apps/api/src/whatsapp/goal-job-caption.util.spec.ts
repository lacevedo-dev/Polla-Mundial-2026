import {
  encodeGoalJobCaption,
  parseGoalJobCaption,
} from './goal-job-caption.util';

describe('goal-job-caption.util', () => {
  it('codifica y decodifica metadatos del gol sin mostrarlos en el caption', () => {
    const visible = '⚽ *¡GOL!* | Liga\nC. Ronaldo — Portugal 1 – 0 Uzbekistan 6\'';
    const encoded = encodeGoalJobCaption(visible, {
      scorerName: 'C. Ronaldo',
      assistName: 'J. Cancelo',
      goalDetail: null,
      elapsed: 6,
      homeScore: 1,
      awayScore: 0,
      scoringTeam: 'Portugal',
    });

    const parsed = parseGoalJobCaption(encoded);
    expect(parsed.caption).toBe(visible);
    expect(parsed.meta?.scorerName).toBe('C. Ronaldo');
    expect(parsed.meta?.homeScore).toBe(1);
  });
});
