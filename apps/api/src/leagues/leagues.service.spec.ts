jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { MemberRole, MemberStatus } from '@prisma/client';
import { LeaguesService } from './leagues.service';

describe('LeaguesService', () => {
    const createService = (prismaMock: any, participationMock: any = { createPrincipalObligationForInvitation: jest.fn() }) =>
        new LeaguesService(prismaMock as any, participationMock as any, { createInAppNotification: jest.fn() } as any);

    it('creates league with default scoring rules', async () => {
        const prismaMock = {
            user: {
                findUnique: jest.fn().mockResolvedValue({ plan: 'FREE' }),
            },
            league: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({
                    id: 'league-1',
                    members: [],
                    scoringRules: [],
                    stageFees: [],
                    distributions: [],
                }),
            },
        };

        const service = createService(prismaMock);
        await service.create('user-1', { name: 'Liga Test' } as any);

        expect(prismaMock.league.findUnique).toHaveBeenCalled();
        expect(prismaMock.league.create).toHaveBeenCalledTimes(1);

        const createArgs = prismaMock.league.create.mock.calls[0][0];
        expect(createArgs.data.members.create).toEqual({
            userId: 'user-1',
            role: MemberRole.ADMIN,
            status: MemberStatus.ACTIVE,
        });
        expect(createArgs.data.scoringRules.createMany.data).toEqual([
            { ruleType: 'EXACT_SCORE', points: 5, description: 'Marcador exacto' },
            { ruleType: 'CORRECT_DIFF', points: 3, description: 'Misma diferencia de goles' },
            { ruleType: 'CORRECT_WINNER', points: 2, description: 'Solo ganador/empate' },
        ]);
        expect(createArgs.include).toEqual({
            members: true,
            scoringRules: true,
            stageFees: true,
            distributions: true,
        });
    });

    it('creates pending-payment membership and principal obligation for paid invitations', async () => {
        const participationMock = { createPrincipalObligationForInvitation: jest.fn().mockResolvedValue({}) };
        const prismaMock = {
            invitation: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'inv-1',
                    leagueId: 'league-1',
                    status: 'SENT',
                    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
                    league: {
                        id: 'league-1',
                        name: 'Liga Premium',
                        includeBaseFee: true,
                        baseFee: 25000,
                        maxParticipants: 20,
                        _count: { members: 3 },
                    },
                }),
                update: jest.fn().mockResolvedValue({}),
            },
            leagueMember: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({}),
                update: jest.fn(),
            },
        };

        const service = createService(prismaMock, participationMock);
        const result = await service.acceptInvitation('user-9', 'inv-1');

        expect(prismaMock.leagueMember.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-9',
                leagueId: 'league-1',
                role: MemberRole.PLAYER,
                status: MemberStatus.PENDING_PAYMENT,
            },
        });
        expect(participationMock.createPrincipalObligationForInvitation).toHaveBeenCalledWith({
            userId: 'user-9',
            leagueId: 'league-1',
            deadlineAt: new Date('2026-06-01T00:00:00.000Z'),
        });
        expect(result.status).toBe(MemberStatus.PENDING_PAYMENT);
    });
});
