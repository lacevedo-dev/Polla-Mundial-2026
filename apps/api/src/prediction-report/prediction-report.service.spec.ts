import { PredictionReportService } from './prediction-report.service';

describe('PredictionReportService', () => {
  const prisma = {
    prediction: {
      findMany: jest.fn(),
    },
    match: {
      update: jest.fn(),
    },
  } as any;

  const emailService = {
    sendPredictionsReport: jest.fn(),
  } as any;

  let service: PredictionReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PredictionReportService(prisma, emailService);
    prisma.prediction.findMany.mockResolvedValue([
      { userId: 'user-1', points: 7 },
      { userId: 'user-2', points: 3 },
    ]);
    prisma.match.update.mockResolvedValue({});
    emailService.sendPredictionsReport.mockResolvedValue(undefined);
  });

  it('uses prefetched scheduled context to send pending reports without reloading league audience', async () => {
    const now = new Date('2026-03-28T15:30:00.000Z');
    const context = {
      now,
      maxClosePredictionMinutes: 30,
      activeLeagues: [
        {
          id: 'league-1',
          name: 'Liga 1',
          code: 'L1',
          closePredictionMinutes: 15,
          leagueTournaments: [{ tournamentId: 'tour-1' }],
          members: [
            {
              userId: 'user-1',
              status: 'ACTIVE',
              role: 'ADMIN',
              user: { id: 'user-1', name: 'Ana', email: 'ana@test.com' },
            },
            {
              userId: 'user-2',
              status: 'PENDING_PAYMENT',
              role: 'MEMBER',
              user: { id: 'user-2', name: 'Beto', email: 'beto@test.com' },
            },
          ],
        },
      ],
      scheduledMatches: [
        {
          id: 'match-1',
          matchDate: new Date('2026-03-28T15:40:00.000Z'),
          tournamentId: 'tour-1',
          venue: 'Stadium',
          round: '1',
          predictionReportSentAt: null,
          homeTeam: { name: 'A' },
          awayTeam: { name: 'B' },
          predictions: [
            {
              userId: 'user-1',
              leagueId: 'league-1',
              homeScore: 1,
              awayScore: 0,
              submittedAt: new Date('2026-03-28T14:00:00.000Z'),
              user: { id: 'user-1', name: 'Ana', email: 'ana@test.com' },
            },
          ],
        },
      ],
    } as any;

    await service.sendPendingReports(context);

    expect(emailService.sendPredictionsReport).toHaveBeenCalledTimes(1);
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { predictionReportSentAt: now },
    });
    expect(prisma.prediction.findMany).toHaveBeenCalledTimes(1);
  });
});
