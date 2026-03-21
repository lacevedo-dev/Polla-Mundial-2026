jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { MemberStatus, ParticipationStatus } from '@prisma/client';
import { ParticipationService } from './participation.service';

describe('ParticipationService', () => {
  const createService = (prismaMock: any, notificationsMock: any = { createInAppNotification: jest.fn() }) =>
    new ParticipationService(prismaMock as any, notificationsMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds available categories and creates pending obligations from selections', async () => {
    const prismaMock = {
      leagueMember: {
        findUnique: jest.fn().mockResolvedValue({ status: MemberStatus.ACTIVE }),
      },
      league: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'league-1',
          name: 'Liga test',
          includeBaseFee: true,
          baseFee: 15000,
          includeStageFees: true,
          closePredictionMinutes: 15,
          currency: 'COP',
          stageFees: [{ type: 'MATCH', amount: 5000, label: 'Partido' }],
          distributions: [],
        }),
      },
      match: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'match-1',
          phase: 'GROUP',
          group: 'A',
          matchDate: new Date('2026-06-01T18:00:00.000Z'),
          homeTeam: { name: 'Colombia' },
          awayTeam: { name: 'Brasil' },
        }),
      },
      participationObligation: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'obl-1',
              category: 'PRINCIPAL',
              referenceId: 'league-1',
              referenceLabel: 'Liga test',
              status: ParticipationStatus.PENDING_PAYMENT,
              unitAmount: 15000,
              multiplier: 2,
              totalAmount: 30000,
              currency: 'COP',
              deadlineAt: new Date('2026-06-01T17:45:00.000Z'),
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
            },
          ]),
        create: jest.fn().mockResolvedValue({ id: 'obl-1' }),
        update: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    const service = createService(prismaMock);

    const options = await service.getAvailableCategories('user-1', 'league-1', 'match-1');
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'PRINCIPAL',
          unitAmount: 15000,
          status: 'UNSELECTED',
        }),
        expect.objectContaining({
          category: 'MATCH',
          referenceId: 'match-1',
          unitAmount: 5000,
        }),
      ]),
    );

    const summary = await service.upsertSelections('user-1', {
      leagueId: 'league-1',
      matchId: 'match-1',
      selections: [
        { category: 'PRINCIPAL' as any, referenceId: 'league-1', multiplier: 2 },
      ],
    });

    expect(prismaMock.participationObligation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: 'PRINCIPAL',
        totalAmount: 30000,
        multiplier: 2,
        source: 'PREDICTION',
      }),
    });
    expect(summary.totalPending).toBe(30000);
    expect(summary.hasPrincipalPending).toBe(true);
  });

  it('activates obligations and pending memberships after payment', async () => {
    const notificationsMock = { createInAppNotification: jest.fn().mockResolvedValue({}) };
    const prismaMock = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          items: JSON.stringify([
            {
              type: 'PARTICIPATION',
              obligationId: 'obl-1',
            },
          ]),
        }),
      },
      participationObligation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'obl-1',
            userId: 'user-1',
            leagueId: 'league-1',
            category: 'PRINCIPAL',
            status: ParticipationStatus.PENDING_PAYMENT,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      leagueMember: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const service = createService(prismaMock, notificationsMock);
    const result = await service.activatePaidObligationsForOrder('order-1', 'pi-1');

    expect(prismaMock.participationObligation.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['obl-1'] }, status: ParticipationStatus.PENDING_PAYMENT },
      data: expect.objectContaining({
        status: ParticipationStatus.PAID,
        orderId: 'order-1',
        paymentId: 'pi-1',
      }),
    });
    expect(prismaMock.leagueMember.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        leagueId: 'league-1',
        status: MemberStatus.PENDING_PAYMENT,
      },
      data: { status: MemberStatus.ACTIVE },
    });
    expect(result).toEqual({ updated: 1, membershipsActivated: 1 });
    expect(notificationsMock.createInAppNotification).toHaveBeenCalled();
  });
});
