jest.mock('../prisma/prisma.service', () => ({
    PrismaService: class PrismaService { },
}));

import { MemberRole, MemberStatus } from '@prisma/client';
import { LeaguesService } from './leagues.service';

describe('LeaguesService', () => {
    const createService = (prismaMock: any) => new LeaguesService(prismaMock as any);

    it('creates league with default scoring rules', async () => {
        const prismaMock = {
            league: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({
                    id: 'league-1',
                    members: [],
                    scoringRules: [],
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
        });
    });

    it('does not modify existing leagues when creating a new one', async () => {
        const prismaMock = {
            league: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({
                    id: 'league-2',
                    members: [],
                    scoringRules: [],
                }),
                updateMany: jest.fn(),
                update: jest.fn(),
            },
        };

        const service = createService(prismaMock);
        await service.create('user-2', { name: 'Liga Nueva' } as any);

        expect(prismaMock.league.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.league.updateMany).not.toHaveBeenCalled();
        expect(prismaMock.league.update).not.toHaveBeenCalled();
    });
});
