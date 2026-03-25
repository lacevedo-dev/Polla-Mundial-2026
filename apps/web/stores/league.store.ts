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

export interface InvitationItem {
    id: string;
    leagueId: string;
    leagueName: string;
    leagueCode?: string;
    leagueDescription?: string;
    privacy?: 'PUBLIC' | 'PRIVATE';
    plan?: string;
    memberCount?: number;
    maxParticipants?: number | null;
    baseFee?: number | null;
    currency?: string | null;
    primaryTournamentName?: string;
    closePredictionMinutes?: number | null;
    leagueCover?: string;
    inviterName: string;
    inviterUsername?: string;
    expiresAt?: string | null;
}

export interface PublicLeagueItem {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    maxParticipants?: number | null;
    baseFee?: number | null;
    currency?: string | null;
    plan?: string | null;
    cover?: string | null;
}

interface LeagueState {
    activeLeague: LeagueContext | null;
    myLeagues: LeagueContext[];
    invitations: InvitationItem[];
    publicLeagues: PublicLeagueItem[];
    isLoading: boolean;

    fetchMyLeagues: () => Promise<LeagueContext[]>;
    fetchLeagueDetails: (id: string) => Promise<LeagueContext>;
    setActiveLeague: (league: LeagueContext | string | null) => void;
    createLeague: (data: CreateLeagueInput) => Promise<LeagueContext>;
    joinLeague: (code: string) => Promise<void>;
    fetchInvitations: () => Promise<void>;
    fetchPublicLeagues: () => Promise<void>;
    acceptInvitation: (id: string) => Promise<string>;
    declineInvitation: (id: string) => Promise<void>;
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
    invitations: [],
    publicLeagues: [],
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

    fetchInvitations: async () => {
        try {
            const raw = await request<any[]>('/leagues/invitations');
            const invitations: InvitationItem[] = raw.map((inv) => ({
                id: inv.id,
                leagueId: inv.league?.id ?? inv.leagueId,
                leagueName: inv.league?.name ?? '—',
                leagueCode: inv.league?.code ?? undefined,
                leagueDescription: inv.league?.description ?? undefined,
                privacy: inv.league?.privacy ?? 'PRIVATE',
                plan: inv.league?.plan ?? undefined,
                memberCount: inv.league?._count?.members ?? 0,
                maxParticipants: inv.league?.maxParticipants ?? null,
                baseFee: inv.league?.baseFee ?? null,
                currency: inv.league?.currency ?? null,
                primaryTournamentName: inv.league?.primaryTournament?.name ?? undefined,
                closePredictionMinutes: inv.league?.closePredictionMinutes ?? null,
                leagueCover: inv.league?.cover ?? undefined,
                inviterName: inv.inviter?.name ?? 'Alguien',
                inviterUsername: inv.inviter?.username ?? undefined,
                expiresAt: inv.expiresAt ?? null,
            }));
            set({ invitations });
        } catch {
            set({ invitations: [] });
        }
    },

    fetchPublicLeagues: async () => {
        try {
            const raw = await request<any[]>('/leagues/public');
            const publicLeagues: PublicLeagueItem[] = raw.map((l) => ({
                id: l.id,
                name: l.name,
                description: l.description ?? undefined,
                memberCount: l._count?.members ?? 0,
                maxParticipants: l.maxParticipants ?? null,
                baseFee: l.baseFee ?? null,
                currency: l.currency ?? null,
                plan: l.plan ?? null,
                cover: l.cover ?? null,
            }));
            set({ publicLeagues });
        } catch {
            set({ publicLeagues: [] });
        }
    },

    acceptInvitation: async (id) => {
        const res = await request<{ ok: boolean; leagueId: string }>(`/leagues/invitations/${id}/accept`, { method: 'POST' });
        // Remove from list and refresh my leagues
        set((state) => ({ invitations: state.invitations.filter((inv) => inv.id !== id) }));
        const refreshed = await request<LeagueApiResponse[]>('/leagues');
        const normalizedLeagues = refreshed.map(toLeagueContextListItem);
        set((state) => ({
            myLeagues: normalizedLeagues,
            activeLeague: resolveActiveLeague(normalizedLeagues, state.activeLeague),
        }));
        return res.leagueId;
    },

    declineInvitation: async (id) => {
        await request(`/leagues/invitations/${id}/decline`, { method: 'POST' });
        set((state) => ({ invitations: state.invitations.filter((inv) => inv.id !== id) }));
    },
}));
