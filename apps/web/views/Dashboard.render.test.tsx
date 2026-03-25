import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useAuthStore } from '../stores/auth.store';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore } from '../stores/prediction.store';
import { useDashboardStore } from '../stores/dashboard.store';

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/dashboard/stats')) {
        return Response.json({ aciertos: 12, errores: 3, racha: 2, tasa: 80 });
    }

    if (url.includes('/dashboard/leagues')) {
        return Response.json({ ligas: [] });
    }

    if (url.includes('/dashboard/performance')) {
        return Response.json([]);
    }

    if (url.includes('/dashboard/predictions/recent')) {
        return Response.json({ predicciones: [] });
    }

    if (url.endsWith('/leagues/league-1')) {
        return Response.json({
            id: 'league-1',
            name: 'Liga Test',
            description: 'Liga para prueba',
            code: 'TEST123',
            status: 'ACTIVE',
            role: 'ADMIN',
            settings: {
                maxParticipants: 20,
                baseFee: 0,
                currency: 'COP',
                plan: 'FREE',
                closePredictionMinutes: 15,
            },
            stats: {
                memberCount: 4,
            },
        });
    }

    if (url.endsWith('/matches')) {
        return Response.json([]);
    }

    if (url.includes('/predictions/league/league-1')) {
        return Response.json([]);
    }

    if (url.includes('/predictions/leaderboard/league-1')) {
        return Response.json([]);
    }

    return Response.json([]);
});

describe('Dashboard render stability', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        localStorage.clear();

        useAuthStore.setState({
            user: {
                id: 'user-1',
                name: 'Test User',
                email: 'test@example.com',
                username: 'test-user',
                role: 'USER',
                emailVerified: true,
            },
            token: 'token',
            isLoading: false,
            emailVerified: true,
        });

        useLeagueStore.setState({
            activeLeague: {
                id: 'league-1',
                name: 'Liga Test',
                description: 'Liga para prueba',
                code: 'TEST123',
                status: 'ACTIVE',
                role: 'ADMIN',
                settings: {
                    maxParticipants: 20,
                    baseFee: 0,
                    currency: 'COP',
                    plan: 'FREE',
                    closePredictionMinutes: 15,
                },
                stats: {
                    memberCount: 4,
                },
            },
            myLeagues: [
                {
                    id: 'league-1',
                    name: 'Liga Test',
                    description: 'Liga para prueba',
                    code: 'TEST123',
                    status: 'ACTIVE',
                    role: 'ADMIN',
                    settings: {
                        maxParticipants: 20,
                        baseFee: 0,
                        currency: 'COP',
                        plan: 'FREE',
                    },
                    stats: {
                        memberCount: 4,
                    },
                },
            ],
            isLoading: false,
            fetchMyLeagues: vi.fn().mockResolvedValue([]),
            fetchLeagueDetails: vi.fn().mockResolvedValue(undefined),
            setActiveLeague: vi.fn(),
        });

        usePredictionStore.setState({
            matches: [],
            leaderboard: [],
            isLoading: false,
            fetchLeagueMatches: vi.fn().mockResolvedValue([]),
            fetchLeaderboard: vi.fn().mockResolvedValue([]),
            resetLeagueData: vi.fn(),
        });

        useDashboardStore.setState({
            stats: {
                aciertos: 12,
                errores: 3,
                racha: 2,
                tasa: 80,
            },
            leagues: [],
            performance: [],
            predictions: [],
            loading: false,
            error: null,
            lastFetchTime: Date.now(),
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        fetchMock.mockClear();
        useDashboardStore.getState().reset();
        usePredictionStore.getState().resetLeagueData();
        useLeagueStore.setState({
            activeLeague: null,
            myLeagues: [],
            isLoading: false,
        });
        useAuthStore.setState({
            user: null,
            token: null,
            isLoading: false,
            emailVerified: false,
        });
    });

    it('renders without entering an infinite re-render loop', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Dashboard />
                </MemoryRouter>,
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Liga Test' })).toBeTruthy();
        });

        expect(screen.getByText(/Código TEST123/i)).toBeTruthy();
    });
});
