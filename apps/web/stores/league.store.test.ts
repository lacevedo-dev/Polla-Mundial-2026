import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { useLeagueStore } from './league.store';

vi.mock('../api', async () => {
    const actual = await vi.importActual<typeof import('../api')>('../api');
    return {
        ...actual,
        request: vi.fn(),
    };
});

const requestMock = vi.mocked(request);

describe('useLeagueStore', () => {
    beforeEach(() => {
        requestMock.mockReset();
        useLeagueStore.setState({
            activeLeague: null,
            myLeagues: [],
            isLoading: false,
        });
    });

    it('loads leagues and keeps a stable active league surface for the UI', async () => {
        requestMock.mockResolvedValueOnce([
            {
                id: 'league-1',
                name: 'Liga Uno',
                status: 'ACTIVE',
                code: 'ABC123',
                plan: 'FREE',
                rank: 2,
                points: 11,
                _count: { members: 4 },
                members: [{ role: 'ADMIN', status: 'ACTIVE' }],
            },
        ]);

        await useLeagueStore.getState().fetchMyLeagues();

        expect(useLeagueStore.getState().myLeagues).toHaveLength(1);
        expect(useLeagueStore.getState().activeLeague).toMatchObject({
            id: 'league-1',
            name: 'Liga Uno',
            role: 'ADMIN',
            stats: {
                rank: 2,
                points: 11,
                memberCount: 4,
            },
        });
    });

    it('normalizes create-league payloads before calling the backend', async () => {
        requestMock.mockResolvedValueOnce({
            id: 'league-2',
            name: 'Liga Dorada',
            status: 'SETUP',
            privacy: 'PRIVATE',
            plan: 'GOLD',
            code: 'GOLD01',
            members: [{ role: 'ADMIN', status: 'ACTIVE' }],
        });

        await useLeagueStore.getState().createLeague({
            name: 'Liga Dorada',
            description: 'MVP',
            privacy: 'private',
            logo: null,
            participantsCount: 18,
            includeBaseFee: true,
            baseFeeAmount: '25000',
            includeStageFees: false,
            stageFees: {
                match: { active: false, amount: '0' },
                round: { active: false, amount: '0' },
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

        expect(requestMock).toHaveBeenCalledWith('/leagues', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Liga Dorada',
                description: 'MVP',
                privacy: 'PRIVATE',
                maxParticipants: 18,
                includeBaseFee: true,
                baseFee: 25000,
                currency: 'COP',
                plan: 'GOLD',
                includeStageFees: false,
                adminFeePercent: 10,
            }),
        });
        expect(useLeagueStore.getState().activeLeague?.id).toBe('league-2');
    });

    it('loads league details and upserts the normalized result into the store', async () => {
        useLeagueStore.setState({
            activeLeague: null,
            myLeagues: [
                {
                    id: 'league-3',
                    name: 'Liga Editar',
                    role: 'MEMBER',
                    status: 'SETUP',
                    settings: {},
                    stats: {},
                },
            ],
            isLoading: false,
        });

        requestMock.mockResolvedValueOnce({
            id: 'league-3',
            name: 'Liga Editar',
            status: 'ACTIVE',
            members: [
                {
                    role: 'ADMIN',
                    status: 'ACTIVE',
                    user: { id: 'user-1', name: 'Ana' },
                },
            ],
        });

        await useLeagueStore.getState().fetchLeagueDetails('league-3');

        expect(useLeagueStore.getState().myLeagues[0]).toMatchObject({
            id: 'league-3',
            role: 'ADMIN',
            members: [{ name: 'Ana' }],
        });
        expect(useLeagueStore.getState().activeLeague?.id).toBe('league-3');
    });

    it('uses the backend join route/body and preserves existing state on failure', async () => {
        useLeagueStore.setState({
            activeLeague: {
                id: 'league-1',
                name: 'Liga Actual',
                role: 'ADMIN',
                status: 'ACTIVE',
                settings: {},
                stats: { memberCount: 3 },
            },
            myLeagues: [
                {
                    id: 'league-1',
                    name: 'Liga Actual',
                    role: 'ADMIN',
                    status: 'ACTIVE',
                    settings: {},
                    stats: { memberCount: 3 },
                },
            ],
            isLoading: false,
        });

        requestMock.mockRejectedValueOnce(new Error('Código inválido'));

        await expect(useLeagueStore.getState().joinLeague('BAD999')).rejects.toThrow('Código inválido');

        expect(requestMock).toHaveBeenCalledWith('/leagues/join', {
            method: 'POST',
            body: JSON.stringify({ code: 'BAD999' }),
        });
        expect(useLeagueStore.getState().myLeagues).toHaveLength(1);
        expect(useLeagueStore.getState().activeLeague?.id).toBe('league-1');
    });
});
