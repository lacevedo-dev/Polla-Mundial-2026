import type { LeagueData } from '@polla-2026/shared';
import { create } from 'zustand';
import { request } from '../api';
import {
    toCreateLeagueRequest,
    toLeagueContextDetail,
    toLeagueContextListItem,
    type CreateLeagueRequest,
    type LeagueApiResponse,
    type LeagueContext,
} from './league.adapters';

export type { LeagueContext } from './league.adapters';

type CreateLeagueInput = LeagueData | CreateLeagueRequest;

interface LeagueState {
    activeLeague: LeagueContext | null;
    myLeagues: LeagueContext[];
    isLoading: boolean;

    fetchMyLeagues: () => Promise<LeagueContext[]>;
    fetchLeagueDetails: (id: string) => Promise<LeagueContext>;
    setActiveLeague: (league: LeagueContext | string | null) => void;
    createLeague: (data: CreateLeagueInput) => Promise<LeagueContext>;
    joinLeague: (code: string) => Promise<void>;
}

function upsertLeague(leagues: LeagueContext[], nextLeague: LeagueContext): LeagueContext[] {
    const existingIndex = leagues.findIndex((league) => league.id === nextLeague.id);
    if (existingIndex === -1) {
        return [nextLeague, ...leagues];
    }

    const nextLeagues = [...leagues];
    nextLeagues[existingIndex] = {
        ...nextLeagues[existingIndex],
        ...nextLeague,
    };
    return nextLeagues;
}

function resolveActiveLeague(
    leagues: LeagueContext[],
    currentActiveLeague: LeagueContext | null,
): LeagueContext | null {
    if (!leagues.length) {
        return null;
    }

    if (!currentActiveLeague) {
        return leagues[0];
    }

    return leagues.find((league) => league.id === currentActiveLeague.id) ?? leagues[0];
}

export const useLeagueStore = create<LeagueState>((set, get) => ({
    activeLeague: null,
    myLeagues: [],
    isLoading: false,

    fetchMyLeagues: async () => {
        set({ isLoading: true });
        try {
            const leagues = await request<LeagueApiResponse[]>('/leagues');
            const normalizedLeagues = leagues.map(toLeagueContextListItem);

            set((state) => ({
                myLeagues: normalizedLeagues,
                activeLeague: resolveActiveLeague(normalizedLeagues, state.activeLeague),
                isLoading: false,
            }));

            return normalizedLeagues;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    fetchLeagueDetails: async (id) => {
        set({ isLoading: true });
        try {
            const league = toLeagueContextDetail(await request<LeagueApiResponse>(`/leagues/${id}`));
            set((state) => ({
                myLeagues: upsertLeague(state.myLeagues, league),
                activeLeague: league,
                isLoading: false,
            }));

            return league;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    setActiveLeague: (league) => {
        if (!league) {
            set({ activeLeague: null });
            return;
        }

        if (typeof league === 'string') {
            const nextLeague = get().myLeagues.find((candidate) => candidate.id === league);
            if (nextLeague) {
                set({ activeLeague: nextLeague });
            }
            return;
        }

        set({ activeLeague: league });
    },

    createLeague: async (data) => {
        set({ isLoading: true });
        try {
            const payload = toCreateLeagueRequest(data);
            const createdLeague = toLeagueContextDetail(
                await request<LeagueApiResponse>('/leagues', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                }),
            );

            set((state) => ({
                myLeagues: upsertLeague(state.myLeagues, createdLeague),
                activeLeague: createdLeague,
                isLoading: false,
            }));

            return createdLeague;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    joinLeague: async (code) => {
        const previousState = {
            activeLeague: get().activeLeague,
            myLeagues: get().myLeagues,
        };

        set({ isLoading: true });
        try {
            await request('/leagues/join', {
                method: 'POST',
                body: JSON.stringify({ code }),
            });

            const refreshedLeagues = await request<LeagueApiResponse[]>('/leagues');
            const normalizedLeagues = refreshedLeagues.map(toLeagueContextListItem);

            set({
                myLeagues: normalizedLeagues,
                activeLeague: resolveActiveLeague(normalizedLeagues, previousState.activeLeague),
                isLoading: false,
            });
        } catch (error) {
            set({
                myLeagues: previousState.myLeagues,
                activeLeague: previousState.activeLeague,
                isLoading: false,
            });
            throw error;
        }
    },
}));
