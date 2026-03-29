import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminMatchesController } from './admin-matches.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesService } from '../matches/matches.service';
import { PredictionsService } from '../predictions/predictions.service';

describe('AdminMatchesController', () => {
  const prismaMock = {
    match: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    prediction: {
      findMany: jest.fn(),
    },
    footballSyncLog: {
      findMany: jest.fn(),
    },
  };

  const matchesServiceMock = {
    create: jest.fn(),
    updateScore: jest.fn(),
  };

  const predictionsServiceMock = {
    calculateMatchPoints: jest.fn(),
    calculatePhaseBonuses: jest.fn(),
  };

  let controller: AdminMatchesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminMatchesController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: MatchesService, useValue: matchesServiceMock },
        { provide: PredictionsService, useValue: predictionsServiceMock },
      ],
    }).compile();

    controller = moduleRef.get(AdminMatchesController);
  });

  it('applies startDate and endDate to matchDate before paginating', async () => {
    prismaMock.match.findMany
      .mockResolvedValueOnce([
        {
          id: 'match-1',
          matchDate: new Date('2026-03-28T10:00:00.000Z'),
          status: 'SCHEDULED',
          phase: 'GROUP',
          homeScore: null,
          awayScore: null,
          externalId: 'fixture-1',
          homeTeam: { id: 'team-1' },
          awayTeam: { id: 'team-2' },
          tournament: { id: 'tournament-1', name: 'World Cup', logoUrl: null },
          syncLogs: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'match-1',
          externalId: 'fixture-1',
          syncLogs: [{ status: 'SUCCESS' }],
        },
      ]);
    prismaMock.match.count.mockResolvedValue(1);
    prismaMock.auditLog.findMany.mockResolvedValue([]);

    const result = await controller.findAll(
      1,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-03-28',
      '2026-03-29',
    );

    expect(prismaMock.match.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          matchDate: {
            gte: new Date('2026-03-28T05:00:00.000Z'),
            lt: new Date('2026-03-30T05:00:00.000Z'),
          },
        },
        skip: 0,
        take: 50,
        orderBy: { matchDate: 'asc' },
      }),
    );
    expect(prismaMock.match.count).toHaveBeenCalledWith({
      where: {
        matchDate: {
          gte: new Date('2026-03-28T05:00:00.000Z'),
          lt: new Date('2026-03-30T05:00:00.000Z'),
        },
      },
    });
    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe('match-1');
  });

  it('rejects malformed date filters before querying Prisma', async () => {
    await expect(
      controller.findAll(
        1,
        50,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'not-a-date',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.match.findMany).not.toHaveBeenCalled();
    expect(prismaMock.match.count).not.toHaveBeenCalled();
  });
});
