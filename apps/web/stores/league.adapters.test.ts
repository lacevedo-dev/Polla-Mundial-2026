import { describe, expect, it } from 'vitest';
import { toCreateLeagueRequest, toLeagueContextDetail, toLeagueContextListItem } from './league.adapters';

describe('league.adapters', () => {
    it('normalizes the rich create-league wizard payload to the MVP backend DTO', () => {
        const request = toCreateLeagueRequest({
            name: ' Liga del Barrio ',
            description: '  Mundial 2026 ',
            privacy: 'private',
            logo: null,
            participantsCount: 24,
            includeBaseFee: true,
            baseFeeAmount: '50000',
            includeStageFees: true,
            stageFees: {
                match: { active: true, amount: '2000' },
                round: { active: true, amount: '5000' },
                phase: { active: false, amount: '0' },
            },
            adminFeePercent: 10,
            distributions: {
                general: { winnersCount: 3, distribution: [] },
                match: { winnersCount: 1, distribution: [] },
                round: { winnersCount: 1, distribution: [] },
                phase: { winnersCount: 1, distribution: [] },
            },
            currency: 'cop',
            plan: 'gold',
        });

        expect(request).toEqual({
            name: 'Liga del Barrio',
            description: 'Mundial 2026',
            privacy: 'PRIVATE',
            maxParticipants: 24,
            includeBaseFee: true,
            baseFee: 50000,
            currency: 'COP',
            plan: 'GOLD',
        });
    });

    it('maps backend league list items to a stable frontend context', () => {
        const context = toLeagueContextListItem({
            id: 'league-1',
            name: 'Liga Colombia',
            description: 'Predicciones activas',
            code: 'ABC123',
            privacy: 'PUBLIC',
            status: 'ACTIVE',
            maxParticipants: 20,
            includeBaseFee: true,
            baseFee: 10000,
            currency: 'COP',
            plan: 'FREE',
            _count: { members: 12 },
            members: [{ role: 'PLAYER', status: 'ACTIVE' }],
        });

        expect(context).toMatchObject({
            id: 'league-1',
            name: 'Liga Colombia',
            role: 'MEMBER',
            code: 'ABC123',
            settings: {
                privacy: 'PUBLIC',
                maxParticipants: 20,
                baseFee: 10000,
                plan: 'FREE',
            },
            stats: {
                memberCount: 12,
                totalPrize: expect.stringContaining('$'),
            },
        });
    });

    it('maps backend league details including members to the stable frontend context', () => {
        const context = toLeagueContextDetail({
            id: 'league-2',
            name: 'Liga Privada',
            status: 'SETUP',
            privacy: 'PRIVATE',
            members: [
                {
                    role: 'ADMIN',
                    status: 'ACTIVE',
                    user: {
                        id: 'user-1',
                        name: 'Luisa',
                        avatar: '/uploads/avatars/luisa.png',
                    },
                },
                {
                    role: 'PLAYER',
                    status: 'PENDING',
                    user: {
                        id: 'user-2',
                        username: 'carlos10',
                        avatar: null,
                    },
                },
            ],
        });

        expect(context.role).toBe('ADMIN');
        expect(context.stats.memberCount).toBe(2);
        expect(context.members).toEqual([
            {
                id: 'user-1',
                name: 'Luisa',
                role: 'ADMIN',
                status: 'ACTIVE',
                avatar: 'http://localhost:3004/uploads/avatars/luisa.png',
            },
            {
                id: 'user-2',
                name: 'carlos10',
                role: 'MEMBER',
                status: 'PENDING',
                avatar: undefined,
            },
        ]);
    });
});
