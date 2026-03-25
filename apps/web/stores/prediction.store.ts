import { create } from 'zustand';
import { request } from '../api';
import {
    mergeLeaguePredictions,
    toLeaderboardRows,
    type LeaderboardCategory,
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
    fetchLeaderboard: (leagueId: string, category?: LeaderboardCategory) => Promise<LeaderboardRow[]>;
    savePrediction: (leagueId: string, matchId: string, home: number, away: number, advanceTeamId?: string) => Promise<void>;
    resetLeagueData: () => void;
}

function sortMatchesByDate(matches: MatchViewModel[]): MatchViewModel[] {
    return [...matches].sort((left, right) => left.date.localeCompare(right.date));
}

function mergeAndSortMatches(
    matches: MatchResponse[],
    predictions: LeaguePredictionResponse[],
): MatchViewModel[] {
    return sortMatchesByDate(mergeLeaguePredictions(matches, predictions));
}

export const usePredictionStore = create<PredictionState>((set) => ({
    matches: [],
    leaderboard: [],
    isLoading: false,

    fetchLeagueMatches: async (leagueId) => {
        set({ isLoading: true });
        try {
            const matches = await request<MatchResponse[]>(`/matches?leagueId=${leagueId}`);
            const baseMatches = mergeAndSortMatches(matches, []);
            set({
                matches: baseMatches,
                isLoading: false,
            });

            void request<LeaguePredictionResponse[]>(`/predictions/league/${leagueId}`)
                .then((predictions) => {
                    set({
                        matches: mergeAndSortMatches(matches, predictions),
                    });
                })
                .catch((error) => {
                    console.warn('[prediction.store] league predictions could not be loaded', error);
                });

            return baseMatches;
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    fetchLeaderboard: async (leagueId, category = 'GENERAL') => {
        set({ isLoading: true });
        try {
            const query = category !== 'GENERAL'
                ? `?category=${encodeURIComponent(category)}`
                : '';
            const leaderboard = toLeaderboardRows(
                await request<LeaderboardApiEntry[]>(`/predictions/leaderboard/${leagueId}${query}`),
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

    savePrediction: async (leagueId, matchId, home, away, advanceTeamId) => {
        await request('/predictions', {
            method: 'POST',
            body: JSON.stringify({
                leagueId,
                matchId,
                homeScore: home,
                awayScore: away,
                ...(advanceTeamId !== undefined ? { advanceTeamId } : {}),
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
                              advanceTeamId,
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
