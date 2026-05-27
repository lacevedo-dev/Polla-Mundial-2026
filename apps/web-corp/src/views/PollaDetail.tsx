import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, Circle, Trophy, Star, Save, Lock, Loader2, AlertTriangle, Zap, LayoutGrid, AlignJustify, Filter } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';

/* ─── Types ─────────────────────────────────────────────────── */

interface Team { id: string; name: string; shortCode: string | null; flagUrl: string | null; code: string; }
interface UpcomingMatch {
    id: string; matchDate: string; status: string;
    homeScore: number | null; awayScore: number | null;
    homeTeam: Team; awayTeam: Team;
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

function PredictionRow({ match, leagueId, closeMin, onSaved, compact = false }: {
    match: UpcomingMatch; leagueId: string; closeMin: number; compact?: boolean;
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

    const dateFmt = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(match.matchDate));
    const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(match.matchDate));
    const phase = (match as any).phase as string | undefined;
    const group = (match as any).group as string | undefined;

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
        <div className="border-b border-slate-100 px-4 py-4 last:border-b-0">
            <div className="space-y-3">
                {/* Cabecera: hora + estado */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{dateFmt} · {timeFmt}</span>
                        {live && <span className="text-[9px] font-black text-rose-500 animate-pulse uppercase">En vivo</span>}
                        {!live && !finished && canPredict && (
                            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary,#f59e0b)' }}>Abierto</span>
                        )}
                        {!live && !finished && !canPredict && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cerrado</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {match.myPrediction && !isDirty && <CheckCircle2 size={14} className="text-emerald-500" />}
                        {isDirty && !saving && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse block" />}
                        {saving && <Loader2 size={13} className="animate-spin text-slate-400" />}
                    </div>
                </div>

                {/* Grid 3 columnas: local — inputs — visitante */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                        <Flag team={match.homeTeam} size="lg" />
                        <span className="text-xs font-black uppercase text-slate-900">{homeCode}</span>
                        <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[70px] truncate">{match.homeTeam.name}</span>
                    </div>

                    {finished || live ? (
                        <div className="flex flex-col items-center gap-1">
                            <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 ${live ? 'bg-rose-600 border border-rose-200' : 'bg-slate-900 border border-slate-800'}`}>
                                <span className="text-xl font-black text-white">{match.homeScore ?? 0}</span>
                                <span className={`text-lg font-black ${live ? 'text-rose-300' : 'text-slate-500'}`}>:</span>
                                <span className="text-xl font-black text-white">{match.awayScore ?? 0}</span>
                            </div>
                            {finished && match.myPrediction?.points != null && (
                                <span className={`text-[11px] font-black tabular-nums ${match.myPrediction.points > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {match.myPrediction.points > 0 ? `+${match.myPrediction.points} pts` : '0 pts'}
                                </span>
                            )}
                            {finished && match.myPrediction && (
                                <span className="text-[9px] text-slate-400">Tu pred: {match.myPrediction.homeScore}–{match.myPrediction.awayScore}</span>
                            )}
                        </div>
                    ) : canPredict ? (
                        <div className="flex items-center gap-1.5 rounded-xl bg-white px-1.5 py-1 shadow-sm ring-1 ring-slate-200">
                            <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                                onChange={e => setHome(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="h-12 w-14 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 appearance-none"
                                style={{ borderColor: home !== '' ? 'var(--color-primary,#f59e0b)' : undefined }} />
                            <span className="text-base font-black text-slate-300">-</span>
                            <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                                onChange={e => setAway(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="h-12 w-14 rounded-xl border-2 border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 appearance-none"
                                style={{ borderColor: away !== '' ? 'var(--color-primary,#f59e0b)' : undefined }} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                            <span className="text-lg font-black text-slate-400">{match.myPrediction?.homeScore ?? '–'}</span>
                            <span className="text-base font-black text-slate-300">:</span>
                            <span className="text-lg font-black text-slate-400">{match.myPrediction?.awayScore ?? '–'}</span>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-1">
                        <Flag team={match.awayTeam} size="lg" />
                        <span className="text-xs font-black uppercase text-slate-900">{awayCode}</span>
                        <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[70px] truncate">{match.awayTeam.name}</span>
                    </div>
                </div>

                {/* Pie: fase/grupo + botón guardar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {phase && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                                {phase === 'GROUP' ? 'Grupos' : phase === 'ROUND_OF_32' ? 'R32' : phase === 'ROUND_OF_16' ? 'Octavos' : phase === 'QUARTER' ? 'Cuartos' : phase === 'SEMI' ? 'Semis' : phase === 'FINAL' ? 'Final' : phase}
                            </span>
                        )}
                        {group && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500 ring-1 ring-inset ring-slate-200">G{group}</span>
                        )}
                    </div>
                    {canPredict && (
                        <button onClick={submit} disabled={saving || !isDirty}
                            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all disabled:opacity-40"
                            style={saved
                                ? { backgroundColor: '#d1fae5', color: '#059669' }
                                : (isDirty || match.myPrediction)
                                    ? { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }
                                    : { backgroundColor: '#f1f5f9', color: '#94a3b8' }
                            }>
                            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
                        </button>
                    )}
                    {!canPredict && !finished && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-300 font-bold"><Lock size={11} /> Cerrado</span>
                    )}
                </div>

                {err && <p className="text-[10px] text-rose-500 flex items-center gap-1"><AlertTriangle size={10} /> {err}</p>}
            </div>
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
                        const filtered = phaseFilter === 'ALL' ? matches
                            : phaseFilter === 'GROUP' ? matches.filter(m => (m as any).phase === 'GROUP' || !(m as any).phase)
                            : matches.filter(m => (m as any).phase && (m as any).phase !== 'GROUP');
                        return (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                {/* Cabecera con controles */}
                                <div className="px-4 py-3 border-b border-slate-50 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                            <Clock size={14} className="text-slate-400" /> Partidos
                                        </h2>
                                        {/* Toggle vista */}
                                        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg">
                                            <button onClick={() => setViewMode('expanded')}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black transition-all ${viewMode === 'expanded' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                                                <LayoutGrid size={11} /> Normal
                                            </button>
                                            <button onClick={() => setViewMode('compact')}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black transition-all ${viewMode === 'compact' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                                                <AlignJustify size={11} /> Compacto
                                            </button>
                                        </div>
                                    </div>
                                    {/* Filtro de fase */}
                                    <div className="flex items-center gap-1.5">
                                        <Filter size={10} className="text-slate-400 shrink-0" />
                                        {(['ALL', 'GROUP', 'KNOCKOUT'] as const).map((f) => (
                                            <button key={f} onClick={() => setPhaseFilter(f)}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${phaseFilter === f ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                style={phaseFilter === f ? { backgroundColor: 'var(--color-primary,#f59e0b)' } : undefined}>
                                                {f === 'ALL' ? 'Todos' : f === 'GROUP' ? 'Grupos' : 'Eliminación'}
                                            </button>
                                        ))}
                                        <span className="ml-auto text-[10px] font-bold text-slate-400">{filtered.length} partidos</span>
                                    </div>
                                </div>

                                {filtered.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        No hay partidos{phaseFilter !== 'ALL' ? ' en esta fase' : ' en esta polla aún'}
                                    </div>
                                ) : (
                                    <div className={viewMode === 'compact' ? '' : 'divide-y divide-slate-100'}>
                                        {filtered.map((m) => (
                                            <PredictionRow
                                                key={m.id} match={m}
                                                leagueId={league.id}
                                                closeMin={league.closePredictionMinutes}
                                                onSaved={handlePredictionSaved}
                                                compact={viewMode === 'compact'}
                                            />
                                        ))}
                                    </div>
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
