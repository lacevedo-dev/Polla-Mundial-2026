import {
  buildResultUserMessage,
  buildResultWaCaption,
  summarizeLeagueResults,
} from './post-match-message.builder';

describe('post-match-message.builder', () => {
  const matchDate = new Date('2026-06-20T23:00:00.000Z');

  it('construye mensaje personal con hora Bogotá', () => {
    const { title, body } = buildResultUserMessage({
      homeTeam: 'Colombia',
      awayTeam: 'Ecuador',
      homeScore: 2,
      awayScore: 1,
      matchDate,
      totalPoints: 7,
      totalPollas: 1,
      pollasWithExact: 0,
      maxPoints: 3,
    });

    expect(title).toBe('Resultado publicado');
    expect(body).toContain('Colombia 2-1 Ecuador');
    expect(body).toContain('hora Bogotá');
    expect(body).toContain('7 pts');
  });

  it('destaca marcador exacto en título', () => {
    const { title } = buildResultUserMessage({
      homeTeam: 'Colombia',
      awayTeam: 'Ecuador',
      homeScore: 2,
      awayScore: 1,
      matchDate,
      totalPoints: 7,
      totalPollas: 2,
      pollasWithExact: 1,
      maxPoints: 7,
    });

    expect(title).toBe('Acertaste el marcador exacto');
  });

  it('construye caption WA con top y exactos', () => {
    const summary = summarizeLeagueResults('l1', 'Polla Test', [
      {
        userId: 'u1',
        displayName: 'Ana',
        points: 7,
        detailType: 'EXACT_SCORE',
      },
      {
        userId: 'u2',
        displayName: 'Bob',
        points: 3,
        detailType: 'CORRECT_WINNER',
      },
      {
        userId: 'u3',
        displayName: 'Carlos',
        points: 0,
        detailType: 'NONE',
      },
    ]);

    const caption = buildResultWaCaption({
      homeTeam: 'Colombia',
      awayTeam: 'Ecuador',
      homeScore: 2,
      awayScore: 1,
      summary,
    });

    expect(caption).toContain('Resultado final');
    expect(caption).toContain('Ana');
    expect(caption).toContain('2/3');
    expect(caption).toContain('reporte detallado');
  });
});
