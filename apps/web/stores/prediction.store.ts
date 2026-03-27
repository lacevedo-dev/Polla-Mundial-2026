import { create } from 'zustand';
import { request } from '../api';
import {
    mergeLeaguePredictions,
    toLeaderboardBreakdown,
    toLeaderboardRows,
    type LeaderboardBreakdown,
    type LeaderboardBreakdownApiResponse,
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
    leaderboardBreakdowns: Record<string, LeaderboardBreakdown>;
    isLoading: boolean;
    fetchLeagueMatches: (leagueId: string, options?: { background?: boolean }) => Promise<MatchViewModel[]>;
    fetchLeaderboard: (leagueId: string, category?: LeaderboardCategory) => Promise<LeaderboardRow[]>;
    fetchLeaderboardBreakdown: (leagueId: string, userId: string, category?: LeaderboardCategory) => Promise<LeaderboardBreakdown>;
    savePrediction: (leagueId: string, matchId: string, home: number, away: number, advanceTeamId?: string) => Promise<void>;
    resetLeagueData: () => void;
    goalEvents: GoalEvent[];
    clearGoalEvent: (id: string) => void;
    updateMatchLiveScore: (matchId: string, homeScore: number | null, awayScore: number | null, status: string, elapsed?: number | null, statusShort?: string | null) => void;
}

export interface GoalEvent {
    id: string;
    matchId: string;
    team: 'home' | 'away';
    teamName: string;
    homeScore: number;
    awayScore: number;
    elapsed: number | null;
    at: number; // timestamp ms
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
    leaderboardBreakdowns: {},
    isLoading: false,
    goalEvents: [],

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

    fetchLeaderboardBreakdown: async (leagueId, userId, category = 'GENERAL') => {
        const query = category !== 'GENERAL'
            ? `?category=${encodeURIComponent(category)}`
            : '';
        const breakdown = toLeaderboardBreakdown(
            await request<LeaderboardBreakdownApiResponse>(
                `/predictions/leaderboard/${leagueId}/user/${userId}${query}`,
            ),
        );

        set((state) => ({
            leaderboardBreakdowns: {
                ...state.leaderboardBreakdowns,
                [`${leagueId}:${category}:${userId}`]: breakdown,
            },
        }));

        return breakdown;
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
            leaderboardBreakdowns: {},
        }),

    clearGoalEvent: (id) =>
        set((state) => ({ goalEvents: state.goalEvents.filter((g) => g.id !== id) })),

    updateMatchLiveScore: (matchId, homeScore, awayScore, status, elapsed, statusShort) => {
        set((state) => {
            const prev = state.matches.find((m) => m.id === matchId);
            const newGoals: GoalEvent[] = [];

            if (prev && homeScore !== null && awayScore !== null) {
                const prevHome = prev.result?.home ?? 0;
                const prevAway = prev.result?.away ?? 0;
                if (homeScore > prevHome && prev.status === 'live') {
                    newGoals.push({
                        id: `${matchId}-h-${homeScore}-${Date.now()}`,
                        matchId,
                        team: 'home',
                        teamName: prev.homeTeam,
                        homeScore,
                        awayScore,
                        elapsed: elapsed ?? null,
                        at: Date.now(),
                    });
                }
                if (awayScore > prevAway && prev.status === 'live') {
                    newGoals.push({
                        id: `${matchId}-a-${awayScore}-${Date.now()}`,
                        matchId,
                        team: 'away',
                        teamName: prev.awayTeam,
                        homeScore,
                        awayScore,
                        elapsed: elapsed ?? null,
                        at: Date.now(),
                    });
                }
            }

            const normalizedStatus = status === 'LIVE' ? 'live' : status === 'FINISHED' ? 'finished' : status === 'SCHEDULED' ? 'open' : (prev?.status ?? 'open');
            return {
                matches: state.matches.map((m) => {
                    if (m.id !== matchId) return m;
                    return {
                        ...m,
                        status: normalizedStatus as MatchViewModel['status'],
                        result: homeScore !== null && awayScore !== null
                            ? { home: homeScore, away: awayScore }
                            : m.result,
                        elapsed: elapsed ?? m.elapsed,
                        statusShort: statusShort ?? m.statusShort,
                    };
                }),
                goalEvents: [...state.goalEvents, ...newGoals],
            };
        });
    },
}));
