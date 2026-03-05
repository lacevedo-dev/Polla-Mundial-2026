import { create } from 'zustand';
import { CategoryDistribution, PrizeWinner } from '@polla-2026/shared';

export interface LeagueContext {
    id: string;
    name: string;
    description?: string;
    role: 'admin' | 'user';
    plan: 'free' | 'gold' | 'diamond';
    participants: { current: number; max: number };
    privacy: 'public' | 'private';
    includeBaseFee: boolean;
    baseFeeAmount: string;
    includeStageFees: boolean;
    stageFees: {
        match: { active: boolean; amount: string };
        round: { active: boolean; amount: string };
        phase: { active: boolean; amount: string };
    };
    adminFeePercent: number;
    distributions: {
        general: CategoryDistribution;
        match: CategoryDistribution;
        round: CategoryDistribution;
        phase: CategoryDistribution;
    };
    stats: {
        rank?: number;
        points?: number;
        collected?: string;
        totalPrize?: string;
    };
    code?: string;
}

export interface LeagueSummary {
    id: string;
    name: string;
    role: 'admin' | 'participant';
    rank: number;
    points: number;
    startDate: string;
    totalPlayers: number;
    avatar: string;
    color: string;
    plan: 'free' | 'gold' | 'diamond';
}

export interface PublicLeague {
    id: string;
    name: string;
    members: number;
    maxMembers: number;
    entryFee: string;
    prizePool: string;
    tags: string[];
}

export interface Invite {
    id: string;
    leagueName: string;
    inviterName: string;
    avatar: string;
    expiresIn: string;
}

const getInitialDistribution = (winnersCount: number, adminFee: number): PrizeWinner[] => {
    const prizes: PrizeWinner[] = Array.from({ length: 10 }, (_, i) => ({
        position: i + 1,
        label: `${i + 1}º PUESTO`,
        percentage: 0,
        active: false
    }));
    const netPool = 100 - adminFee;
    const templates: Record<number, number[]> = {
        1: [100], 2: [60, 40], 3: [50, 30, 20], 4: [40, 30, 20, 10], 5: [35, 25, 20, 10, 10],
        6: [30, 20, 15, 15, 10, 10], 7: [25, 20, 15, 10, 10, 10, 10], 8: [20, 15, 15, 10, 10, 10, 10, 10],
        9: [20, 15, 10, 10, 10, 10, 10, 10, 5], 10: [15, 15, 10, 10, 10, 10, 10, 10, 5, 5]
    };
    const weights = templates[winnersCount] || Array(winnersCount).fill(100 / winnersCount);
    let currentSum = 0;
    for (let i = 0; i < winnersCount; i++) {
        prizes[i].active = true;
        let val = Math.round((netPool * (weights[i] / 100)) / 5) * 5;
        if (i === winnersCount - 1) val = netPool - currentSum;
        prizes[i].percentage = val;
        currentSum += val;
    }
    return prizes;
};

const MOCK_LEAGUES_DETAIL: LeagueContext[] = [
    {
        id: 'league-1',
        name: 'LOS CRACKS DEL BARRIO',
        description: 'La liga oficial del barrio para el mundial.',
        role: 'admin',
        plan: 'gold',
        privacy: 'private',
        participants: { current: 24, max: 50 },
        includeBaseFee: true,
        baseFeeAmount: '50000',
        includeStageFees: true,
        stageFees: {
            match: { active: true, amount: '2000' },
            round: { active: true, amount: '5000' },
            phase: { active: false, amount: '10000' }
        },
        adminFeePercent: 10,
        distributions: {
            general: { winnersCount: 3, distribution: getInitialDistribution(3, 10) },
            match: { winnersCount: 1, distribution: getInitialDistribution(1, 10) },
            round: { winnersCount: 1, distribution: getInitialDistribution(1, 10) },
            phase: { winnersCount: 1, distribution: getInitialDistribution(1, 10) }
        },
        stats: { collected: '$1.200k', totalPrize: '$1.080k' },
        code: 'CRACKS-2026'
    },
    {
        id: 'league-2',
        name: 'OFICINA 2026',
        description: 'Solo personal de contabilidad y ventas.',
        role: 'user',
        plan: 'diamond',
        privacy: 'private',
        participants: { current: 156, max: 200 },
        includeBaseFee: true,
        baseFeeAmount: '100000',
        includeStageFees: false,
        stageFees: {
            match: { active: false, amount: '0' },
            round: { active: false, amount: '0' },
            phase: { active: false, amount: '0' }
        },
        adminFeePercent: 5,
        distributions: {
            general: { winnersCount: 5, distribution: getInitialDistribution(5, 5) },
            match: { winnersCount: 1, distribution: getInitialDistribution(1, 5) },
            round: { winnersCount: 1, distribution: getInitialDistribution(1, 5) },
            phase: { winnersCount: 1, distribution: getInitialDistribution(1, 5) }
        },
        stats: { rank: 12, points: 45, totalPrize: '$5.000k' }
    },
    {
        id: 'league-3',
        name: 'FAMILIA PEREZ',
        role: 'user',
        plan: 'free',
        privacy: 'public',
        participants: { current: 8, max: 10 },
        includeBaseFee: false,
        baseFeeAmount: '0',
        includeStageFees: false,
        stageFees: {
            match: { active: false, amount: '0' },
            round: { active: false, amount: '0' },
            phase: { active: false, amount: '0' }
        },
        adminFeePercent: 0,
        distributions: {
            general: { winnersCount: 1, distribution: getInitialDistribution(1, 0) },
            match: { winnersCount: 1, distribution: getInitialDistribution(1, 0) },
            round: { winnersCount: 1, distribution: getInitialDistribution(1, 0) },
            phase: { winnersCount: 1, distribution: getInitialDistribution(1, 0) }
        },
        stats: { rank: 1, points: 12, totalPrize: '$0' }
    }
];

const MOCK_LEAGUES_SUMMARY: LeagueSummary[] = [
    { id: 'league-1', name: 'Los Cracks del Barrio', role: 'admin', rank: 1, points: 120, startDate: '2026-06-11T14:00:00', totalPlayers: 24, avatar: 'LC', color: 'bg-black text-white', plan: 'gold' },
    { id: 'league-2', name: 'Oficina 2026', role: 'participant', rank: 12, points: 45, startDate: '2026-06-11T14:00:00', totalPlayers: 156, avatar: 'OF', color: 'bg-slate-200 text-slate-600', plan: 'free' },
];

const MOCK_PUBLIC_LEAGUES: PublicLeague[] = [
    { id: 'p1', name: 'Global VIP 2026', members: 4500, maxMembers: 5000, entryFee: '$50.000', prizePool: '$200M+', tags: ['Premium', 'Alto Riezgo'] },
    { id: 'p2', name: 'Fiebre Amarilla (Colombia)', members: 12000, maxMembers: 50000, entryFee: 'Gratis', prizePool: '$0', tags: ['Gratis', 'Diversión'] },
    { id: 'p3', name: 'Copa Latinoamericana', members: 230, maxMembers: 500, entryFee: '$10.000', prizePool: '$2M', tags: ['Competitiva', 'Regional'] },
];

const MOCK_PENDING_INVITES: Invite[] = [
    { id: 'i1', leagueName: 'Familia Perez 2026', inviterName: 'Tío Jorge', avatar: 'https://picsum.photos/seed/jorge/40/40', expiresIn: '2 días' }
];

export interface RankingUser {
    id: string;
    rank: number;
    name: string;
    username: string;
    points: number;
    avatar: string;
    trend: 'up' | 'down' | 'stable';
    matchesPredicted: number;
    successRate: number;
}

const MOCK_RANKING: RankingUser[] = [
    { id: '1', rank: 1, name: 'Andrés Mendoza', username: '@amendoza_gol', points: 450, avatar: 'https://picsum.photos/seed/user1/100/100', trend: 'stable', matchesPredicted: 48, successRate: 85 },
    { id: '2', rank: 2, name: 'Sofía Rodríguez', username: '@sofia_predice', points: 435, avatar: 'https://picsum.photos/seed/user2/100/100', trend: 'up', matchesPredicted: 48, successRate: 82 },
    { id: '3', rank: 3, name: 'Carlos Ruiz', username: '@cruiz_crack', points: 420, avatar: 'https://picsum.photos/seed/user3/100/100', trend: 'down', matchesPredicted: 48, successRate: 79 },
    { id: '4', rank: 4, name: 'Valentina López', username: '@val_futbol', points: 410, avatar: 'https://picsum.photos/seed/user4/100/100', trend: 'up', matchesPredicted: 48, successRate: 77 },
    { id: '5', rank: 5, name: 'Diego Torres', username: '@dtorres_stats', points: 395, avatar: 'https://picsum.photos/seed/user5/100/100', trend: 'stable', matchesPredicted: 48, successRate: 75 },
    { id: '6', rank: 6, name: 'Mariana Silva', username: '@mari_gol', points: 380, avatar: 'https://picsum.photos/seed/user6/100/100', trend: 'down', matchesPredicted: 48, successRate: 72 },
    { id: '7', rank: 7, name: 'Javier Ortiz', username: '@javi_polla', points: 375, avatar: 'https://picsum.photos/seed/user7/100/100', trend: 'up', matchesPredicted: 48, successRate: 71 },
    { id: '8', rank: 8, name: 'Lucía Gómez', username: '@lucia_pro', points: 360, avatar: 'https://picsum.photos/seed/user8/100/100', trend: 'stable', matchesPredicted: 48, successRate: 68 },
    { id: '9', rank: 9, name: 'Fernando Paz', username: '@fer_mundial', points: 355, avatar: 'https://picsum.photos/seed/user9/100/100', trend: 'down', matchesPredicted: 48, successRate: 67 },
    { id: '10', rank: 10, name: 'Camila Herrera', username: '@cami_fan', points: 340, avatar: 'https://picsum.photos/seed/user10/100/100', trend: 'up', matchesPredicted: 48, successRate: 64 },
];

interface LeagueState {
    // Estado local para Dashboard (contexto de liga activa)
    activeLeague: LeagueContext | null;
    myLeaguesDetail: LeagueContext[];

    // Estado para Predictions (resumen de ligas)
    myLeaguesSummary: LeagueSummary[];
    publicLeagues: PublicLeague[];
    pendingInvites: Invite[];
    ranking: RankingUser[];

    // Acciones
    setActiveLeague: (leagueId: string) => void;
    createLeague: (leagueData: any) => void;
}

export const useLeagueStore = create<LeagueState>((set, get) => ({
    activeLeague: MOCK_LEAGUES_DETAIL[0],
    myLeaguesDetail: MOCK_LEAGUES_DETAIL,
    myLeaguesSummary: MOCK_LEAGUES_SUMMARY,
    publicLeagues: MOCK_PUBLIC_LEAGUES,
    pendingInvites: MOCK_PENDING_INVITES,
    ranking: MOCK_RANKING,

    setActiveLeague: (leagueId: string) => {
        const league = get().myLeaguesDetail.find(l => l.id === leagueId);
        if (league) {
            set({ activeLeague: league });
        }
    },

    createLeague: (data: any) => {
        const newLeagueDetail: LeagueContext = {
            id: `league-${Math.random().toString(36).substr(2, 9)}`,
            name: data.name || 'Nueva Liga',
            description: data.description,
            role: 'admin',
            plan: data.plan || 'free',
            privacy: data.privacy || 'private',
            participants: { current: 1, max: data.participantsCount || 50 },
            includeBaseFee: data.includeBaseFee,
            baseFeeAmount: data.baseFeeAmount,
            includeStageFees: data.includeStageFees,
            stageFees: data.stageFees,
            adminFeePercent: data.adminFeePercent,
            distributions: data.distributions,
            stats: { collected: '$0', totalPrize: '$0' },
            code: Math.random().toString(36).substr(2, 6).toUpperCase()
        };

        const newLeagueSummary: LeagueSummary = {
            id: newLeagueDetail.id,
            name: newLeagueDetail.name,
            role: 'admin',
            rank: 1,
            points: 0,
            startDate: new Date().toISOString(),
            totalPlayers: 1,
            avatar: newLeagueDetail.name.substring(0, 2).toUpperCase(),
            color: 'bg-indigo-600 text-white',
            plan: newLeagueDetail.plan
        };

        set(state => ({
            myLeaguesDetail: [newLeagueDetail, ...state.myLeaguesDetail],
            myLeaguesSummary: [newLeagueSummary, ...state.myLeaguesSummary],
            activeLeague: newLeagueDetail
        }));
    }
}));
