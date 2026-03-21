import { create } from 'zustand';
import { request } from '../api';
import {
    mergeLeaguePredictions,
    toLeaderboardRows,
    type LeaderboardApiEntry,
    type LeaderboardRow,
    type LeaguePredictionResponse,
    type MatchResponse,
    type MatchViewModel,
} from './prediction.adapters';

export type { LeaderboardRow, MatchViewModel } from './prediction.adapters';

interface PredictionState {
    matches: MatchViewModel[];
    leaderboard: LeaderboardRow[];
    isLoading: boolean;
    fetchLeagueMatches: (leagueId: string) => Promise<MatchViewModel[]>;
    fetchLeaderboard: (leagueId: string) => Promise<LeaderboardRow[]>;
    savePrediction: (leagueId: string, matchId: string, home: number, away: number) => Promise<void>;
    resetLeagueData: () => void;
}

function sortMatchesByDate(matches: MatchViewModel[]): MatchViewModel[] {
    return [...matches].sort((left, right) => left.date.localeCompare(right.date));
}

export const usePredictionStore = create<PredictionState>((set) => ({
    matches: [],
    leaderboard: [],
    isLoading: false,

    fetchLeagueMatches: async (leagueId) => {
        set({ isLoading: true });
        try {
            const matches = await request<MatchResponse[]>('/matches');
            const predictions = await request<LeaguePredictionResponse[]>(
                `/predictions/league/${leagueId}`,
            );

            const mergedMatches = sortMatchesByDate(mergeLeaguePredictions(matches, predictions));
            set({
                matches: mergedMatches,
                isLoading: false,
            });

            return mergedMatches;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    fetchLeaderboard: async (leagueId) => {
        set({ isLoading: true });
        try {
            const leaderboard = toLeaderboardRows(
                await request<LeaderboardApiEntry[]>(`/predictions/leaderboard/${leagueId}`),
            );

            set({
                leaderboard,
                isLoading: false,
            });

            return leaderboard;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    savePrediction: async (leagueId, matchId, home, away) => {
        await request('/predictions', {
            method: 'POST',
            body: JSON.stringify({
                leagueId,
                matchId,
                homeScore: home,
                awayScore: away,
            }),
        });

        set((state) => ({
            matches: state.matches.map((match) =>
                match.id === matchId
                    ? {
                          ...match,
                          prediction: {
                              home: String(home),
                              away: String(away),
                          },
                          saved: true,
                      }
                    : match,
            ),
        }));
    },

    resetLeagueData: () =>
        set({
            matches: [],
            leaderboard: [],
        }),
}));
