
import React from 'react';
import {
    AlertCircle,
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    BarChart3,
    Brain,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    GitMerge,
    LayoutGrid,
    Lock,
    Medal,
    Save,
    Search,
    Sparkles,
    Trophy,
    Zap,
} from 'lucide-react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { useLeagueStore } from '../stores/league.store';
import { usePredictionStore, type MatchViewModel } from '../stores/prediction.store';
import { useConfigStore } from '../stores/config.store';
import { useAuthStore } from '../stores/auth.store';
import { useAiCredits } from '../hooks/useAiCredits';

type DraftMap = Record<string, { home: string; away: string }>;
type PhaseFilter = 'ALL' | 'GROUP' | 'KNOCKOUT';

interface SimulatorTeam {
    id: string;
    name: string;
    iso: string;
}

interface SimulatorGroup {
    name: string;
    teams: SimulatorTeam[];
}

const INITIAL_GROUPS: SimulatorGroup[] = [
    {
        name: 'Grupo A',
        teams: [
            { id: 'mx', name: 'México', iso: 'mx' },
            { id: 'za', name: 'Sudáfrica', iso: 'za' },
            { id: 'kr', name: 'Corea Sur', iso: 'kr' },
            { id: 'dk', name: 'Dinamarca', iso: 'dk' },
        ],
    },
    {
        name: 'Grupo B',
        teams: [
            { id: 'fr', name: 'Francia', iso: 'fr' },
            { id: 'ca', name: 'Canadá', iso: 'ca' },
            { id: 'ng', name: 'Nigeria', iso: 'ng' },
            { id: 'jp', name: 'Japón', iso: 'jp' },
        ],
    },
    {
        name: 'Grupo C',
        teams: [
            { id: 'us', name: 'USA', iso: 'us' },
            { id: 'gb-eng', name: 'Inglaterra', iso: 'gb-eng' },
            { id: 'ir', name: 'Irán', iso: 'ir' },
            { id: 'cl', name: 'Chile', iso: 'cl' },
        ],
    },
    {
        name: 'Grupo D',
        teams: [
            { id: 'br', name: 'Brasil', iso: 'br' },
            { id: 'co', name: 'Colombia', iso: 'co' },
            { id: 'pl', name: 'Polonia', iso: 'pl' },
            { id: 'sa', name: 'Arabia S.', iso: 'sa' },
        ],
    },
];


function buildDrafts(matches: MatchViewModel[]): DraftMap {
    return Object.fromEntries(
        matches.map((match) => [
            match.id,
            {
                home: match.prediction.home,
                away: match.prediction.away,
            },
        ]),
    );
}

function normalizePhase(phase?: string | null): 'GROUP' | 'KNOCKOUT' {
    return phase?.toUpperCase() === 'GROUP' ? 'GROUP' : 'KNOCKOUT';
}

function toDisplayPhase(phase?: string | null): string {
    return normalizePhase(phase) === 'GROUP' ? 'Fase de grupos' : 'Eliminatorias';
}

function summarizeCloseTime(matchDate: string): string {
    const diffMs = new Date(matchDate).getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) {
        return 'Cerrado';
    }

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const totalDays = Math.floor(totalHours / 24);

    if (totalDays > 0) {
        return totalDays === 1 ? '1 día' : `${totalDays} días`;
    }

    if (totalHours > 0) {
        return `${totalHours}h`;
    }

    const totalMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${totalMinutes}m`;
}

// Smart Insights credit caps — fallback values used before config loads from /config/plans.
// The admin configures actual values via the Admin Panel → Planes.
const SI_PLAN_CREDITS_FALLBACK: Record<string, number> = {
    FREE: 3,
    GOLD: 30,
    DIAMOND: 100,
};

function getSiCreditKey(plan: string): string {
    return `polla_si_credits_${plan.toUpperCase()}`;
}

function getSiCredits(plan: string, cap: number): number {
    try {
        const stored = localStorage.getItem(getSiCreditKey(plan));
        if (stored === null) return cap;
        try {
            const parsed = JSON.parse(stored) as { credits: number; cap: number };
            if (parsed && typeof parsed === 'object' && 'cap' in parsed) {
                // If admin changed the cap, reset credits to the new cap
                if (parsed.cap !== cap) return cap;
                return Number.isNaN(parsed.credits) ? cap : Math.max(0, parsed.credits);
            }
        } catch { /* fall through to legacy parse */ }
        // Legacy: plain number stored
        const n = Number.parseInt(stored, 10);
        return Number.isNaN(n) ? cap : Math.max(0, n);
    } catch {
        return cap;
    }
}

function consumeSiCredit(plan: string, cap: number): number {
    try {
        const next = Math.max(0, getSiCredits(plan, cap) - 1);
        localStorage.setItem(getSiCreditKey(plan), JSON.stringify({ credits: next, cap, storedAt: new Date().toISOString() }));
        return next;
    } catch {
        return 0;
    }
}

function clearSiCreditsIfReset(plan: string, globalResetAt: string | null, userResetAt?: string | null): void {
    // Use the most recent of the two reset timestamps (global vs per-user)
    const resetAt = globalResetAt && userResetAt
        ? (userResetAt > globalResetAt ? userResetAt : globalResetAt)
        : (userResetAt ?? globalResetAt);
    if (!resetAt) return;
    try {
        const stored = localStorage.getItem(getSiCreditKey(plan));
        if (!stored) return;
        const parsed = JSON.parse(stored) as { storedAt?: string };
        const storedAt = parsed.storedAt ?? '1970-01-01T00:00:00.000Z';
        if (resetAt > storedAt) {
            localStorage.removeItem(getSiCreditKey(plan));
        }
    } catch { /* ignore */ }
}

// Persistent cache for AI insights — avoids re-fetching and re-consuming credits.
// Stored in localStorage with a 24-hour TTL so users never pay credits for a match
// they already analyzed, even across page reloads or tab closes.
const INSIGHTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getInsightsCacheKey(matchId: string): string {
    return `polla_insights_v5_${matchId}`;
}

function getCachedInsights(matchId: string): object | null {
    try {
        const raw = localStorage.getItem(getInsightsCacheKey(matchId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data: object; cachedAt: string };
        if (!parsed?.data || !parsed?.cachedAt) return null;
        const age = Date.now() - new Date(parsed.cachedAt).getTime();
        if (age > INSIGHTS_CACHE_TTL_MS) {
            localStorage.removeItem(getInsightsCacheKey(matchId));
            return null;
        }
        return parsed.data;
    } catch {
        return null;
    }
}

function setCachedInsights(matchId: string, data: object): void {
    try {
        localStorage.setItem(getInsightsCacheKey(matchId), JSON.stringify({ data, cachedAt: new Date().toISOString() }));
    } catch {}
}

function simpleHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function generateMatchInsights(match: MatchViewModel) {
    const h = simpleHash(match.id || match.homeTeam + match.awayTeam);
    const homeWin = 30 + (h % 26);
    const draw = 15 + ((h >> 4) % 16);
    const awayWin = Math.max(5, 100 - homeWin - draw);
    const picks = ['W', 'D', 'L'] as const;
    const homeForm = Array.from({ length: 5 }, (_, i) => picks[(h >> i) % 3]);
    const awayForm = Array.from({ length: 5 }, (_, i) => picks[(h >> (i + 5)) % 3]);
    const scores = [
        `${(h >> 1) % 3}-${(h >> 2) % 2}`,
        '1-1',
        `${(h >> 3) % 2}-${((h >> 4) % 3) + 1}`,
    ];
    const smartPick =
        homeWin > awayWin + 10 ? match.homeTeam : awayWin > homeWin + 10 ? match.awayTeam : 'Empate';

    // Generar insights personalizados
    const insights = [
        'Bloque medio y transiciones rápidas marcarán un duelo de márgenes cortos.',
        'Predominio en la zona central podría definir el control del encuentro.',
        'Presión alta y recuperación rápida serán claves en este enfrentamiento.',
        'El juego aéreo y pelotas paradas pueden marcar la diferencia.',
        'Velocidad en las bandas contra solidez defensiva será el contraste principal.',
        'Experiencia en torneos internacionales favorece a uno de los equipos.',
    ];
    const insight = insights[h % insights.length];

    const personalInsights = [
        'Tu historial sugiere que valores la solidez defensiva en partidos equilibrados.',
        'Históricamente has apostado por resultados conservadores en fases de grupos.',
        'Tiendes a confiar en el favorito local cuando hay poca diferencia de nivel.',
        'Tus pronósticos recientes muestran preferencia por marcadores bajos.',
    ];
    const personalInsight = personalInsights[h % personalInsights.length];

    return { homeWin, draw, awayWin, homeForm, awayForm, scores, smartPick, insight, personalInsight };
}

function formatFriendlyDate(isoDate: string): string {
    const date = new Date(isoDate + 'T12:00:00Z');
    if (Number.isNaN(date.getTime())) return isoDate;
    const parts = new Intl.DateTimeFormat('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
    }).formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    return `${weekday} ${day} ${month}`.toUpperCase();
}

function formatMatchTime(matchDate: string): string {
    const date = new Date(matchDate);
    if (Number.isNaN(date.getTime())) {
        return '--:--';
    }

    return new Intl.DateTimeFormat('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

function getMatchStatusLabel(status: MatchViewModel['status']): string {
    switch (status) {
        case 'live':
            return 'En vivo';
        case 'finished':
            return 'Finalizado';
        case 'closed':
            return 'Cerrado';
        default:
            return 'Abierto';
    }
}

function getMatchStatusClasses(status: MatchViewModel['status']): string {
    switch (status) {
        case 'live':
            return 'border-rose-200 bg-rose-50 text-rose-600';
        case 'finished':
            return 'border-slate-200 bg-slate-100 text-slate-600';
        case 'closed':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        default:
            return 'border-lime-200 bg-lime-50 text-lime-700';
    }
}

interface TeamIdentityProps {
    name: string;
    code: string;
    flag: string;
    align?: 'left' | 'right';
}

function TeamIdentity({ name, code, flag, align = 'left' }: TeamIdentityProps) {
    const isRight = align === 'right';

    return (
        <div className={`flex min-w-0 flex-1 items-center gap-2 ${isRight ? 'justify-end text-right' : 'justify-start text-left'}`}>
            {/* Mobile: vertical layout (flag on top, code below) */}
            <div className="flex flex-col items-center gap-1 sm:hidden" title={name}>
                <img
                    src={flag}
                    alt={name}
                    className="h-8 w-11 rounded-md border border-slate-200 object-cover shadow-sm"
                />
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">{code}</span>
            </div>

            {/* Desktop: horizontal layout (original) */}
            {isRight ? (
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                    <div className="min-w-0">
                        <span className="block truncate text-xs font-black uppercase text-slate-900">{name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{code}</span>
                    </div>
                    <img
                        src={flag}
                        alt={name}
                        className="h-7 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
                    />
                </div>
            ) : (
                <div className="hidden min-w-0 items-center gap-2 sm:flex">
                    <img
                        src={flag}
                        alt={name}
                        className="h-7 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                        <span className="block truncate text-xs font-black uppercase text-slate-900">{name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{code}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ScoreControlProps {
    teamName: string;
    side: 'local' | 'visitante';
    value: string;
    onChange: (value: string) => void;
    onAdjust: (delta: number) => void;
    disabled?: boolean;
    onEnter?: () => void;
    inputRef?: React.RefObject<HTMLInputElement> | ((el: HTMLInputElement | null) => void);
}

function ScoreControl({ teamName, side, value, onChange, onAdjust, disabled = false, onEnter, inputRef }: ScoreControlProps) {
    const label = `Marcador ${side} para ${teamName}`;

    return (
        <>
            {/* Mobile: numeric input only (no +/- buttons) */}
            <input
                ref={inputRef}
                type="tel"
                min={0}
                max={99}
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={label}
                disabled={disabled}
                value={value}
                onChange={(event) => {
                    const newValue = event.target.value;
                    onChange(newValue);
                    // Auto-advance cuando ingresa un número válido
                    if (newValue && /^\d+$/.test(newValue) && onEnter) {
                        setTimeout(() => onEnter(), 150);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && onEnter) {
                        event.preventDefault();
                        onEnter();
                    }
                }}
                placeholder="0"
                className="h-12 w-14 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20 disabled:opacity-60 sm:hidden"
            />

            {/* Desktop: original layout with +/- buttons */}
            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1 shadow-sm shadow-slate-100 sm:flex">
                <button
                    type="button"
                    onClick={() => onAdjust(-1)}
                    disabled={disabled}
                    aria-label={`Disminuir ${label.toLowerCase()}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                >
                    −
                </button>
                <input
                    type="number"
                    min={0}
                    max={99}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={label}
                    disabled={disabled}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white disabled:opacity-60"
                />
                <button
                    type="button"
                    onClick={() => onAdjust(1)}
                    disabled={disabled}
                    aria-label={`Aumentar ${label.toLowerCase()}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                >
                    +
                </button>
            </div>
        </>
    );
}

type InsightsPayload = ReturnType<typeof generateMatchInsights> & {
    insight?: string;
    personalInsight?: string;
};

interface CompactMatchRowProps {
    match: MatchViewModel;
    draft: { home: string; away: string };
    isExpanded: boolean;
    isSaving: boolean;
    isDirty: boolean;
    canEdit: boolean;
    speedMode: boolean;
    cachedInsights: object | null;
    insightsLoading: boolean;
    analysisMatchId: string | null;
    siCredits: number;
    planCap: number;
    onToggleExpand: () => void;
    onDraftChange: (field: 'home' | 'away', value: string) => void;
    onSave: () => void;
    onHomeInputRef: (el: HTMLInputElement | null) => void;
    onAwayInputRef: (el: HTMLInputElement | null) => void;
    onHomeEnter: () => void;
    onAwayEnter: () => void;
    onRequestInsights: () => void;
    onApplySuggestedScore: (home: string, away: string) => void;
    onCollapseOthers: () => void;
}

function CompactMatchRow({
    match,
    draft,
    isExpanded,
    isSaving,
    isDirty,
    canEdit,
    speedMode,
    cachedInsights,
    insightsLoading,
    analysisMatchId,
    siCredits,
    planCap,
    onToggleExpand,
    onDraftChange,
    onSave,
    onHomeInputRef,
    onAwayInputRef,
    onHomeEnter,
    onAwayEnter,
    onRequestInsights,
    onApplySuggestedScore,
    onCollapseOthers,
}: CompactMatchRowProps) {
    const [insightsLevel, setInsightsLevel] = React.useState<'none' | 'suggestions' | 'full'>('none');
    const hasBeenConsulted = cachedInsights !== null;
    // Si NO está en speed mode, mostrar vista expandida completa
    if (!speedMode) {
        return (
            <div className="border-b border-slate-100 px-3 py-3 last:border-b-0">
                <div className="space-y-2.5">
                    {/* Header con hora y estado */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{formatMatchTime(match.date)}</span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-amber-500">
                                {summarizeCloseTime(match.date)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {match.saved && <CheckCircle2 className="h-4 w-4 text-lime-600" />}
                            {isDirty && !isSaving && <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                            {isSaving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-lime-600" />}
                        </div>
                    </div>

                    {/* Equipos y marcadores (layout vertical mejorado) */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        {/* Home team - vertical */}
                        <div className="flex flex-col items-center gap-1">
                            <img src={match.homeFlag} alt={match.homeTeamCode} className="h-8 w-11 rounded-md border border-slate-200 object-cover shadow-sm" />
                            <span className="text-xs font-black uppercase text-slate-900">{match.homeTeamCode}</span>
                        </div>

                        {/* Score inputs */}
                        {canEdit ? (
                            <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-1.5 py-1 shadow-sm ring-1 ring-slate-200">
                                <input
                                    ref={onHomeInputRef}
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={draft.home}
                                    onChange={(e) => onDraftChange('home', e.target.value)}
                                    placeholder="0"
                                    className="h-12 w-14 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
                                />
                                <span className="px-0.5 text-base font-black text-slate-300">-</span>
                                <input
                                    ref={onAwayInputRef}
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={draft.away}
                                    onChange={(e) => onDraftChange('away', e.target.value)}
                                    placeholder="0"
                                    className="h-12 w-14 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
                                />
                            </div>
                        ) : (
                            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="text-sm font-black text-slate-900">{draft.home || '−'}</span>
                                <span className="text-sm font-black text-slate-300">:</span>
                                <span className="text-sm font-black text-slate-900">{draft.away || '−'}</span>
                            </div>
                        )}

                        {/* Away team - vertical */}
                        <div className="flex flex-col items-center gap-1">
                            <img src={match.awayFlag} alt={match.awayTeamCode} className="h-8 w-11 rounded-md border border-slate-200 object-cover shadow-sm" />
                            <span className="text-xs font-black uppercase text-slate-900">{match.awayTeamCode}</span>
                        </div>
                    </div>

                    {/* Info y botones de acción */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1 text-[9px]">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold uppercase text-slate-500">
                                {toDisplayPhase(match.phase)}
                            </span>
                            {match.group && (
                                <span className="rounded-full bg-white px-2 py-0.5 font-bold uppercase text-slate-500 ring-1 ring-inset ring-slate-200">
                                    G{match.group}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {/* Botón IA */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCollapseOthers();
                                    if (!cachedInsights && !insightsLoading) {
                                        onRequestInsights();
                                    }
                                    setInsightsLevel(insightsLevel === 'none' ? 'suggestions' : 'none');
                                }}
                                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                                    hasBeenConsulted
                                        ? 'bg-violet-100 text-violet-600 ring-2 ring-violet-200'
                                        : insightsLoading && analysisMatchId === match.id
                                        ? 'bg-amber-100 text-amber-600'
                                        : 'border border-slate-200 bg-white text-slate-400 hover:bg-violet-50 hover:text-violet-600'
                                }`}
                            >
                                {insightsLoading && analysisMatchId === match.id ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                                ) : (
                                    <Brain className="h-4 w-4" />
                                )}
                            </button>

                            {/* Botón guardar */}
                            {canEdit && (
                                <button
                                    onClick={onSave}
                                    disabled={isSaving}
                                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:opacity-60 ${
                                        isDirty || match.saved
                                            ? 'bg-lime-400 text-slate-900 hover:bg-lime-300'
                                            : 'border border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                    }`}
                                >
                                    {isSaving
                                        ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                                        : match.saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />
                                    }
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Panel de insights para modo no compacto */}
                    {insightsLevel !== 'none' && cachedInsights && (
                        <div className="animate-slideDown mt-2 overflow-hidden rounded-xl border border-violet-100 bg-gradient-to-b from-violet-50 to-white">
                            {/* Nivel 2: Sugerencias */}
                            <div className="px-3 py-2.5">
                                {(() => {
                                    const ins = (cachedInsights ?? generateMatchInsights(match)) as InsightsPayload;
                                    const scoreLabels = ['SEGURA', 'IA MODEL', 'ARRIESGADA'] as const;
                                    const scoreStyles = [
                                        'bg-lime-100 text-lime-700 border-lime-200',
                                        'bg-violet-100 text-violet-700 border-violet-200',
                                        'bg-amber-100 text-amber-700 border-amber-200',
                                    ] as const;

                                    return (
                                        <>
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Sparkles className="h-3 w-3 text-violet-500" />
                                                    <span className="text-[8px] font-black uppercase tracking-wider text-violet-600">Sugerencias IA</span>
                                                    {hasBeenConsulted && (
                                                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-purple-600">IA</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-[8px]">
                                                    <span className="font-bold text-slate-500">{siCredits}/{planCap}</span>
                                                    <span className="text-slate-400">créditos</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-1.5">
                                                {ins.scores.map((score, idx) => {
                                                    const [h, a] = score.split('-');
                                                    const probs = [ins.homeWin, ins.draw, ins.awayWin];
                                                    return (
                                                        <button
                                                            key={score + idx}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onApplySuggestedScore(h, a);
                                                            }}
                                                            className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 transition-all active:scale-95 ${scoreStyles[idx]}`}
                                                        >
                                                            <span className="text-[7px] font-black uppercase tracking-wider opacity-80">{scoreLabels[idx]}</span>
                                                            <span className="text-lg font-black leading-none">{score}</span>
                                                            <span className="text-[7px] font-bold opacity-70">{probs[idx]}%</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {insightsLevel === 'suggestions' && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInsightsLevel('full');
                                                    }}
                                                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-violet-200 bg-white py-1.5 text-[9px] font-black uppercase tracking-wider text-violet-600 transition-colors hover:bg-violet-50"
                                                >
                                                    <ChevronDown className="h-3 w-3" />
                                                    Ver análisis completo
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Nivel 3: Análisis completo */}
                            {insightsLevel === 'full' && (
                                <div className="animate-slideDown border-t border-violet-100 px-3 py-2.5">
                                    {(() => {
                                        const ins = (cachedInsights ?? generateMatchInsights(match)) as InsightsPayload;
                                        return (
                                            <>
                                                {ins.insight && (
                                                    <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
                                                        <Sparkles className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-500" />
                                                        <p className="text-[9px] font-medium leading-relaxed text-slate-700">"{ins.insight}"</p>
                                                    </div>
                                                )}

                                                <div className="mb-2">
                                                    <div className="mb-1 flex justify-between text-[8px] font-bold uppercase">
                                                        <span className="text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                                                        <span className="text-slate-400">Empate</span>
                                                        <span className="text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                                                    </div>
                                                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="bg-slate-900 transition-all" style={{ width: `${ins.homeWin}%` }} />
                                                        <div className="bg-slate-300 transition-all" style={{ width: `${ins.draw}%` }} />
                                                        <div className="bg-lime-400 transition-all" style={{ width: `${ins.awayWin}%` }} />
                                                    </div>
                                                    <div className="mt-0.5 flex justify-between">
                                                        <span className="text-[8px] font-black text-slate-900">{ins.homeWin}%</span>
                                                        <span className="text-[8px] font-black text-slate-400">{ins.draw}%</span>
                                                        <span className="text-[8px] font-black text-slate-900">{ins.awayWin}%</span>
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                                                    <div className="mb-1 flex items-center gap-1">
                                                        <BarChart3 className="h-2.5 w-2.5 text-indigo-500" />
                                                        <span className="text-[7px] font-black uppercase tracking-wider text-indigo-600">Últimos 5</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex gap-0.5">
                                                            {ins.homeForm.map((r, i) => (
                                                                <span key={i} className={`flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                                            ))}
                                                        </div>
                                                        <span className="text-[8px] font-black text-indigo-600">VS</span>
                                                        <div className="flex gap-0.5">
                                                            {ins.awayForm.map((r, i) => (
                                                                <span key={i} className={`flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setInsightsLevel('suggestions');
                                                    }}
                                                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-violet-200 bg-white py-1.5 text-[9px] font-black uppercase tracking-wider text-violet-600 transition-colors hover:bg-violet-50"
                                                >
                                                    <ChevronUp className="h-3 w-3" />
                                                    Ocultar detalles
                                                </button>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Speed mode: Vista ultra-compacta de una línea
    return (
        <div className="overflow-hidden border-b border-slate-100 last:border-b-0">
            {/* Compact row - one line */}
            <button
                type="button"
                onClick={onToggleExpand}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 sm:hidden"
            >
                <span className="shrink-0 text-[10px] font-black text-slate-500">{formatMatchTime(match.date)}</span>

                {/* Home team */}
                <div className="flex min-w-0 items-center gap-1">
                    <img src={match.homeFlag} alt={match.homeTeamCode} className="h-5 w-7 rounded border border-slate-200 object-cover" />
                    <span className="text-[10px] font-black uppercase text-slate-900">{match.homeTeamCode}</span>
                </div>

                {/* Score or inputs */}
                {canEdit && isExpanded ? (
                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                            ref={onHomeInputRef}
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={draft.home}
                            onChange={(e) => {
                                onDraftChange('home', e.target.value);
                                if (e.target.value && /^\d+$/.test(e.target.value)) {
                                    setTimeout(() => onHomeEnter(), 150);
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-10 rounded-lg border-2 border-lime-400 bg-white text-center text-sm font-black text-slate-900 outline-none ring-2 ring-lime-400/20"
                        />
                        <span className="text-xs font-black text-slate-300">-</span>
                        <input
                            ref={onAwayInputRef}
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={draft.away}
                            onChange={(e) => {
                                onDraftChange('away', e.target.value);
                                if (e.target.value && /^\d+$/.test(e.target.value)) {
                                    setTimeout(() => onAwayEnter(), 150);
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-10 rounded-lg border-2 border-lime-400 bg-white text-center text-sm font-black text-slate-900 outline-none ring-2 ring-lime-400/20"
                        />
                    </div>
                ) : (
                    <div className="flex shrink-0 items-center gap-1">
                        <span className="text-xs font-black text-slate-900">{draft.home || '-'}</span>
                        <span className="text-xs font-black text-slate-300">-</span>
                        <span className="text-xs font-black text-slate-900">{draft.away || '-'}</span>
                    </div>
                )}

                {/* Away team */}
                <div className="flex min-w-0 items-center gap-1">
                    <span className="text-[10px] font-black uppercase text-slate-900">{match.awayTeamCode}</span>
                    <img src={match.awayFlag} alt={match.awayTeamCode} className="h-5 w-7 rounded border border-slate-200 object-cover" />
                </div>

                {/* Status indicator + IA button */}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                    {match.saved && (
                        <CheckCircle2 className="h-4 w-4 text-lime-600" />
                    )}
                    {isDirty && !isSaving && (
                        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    )}
                    {isSaving && (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-lime-600" />
                    )}

                    {/* IA Button - aparece junto a los días */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCollapseOthers();
                            if (!cachedInsights && !insightsLoading) {
                                onRequestInsights();
                            }
                            setInsightsLevel(insightsLevel === 'none' ? 'suggestions' : 'none');
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-lg transition-all ${
                            hasBeenConsulted
                                ? 'bg-violet-100 text-violet-600 ring-1 ring-violet-300'
                                : insightsLoading && analysisMatchId === match.id
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-slate-100 text-slate-400 hover:bg-violet-50 hover:text-violet-600'
                        }`}
                    >
                        {insightsLoading && analysisMatchId === match.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-amber-600 border-t-transparent" />
                        ) : (
                            <Brain className="h-3 w-3" />
                        )}
                    </button>

                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Nivel 1: Info básica (cuando se expande) */}
            {isExpanded && (
                <div className="animate-slideDown border-t border-slate-100 bg-slate-50 px-3 py-2 sm:hidden">
                    <div className="flex flex-wrap items-center gap-1 text-[9px]">
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 font-bold uppercase text-slate-600">
                            {toDisplayPhase(match.phase)}
                        </span>
                        {match.group && (
                            <span className="rounded-full bg-white px-2 py-0.5 font-bold uppercase text-slate-500">
                                Grupo {match.group}
                            </span>
                        )}
                        <span className="text-slate-400">• {summarizeCloseTime(match.date)}</span>
                        {match.saved && (
                            <span className="ml-auto font-bold text-lime-600">
                                ✓ {match.prediction.home}-{match.prediction.away}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Nivel 2: Smart Insights - Sugerencias (3 marcadores) */}
            {insightsLevel !== 'none' && cachedInsights && (
                <div className="animate-slideDown border-t border-slate-100 bg-gradient-to-b from-violet-50 to-white px-3 py-2.5 sm:hidden">
                    {(() => {
                        const ins = (cachedInsights ?? generateMatchInsights(match)) as InsightsPayload;
                        const scoreLabels = ['SEGURA', 'IA MODEL', 'ARRIESGADA'] as const;
                        const scoreStyles = [
                            'bg-lime-100 text-lime-700 border-lime-200',
                            'bg-violet-100 text-violet-700 border-violet-200',
                            'bg-amber-100 text-amber-700 border-amber-200',
                        ] as const;

                        return (
                            <>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles className="h-3 w-3 text-violet-500" />
                                        <span className="text-[8px] font-black uppercase tracking-wider text-violet-600">Sugerencias IA</span>
                                        {hasBeenConsulted && (
                                            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-purple-600">IA</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-[8px]">
                                        <span className="font-bold text-slate-500">{siCredits}/{planCap}</span>
                                        <span className="text-slate-400">créditos</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-1.5">
                                    {ins.scores.map((score, idx) => {
                                        const [h, a] = score.split('-');
                                        const probs = [ins.homeWin, ins.draw, ins.awayWin];
                                        return (
                                            <button
                                                key={score + idx}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onApplySuggestedScore(h, a);
                                                }}
                                                className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 transition-all active:scale-95 ${scoreStyles[idx]}`}
                                            >
                                                <span className="text-[7px] font-black uppercase tracking-wider opacity-80">{scoreLabels[idx]}</span>
                                                <span className="text-lg font-black leading-none">{score}</span>
                                                <span className="text-[7px] font-bold opacity-70">{probs[idx]}%</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Botón "Ver más detalles" */}
                                {insightsLevel === 'suggestions' && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInsightsLevel('full');
                                        }}
                                        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-violet-200 bg-white py-1.5 text-[9px] font-black uppercase tracking-wider text-violet-600 transition-colors hover:bg-violet-50"
                                    >
                                        <ChevronDown className="h-3 w-3" />
                                        Ver análisis completo
                                    </button>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Nivel 3: Análisis completo (racha, insight, etc.) */}
            {insightsLevel === 'full' && cachedInsights && (
                <div className="animate-slideDown border-t border-violet-100 bg-gradient-to-b from-violet-50 to-white px-3 py-2.5 sm:hidden">
                    {(() => {
                        const ins = (cachedInsights ?? generateMatchInsights(match)) as InsightsPayload;
                        return (
                            <>
                                {/* Insight principal */}
                                {ins.insight && (
                                    <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
                                        <Sparkles className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-500" />
                                        <p className="text-[9px] font-medium leading-relaxed text-slate-700">"{ins.insight}"</p>
                                    </div>
                                )}

                                {/* Probabilidades */}
                                <div className="mb-2">
                                    <div className="mb-1 flex justify-between text-[8px] font-bold uppercase">
                                        <span className="text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                                        <span className="text-slate-400">Empate</span>
                                        <span className="text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                                    </div>
                                    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="bg-slate-900 transition-all" style={{ width: `${ins.homeWin}%` }} />
                                        <div className="bg-slate-300 transition-all" style={{ width: `${ins.draw}%` }} />
                                        <div className="bg-lime-400 transition-all" style={{ width: `${ins.awayWin}%` }} />
                                    </div>
                                    <div className="mt-0.5 flex justify-between">
                                        <span className="text-[8px] font-black text-slate-900">{ins.homeWin}%</span>
                                        <span className="text-[8px] font-black text-slate-400">{ins.draw}%</span>
                                        <span className="text-[8px] font-black text-slate-900">{ins.awayWin}%</span>
                                    </div>
                                </div>

                                {/* Racha */}
                                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2">
                                    <div className="mb-1 flex items-center gap-1">
                                        <BarChart3 className="h-2.5 w-2.5 text-indigo-500" />
                                        <span className="text-[7px] font-black uppercase tracking-wider text-indigo-600">Últimos 5</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex gap-0.5">
                                            {ins.homeForm.map((r, i) => (
                                                <span key={i} className={`flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                            ))}
                                        </div>
                                        <span className="text-[8px] font-black text-indigo-600">VS</span>
                                        <div className="flex gap-0.5">
                                            {ins.awayForm.map((r, i) => (
                                                <span key={i} className={`flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Botón "Ocultar detalles" */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setInsightsLevel('suggestions');
                                    }}
                                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-violet-200 bg-white py-1.5 text-[9px] font-black uppercase tracking-wider text-violet-600 transition-colors hover:bg-violet-50"
                                >
                                    <ChevronUp className="h-3 w-3" />
                                    Ocultar detalles
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Desktop: original full layout */}
            <div className="hidden sm:block">
                {/* Your existing desktop match card code */}
            </div>
        </div>
    );
}

interface SmartInsightsPanelProps {
    match: MatchViewModel;
    leaguePlan: string;
    planCap: number;
    siCredits: number;
    cachedData: object | null;
    insightsLocked: boolean;
    insightsLoading: boolean;
    analysisMatchId: string | null;
    insightsError: string | null;
    isCollapsed: boolean;
    onToggleCollapsed: () => void;
    onApplySuggestedScore: (home: string, away: string) => void;
    onUpgradePlan: (plan: 'gold' | 'diamond') => void;
    onDismissLock: () => void;
}

function SmartInsightsPanel({
    match,
    leaguePlan,
    planCap,
    siCredits,
    cachedData,
    insightsLocked,
    insightsLoading,
    analysisMatchId,
    insightsError,
    isCollapsed,
    onToggleCollapsed,
    onApplySuggestedScore,
    onUpgradePlan,
    onDismissLock,
}: SmartInsightsPanelProps) {
    if (insightsLocked) {
        const lockMessages: Record<string, { title: string; body: string; cta: string; ctaPlan: 'gold' | 'diamond' | null; sub: string }> = {
            FREE: {
                title: 'Has agotado tus créditos de prueba',
                body: 'Mejora tu polla a plan GOLD o DIAMOND para más análisis IA.',
                cta: 'Ver planes disponibles',
                ctaPlan: 'gold',
                sub: 'Plan GOLD · 30 análisis · Plan DIAMOND · 100 análisis',
            },
            GOLD: {
                title: `Usaste los ${planCap} análisis de tu plan`,
                body: 'Actualiza a DIAMOND para triplicar tus análisis disponibles.',
                cta: 'Actualizar a DIAMOND',
                ctaPlan: 'diamond',
                sub: 'Plan DIAMOND · 100 análisis incluidos',
            },
            DIAMOND: {
                title: `Usaste los ${planCap} análisis disponibles`,
                body: 'Has alcanzado el límite del período actual. Los créditos se recargarán próximamente.',
                cta: 'Entendido',
                ctaPlan: null,
                sub: 'Los créditos se recargan cada período',
            },
        };
        const msg = lockMessages[leaguePlan] ?? lockMessages['FREE'];
        return (
            <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:mx-5">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Smart Insights • IA Powered</span>
                    <span className="ml-auto rounded-full bg-rose-100 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-rose-600">
                        0/{planCap} créditos
                    </span>
                </div>
                <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                        <Lock className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-900">{msg.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{msg.body}</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <button
                            type="button"
                            onClick={() => (msg.ctaPlan ? onUpgradePlan(msg.ctaPlan) : onDismissLock())}
                            className="rounded-full bg-lime-400 px-5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900 transition-all hover:bg-lime-300"
                        >
                            {msg.cta}
                        </button>
                        <span className="text-[9px] text-slate-400">{msg.sub}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (insightsLoading && analysisMatchId === match.id) {
        return (
            <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:mx-5">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Smart Insights • IA Powered</span>
                </div>
                <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-amber-400" />
                    <p className="text-xs font-bold text-slate-500">Analizando partido con IA...</p>
                </div>
            </div>
        );
    }

    if (insightsError && !cachedData) {
        console.warn('[SmartInsights] error:', insightsError);
        return (
            <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-amber-100 bg-white sm:mx-5">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Smart Insights • IA Powered</span>
                </div>
                <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-700">Análisis en procesamiento</p>
                        <p className="mt-1 max-w-xs text-[10px] text-slate-400">
                            El motor de IA está ocupado en este momento. Inténtalo de nuevo en unos segundos.
                        </p>
                        {insightsError && (
                            <p className="mt-2 max-w-xs break-words font-mono text-[9px] text-rose-400">{insightsError}</p>
                        )}
                    </div>
                    <p className="text-[9px] text-slate-400">Presiona el botón <span className="font-bold">IA</span> para reintentar · No se consumió crédito</p>
                </div>
            </div>
        );
    }

    const ins = (cachedData ?? generateMatchInsights(match)) as InsightsPayload;
    const scoreLabels = ['SEGURA', 'IA MODEL', 'ARRIESGADA'] as const;
    const scoreStyles = [
        'bg-lime-100 text-lime-700',
        'bg-violet-100 text-violet-700',
        'bg-amber-100 text-amber-700',
    ] as const;
    const planBadgeColor =
        leaguePlan === 'DIAMOND' ? 'bg-cyan-100 text-cyan-700' :
        leaguePlan === 'GOLD' ? 'bg-amber-100 text-amber-700' :
        'bg-slate-100 text-slate-500';
    const homeEff = Math.round((ins.homeForm.filter((r) => r === 'W').length / 5) * 100);
    const awayEff = Math.round((ins.awayForm.filter((r) => r === 'W').length / 5) * 100);
    const calcTrend = (form: Array<'W' | 'D' | 'L'>) =>
        form.slice(3).filter((r) => r === 'W').length >= 1 ? 'up' : 'down';
    const homeTrend = calcTrend(ins.homeForm);
    const awayTrend = calcTrend(ins.awayForm);

    return (
        <div className="mx-3 mb-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white sm:mx-5 sm:mb-3 sm:rounded-2xl">
            <button
                type="button"
                aria-label={`${isCollapsed ? 'Ver detalle' : 'Ocultar detalle'} de Smart Insights para ${match.homeTeam} vs ${match.awayTeam}`}
                onClick={onToggleCollapsed}
                className="flex w-full flex-col gap-2 border-b border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3"
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-[9px] font-black uppercase tracking-[0.22em] text-violet-600">Smart Insights • IA Powered</span>
                    {cachedData && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-purple-600">IA</span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${planBadgeColor}`}>
                        {siCredits}/{planCap} créditos
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {isCollapsed ? 'Ver detalle' : 'Ocultar'}
                        {isCollapsed
                            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                        }
                    </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {ins.scores.map((score, idx) => (
                            <span
                                key={`summary-${score}-${idx}`}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${scoreStyles[idx]}`}
                            >
                                <span>{scoreLabels[idx]}</span>
                                <span className="text-[11px] leading-none">{score}</span>
                            </span>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-black uppercase tracking-[0.18em] text-slate-500">
                            Favorito {ins.smartPick}
                        </span>
                        <span className="text-slate-400">{ins.homeWin}% · {ins.draw}% · {ins.awayWin}%</span>
                    </div>
                </div>
                <p className="line-clamp-2 text-[10px] font-medium leading-relaxed text-slate-500">
                    {ins.personalInsight || ins.insight || 'Resumen táctico y de forma disponible para este partido.'}
                </p>
            </button>
            {!isCollapsed && <>
                <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:divide-x lg:divide-slate-100">
                    <div className="px-4 pb-4 pt-3">
                        <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase">
                            <span className="font-black text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                            <span className="text-slate-400">Empate</span>
                            <span className="font-black text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className="bg-slate-900 transition-all" style={{ width: `${ins.homeWin}%` }} />
                            <div className="bg-slate-300 transition-all" style={{ width: `${ins.draw}%` }} />
                            <div className="bg-lime-400 transition-all" style={{ width: `${ins.awayWin}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between">
                            <span className="text-[10px] font-black text-slate-900">{ins.homeWin}%</span>
                            <span className="text-[10px] font-black text-slate-400">{ins.draw}%</span>
                            <span className="text-[10px] font-black text-slate-900">{ins.awayWin}%</span>
                        </div>
                        {ins.insight && (
                            <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5">
                                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                                <p className="text-[10px] font-medium leading-relaxed text-slate-700">"{ins.insight}"</p>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 lg:border-t-0">
                        <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Sugerencias automáticas</p>
                        <div className="grid grid-cols-3 gap-2">
                            {ins.scores.map((score, idx) => {
                                const [h, a] = score.split('-');
                                const probs = [ins.homeWin, ins.draw, ins.awayWin];
                                return (
                                    <button
                                        key={score + idx}
                                        type="button"
                                        onClick={() => onApplySuggestedScore(h, a)}
                                        className={`flex flex-col items-center gap-1 rounded-xl py-3 transition-all hover:scale-105 active:scale-95 ${scoreStyles[idx]}`}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-wider opacity-80">{scoreLabels[idx]}</span>
                                        <span className="text-2xl font-black leading-none">{score}</span>
                                        <span className="text-[9px] font-bold opacity-70">{probs[idx]}% Prob.</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Análisis de Racha · Últimos 5</span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tendencia</span>
                    </div>
                    <div className="flex flex-col gap-2 lg:hidden">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="w-14 shrink-0 truncate text-[10px] font-black uppercase text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                                <div className="flex gap-0.5">
                                    {ins.homeForm.map((r, i) => (
                                        <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                                {homeTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                <span className={`text-[9px] font-black ${homeTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{homeTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="w-14 shrink-0 truncate text-[10px] font-black uppercase text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                                <div className="flex gap-0.5">
                                    {ins.awayForm.map((r, i) => (
                                        <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                                {awayTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                <span className={`text-[9px] font-black ${awayTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{awayTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                            </div>
                        </div>
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                            <p className="text-[10px] font-semibold leading-relaxed text-indigo-800">
                                {ins.personalInsight || ins.insight || 'Análisis de forma actual e historial reciente de ambos equipos.'}
                            </p>
                            <p className="mt-2 text-[9px] font-black uppercase text-indigo-900">
                                Opción inteligente: <span className="text-indigo-600">{ins.smartPick}</span>
                            </p>
                        </div>
                    </div>
                    <div className="hidden items-start gap-2 lg:flex">
                        <div className="flex min-w-0 flex-col items-start gap-1">
                            <span className="max-w-[72px] truncate text-[10px] font-black uppercase text-slate-900">{match.homeTeam.split(' ')[0]}</span>
                            <span className="text-[9px] text-slate-400">{homeEff}% efic.</span>
                            <div className="flex gap-0.5">
                                {ins.homeForm.map((r, i) => (
                                    <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                ))}
                            </div>
                            <div className="flex items-center gap-0.5">
                                {homeTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                <span className={`text-[9px] font-black ${homeTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{homeTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                            </div>
                        </div>
                        <div className="flex min-h-[84px] flex-1 flex-col justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                            <p className="text-[10px] font-semibold leading-relaxed text-indigo-800">
                                {ins.personalInsight || ins.insight || 'Análisis de forma actual e historial reciente de ambos equipos.'}
                            </p>
                            <p className="mt-2 text-[9px] font-black uppercase text-indigo-900">
                                Opción inteligente: <span className="text-indigo-600">{ins.smartPick}</span>
                            </p>
                        </div>
                        <div className="flex min-w-0 flex-col items-end gap-1">
                            <span className="max-w-[72px] truncate text-[10px] font-black uppercase text-slate-900">{match.awayTeam.split(' ')[0]}</span>
                            <span className="text-[9px] text-slate-400">{awayEff}% efic.</span>
                            <div className="flex gap-0.5">
                                {ins.awayForm.map((r, i) => (
                                    <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${r === 'W' ? 'bg-lime-500 text-white' : r === 'D' ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'}`}>{r}</span>
                                ))}
                            </div>
                            <div className="flex items-center justify-end gap-0.5">
                                {awayTrend === 'up' ? <ArrowUp className="h-3 w-3 text-lime-600" /> : <ArrowDown className="h-3 w-3 text-rose-500" />}
                                <span className={`text-[9px] font-black ${awayTrend === 'up' ? 'text-lime-600' : 'text-rose-500'}`}>{awayTrend === 'up' ? 'SUBE' : 'BAJA'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </>}
        </div>
    );
}

const Predictions: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const activeLeague = useLeagueStore((state) => state.activeLeague);
    const myLeagues = useLeagueStore((state) => state.myLeagues);
    const fetchMyLeagues = useLeagueStore((state) => state.fetchMyLeagues);
    const setActiveLeague = useLeagueStore((state) => state.setActiveLeague);
    const matches = usePredictionStore((state) => state.matches);
    const isLoading = usePredictionStore((state) => state.isLoading);
    const fetchLeagueMatches = usePredictionStore((state) => state.fetchLeagueMatches);
    const savePrediction = usePredictionStore((state) => state.savePrediction);
    const resetLeagueData = usePredictionStore((state) => state.resetLeagueData);
    const getRemoteSiCredits = useConfigStore((state) => state.getSiCredits);
    const creditsResetAt = useConfigStore((state) => state.creditsResetAt);
    const aiCredits = useAiCredits();

    const [drafts, setDrafts] = React.useState<DraftMap>({});
    const [searchTerm, setSearchTerm] = React.useState('');
    const [phaseFilter, setPhaseFilter] = React.useState<PhaseFilter>('ALL');
    const [error, setError] = React.useState<string | null>(null);
    const [savingMatchId, setSavingMatchId] = React.useState<string | null>(null);
    const [analysisMatchId, setAnalysisMatchId] = React.useState<string | null>(null);
    const [insightsLocked, setInsightsLocked] = React.useState(false);
    const [insightsLoading, setInsightsLoading] = React.useState(false);
    const [insightsData, setInsightsData] = React.useState<Record<string, object>>({});
    const [insightsError, setInsightsError] = React.useState<string | null>(null);
    const [insightsCollapsed, setInsightsCollapsed] = React.useState<Record<string, boolean>>({});
    const [isSavingAll, setIsSavingAll] = React.useState(false);
    const [expandedMatches, setExpandedMatches] = React.useState<Set<string>>(new Set());
    const [speedEntryMode, setSpeedEntryMode] = React.useState(false);
    const homeInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
    const awayInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
    const [searchExpanded, setSearchExpanded] = React.useState(false);
    const [isScrolled, setIsScrolled] = React.useState(false);

    // Dirty detection: open matches whose draft differs from saved prediction
    const dirtyMatchIds = React.useMemo(() =>
        matches
            .filter((match) => {
                if (match.status !== 'open' && match.status !== 'live') return false;
                const draft = drafts[match.id];
                if (!draft || draft.home === '' || draft.away === '') return false;
                return draft.home !== match.prediction.home || draft.away !== match.prediction.away;
            })
            .map((m) => m.id),
    [matches, drafts]);
    const hasDirtyChanges = dirtyMatchIds.length > 0;
    // Plan for credits: user's own subscription plan takes priority over league plan
    const resolvedPlan = React.useMemo(() =>
        (user?.plan ?? activeLeague?.settings?.plan ?? 'FREE').toUpperCase(),
    [user?.plan, activeLeague?.settings?.plan]);

    const [siCredits, setSiCredits] = React.useState<number>(() => {
        const plan = (user?.plan ?? activeLeague?.settings?.plan ?? 'FREE').toUpperCase();
        const cap = SI_PLAN_CREDITS_FALLBACK[plan] ?? SI_PLAN_CREDITS_FALLBACK['FREE'];
        return getSiCredits(plan, cap);
    });
    const [predictionMode, setPredictionMode] = React.useState<'matches' | 'simulator'>('matches');
    const [simulatorTab, setSimulatorTab] = React.useState<'groups' | 'bracket'>('groups');
    const [activeGroup, setActiveGroup] = React.useState<string>('ALL');
    const [activeGroupModal, setActiveGroupModal] = React.useState<string | null>(null);
    const [groups, setGroups] = React.useState<SimulatorGroup[]>(INITIAL_GROUPS);

    React.useEffect(() => {
        if (myLeagues.length > 0) {
            return;
        }

        void fetchMyLeagues().catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar tus ligas.');
        });
    }, [fetchMyLeagues, myLeagues.length]);

    React.useEffect(() => {
        if (!activeLeague?.id) {
            resetLeagueData();
            setDrafts({});
            return;
        }

        setError(null);
        void fetchLeagueMatches(activeLeague.id).catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible cargar los partidos.');
        });
    }, [activeLeague?.id, fetchLeagueMatches, resetLeagueData]);

    React.useEffect(() => {
        setDrafts(buildDrafts(matches));
    }, [matches]);

    // Sync credits when user plan, active league, remote config, or reset changes
    React.useEffect(() => {
        clearSiCreditsIfReset(resolvedPlan, creditsResetAt, user?.creditResetAt);
        const cap = getRemoteSiCredits(resolvedPlan);
        setSiCredits(getSiCredits(resolvedPlan, cap));
        setAnalysisMatchId(null);
        setInsightsLocked(false);
    }, [resolvedPlan, getRemoteSiCredits, creditsResetAt, user?.creditResetAt]);

    const filteredMatches = React.useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return matches.filter((match) => {
            const matchesPhase = phaseFilter === 'ALL' || normalizePhase(match.phase) === phaseFilter;
            const matchesGroup =
                phaseFilter !== 'GROUP' || activeGroup === 'ALL' || match.group === activeGroup;
            const haystack = `${match.homeTeam} ${match.awayTeam} ${match.venue}`.toLowerCase();
            const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
            return matchesPhase && matchesGroup && matchesSearch;
        });
    }, [matches, phaseFilter, activeGroup, searchTerm]);

    const groupedMatches = React.useMemo(() => {
        return filteredMatches.reduce<Record<string, MatchViewModel[]>>((acc, match) => {
            const bucket = match.displayDate || 'Sin fecha';
            acc[bucket] = acc[bucket] || [];
            acc[bucket].push(match);
            return acc;
        }, {});
    }, [filteredMatches]);

    const nextMatchId = React.useMemo(() => {
        const openMatch = matches
            .filter((match) => match.status === 'open' || match.status === 'live')
            .sort((left, right) => left.date.localeCompare(right.date))[0];
        return openMatch?.id ?? null;
    }, [matches]);

    const groupStandings = React.useMemo(() => {
        if (!activeGroupModal) return [];
        const groupMatches = matches.filter(
            (m) => m.group === activeGroupModal && m.status === 'finished' && m.result,
        );
        const table: Record<string, { team: string; flag: string; pj: number; gf: number; gc: number; pts: number }> = {};
        const row = (team: string, flag: string) => {
            if (!table[team]) table[team] = { team, flag, pj: 0, gf: 0, gc: 0, pts: 0 };
            return table[team];
        };
        for (const m of groupMatches) {
            const h = row(m.homeTeam, m.homeFlag);
            const a = row(m.awayTeam, m.awayFlag);
            const { home: hg, away: ag } = m.result!;
            h.pj++; a.pj++;
            h.gf += hg; h.gc += ag;
            a.gf += ag; a.gc += hg;
            if (hg > ag) { h.pts += 3; }
            else if (hg < ag) { a.pts += 3; }
            else { h.pts += 1; a.pts += 1; }
        }
        return Object.values(table)
            .sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf)
            .map((r, i) => ({ ...r, pos: i + 1, dg: r.gf - r.gc }));
    }, [activeGroupModal, matches]);

    const savedCount = React.useMemo(() => matches.filter((match) => match.saved).length, [matches]);
    const openCount = React.useMemo(
        () => matches.filter((match) => match.status === 'open' || match.status === 'live').length,
        [matches],
    );

    const availableGroups = React.useMemo(() => {
        const groupSet = new Set<string>();
        matches.forEach((match) => {
            if (match.group) {
                groupSet.add(match.group);
            }
        });

        return [...groupSet].sort();
    }, [matches]);

    const qualifiedTeams = React.useMemo(() => {
        const teams: Record<string, SimulatorTeam> = {};
        groups.forEach((group, index) => {
            const letter = String.fromCharCode(65 + index);
            teams[`1${letter}`] = group.teams[0];
            teams[`2${letter}`] = group.teams[1];
        });
        return teams;
    }, [groups]);

    const roundOf16Matchups = [
        { id: 'R16-1', team1: '1A', team2: '2B' },
        { id: 'R16-2', team1: '1C', team2: '2D' },
        { id: 'R16-3', team1: '1B', team2: '2A' },
        { id: 'R16-4', team1: '1D', team2: '2C' },
    ];

    const handleDraftChange = (matchId: string, field: 'home' | 'away', value: string) => {
        if (value && !/^\d+$/.test(value)) {
            return;
        }

        if (value.length > 2) {
            return;
        }

        setDrafts((currentDrafts) => ({
            ...currentDrafts,
            [matchId]: {
                home: currentDrafts[matchId]?.home ?? '',
                away: currentDrafts[matchId]?.away ?? '',
                [field]: value,
            },
        }));
    };

    const handleSave = async (matchId: string) => {
        if (!activeLeague?.id) {
            return;
        }

        const nextDraft = drafts[matchId];
        if (!nextDraft || nextDraft.home === '' || nextDraft.away === '') {
            setError('Debes ingresar ambos marcadores antes de guardar el pronóstico.');
            return;
        }

        setSavingMatchId(matchId);
        setError(null);

        try {
            await savePrediction(
                activeLeague.id,
                matchId,
                Number.parseInt(nextDraft.home, 10),
                Number.parseInt(nextDraft.away, 10),
            );
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'No fue posible guardar el pronóstico.');
        } finally {
            setSavingMatchId(null);
        }
    };

    const handleSaveAll = async () => {
        if (!activeLeague?.id || dirtyMatchIds.length === 0) return;
        setIsSavingAll(true);
        setError(null);
        let failed = 0;
        for (const matchId of dirtyMatchIds) {
            const draft = drafts[matchId];
            if (!draft || draft.home === '' || draft.away === '') continue;
            try {
                await savePrediction(
                    activeLeague.id,
                    matchId,
                    Number.parseInt(draft.home, 10),
                    Number.parseInt(draft.away, 10),
                );
            } catch {
                failed++;
            }
        }
        setIsSavingAll(false);
        if (failed > 0) {
            setError(`${failed} pronóstico(s) no pudieron guardarse. Inténtalo de nuevo.`);
        }
    };

    // Block SPA navigation when there are unsaved changes
    const blocker = useBlocker(hasDirtyChanges);

    // Block browser close/refresh when there are unsaved changes
    React.useEffect(() => {
        if (!hasDirtyChanges) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasDirtyChanges]);

    // Scroll detection for sticky header
    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleTeamMove = (groupIndex: number, teamIndex: number, direction: 'up' | 'down') => {
        setGroups((previous) => {
            const nextGroups = structuredClone(previous);
            const nextGroup = nextGroups[groupIndex];

            if (direction === 'up' && teamIndex > 0) {
                [nextGroup.teams[teamIndex], nextGroup.teams[teamIndex - 1]] = [
                    nextGroup.teams[teamIndex - 1],
                    nextGroup.teams[teamIndex],
                ];
            }

            if (direction === 'down' && teamIndex < nextGroup.teams.length - 1) {
                [nextGroup.teams[teamIndex], nextGroup.teams[teamIndex + 1]] = [
                    nextGroup.teams[teamIndex + 1],
                    nextGroup.teams[teamIndex],
                ];
            }

            return nextGroups;
        });
    };

    // Helper for auto-advance in speed entry mode
    const getNextOpenMatch = (currentMatchId: string) => {
        const currentIndex = filteredMatches.findIndex((m) => m.id === currentMatchId);
        if (currentIndex === -1) return null;

        for (let i = currentIndex + 1; i < filteredMatches.length; i++) {
            const m = filteredMatches[i];
            if (m.status === 'open' || m.status === 'live') return m;
        }
        return null;
    };

    const handleSpeedEntry = async (matchId: string) => {
        const draft = drafts[matchId];
        if (!draft || draft.home === '' || draft.away === '') return;

        // Auto-save
        await handleSave(matchId);

        // Trigger haptic feedback if supported
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }

        // Find and focus next match
        const nextMatch = getNextOpenMatch(matchId);
        if (nextMatch && speedEntryMode) {
            setExpandedMatches(new Set([nextMatch.id]));
            setTimeout(() => {
                homeInputRefs.current[nextMatch.id]?.focus();
            }, 250);
        }
    };

    return (
        <>
        <div className="min-h-screen bg-white pb-24">
            {/* ─── STICKY HEADER ─── */}
            <div className={`sticky top-0 z-20 bg-white transition-shadow ${isScrolled ? 'shadow-md' : 'border-b border-slate-100'}`}>
                {/* Top bar: ALWAYS VISIBLE - Title + Back button */}
                <div className="border-b border-slate-100 bg-white">
                    <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:py-3">
                        <button
                            onClick={() => navigate('/my-leagues')}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 sm:h-9 sm:w-9"
                        >
                            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-xs font-black uppercase tracking-tight text-slate-900 sm:text-sm">
                                    {activeLeague?.name ?? 'Sin liga activa'}
                                </h1>
                                {activeLeague?.role === 'ADMIN' && (
                                    <span className="shrink-0 rounded-lg bg-slate-900 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-lime-400 sm:px-2 sm:text-[9px]">
                                        Admin
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sticky tabs: PARTIDOS / SIMULADOR + Speed Mode + Search */}
                <div className="bg-white">
                    <div className="mx-auto max-w-5xl px-4">
                        <div className="flex items-center justify-between gap-2 py-2">
                            {/* Left: Tabs */}
                            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 p-0.5 sm:p-1">
                                <button
                                    onClick={() => setPredictionMode('matches')}
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all sm:gap-1.5 sm:px-4 ${predictionMode === 'matches' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <LayoutGrid className="h-3 w-3" />
                                    <span className="hidden sm:inline">Partidos</span>
                                </button>
                                <button
                                    onClick={() => setPredictionMode('simulator')}
                                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all sm:gap-1.5 sm:px-4 ${predictionMode === 'simulator' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <GitMerge className="h-3 w-3" />
                                    <span className="hidden sm:inline">Simulador</span>
                                </button>
                            </div>

                            {/* Center: Speed Mode Toggle (Mobile only, when in matches mode) */}
                            {predictionMode === 'matches' && (
                                <button
                                    onClick={() => {
                                        setSpeedEntryMode(!speedEntryMode);
                                        if (!speedEntryMode) {
                                            const firstOpen = filteredMatches.find((m) => m.status === 'open' || m.status === 'live');
                                            if (firstOpen) {
                                                setExpandedMatches(new Set([firstOpen.id]));
                                                setTimeout(() => homeInputRefs.current[firstOpen.id]?.focus(), 100);
                                            }
                                        } else {
                                            setExpandedMatches(new Set());
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all sm:hidden ${speedEntryMode ? 'border-lime-400 bg-lime-50 text-lime-700' : 'border-slate-200 bg-white text-slate-500'}`}
                                >
                                    <Zap className={`h-3 w-3 ${speedEntryMode ? 'text-lime-600' : 'text-slate-400'}`} />
                                    {speedEntryMode ? 'Rápido' : 'Normal'}
                                </button>
                            )}

                            {/* Right: Search */}
                            {predictionMode === 'matches' && (
                                <div className="flex items-center gap-2">
                                    {/* Mobile: search icon button */}
                                    <button
                                        onClick={() => setSearchExpanded(!searchExpanded)}
                                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all sm:hidden ${searchExpanded ? 'border-lime-400 bg-lime-50 text-lime-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <Search className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Desktop: always visible */}
                                    <div className="hidden items-center gap-2 sm:flex">
                                        <label className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="search"
                                                value={searchTerm}
                                                onChange={(event) => setSearchTerm(event.target.value)}
                                                placeholder="Buscar equipo..."
                                                className="w-48 rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile search expanded with filters */}
                {searchExpanded && predictionMode === 'matches' && (
                    <div className="animate-slideDown border-t border-slate-100 bg-slate-50 px-4 py-3 sm:hidden">
                        <div className="space-y-2">
                            {/* Search input */}
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Buscar equipo..."
                                    autoFocus
                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-lime-400 focus:ring-2 focus:ring-lime-400/20"
                                />
                            </label>

                            {/* Phase toggle */}
                            <div className="flex overflow-hidden rounded-xl border border-slate-200">
                                <button
                                    onClick={() => setPhaseFilter(phaseFilter === 'KNOCKOUT' ? 'ALL' : 'GROUP')}
                                    className={`flex flex-1 items-center justify-center gap-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${phaseFilter !== 'KNOCKOUT' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}
                                >
                                    <Trophy className="h-3 w-3" /> Grupos
                                </button>
                                <button
                                    onClick={() => setPhaseFilter('KNOCKOUT')}
                                    className={`flex flex-1 items-center justify-center gap-1 border-l border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${phaseFilter === 'KNOCKOUT' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}
                                >
                                    <GitMerge className="h-3 w-3" /> Fases
                                </button>
                            </div>

                            {/* Group pills */}
                            {phaseFilter !== 'KNOCKOUT' && availableGroups.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                                    <button
                                        onClick={() => setActiveGroup('ALL')}
                                        className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${activeGroup === 'ALL' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                                    >
                                        General
                                    </button>
                                    {availableGroups.map((group) => (
                                        <button
                                            key={group}
                                            onClick={() => setActiveGroup(group)}
                                            className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${activeGroup === group ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                                        >
                                            {group}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
                {/* ERROR */}
                {error ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : null}

                {predictionMode === 'matches' ? (
                    <>
                        {/* Desktop filters only */}
                        <div className="hidden items-center justify-between gap-3 sm:flex">
                            <div className="flex overflow-hidden rounded-2xl border border-slate-200">
                                <button
                                    onClick={() => setPhaseFilter(phaseFilter === 'KNOCKOUT' ? 'ALL' : 'GROUP')}
                                    className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors ${phaseFilter !== 'KNOCKOUT' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <Trophy className="h-3 w-3" /> Grupos
                                </button>
                                <button
                                    onClick={() => setPhaseFilter('KNOCKOUT')}
                                    className={`flex items-center gap-1.5 border-l border-slate-200 px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors ${phaseFilter === 'KNOCKOUT' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <GitMerge className="h-3 w-3" /> Fases
                                </button>
                            </div>
                        </div>

                        {/* GROUP PILLS - Desktop only */}
                        {phaseFilter !== 'KNOCKOUT' && availableGroups.length > 0 && (
                            <div className="hidden gap-2 overflow-x-auto pb-1 sm:flex [scrollbar-width:none]">
                                <button
                                    onClick={() => setActiveGroup('ALL')}
                                    className={`shrink-0 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${activeGroup === 'ALL' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                >
                                    General
                                </button>
                                {availableGroups.map((group) => (
                                    <button
                                        key={group}
                                        onClick={() => setActiveGroup(group)}
                                        className={`shrink-0 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${activeGroup === group ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                    >
                                        {group}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* NO LEAGUE */}
                        {!activeLeague && !isLoading ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                                <p className="text-sm text-slate-400">
                                    Selecciona una liga en{' '}
                                    <button onClick={() => navigate('/my-leagues')} className="font-bold text-lime-600 underline">
                                        Mis Pollas
                                    </button>{' '}
                                    para comenzar.
                                </p>
                            </div>
                        ) : null}

                        {/* LOADING */}
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-slate-100" />
                                ))}
                            </div>
                        ) : null}

                        {/* NO RESULTS */}
                        {activeLeague && filteredMatches.length === 0 && !isLoading ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                                No encontramos partidos con los filtros actuales.
                            </div>
                        ) : null}

                        {/* MATCH LIST */}
                        {!isLoading ? (
                            <div className="space-y-3">
                                {Object.entries(groupedMatches).map(([date, dateMatches]) => (
                                    <div key={date} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
                                        {/* Date header */}
                                        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                                                    {formatFriendlyDate(date)}
                                                </span>
                                            </div>
                                            {dateMatches[0]?.group ? (
                                                <button
                                                    onClick={() => setActiveGroupModal(dateMatches[0].group ?? null)}
                                                    className="flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-lime-600 hover:text-lime-700"
                                                >
                                                    <span className="hidden sm:inline">Ver Grupo </span>
                                                    <span className="sm:hidden">Ver </span>
                                                    {dateMatches[0].group} <ChevronRight className="h-3 w-3" />
                                                </button>
                                            ) : null}
                                        </div>

                                        {/* Match rows */}
                                        <div className="divide-y divide-slate-50">
                                            {dateMatches.map((match) => {
                                                const draft = drafts[match.id] ?? { home: '', away: '' };
                                                const isSaving = savingMatchId === match.id;
                                                const isAnalysisOpen = analysisMatchId === match.id;
                                                const isNext = nextMatchId === match.id;
                                                const canEdit = match.status === 'open' || match.status === 'live';
                                                const isDirty = dirtyMatchIds.includes(match.id);
                                                const cachedInsights = insightsData[match.id] ?? getCachedInsights(match.id);
                                                const adjustScore = (field: 'home' | 'away', delta: number) => {
                                                    const cur = draft[field];
                                                    const n = cur === '' ? Math.max(0, delta) : Math.max(0, Math.min(99, Number(cur) + delta));
                                                    handleDraftChange(match.id, field, String(n));
                                                };

                                                const isExpanded = expandedMatches.has(match.id);

                                                return (
                                                    <React.Fragment key={match.id}>
                                                        {/* Mobile: Compact row */}
                                                        <div className="sm:hidden">
                                                            <CompactMatchRow
                                                                match={match}
                                                                draft={draft}
                                                                isExpanded={isExpanded}
                                                                isSaving={isSaving}
                                                                isDirty={isDirty}
                                                                canEdit={canEdit}
                                                                speedMode={speedEntryMode}
                                                                cachedInsights={cachedInsights}
                                                                insightsLoading={insightsLoading}
                                                                analysisMatchId={analysisMatchId}
                                                                siCredits={aiCredits.usedCredits}
                                                                planCap={aiCredits.totalCredits}
                                                                onToggleExpand={() => {
                                                                    const newExpanded = new Set(expandedMatches);
                                                                    if (isExpanded) {
                                                                        newExpanded.delete(match.id);
                                                                    } else {
                                                                        if (!speedEntryMode) {
                                                                            newExpanded.add(match.id);
                                                                        } else {
                                                                            // En speed mode, solo uno expandido
                                                                            newExpanded.clear();
                                                                            newExpanded.add(match.id);
                                                                            setTimeout(() => homeInputRefs.current[match.id]?.focus(), 100);
                                                                        }
                                                                    }
                                                                    setExpandedMatches(newExpanded);
                                                                }}
                                                                onDraftChange={handleDraftChange.bind(null, match.id)}
                                                                onSave={() => handleSave(match.id)}
                                                                onHomeInputRef={(el) => (homeInputRefs.current[match.id] = el)}
                                                                onAwayInputRef={(el) => (awayInputRefs.current[match.id] = el)}
                                                                onHomeEnter={() => awayInputRefs.current[match.id]?.focus()}
                                                                onAwayEnter={() => handleSpeedEntry(match.id)}
                                                                onRequestInsights={async () => {
                                                                    setInsightsError(null);
                                                                    const leaguePlan = resolvedPlan;
                                                                    const cap = getRemoteSiCredits(leaguePlan);
                                                                    const cached = getCachedInsights(match.id) ?? insightsData[match.id];

                                                                    if (cached) {
                                                                        setInsightsCollapsed((prev) => ({ ...prev, [match.id]: prev[match.id] ?? true }));
                                                                        setAnalysisMatchId(match.id);
                                                                        return;
                                                                    }

                                                                    // Verificar créditos disponibles
                                                                    if (!aiCredits.hasCredits) {
                                                                        setInsightsLocked(true);
                                                                        setAnalysisMatchId(match.id);
                                                                        return;
                                                                    }

                                                                    setInsightsLoading(true);
                                                                    setAnalysisMatchId(match.id);

                                                                    try {
                                                                        await new Promise((resolve) => setTimeout(resolve, 1200));
                                                                        const generated = generateMatchInsights(match);

                                                                        // Consumir crédito en la API
                                                                        const result = await aiCredits.consumeCredits({
                                                                            leagueId: activeLeague?.id,
                                                                            matchId: match.id,
                                                                            feature: 'match_insights',
                                                                            responseData: generated,
                                                                            insightGenerated: true,
                                                                            clientInfo: `Match: ${match.homeTeam} vs ${match.awayTeam}`,
                                                                        });

                                                                        if (result.success) {
                                                                            setInsightsData((prev) => ({ ...prev, [match.id]: generated }));
                                                                            setCachedInsights(match.id, generated);
                                                                            setInsightsCollapsed((prev) => ({ ...prev, [match.id]: true }));
                                                                        } else {
                                                                            setInsightsError(result.error || 'No se pudo consumir el crédito');
                                                                        }
                                                                    } catch {
                                                                        setInsightsError('Error al generar insights');
                                                                    } finally {
                                                                        setInsightsLoading(false);
                                                                    }
                                                                }}
                                                                onApplySuggestedScore={(home, away) => {
                                                                    handleDraftChange(match.id, 'home', home);
                                                                    handleDraftChange(match.id, 'away', away);
                                                                }}
                                                                onCollapseOthers={() => {
                                                                    // Colapsar todos los insights de otros partidos
                                                                    setExpandedMatches(new Set([match.id]));
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Desktop: Full card */}
                                                        <div className={`hidden border-l-4 transition-colors sm:block ${isNext ? 'border-l-lime-400 bg-lime-50/30' : 'border-l-transparent'}`}>
                                                        {/* Main row */}
                                                        <div className="space-y-2.5 px-3 py-3 sm:space-y-3 sm:px-5">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                                                                    <div className="shrink-0">
                                                                        <p className="text-xs font-black text-slate-900 sm:text-sm">{formatMatchTime(match.date)}</p>
                                                                        <p className={`mt-0.5 text-[8px] font-black uppercase tracking-[0.14em] sm:text-[9px] sm:tracking-[0.18em] ${match.status === 'live' ? 'text-rose-500' : 'text-amber-500'}`}>
                                                                            {summarizeCloseTime(match.date)}
                                                                        </p>
                                                                    </div>
                                                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.18em] ${getMatchStatusClasses(match.status)}`}>
                                                                        {getMatchStatusLabel(match.status)}
                                                                    </span>
                                                                    {isNext ? (
                                                                        <span className="shrink-0 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-lime-700 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.18em]">
                                                                            Siguiente
                                                                        </span>
                                                                    ) : null}
                                                                    {isDirty ? (
                                                                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-amber-700 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.18em]">
                                                                            Sin guardar
                                                                        </span>
                                                                    ) : null}
                                                                    {cachedInsights ? (
                                                                        <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-violet-700 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.18em]">
                                                                            IA
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`Ver Smart Insights para ${match.homeTeam} vs ${match.awayTeam}`}
                                                                        title={`Ver Smart Insights para ${match.homeTeam} vs ${match.awayTeam}`}
                                                                        onClick={async () => {
                                                                            if (isAnalysisOpen && !(insightsError && analysisMatchId === match.id)) {
                                                                                setAnalysisMatchId(null);
                                                                                setInsightsLocked(false);
                                                                                setInsightsError(null);
                                                                                return;
                                                                            }

                                                                            setInsightsError(null);

                                                                            const leaguePlan = resolvedPlan;
                                                                            const cap = getRemoteSiCredits(leaguePlan);
                                                                            const cached = getCachedInsights(match.id) ?? insightsData[match.id];
                                                                            if (cached) {
                                                                                setInsightsCollapsed((prev) => ({ ...prev, [match.id]: prev[match.id] ?? true }));
                                                                                setAnalysisMatchId(match.id);
                                                                                setInsightsLocked(false);
                                                                                return;
                                                                            }

                                                                            if (siCredits === 0) {
                                                                                setInsightsCollapsed((prev) => ({ ...prev, [match.id]: prev[match.id] ?? true }));
                                                                                setInsightsLocked(true);
                                                                                setAnalysisMatchId(match.id);
                                                                                return;
                                                                            }

                                                                            setInsightsCollapsed((prev) => ({ ...prev, [match.id]: prev[match.id] ?? true }));
                                                                            setInsightsLocked(false);
                                                                            setAnalysisMatchId(match.id);
                                                                            setInsightsLoading(true);
                                                                            try {
                                                                                const { request: apiRequest } = await import('../api');
                                                                                const result = await apiRequest<object>(
                                                                                    `/insights/match/${match.id}`,
                                                                                    {
                                                                                        method: 'POST',
                                                                                        body: JSON.stringify({
                                                                                            homeTeam: match.homeTeam,
                                                                                            awayTeam: match.awayTeam,
                                                                                            phase: match.phase,
                                                                                            group: match.group,
                                                                                        }),
                                                                                    },
                                                                                );
                                                                                setCachedInsights(match.id, result);
                                                                                setInsightsData((prev) => ({ ...prev, [match.id]: result }));
                                                                                setSiCredits(consumeSiCredit(leaguePlan, cap));
                                                                            } catch (err) {
                                                                                const msg = err instanceof Error ? err.message : String(err);
                                                                                setInsightsError(msg);
                                                                            } finally {
                                                                                setInsightsLoading(false);
                                                                            }
                                                                        }}
                                                                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all sm:h-10 sm:w-10 sm:rounded-2xl ${
                                                                            isAnalysisOpen
                                                                                ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-200'
                                                                                : 'border border-slate-200 bg-white text-slate-400 hover:bg-violet-50 hover:text-violet-600'
                                                                        }`}
                                                                    >
                                                                        <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                    </button>
                                                                    {canEdit ? (
                                                                        <button
                                                                            type="button"
                                                                            aria-label={`Guardar pronóstico de ${match.homeTeam} vs ${match.awayTeam}`}
                                                                            title={`Guardar pronóstico de ${match.homeTeam} vs ${match.awayTeam}`}
                                                                            onClick={() => handleSave(match.id)}
                                                                            disabled={isSaving}
                                                                            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:opacity-60 sm:h-10 sm:w-10 sm:rounded-2xl ${
                                                                                isDirty || match.saved
                                                                                    ? 'bg-lime-400 text-slate-900 hover:bg-lime-300'
                                                                                    : 'border border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                                                            }`}
                                                                        >
                                                                            {isSaving
                                                                                ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                                                                                : match.saved ? <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                                            }
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                                                                <TeamIdentity
                                                                    name={match.homeTeam}
                                                                    code={match.homeTeamCode}
                                                                    flag={match.homeFlag}
                                                                    align="right"
                                                                />

                                                                {canEdit ? (
                                                                    <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-1.5 py-1 shadow-sm ring-1 ring-slate-200 sm:gap-2 sm:rounded-2xl sm:bg-slate-50 sm:px-2 sm:py-1.5 sm:shadow-none sm:ring-0 sm:border sm:border-slate-200">
                                                                        <ScoreControl
                                                                            teamName={match.homeTeam}
                                                                            side="local"
                                                                            value={draft.home}
                                                                            onChange={(value) => handleDraftChange(match.id, 'home', value)}
                                                                            onAdjust={(delta) => adjustScore('home', delta)}
                                                                        />
                                                                        <span className="px-0.5 text-base font-black text-slate-300 sm:px-1 sm:text-sm">-</span>
                                                                        <ScoreControl
                                                                            teamName={match.awayTeam}
                                                                            side="visitante"
                                                                            value={draft.away}
                                                                            onChange={(value) => handleDraftChange(match.id, 'away', value)}
                                                                            onAdjust={(delta) => adjustScore('away', delta)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-black text-slate-500 sm:rounded-2xl sm:px-3 sm:py-2">
                                                                        {draft.home || '−'} : {draft.away || '−'}
                                                                    </span>
                                                                )}

                                                                <TeamIdentity
                                                                    name={match.awayTeam}
                                                                    code={match.awayTeamCode}
                                                                    flag={match.awayFlag}
                                                                />
                                                            </div>

                                                            <div className="flex flex-col gap-1.5 text-[9px] sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:text-[10px]">
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-500 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.18em]">
                                                                        {toDisplayPhase(match.phase)}
                                                                    </span>
                                                                    {match.group ? (
                                                                        <span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-500 ring-1 ring-inset ring-slate-200 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.18em]">
                                                                            G{match.group}
                                                                        </span>
                                                                    ) : null}
                                                                    {match.venue ? (
                                                                        <span className="hidden max-w-[180px] truncate rounded-full bg-white px-2.5 py-1 text-[9px] font-medium text-slate-400 ring-1 ring-inset ring-slate-200 sm:inline-block sm:max-w-[240px]">
                                                                            {match.venue}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[9px] sm:text-[10px]">
                                                                    {match.saved ? (
                                                                        <span className="font-bold text-lime-600">
                                                                            ✓ {match.prediction.home}−{match.prediction.away}
                                                                        </span>
                                                                    ) : (
                                                                        <>
                                                                            <span className="text-slate-400 sm:hidden">Ingresa tu pronóstico</span>
                                                                            <span className="hidden text-slate-400 sm:inline">Completa y guarda para cerrar este partido.</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Insights panel */}
                                                        {isAnalysisOpen ? (
                                                            <SmartInsightsPanel
                                                                match={match}
                                                                leaguePlan={resolvedPlan}
                                                                planCap={aiCredits.totalCredits}
                                                                siCredits={aiCredits.usedCredits}
                                                                cachedData={cachedInsights}
                                                                insightsLocked={insightsLocked}
                                                                insightsLoading={insightsLoading}
                                                                analysisMatchId={analysisMatchId}
                                                                insightsError={insightsError}
                                                                isCollapsed={Boolean(insightsCollapsed[match.id])}
                                                                onToggleCollapsed={() => setInsightsCollapsed((prev) => ({ ...prev, [match.id]: !prev[match.id] }))}
                                                                onApplySuggestedScore={(home, away) => {
                                                                    handleDraftChange(match.id, 'home', home);
                                                                    handleDraftChange(match.id, 'away', away);
                                                                }}
                                                                onUpgradePlan={(plan) => navigate('/checkout', { state: { plan } })}
                                                                onDismissLock={() => setInsightsLocked(false)}
                                                            />
                                                        ) : null}
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </>
                ) : (
                    /* SIMULATOR */
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSimulatorTab('groups')}
                                className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                    simulatorTab === 'groups'
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-500'
                                }`}
                            >
                                Fase de grupos
                            </button>
                            <button
                                onClick={() => setSimulatorTab('bracket')}
                                className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                                    simulatorTab === 'bracket'
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-500'
                                }`}
                            >
                                Eliminatorias
                            </button>
                        </div>
                        {simulatorTab === 'groups' ? (
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                Ordena los equipos para proyectar tu fase de grupos. Los dos primeros clasifican a octavos.
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {groups.map((group, groupIndex) => (
                                    <article key={group.name} className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                                            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{group.name}</span>
                                            <span className="rounded-full bg-lime-100 px-2.5 py-1 text-[10px] font-black uppercase text-lime-700">
                                                CL / CL
                                            </span>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {group.teams.map((team, teamIndex) => (
                                                <div key={team.id} className={`flex items-center justify-between px-4 py-3 ${teamIndex < 2 ? 'bg-lime-50/40' : ''}`}>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black ${teamIndex < 2 ? 'bg-lime-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                            {teamIndex + 1}
                                                        </span>
                                                        <img
                                                            src={`https://flagcdn.com/w80/${team.iso}.png`}
                                                            alt={team.name}
                                                            className="h-6 w-8 rounded-md border border-slate-200 object-cover"
                                                        />
                                                        <span className="text-sm font-black uppercase text-slate-900">{team.name}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => handleTeamMove(groupIndex, teamIndex, 'up')}
                                                            disabled={teamIndex === 0}
                                                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleTeamMove(groupIndex, teamIndex, 'down')}
                                                            disabled={teamIndex === group.teams.length - 1}
                                                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                        ) : (
                        <div className="space-y-4">
                            <div className="rounded-[1.75rem] bg-slate-900 p-5 text-center text-white">
                                <Medal className="mx-auto h-8 w-8 text-lime-400" />
                                <h3 className="mt-3 text-lg font-black uppercase tracking-[0.18em]">Cruces de octavos</h3>
                                <p className="mt-1 text-sm text-slate-400">Así quedarían las llaves según tu predicción de grupos.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {roundOf16Matchups.map((matchup) => {
                                    const team1 = qualifiedTeams[matchup.team1];
                                    const team2 = qualifiedTeams[matchup.team2];
                                    return (
                                        <article key={matchup.id} className="rounded-[1.75rem] border border-slate-200 p-4">
                                            <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                                Octavos de final
                                            </p>
                                            <div className="mt-4 flex items-center justify-center gap-4">
                                                {[team1, team2].map((team, index) => (
                                                    <div key={`${matchup.id}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                                                        {team ? (
                                                            <>
                                                                <img
                                                                    src={`https://flagcdn.com/w80/${team.iso}.png`}
                                                                    alt={team.name}
                                                                    className="h-8 w-10 rounded-md border border-slate-200 object-cover"
                                                                />
                                                                <span className="text-center text-[10px] font-black uppercase text-slate-900">
                                                                    {team.name}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-black uppercase text-slate-300">Por definir</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        {/* FAB — save all dirty predictions */}
        {hasDirtyChanges && (
            <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-900 shadow-lg shadow-lime-400/30 transition-all hover:bg-lime-300 disabled:opacity-70 sm:right-6"
            >
                {isSavingAll
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" /><span className="hidden sm:inline">Guardando...</span></>
                    : <><Save className="h-4 w-4" /><span>{dirtyMatchIds.length} {dirtyMatchIds.length === 1 ? 'cambio' : 'cambios'}</span></>
                }
            </button>
        )}

        {/* Unsaved changes dialog */}
        {blocker.state === 'blocked' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
                    <div className="border-b border-slate-100 px-6 py-4">
                        <p className="text-sm font-black text-slate-900">Cambios sin guardar</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Tienes {dirtyMatchIds.length} pronóstico{dirtyMatchIds.length !== 1 ? 's' : ''} sin guardar.
                            ¿Qué deseas hacer?
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                        <button
                            type="button"
                            onClick={async () => { await handleSaveAll(); blocker.proceed(); }}
                            disabled={isSavingAll}
                            className="flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-900 hover:bg-lime-300 disabled:opacity-60"
                        >
                            <Save className="h-4 w-4" /> Guardar y salir
                        </button>
                        <button
                            type="button"
                            onClick={() => blocker.proceed()}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 hover:bg-slate-50"
                        >
                            Descartar y salir
                        </button>
                        <button
                            type="button"
                            onClick={() => blocker.reset()}
                            className="rounded-xl px-4 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeGroupModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">
                            Tabla de posiciones • Grupo {activeGroupModal}
                        </h3>
                        <button
                            onClick={() => setActiveGroupModal(null)}
                            className="rounded-lg px-2 py-1 text-sm font-black text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                            ×
                        </button>
                    </div>
                    <div className="p-4">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                                    <th className="pb-2 text-left">#</th>
                                    <th className="pb-2 text-left">Equipo</th>
                                    <th className="pb-2 text-center">PJ</th>
                                    <th className="pb-2 text-center">DG</th>
                                    <th className="pb-2 text-center text-lime-600">PTS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {groupStandings.length > 0 ? groupStandings.map((row) => (
                                    <tr key={row.team}>
                                        <td className="py-3 font-bold text-slate-500">{row.pos}</td>
                                        <td className="py-3">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={row.flag}
                                                    alt={row.team}
                                                    className="h-4 w-6 rounded-sm border border-slate-200 object-cover"
                                                />
                                                <span className="font-bold text-slate-900">{row.team}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center text-slate-500">{row.pj}</td>
                                        <td className="py-3 text-center text-slate-500">{row.dg > 0 ? `+${row.dg}` : row.dg}</td>
                                        <td className="py-3 text-center font-black text-slate-900">{row.pts}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                                            Sin partidos finalizados en este grupo
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : null}
        </>
    );
};

export default Predictions;
