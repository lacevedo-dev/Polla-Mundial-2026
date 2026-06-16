import { create } from 'zustand';
import { request } from '../api';
import type { CorpRankingResponse, LeaderboardCategory } from '../views/ranking.types';

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
    data: CorpRankingResponse;
    fetchedAt: number;
};

interface RankingStoreState {
    cache: Partial<Record<LeaderboardCategory, CacheEntry>>;
    loadingCategories: Partial<Record<LeaderboardCategory, boolean>>;
    prefetchRanking: (category?: LeaderboardCategory) => Promise<void>;
    fetchRanking: (category?: LeaderboardCategory, options?: { force?: boolean }) => Promise<CorpRankingResponse | null>;
    getCachedRanking: (category?: LeaderboardCategory) => CorpRankingResponse | null;
    isLoadingCategory: (category?: LeaderboardCategory) => boolean;
}

function rankingUrl(category: LeaderboardCategory) {
    return category !== 'GENERAL'
        ? `/corp/ranking?category=${encodeURIComponent(category)}`
        : '/corp/ranking';
}

function isFresh(entry: CacheEntry | undefined) {
    return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS);
}

export const useRankingStore = create<RankingStoreState>((set, get) => ({
    cache: {},
    loadingCategories: {},

    getCachedRanking(category = 'GENERAL') {
        return get().cache[category]?.data ?? null;
    },

    isLoadingCategory(category = 'GENERAL') {
        return Boolean(get().loadingCategories[category]);
    },

    async prefetchRanking(category = 'GENERAL') {
        if (isFresh(get().cache[category])) return;
        await get().fetchRanking(category);
    },

    async fetchRanking(category = 'GENERAL', options = {}) {
        if (!options.force && isFresh(get().cache[category])) {
            return get().cache[category]!.data;
        }

        set((state) => ({
            loadingCategories: { ...state.loadingCategories, [category]: true },
        }));

        try {
            const data = await request<CorpRankingResponse>(rankingUrl(category));
            const resolvedCategory = data.category ?? category;

            set((state) => ({
                cache: {
                    ...state.cache,
                    [resolvedCategory]: { data, fetchedAt: Date.now() },
                },
            }));

            return data;
        } catch {
            return get().cache[category]?.data ?? null;
        } finally {
            set((state) => ({
                loadingCategories: { ...state.loadingCategories, [category]: false },
            }));
        }
    },
}));
