import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, Trophy, Star, Save, Lock, Loader2, AlertTriangle, Zap, LayoutGrid, AlignJustify, Info, Search, Filter } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';

/* ─── Types ─────────────────────────────────────────────────── */

interface Team { id: string; name: string; shortCode: string | null; flagUrl: string | null; code: string; }
interface UpcomingMatch {
    id: string; matchDate: string; status: string;
    homeScore: number | null; awayScore: number | null;
    homeTeam: Team; awayTeam: Team;
    phase?: string | null;
    group?: string | null;
    venue?: string | null;
    myPrediction: { homeScore: number; awayScore: number; points: number | null } | null;
}
interface RecentPrediction {
    matchId: string; matchDate: string;
    homeTeam: string; awayTeam: string;
    homeScore: number | null; awayScore: number | null;
    predictedHome: number; predictedAway: number;
    points: number | null;
}
interface TopRankEntry {
    userId: string; name: string; username: string | null;
    avatar: string | null; totalPoints: number; rank: number; isMe: boolean;
}
interface LeagueDetail {
    id: string; name: string; description: string | null;
    status: string; participantsCount: number; maxParticipants: number;
    closePredictionMinutes: number; myPoints: number; myRank: number;
    scoringRules: { ruleType: string; points: number; description: string | null; multiplier: number }[];
    upcomingMatches: UpcomingMatch[];
    recentPredictions: RecentPrediction[];
    topRanking: TopRankEntry[];
}

/* ─── Helpers ────────────────────────────────────────────────── */

function isPredictionClosed(matchDate: string, closeMin = 15) {
    return Date.now() > new Date(matchDate).getTime() - closeMin * 60_000;
}
function isLiveStatus(s: string) { return ['LIVE', 'IN_PLAY', 'HALFTIME'].includes(s); }
function isFinishedStatus(s: string) { return ['FINISHED', 'FT'].includes(s); }

function formatMatchTime(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }).format(new Date(matchDate));
}
function getDateKey(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Bogota' }).format(new Date(matchDate));
}
function formatDateHeader(matchDate: string): string {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date(matchDate)).toUpperCase();
}
function getDaysUntil(matchDate: string): number | null {
    const diff = new Date(matchDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function formatPhaseLabel(phase?: string | null): string {
    switch (phase) {
        case 'GROUP': return 'Fase de grupos';
        case 'ROUND_OF_32': return 'R32';
        case 'ROUND_OF_16': return 'Octavos';
        case 'QUARTER': return 'Cuartos';
        case 'SEMI': return 'Semis';
        case 'FINAL': return 'Final';
        default: return phase ?? '';
    }
}

/* ─── PredictionRow ──────────────────────────────────────────── */

function Flag({ team, size = 'sm' }: { team: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>; size?: 'sm' | 'lg' }) {
    const abbr = (team.shortCode ?? team.name.slice(0, 3)).toUpperCase();
    const cls = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 object-cover shadow-sm'
        : 'w-7 h-5 object-cover rounded border border-slate-200';
    const fallback = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500'
        : 'w-7 h-5 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500';
    return team.flagUrl
        ? <img src={team.flagUrl} alt={abbr} className={cls} />
        : <div className={fallback}>{abbr.slice(0, 2)}</div>;
}

function PredictionRow({ match, leagueId, closeMin, onSaved, compact = false, isNext = false, isWithoutPrediction = false }: {
    match: UpcomingMatch; leagueId: string; closeMin: number; compact?: boolean;
    isNext?: boolean; isWithoutPrediction?: boolean;
    onSaved: (matchId: string, home: number, away: number) => void;
}) {
    const closed = isPredictionClosed(match.matchDate, closeMin);
    const live = isLiveStatus(match.status);
    const finished = isFinishedStatus(match.status);
    const canPredict = !closed && !finished && !live;

    const [home, setHome] = useState(match.myPrediction?.homeScore?.toString() ?? '');
    const [away, setAway] = useState(match.myPrediction?.awayScore?.toString() ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const initHome = match.myPrediction?.homeScore?.toString() ?? '';
    const initAway = match.myPrediction?.awayScore?.toString() ?? '';
    const isDirty = home !== initHome || away !== initAway;
    const homeCode = (match.homeTeam.shortCode ?? match.homeTeam.name.slice(0, 3)).toUpperCase();
    const awayCode = (match.awayTeam.shortCode ?? match.awayTeam.name.slice(0, 3)).toUpperCase();

    const timeFmt = formatMatchTime(match.matchDate);
    const daysUntil = getDaysUntil(match.matchDate);
    const phase = match.phase;
    const group = match.group;
    const venue = match.venue;

    function adjust(side: 'home' | 'away', delta: number) {
        if (side === 'home') setHome(v => String(Math.max(0, Math.min(99, (parseInt(v) || 0) + delta))));
        else setAway(v => String(Math.max(0, Math.min(99, (parseInt(v) || 0) + delta))));
    }

    async function submit() {
        const h = parseInt(home); const a = parseInt(away);
        if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { setErr('Marcadores inválidos'); return; }
        setSaving(true); setErr(null);
        try {
            await request('/predictions', { method: 'POST', body: JSON.stringify({ matchId: match.id, leagueId, homeScore: h, awayScore: a }) });
            setSaved(true); onSaved(match.id, h, a);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) { setErr(e?.message ?? 'Error al guardar'); }
        finally { setSaving(false); }
    }

    /* ── MODO COMPACTO: una sola línea ── */
    if (compact) {
        return (
            <div className={`px-3 py-2 border-b border-slate-50 last:border-0 transition-colors ${canPredict ? 'hover:bg-slate-50/60' : ''}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 w-12 text-right">
                        <span className="text-[9px] font-bold text-slate-400 block leading-tight">{dateFmt}</span>
                        <span className="text-[10px] font-black text-slate-600 block">{timeFmt}</span>
                    </div>
                    <div className="flex items-center gap-1 w-20 justify-end shrink-0">
                        <span className="text-[11px] font-black text-slate-800 truncate text-right">{homeCode}</span>
                        <Flag team={match.homeTeam} size="sm" />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {finished || live ? (
                            <>
                                <span className={`text-sm font-black ${live ? 'text-rose-600' : 'text-slate-900'}`}>{match.homeScore ?? 0}</span>
                                <span className="text-xs font-black text-slate-300">–</span>
                                <span className={`text-sm font-black ${live ? 'text-rose-600' : 'text-slate-900'}`}>{match.awayScore ?? 0}</span>
                                {live && <span className="text-[8px] font-black text-rose-500 animate-pulse ml-0.5">LIVE</span>}
                            </>
                        ) : canPredict ? (
                            <>
                                <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                                    onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                    className="w-9 h-8 text-center font-black text-sm rounded-lg border-2 focus:outline-none transition-colors appearance-none"
                                    style={{ borderColor: home !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                                <span className="text-xs font-black text-slate-300">–</span>
                                <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                                    onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                    className="w-9 h-8 text-center font-black text-sm rounded-lg border-2 focus:outline-none transition-colors appearance-none"
                                    style={{ borderColor: away !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                            </>
                        ) : (
                            <div className="flex items-center gap-1 opacity-40">
                                <span className="w-9 h-8 flex items-center justify-center text-sm font-black text-slate-400 border-2 border-slate-100 rounded-lg bg-slate-50">{match.myPrediction?.homeScore ?? '–'}</span>
                                <span className="text-xs font-black text-slate-300">–</span>
                                <span className="w-9 h-8 flex items-center justify-center text-sm font-black text-slate-400 border-2 border-slate-100 rounded-lg bg-slate-50">{match.myPrediction?.awayScore ?? '–'}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 w-20 shrink-0">
                        <Flag team={match.awayTeam} size="sm" />
                        <span className="text-[11px] font-black text-slate-800 truncate">{awayCode}</span>
                    </div>
                    <div className="ml-auto shrink-0 flex items-center gap-1.5">
                        {finished && match.myPrediction?.points != null && (
                            <span className="text-xs font-black" style={{ color: match.myPrediction.points > 0 ? 'var(--color-primary,#f59e0b)' : '#94a3b8' }}>
                                {match.myPrediction.points > 0 ? `+${match.myPrediction.points}` : '0'}pts
                            </span>
                        )}
                        {canPredict && (
                            <button onClick={submit} disabled={saving || !isDirty}
                                className="flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30 whitespace-nowrap"
                                style={saved ? { backgroundColor: '#d1fae5', color: '#059669' } : { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }}>
                                {saving ? <Loader2 size={10} className="animate-spin" /> : saved ? <CheckCircle2 size={10} /> : <Save size={10} />}
                                {saved ? 'OK' : 'Guardar'}
                            </button>
                        )}
                        {!canPredict && !finished && <span className="flex items-center gap-0.5 text-[10px] text-slate-300 font-bold"><Lock size={9} /> Cerrado</span>}
                        {canPredict && match.myPrediction && !isDirty && <CheckCircle2 size={13} className="text-emerald-400" />}
                    </div>
                </div>
                {err && <p className="text-[10px] text-rose-500 mt-1 pl-14 flex items-center gap-1"><AlertTriangle size={9} /> {err}</p>}
            </div>
        );
    }

    /* ── MODO EXPANDIDO: layout tipo portal web ── */
    return (
        <div className="border-b border-slate-100 px-4 py-3.5 last:border-b-0">
            {/* Header: hora + días + badges + botones */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div>
                        <span className="text-sm font-black text-slate-900 block">{timeFmt}</span>
                        {daysUntil !== null && (
                            <span className="text-[10px] font-black block" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                {daysUntil} DÍA{daysUntil !== 1 ? 'S' : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                        {live && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-600 border border-rose-200 animate-pulse">EN VIVO</span>}
                        {finished && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200">FINALIZADO</span>}
                        {canPredict && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-lime-100 text-lime-700 border border-lime-200">ABIERTO</span>}
                        {!canPredict && !finished && !live && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200">CERRADO</span>}
                        {isNext && <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-600 border border-amber-200">SIGUIENTE</span>}
                        {isWithoutPrediction && canPredict && (
                            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-orange-100 text-orange-600 border border-orange-200">
                                <Zap size={8} /> SIN PRONÓSTICO
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button title="Información" className="h-8 w-8 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50">
                        <Info size={13} />
                    </button>
                    {canPredict ? (
                        <button onClick={submit} disabled={saving || !isDirty}
                            className="h-8 w-8 flex items-center justify-center rounded-full transition-all disabled:opacity-40"
                            style={saved
                                ? { backgroundColor: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0' }
                                : (isDirty || match.myPrediction)
                                    ? { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }
                                    : { backgroundColor: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' }
                            }>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                        </button>
                    ) : (
                        <div className="h-8 w-8 flex items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                            <Lock size={12} className="text-slate-300" />
                        </div>
                    )}
                </div>
            </div>

            {/* Equipos + marcador */}
            <div className="flex items-center gap-2">
                {/* Local */}
                <div className="flex flex-1 items-center gap-2 justify-end min-w-0">
                    <div className="text-right min-w-0">
                        <span className="hidden sm:block text-[10px] font-black uppercase text-slate-900 truncate">{match.homeTeam.name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{homeCode}</span>
                    </div>
                    <Flag team={match.homeTeam} size="lg" />
                </div>

                {finished || live ? (
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2 ${live ? 'bg-rose-600' : 'bg-slate-900'}`}>
                            <span className="text-lg font-black text-white">{match.homeScore ?? 0}</span>
                            <span className={`text-sm font-black ${live ? 'text-rose-300' : 'text-slate-500'}`}>:</span>
                            <span className="text-lg font-black text-white">{match.awayScore ?? 0}</span>
                        </div>
                    </div>
                ) : canPredict ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                            <button type="button" onClick={() => adjust('home', -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">−</button>
                            <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                                onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none appearance-none" />
                            <button type="button" onClick={() => adjust('home', 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">+</button>
                        </div>
                        <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                            onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                            className="sm:hidden h-12 w-14 rounded-xl border-2 bg-white text-center text-lg font-black outline-none transition appearance-none"
                            style={{ borderColor: home !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                        <span className="text-base font-black text-slate-300">–</span>
                        <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                            <button type="button" onClick={() => adjust('away', -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">−</button>
                            <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                                onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="h-8 w-10 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-black text-slate-900 outline-none appearance-none" />
                            <button type="button" onClick={() => adjust('away', 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-slate-400 hover:bg-slate-100">+</button>
                        </div>
                        <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                            onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                            className="sm:hidden h-12 w-14 rounded-xl border-2 bg-white text-center text-lg font-black outline-none transition appearance-none"
                            style={{ borderColor: away !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 shrink-0">
                        <span className="text-lg font-black text-slate-400">{match.myPrediction?.homeScore ?? '–'}</span>
                        <span className="text-base font-black text-slate-300">:</span>
                        <span className="text-lg font-black text-slate-400">{match.myPrediction?.awayScore ?? '–'}</span>
                    </div>
                )}

                {/* Visitante */}
                <div className="flex flex-1 items-center gap-2 min-w-0">
                    <Flag team={match.awayTeam} size="lg" />
                    <div className="min-w-0">
                        <span className="hidden sm:block text-[10px] font-black uppercase text-slate-900 truncate">{match.awayTeam.name}</span>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{awayCode}</span>
                    </div>
                </div>
            </div>

            {/* Footer: fase + grupo + venue | predicción guardada */}
            <div className="flex items-center justify-between mt-2.5 flex-wrap gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {phase && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">{formatPhaseLabel(phase)}</span>}
                    {group && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 ring-1 ring-inset ring-slate-200">G{group}</span>}
                    {venue && <span className="text-[9px] text-slate-400">{venue}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {finished && match.myPrediction && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                            <CheckCircle2 size={10} /> {match.myPrediction.homeScore}–{match.myPrediction.awayScore}
                            {match.myPrediction.points != null && (
                                <span className={match.myPrediction.points > 0 ? '' : 'text-slate-400'}>
                                    {match.myPrediction.points > 0 ? `+${match.myPrediction.points}pts` : '0pts'}
                                </span>
                            )}
                        </span>
                    )}
                    {isWithoutPrediction && canPredict && (
                        <span className="hidden sm:block text-[9px] text-slate-400">Completa y guarda para cerrar este partido.</span>
                    )}
                </div>
            </div>

            {err && <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-1"><AlertTriangle size={10} /> {err}</p>}
        </div>
    );
}

/* ─── Component ─────────────────────────────────────────────── */

export default function PollaDetail() {
    const { id } = useParams<{ id: string }>();
    const [league, setLeague] = useState<LeagueDetail | null>(null);
    const [matches, setMatches] = useState<UpcomingMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'partidos' | 'ranking' | 'reglas'>('partidos');
    const [viewMode, setViewMode] = useState<'expanded' | 'compact'>('expanded');
    const [phaseFilter, setPhaseFilter] = useState<'ALL' | 'GROUP' | 'KNOCKOUT'>('ALL');
    const [groupFilter, setGroupFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        request<LeagueDetail>(`/corp/leagues/${id}`)
            .then((l) => { setLeague(l); setMatches(l.upcomingMatches); })
            .catch(() => setLeague(null))
            .finally(() => setLoading(false));
    }, [id]);

    function handlePredictionSaved(matchId: string, home: number, away: number) {
        setMatches((prev) => prev.map((m) =>
            m.id === matchId ? { ...m, myPrediction: { homeScore: home, awayScore: away, points: null } } : m
        ));
    }

    const pendingCount = matches.filter((m) => {
        const cl = isPredictionClosed(m.matchDate, league?.closePredictionMinutes ?? 15);
        return !cl && !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !m.myPrediction;
    }).length;

    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

    return (
        <CorpLayout>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4 transition-colors">
                <ArrowLeft size={15} /> Dashboard
            </Link>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
                </div>
            ) : !league ? (
                <div className="text-center py-20 text-slate-400">
                    <Trophy size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="font-semibold">Polla no encontrada</p>
                    <Link to="/pollas" className="mt-2 inline-block text-sm font-bold hover:underline" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                        Ver todas las pollas
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Hero */}
                    <div className="rounded-2xl p-5 text-white shadow-md"
                        style={{ background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 55%, #1e293b))' }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Polla</p>
                        <h1 className="text-2xl font-black">{league.name}</h1>
                        {league.description && <p className="text-sm text-white/70 mt-1">{league.description}</p>}
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {[
                                { label: 'Mis puntos', value: league.myPoints },
                                { label: 'Mi posición', value: `#${league.myRank}` },
                                { label: 'Participantes', value: `${league.participantsCount}/${league.maxParticipants}` },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-white/15 rounded-xl p-3 text-center">
                                    <p className="text-lg font-black">{value}</p>
                                    <p className="text-[10px] text-white/70 font-medium mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alerta pronósticos pendientes */}
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary,#f59e0b) 10%, white)', borderColor: 'color-mix(in srgb, var(--color-primary,#f59e0b) 35%, white)', color: 'color-mix(in srgb, var(--color-primary,#f59e0b) 80%, #1e293b)' }}>
                            <Zap size={15} />
                            <span>{pendingCount} partido{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de pronóstico</span>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                        {(['partidos', 'ranking', 'reglas'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Tab: Partidos */}
                    {tab === 'partidos' && (() => {
                        const closeMin = league.closePredictionMinutes;

                        // Filtro fase
                        const byPhase = phaseFilter === 'ALL' ? matches
                            : phaseFilter === 'GROUP' ? matches.filter(m => m.phase === 'GROUP' || !m.phase)
                            : matches.filter(m => m.phase && m.phase !== 'GROUP');

                        // Grupos disponibles
                        const availableGroups = Array.from(
                            new Set(byPhase.filter(m => m.group).map(m => m.group!))
                        ).sort();
                        const showGroupFilter = phaseFilter !== 'KNOCKOUT' && availableGroups.length > 1;

                        // Filtro grupo + búsqueda
                        const byGroup = (groupFilter === 'ALL' || !showGroupFilter)
                            ? byPhase : byPhase.filter(m => m.group === groupFilter);
                        const filtered = search.trim()
                            ? byGroup.filter(m =>
                                m.homeTeam.name.toLowerCase().includes(search.toLowerCase()) ||
                                m.awayTeam.name.toLowerCase().includes(search.toLowerCase()) ||
                                (m.homeTeam.shortCode ?? '').toLowerCase().includes(search.toLowerCase()) ||
                                (m.awayTeam.shortCode ?? '').toLowerCase().includes(search.toLowerCase())
                            )
                            : byGroup;

                        // Secciones
                        const nextMatch = filtered.find(m => !isFinishedStatus(m.status) && !isLiveStatus(m.status));
                        const withoutPrediction = filtered.filter(m => {
                            const cl = isPredictionClosed(m.matchDate, closeMin);
                            return !cl && !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !m.myPrediction && m.id !== nextMatch?.id;
                        });
                        const rest = filtered.filter(m => m.id !== nextMatch?.id && !withoutPrediction.find(x => x.id === m.id));

                        // Agrupación por fecha para "resto"
                        const restByDate: Record<string, UpcomingMatch[]> = {};
                        for (const m of rest) {
                            const k = getDateKey(m.matchDate);
                            if (!restByDate[k]) restByDate[k] = [];
                            restByDate[k].push(m);
                        }
                        const restDates = Object.keys(restByDate).sort();

                        // Agrupación por fecha para "sin pronóstico"
                        const noPredByDate: Record<string, UpcomingMatch[]> = {};
                        for (const m of withoutPrediction) {
                            const k = getDateKey(m.matchDate);
                            if (!noPredByDate[k]) noPredByDate[k] = [];
                            noPredByDate[k].push(m);
                        }
                        const noPredDates = Object.keys(noPredByDate).sort();

                        const makeRow = (m: UpcomingMatch, opts?: { isNext?: boolean; isWithoutPrediction?: boolean }) => (
                            <PredictionRow
                                key={m.id} match={m}
                                leagueId={league.id}
                                closeMin={closeMin}
                                onSaved={handlePredictionSaved}
                                compact={viewMode === 'compact'}
                                isNext={opts?.isNext}
                                isWithoutPrediction={opts?.isWithoutPrediction}
                            />
                        );

                        return (
                            <div className="space-y-3">
                                {/* Barra de controles */}
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 space-y-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Sub-tabs GRUPOS | FASES */}
                                        <div className="flex items-center gap-0.5 p-0.5 bg-slate-900 rounded-xl">
                                            {(['GROUP', 'KNOCKOUT'] as const).map((f) => (
                                                <button key={f}
                                                    onClick={() => { setPhaseFilter(f); setGroupFilter('ALL'); }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                                        phaseFilter === f || (f === 'GROUP' && phaseFilter === 'ALL')
                                                            ? 'bg-white text-slate-900 shadow-sm'
                                                            : 'text-slate-400 hover:text-white'
                                                    }`}>
                                                    {f === 'GROUP' ? 'Grupos' : 'Fases'}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Vista */}
                                        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg ml-auto">
                                            <button onClick={() => setViewMode('expanded')}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black transition-all ${viewMode === 'expanded' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                                                <LayoutGrid size={11} /> Normal
                                            </button>
                                            <button onClick={() => setViewMode('compact')}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black transition-all ${viewMode === 'compact' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                                                <AlignJustify size={11} /> Compacto
                                            </button>
                                        </div>
                                    </div>
                                    {/* Filtro letra de grupo */}
                                    {showGroupFilter && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <button onClick={() => setGroupFilter('ALL')}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${groupFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                General
                                            </button>
                                            {availableGroups.map(g => (
                                                <button key={g} onClick={() => setGroupFilter(g)}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${groupFilter === g ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                    style={groupFilter === g ? { backgroundColor: 'var(--color-primary,#f59e0b)' } : undefined}>
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {/* Buscador */}
                                    <div className="relative">
                                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                                            placeholder="Buscar equipo..."
                                            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 outline-none focus:border-slate-300 focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>

                                {filtered.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
                                        {search ? `Sin resultados para "${search}"` : 'No hay partidos en esta polla aún'}
                                    </div>
                                ) : (
                                    <>
                                        {/* Próximo partido */}
                                        {nextMatch && (
                                            <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: 'var(--color-primary,#f59e0b)' }}>
                                                <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--color-primary,#f59e0b)' }}>
                                                    <Zap size={12} className="text-white" />
                                                    <span className="text-[11px] font-black text-white uppercase tracking-wider">
                                                        {isLiveStatus(nextMatch.status) ? 'En vivo' : 'Próximo partido'}
                                                    </span>
                                                </div>
                                                <div className="bg-white">
                                                    {makeRow(nextMatch, { isNext: true })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Sin pronóstico — agrupado por fecha */}
                                        {withoutPrediction.length > 0 && (
                                            <div className="rounded-2xl border border-amber-200 overflow-hidden" style={{ backgroundColor: '#fffbeb' }}>
                                                <div className="px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
                                                    <AlertTriangle size={12} className="text-amber-500" />
                                                    <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">
                                                        Sin pronóstico ({withoutPrediction.length})
                                                    </span>
                                                </div>
                                                {noPredDates.map(dateKey => {
                                                    const dayMatches = noPredByDate[dateKey];
                                                    const firstDate = dayMatches[0].matchDate;
                                                    return (
                                                        <div key={dateKey}>
                                                            <div className="px-4 py-1.5 border-b border-amber-100 flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                                    ↑ Ingresa tu pronóstico
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400">{formatDateHeader(firstDate)}</span>
                                                            </div>
                                                            <div className={`bg-white ${viewMode === 'compact' ? '' : 'divide-y divide-slate-100'}`}>
                                                                {dayMatches.map(m => makeRow(m, { isWithoutPrediction: true }))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Resto — agrupado por fecha */}
                                        {rest.length > 0 && (
                                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                                {restDates.map(dateKey => {
                                                    const dayMatches = restByDate[dateKey];
                                                    const firstDate = dayMatches[0].matchDate;
                                                    const primaryGroup = dayMatches.find(m => m.group)?.group;
                                                    return (
                                                        <div key={dateKey}>
                                                            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Clock size={10} className="text-slate-400" />
                                                                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">{formatDateHeader(firstDate)}</span>
                                                                </div>
                                                                {primaryGroup && (
                                                                    <button
                                                                        onClick={() => { setPhaseFilter('GROUP'); setGroupFilter(primaryGroup); }}
                                                                        className="text-[10px] font-black hover:opacity-70 transition-opacity"
                                                                        style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                                        Ver Grupo {primaryGroup} &rsaquo;
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className={viewMode === 'compact' ? '' : 'divide-y divide-slate-100'}>
                                                                {dayMatches.map(m => makeRow(m))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    {/* Tab: Ranking */}
                    {tab === 'ranking' && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3.5 border-b border-slate-50">
                                <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                    <Star size={14} className="text-slate-400" /> Clasificación
                                </h2>
                            </div>
                            {league.topRanking.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Sin puntuaciones aún</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {league.topRanking.map((entry) => (
                                        <div key={entry.userId}
                                            className="flex items-center gap-3 px-4 py-3"
                                            style={entry.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' } : undefined}>
                                            <span className="text-base w-8 text-center shrink-0 font-bold text-slate-400">
                                                {MEDAL[entry.rank] ?? `#${entry.rank}`}
                                            </span>
                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                {entry.avatar
                                                    ? <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                                    : <span className="text-xs font-black text-slate-400">{entry.name.charAt(0)}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate"
                                                    style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#1e293b' }}>
                                                    {entry.name}{entry.isMe && <span className="text-xs opacity-60 ml-1">(tú)</span>}
                                                </p>
                                                {entry.username && <p className="text-[10px] text-slate-400">@{entry.username}</p>}
                                            </div>
                                            <span className="text-sm font-black text-slate-700 shrink-0">{entry.totalPoints} pts</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="border-t border-slate-50 px-4 py-3 text-center">
                                <Link to="/ranking" className="text-xs font-bold hover:opacity-80 transition-opacity" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                    Ver ranking global →
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Tab: Reglas */}
                    {tab === 'reglas' && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3.5 border-b border-slate-50">
                                <h2 className="font-black text-slate-900 text-sm">Reglas de puntuación</h2>
                            </div>
                            {league.scoringRules.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Sin reglas configuradas</div>
                            ) : (
                                <div className="px-4 py-2 divide-y divide-slate-50">
                                    {league.scoringRules.map((r) => (
                                        <div key={r.ruleType} className="flex items-center justify-between py-3">
                                            <span className="text-sm text-slate-700 font-medium">{r.description ?? r.ruleType}</span>
                                            <span className="text-sm font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>{r.points} pts</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="px-4 py-4 border-t border-slate-50 bg-slate-50">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Clock size={12} />
                                    <span>Los pronósticos cierran {league.closePredictionMinutes} min antes del partido</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </CorpLayout>
    );
}
