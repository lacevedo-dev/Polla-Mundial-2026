import { create } from 'zustand';
import { request } from '../api';

export interface LeagueContext {
    id: string;
    name: string;
    description?: string;
    role: 'ADMIN' | 'MEMBER';
    status: string;
    settings: any;
    stats: {
        rank?: number;
        points?: number;
        collected?: string;
        totalPrize?: string;
        memberCount?: number;
    };
    code?: string;
}

interface LeagueState {
    activeLeague: LeagueContext | null;
    myLeagues: LeagueContext[];
    isLoading: boolean;

    fetchMyLeagues: () => Promise<void>;
    fetchLeagueDetails: (id: string) => Promise<void>;
    setActiveLeague: (league: LeagueContext) => void;
    createLeague: (data: any) => Promise<LeagueContext>;
    joinLeague: (code: string) => Promise<void>;
}

export const useLeagueStore = create<LeagueState>((set, get) => ({
    activeLeague: null,
    myLeagues: [],
    isLoading: false,

    fetchMyLeagues: async () => {
        set({ isLoading: true });
        try {
            const leagues: any = await request('/leagues');
            set({ myLeagues: leagues, isLoading: false });
            if (leagues.length > 0 && !get().activeLeague) {
                set({ activeLeague: leagues[0] });
            }
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    fetchLeagueDetails: async (id: string) => {
        set({ isLoading: true });
        try {
            const league: any = await request(`/leagues/${id}`);
            set({ activeLeague: league, isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    setActiveLeague: (league) => set({ activeLeague: league }),

    createLeague: async (data) => {
        set({ isLoading: true });
        try {
            const league: any = await request('/leagues', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            set(state => ({
                myLeagues: [league, ...state.myLeagues],
                activeLeague: league,
                isLoading: false
            }));
            return league;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    joinLeague: async (code) => {
        set({ isLoading: true });
        try {
            await request(`/leagues/join/${code}`, { method: 'POST' });
            const leagues: any = await request('/leagues');
            set({ myLeagues: leagues, isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    }
}));
