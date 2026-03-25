import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const prismaMock = {
    prediction: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const service = new DashboardService(prismaMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts resolved predictions with points as aciertos and zero-point predictions as errores', async () => {
    prismaMock.prediction.findMany.mockResolvedValue([
      {
        points: 3,
        homeScore: 2,
        awayScore: 1,
        match: { homeScore: 1, awayScore: 0 },
      },
      {
        points: 0,
        homeScore: 0,
        awayScore: 1,
        match: { homeScore: 2, awayScore: 1 },
      },
      {
        points: null,
        homeScore: 1,
        awayScore: 1,
        match: { homeScore: null, awayScore: null },
      },
    ]);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(service.getStats('user-1')).resolves.toEqual({
      aciertos: 1,
      errores: 1,
      racha: 0,
      tasa: 50,
    });
  });

  it('includes earned points in recent predictions', async () => {
    prismaMock.prediction.findMany.mockResolvedValue([
      {
        id: 'pred-1',
        homeScore: 2,
        awayScore: 1,
        points: 3,
        submittedAt: '2026-03-25T10:00:00.000Z',
        match: {
          homeScore: 1,
          awayScore: 0,
          homeTeam: { name: 'Colombia' },
          awayTeam: { name: 'Brasil' },
        },
      },
    ]);

    await expect(service.getRecentPredictions('user-1')).resolves.toEqual({
      predicciones: [
        {
          id: 'pred-1',
          match: 'Colombia vs Brasil',
          tuPrediccion: '2-1',
          resultado: '1-0',
          acierto: false,
          puntos: 3,
          fecha: '25/3/2026',
        },
      ],
    });
  });

  it('deduplicates recent predictions by match within a league keeping the latest submission first', async () => {
    prismaMock.prediction.findMany.mockResolvedValue([
      {
        id: 'pred-new',
        matchId: 'match-1',
        leagueId: 'league-1',
        homeScore: 2,
        awayScore: 1,
        points: 1,
        submittedAt: '2026-03-25T11:00:00.000Z',
        match: {
          homeScore: 0,
          awayScore: 1,
          homeTeam: { name: 'Kyrgyzstan' },
          awayTeam: { name: 'Equatorial Guinea' },
        },
      },
      {
        id: 'pred-old',
        matchId: 'match-1',
        leagueId: 'league-1',
        homeScore: 1,
        awayScore: 1,
        points: 0,
        submittedAt: '2026-03-25T10:00:00.000Z',
        match: {
          homeScore: 0,
          awayScore: 1,
          homeTeam: { name: 'Kyrgyzstan' },
          awayTeam: { name: 'Equatorial Guinea' },
        },
      },
      {
        id: 'pred-2',
        matchId: 'match-2',
        leagueId: 'league-1',
        homeScore: 1,
        awayScore: 0,
        points: null,
        submittedAt: '2026-03-25T09:00:00.000Z',
        match: {
          homeScore: null,
          awayScore: null,
          homeTeam: { name: 'Moldova' },
          awayTeam: { name: 'Lithuania' },
        },
      },
    ]);

    const response = await service.getRecentPredictions('user-1', 'league-1');

    expect(response.predicciones).toHaveLength(2);
    expect(response.predicciones[0]).toMatchObject({
      id: 'pred-new',
      match: 'Kyrgyzstan vs Equatorial Guinea',
      tuPrediccion: '2-1',
    });
    expect(response.predicciones[1]).toMatchObject({
      id: 'pred-2',
      match: 'Moldova vs Lithuania',
    });
  });
});
