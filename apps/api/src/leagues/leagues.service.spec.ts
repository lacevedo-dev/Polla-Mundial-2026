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
                findFirst: jest.fn().mockResolvedValue(null),
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
        expect(createArgs.data.scoringRules.createMany.data).toEqual(expect.arrayContaining([
            { ruleType: 'EXACT_SCORE', points: 5, description: 'Marcador exacto' },
            { ruleType: 'CORRECT_WINNER', points: 2, description: 'Ganador / empate correcto' },
            { ruleType: 'TEAM_GOALS', points: 1, description: 'Gol acertado (al menos un equipo)' },
        ]));
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

    it('creates pending-payment membership and principal obligation when joining a paid public league', async () => {
        const participationMock = { createPrincipalObligationForInvitation: jest.fn().mockResolvedValue({}) };
        const prismaMock = {
            league: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'league-2',
                    code: 'ABCD12',
                    privacy: 'PUBLIC',
                    includeBaseFee: true,
                    baseFee: 18000,
                    maxParticipants: 10,
                    _count: { members: 2 },
                }),
            },
            leagueMember: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({
                    id: 'member-1',
                    status: MemberStatus.PENDING_PAYMENT,
                }),
            },
        };

        const service = createService(prismaMock, participationMock);
        const result = await service.joinLeagueByCode('user-22', 'abcd12');

        expect(prismaMock.leagueMember.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-22',
                leagueId: 'league-2',
                role: MemberRole.PLAYER,
                status: MemberStatus.PENDING_PAYMENT,
            },
        });
        expect(participationMock.createPrincipalObligationForInvitation).toHaveBeenCalledWith({
            userId: 'user-22',
            leagueId: 'league-2',
        });
        expect(result.status).toBe(MemberStatus.PENDING_PAYMENT);
    });

    it('rejects creating a league with a duplicated name', async () => {
        const prismaMock = {
            league: {
                findFirst: jest.fn().mockResolvedValue({ id: 'league-existing', name: 'Liga Test' }),
            },
        };

        const service = createService(prismaMock);

        await expect(service.create('user-1', { name: 'Liga Test' } as any)).rejects.toThrow(
            'Ya existe una polla con ese nombre. Usa un nombre diferente.',
        );
    });

    it('rejects updating a league with a duplicated name', async () => {
        const prismaMock = {
            leagueMember: {
                findUnique: jest.fn().mockResolvedValue({ role: MemberRole.ADMIN }),
            },
            league: {
                findFirst: jest.fn().mockResolvedValue({ id: 'league-existing', name: 'Liga Repetida' }),
            },
        };

        const service = createService(prismaMock);

        await expect(service.updateLeague('user-1', 'league-1', { name: 'Liga Repetida' } as any)).rejects.toThrow(
            'Ya existe una polla con ese nombre. Usa un nombre diferente.',
        );
    });
});
