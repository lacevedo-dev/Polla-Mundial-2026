import { create } from 'zustand';
import { MatchStatus, Phase, Round, CategoryDistribution, PrizeWinner } from '@polla-2026/shared';

export interface AISuggestion {
    label: string;
    type: 'safe' | 'risky' | 'ai';
    score: { home: number; away: number };
    probability: string;
}

export interface MatchPrediction {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    homeIso: string; // ISO code for flag image
    awayIso: string; // ISO code for flag image
    date: string; // ISO Date for sorting
    displayDate: string;
    time: string;
    closeTime: string; // "Cierre en..." text
    status: MatchStatus;
    venue: string;
    city: string;
    phase: Phase;
    phaseName?: string; // e.g. "Primera Fase"
    group?: string;
    round?: Round;
    prediction: { home: string; away: string };
    result?: { home: number; away: number };
    pointsEarned?: number;
    saved?: boolean;
    // Premium Stats Data
    analysis?: {
        winProb: { home: number, draw: number, away: number };
        insight: string;
        recentForm: { home: string[], away: string[] };
        formConclusion: string; // New field for form analysis text
        formBet: string; // New field for specific bet based on form
        suggestions: AISuggestion[];
    };
}

// New Interfaces for Simulator
export interface GroupTeam {
    id: string;
    name: string;
    flag: string;
    iso?: string;
}

export interface GroupData {
    name: string;
    teams: GroupTeam[];
}

const MOCK_MATCHES: MatchPrediction[] = [
    {
        id: 'm1', homeTeam: 'México', awayTeam: 'Sudáfrica', homeFlag: '🇲🇽', awayFlag: '🇿🇦', homeIso: 'mx', awayIso: 'za',
        date: '2026-06-11T14:00:00', displayDate: 'Jueves 11 Junio', time: '14:00', closeTime: '2h 30m',
        status: 'open', venue: 'Estadio Azteca', city: 'Ciudad de México',
        phase: 'group', phaseName: 'Primera Fase', group: 'A', round: 'group',
        prediction: { home: '', away: '' },
        analysis: {
            winProb: { home: 60, draw: 25, away: 15 },
            insight: "México es fuerte en el Azteca. Sudáfrica sufre en altura.",
            recentForm: { home: ['W', 'W', 'D', 'L', 'W'], away: ['L', 'D', 'L', 'W', 'L'] },
            formConclusion: "México domina en casa (3 de 5 ganados). Sudáfrica muestra debilidad defensiva como visitante.",
            formBet: "Local anota +1.5 Goles",
            suggestions: [
                { label: 'Segura', type: 'safe', score: { home: 2, away: 0 }, probability: '65%' },
                { label: 'IA Model', type: 'ai', score: { home: 3, away: 1 }, probability: '45%' },
                { label: 'Arriesgada', type: 'risky', score: { home: 1, away: 1 }, probability: '15%' }
            ]
        }
    },
    {
        id: 'm2', homeTeam: 'Corea del Sur', awayTeam: 'Dinamarca', homeFlag: '🇰🇷', awayFlag: '🇩🇰', homeIso: 'kr', awayIso: 'dk',
        date: '2026-06-11T21:00:00', displayDate: 'Jueves 11 Junio', time: '21:00', closeTime: '9h',
        status: 'open', venue: 'Estadio Akron', city: 'Guadalajara',
        phase: 'group', phaseName: 'Primera Fase', group: 'A', round: 'group',
        prediction: { home: '', away: '' },
        analysis: {
            winProb: { home: 30, draw: 30, away: 40 },
            insight: "Partido muy cerrado táctica y físicamente.",
            recentForm: { home: ['W', 'L', 'D', 'W', 'D'], away: ['W', 'W', 'W', 'L', 'D'] },
            formConclusion: "Ambos equipos vienen irregulares. Dinamarca tiende a empatar en climas cálidos.",
            formBet: "Empate o Baja 2.5",
            suggestions: [
                { label: 'Lógica', type: 'safe', score: { home: 0, away: 1 }, probability: '55%' },
                { label: 'IA Model', type: 'ai', score: { home: 1, away: 1 }, probability: '35%' },
                { label: 'Sorpresa', type: 'risky', score: { home: 2, away: 1 }, probability: '10%' }
            ]
        }
    },
    {
        id: 'm3', homeTeam: 'Canadá', awayTeam: 'Francia', homeFlag: '🇨🇦', awayFlag: '🇫🇷', homeIso: 'ca', awayIso: 'fr',
        date: '2026-06-12T16:00:00', displayDate: 'Viernes 12 Junio', time: '16:00', closeTime: '1d',
        status: 'open', venue: 'BMO Field', city: 'Toronto',
        phase: 'group', phaseName: 'Primera Fase', group: 'B', round: 'group',
        prediction: { home: '', away: '' },
        analysis: {
            winProb: { home: 10, draw: 20, away: 70 },
            insight: "Francia es clara favorita, pero cuidado con el frío.",
            recentForm: { home: ['L', 'L', 'W', 'D', 'L'], away: ['W', 'W', 'W', 'W', 'W'] },
            formConclusion: "Francia viene imparable (5/5 victorias). Canadá sufre contra equipos top europeos.",
            formBet: "Visitante gana a cero",
            suggestions: [
                { label: 'Segura', type: 'safe', score: { home: 0, away: 3 }, probability: '80%' },
                { label: 'IA Model', type: 'ai', score: { home: 1, away: 3 }, probability: '60%' },
                { label: 'Golpe', type: 'risky', score: { home: 1, away: 1 }, probability: '5%' }
            ]
        }
    }
];

const INITIAL_GROUPS: GroupData[] = [
    { name: 'Grupo A', teams: [{ id: 'mx', name: 'México', flag: '🇲🇽', iso: 'mx' }, { id: 'za', name: 'Sudáfrica', flag: '🇿🇦', iso: 'za' }, { id: 'kr', name: 'Corea Sur', flag: '🇰🇷', iso: 'kr' }, { id: 'dk', name: 'Dinamarca', flag: '🇩🇰', iso: 'dk' }] },
    { name: 'Grupo B', teams: [{ id: 'fr', name: 'Francia', flag: '🇫🇷', iso: 'fr' }, { id: 'ca', name: 'Canadá', flag: '🇨🇦', iso: 'ca' }, { id: 'ng', name: 'Nigeria', flag: '🇳🇬', iso: 'ng' }, { id: 'jp', name: 'Japón', flag: '🇯🇵', iso: 'jp' }] },
    { name: 'Grupo C', teams: [{ id: 'us', name: 'USA', flag: '🇺🇸', iso: 'us' }, { id: 'gb-eng', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', iso: 'gb-eng' }, { id: 'ir', name: 'Irán', flag: '🇮🇷', iso: 'ir' }, { id: 'cl', name: 'Chile', flag: '🇨🇱', iso: 'cl' }] },
    { name: 'Grupo D', teams: [{ id: 'br', name: 'Brasil', flag: '🇧🇷', iso: 'br' }, { id: 'co', name: 'Colombia', flag: '🇨🇴', iso: 'co' }, { id: 'pl', name: 'Polonia', flag: '🇵🇱', iso: 'pl' }, { id: 'sa', name: 'Arabia S.', flag: '🇸🇦', iso: 'sa' }] },
];

export interface StandingData {
    pos: number, team: string, iso: string, pj: number, g: number, e: number, p: number, dg: number, pts: number
}

const MOCK_STANDINGS: StandingData[] = [
    { pos: 1, team: 'México', iso: 'mx', pj: 2, g: 2, e: 0, p: 0, dg: 4, pts: 6 },
    { pos: 2, team: 'Dinamarca', iso: 'dk', pj: 2, g: 1, e: 1, p: 0, dg: 2, pts: 4 },
    { pos: 3, team: 'Corea del Sur', iso: 'kr', pj: 2, g: 0, e: 1, p: 1, dg: -2, pts: 1 },
    { pos: 4, team: 'Sudáfrica', iso: 'za', pj: 2, g: 0, e: 0, p: 2, dg: -4, pts: 0 },
];

interface PredictionState {
    matches: MatchPrediction[];
    groups: GroupData[];
    standings: StandingData[];
    // functions
    setPrediction: (matchId: string, home: string, away: string) => void;
    setMatches: (updater: (prev: MatchPrediction[]) => MatchPrediction[]) => void;
    setGroups: (updater: (prev: GroupData[]) => GroupData[]) => void;
    savePrediction: (matchId: string) => Promise<void>;
}

export const usePredictionStore = create<PredictionState>((set) => ({
    matches: MOCK_MATCHES,
    groups: INITIAL_GROUPS,
    standings: MOCK_STANDINGS,

    setMatches: (updater) => set((state) => ({ matches: updater(state.matches) })),
    setGroups: (updater) => set((state) => ({ groups: updater(state.groups) })),

    setPrediction: (matchId, home, away) => set((state) => ({
        matches: state.matches.map(m => m.id === matchId ? { ...m, prediction: { home, away } } : m)
    })),

    savePrediction: async (matchId) => {
        // simulated delay
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                set((state) => ({
                    matches: state.matches.map(m => m.id === matchId ? { ...m, saved: true } : m)
                }));
                resolve();
            }, 600);
        });
    }
}));
