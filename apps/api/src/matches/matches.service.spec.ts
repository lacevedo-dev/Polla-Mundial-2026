import { MatchStatus, Phase } from '@prisma/client';
import { MatchesService } from './matches.service';

describe('MatchesService', () => {
  const prismaMock = {
    match: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const predictionsServiceMock = {
    calculateMatchPoints: jest.fn().mockResolvedValue(undefined),
    calculatePhaseBonuses: jest.fn().mockResolvedValue(undefined),
  };

  const predictionReportServiceMock = {
    sendMatchResultsReport: jest.fn().mockResolvedValue(undefined),
  };

  const service = new MatchesService(
    prismaMock as any,
    predictionsServiceMock as any,
    predictionReportServiceMock as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps canonical team fields into the public match response', async () => {
    prismaMock.match.findMany.mockResolvedValue([
      {
        id: 'match-1',
        matchDate: '2026-06-11T14:00:00.000Z',
        status: MatchStatus.SCHEDULED,
        phase: Phase.GROUP,
        group: 'A',
        venue: 'Estadio Azteca',
        homeScore: null,
        awayScore: null,
        externalId: 'fixture-1',
        homeTeam: {
          id: 'team-home',
          name: 'México',
          code: 'MEX',
          shortCode: 'MEX',
          flagUrl: 'https://example.com/mex.png',
        },
        awayTeam: {
          id: 'team-away',
          name: 'Sudáfrica',
          code: 'RSA',
          shortCode: 'RSA',
          flagUrl: 'https://example.com/rsa.png',
        },
      },
    ]);

    const [match] = await service.findAll();

    expect(match).toEqual({
      id: 'match-1',
      matchDate: '2026-06-11T14:00:00.000Z',
      status: MatchStatus.SCHEDULED,
      phase: Phase.GROUP,
      group: 'A',
      venue: 'Estadio Azteca',
      homeScore: null,
      awayScore: null,
      externalId: 'fixture-1',
      homeTeam: {
        id: 'team-home',
        name: 'México',
        code: 'MEX',
        shortCode: 'MEX',
        flagUrl: 'https://example.com/mex.png',
      },
      awayTeam: {
        id: 'team-away',
        name: 'Sudáfrica',
        code: 'RSA',
        shortCode: 'RSA',
        flagUrl: 'https://example.com/rsa.png',
      },
    });
  });

  it('recalculates points, bonuses and triggers results email when admin updates a score', async () => {
    prismaMock.match.findUnique.mockResolvedValue({
      id: 'match-1',
      matchDate: '2026-06-11T14:00:00.000Z',
      status: MatchStatus.SCHEDULED,
      phase: Phase.KNOCKOUT,
      group: null,
      venue: 'Estadio Azteca',
      homeScore: null,
      awayScore: null,
      externalId: 'fixture-1',
      homeTeam: {
        id: 'team-home',
        name: 'México',
        code: 'MEX',
        shortCode: 'MEX',
        flagUrl: 'https://example.com/mex.png',
      },
      awayTeam: {
        id: 'team-away',
        name: 'Sudáfrica',
        code: 'RSA',
        shortCode: 'RSA',
        flagUrl: 'https://example.com/rsa.png',
      },
    });
    prismaMock.match.update.mockResolvedValue({
      id: 'match-1',
      matchDate: '2026-06-11T14:00:00.000Z',
      status: MatchStatus.FINISHED,
      phase: Phase.KNOCKOUT,
      group: null,
      venue: 'Estadio Azteca',
      homeScore: 2,
      awayScore: 1,
      externalId: 'fixture-1',
      homeTeam: {
        id: 'team-home',
        name: 'México',
        code: 'MEX',
        shortCode: 'MEX',
        flagUrl: 'https://example.com/mex.png',
      },
      awayTeam: {
        id: 'team-away',
        name: 'Sudáfrica',
        code: 'RSA',
        shortCode: 'RSA',
        flagUrl: 'https://example.com/rsa.png',
      },
    });

    await service.updateScore('match-1', { homeScore: 2, awayScore: 1 });

    expect(predictionsServiceMock.calculateMatchPoints).toHaveBeenCalledWith('match-1');
    expect(predictionsServiceMock.calculatePhaseBonuses).toHaveBeenCalledWith('match-1');
    expect(predictionReportServiceMock.sendMatchResultsReport).toHaveBeenCalledWith('match-1');
  });
});
