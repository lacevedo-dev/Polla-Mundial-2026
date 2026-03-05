import { create } from 'zustand';
import { request } from '../api';

export interface MatchPrediction {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    date: string;
    status: string;
    prediction: { home: string; away: string };
    result?: { home: number; away: number };
    pointsEarned?: number;
    saved?: boolean;
}

interface PredictionState {
    matches: MatchPrediction[];
    isLoading: boolean;
    fetchMatches: (leagueId: string) => Promise<void>;
    savePrediction: (leagueId: string, matchId: string, home: number, away: number) => Promise<void>;
}

export const usePredictionStore = create<PredictionState>((set) => ({
    matches: [],
    isLoading: false,

    fetchMatches: async (leagueId) => {
        set({ isLoading: true });
        try {
            const data: any = await request(`/matches?leagueId=${leagueId}`);
            // Mapear datos del backend al formato del frontend
            const mapped = data.map((m: any) => ({
                id: m.id,
                homeTeam: m.homeTeam.name,
                awayTeam: m.awayTeam.name,
                homeFlag: m.homeTeam.flag || '🏳️',
                awayFlag: m.awayTeam.flag || '🏳️',
                date: m.date,
                status: m.status,
                prediction: {
                    home: m.predictions?.[0]?.homeScore?.toString() || '',
                    away: m.predictions?.[0]?.awayScore?.toString() || '',
                },
                saved: m.predictions?.length > 0
            }));
            set({ matches: mapped, isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    savePrediction: async (leagueId, matchId, home, away) => {
        try {
            await request('/predictions', {
                method: 'POST',
                body: JSON.stringify({
                    leagueId,
                    matchId,
                    homeScore: home,
                    awayScore: away
                })
            });
            set(state => ({
                matches: state.matches.map(m =>
                    m.id === matchId ? { ...m, prediction: { home: home.toString(), away: away.toString() }, saved: true } : m
                )
            }));
        } catch (error) {
            throw error;
        }
    }
}));
