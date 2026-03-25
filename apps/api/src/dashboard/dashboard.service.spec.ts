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
});
