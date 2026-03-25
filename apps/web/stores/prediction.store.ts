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
    fetchLeagueMatches: (leagueId: string, options?: { background?: boolean }) => Promise<MatchViewModel[]>;
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

function arePredictionPayloadsEqual(
    left: MatchViewModel[],
    right: MatchViewModel[],
): boolean {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((current, index) => {
        const next = right[index];
        return (
            current.id === next.id &&
            current.status === next.status &&
            current.date === next.date &&
            current.homeTeam === next.homeTeam &&
            current.awayTeam === next.awayTeam &&
            current.prediction.home === next.prediction.home &&
            current.prediction.away === next.prediction.away &&
            current.prediction.advanceTeamId === next.prediction.advanceTeamId &&
            current.result?.home === next.result?.home &&
            current.result?.away === next.result?.away &&
            current.pointsEarned === next.pointsEarned &&
            current.saved === next.saved &&
            current.advancingTeamId === next.advancingTeamId
        );
    });
}

export const usePredictionStore = create<PredictionState>((set) => ({
    matches: [],
    leaderboard: [],
    isLoading: false,

    fetchLeagueMatches: async (leagueId, options) => {
        if (!options?.background) {
            set({ isLoading: true });
        }
        try {
            const matches = await request<MatchResponse[]>(`/matches?leagueId=${leagueId}`);
            const baseMatches = mergeAndSortMatches(matches, []);
            set((state) => {
                const nextState: Partial<PredictionState> = {};
                if (!arePredictionPayloadsEqual(state.matches, baseMatches)) {
                    nextState.matches = baseMatches;
                }
                if (!options?.background) {
                    nextState.isLoading = false;
                }
                return Object.keys(nextState).length ? nextState as PredictionState : state;
            });

            void request<LeaguePredictionResponse[]>(`/predictions/league/${leagueId}`)
                .then((predictions) => {
                    const nextMatches = mergeAndSortMatches(matches, predictions);
                    set((state) =>
                        arePredictionPayloadsEqual(state.matches, nextMatches)
                            ? state
                            : { matches: nextMatches },
                    );
                })
                .catch((error) => {
                    console.warn('[prediction.store] league predictions could not be loaded', error);
                });

            return baseMatches;
        } catch (error) {
            if (!options?.background) {
                set({ isLoading: false });
            }
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
