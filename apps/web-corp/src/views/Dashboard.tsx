import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Trophy, Users, ChevronRight,
    Clock, CheckCircle2, Star, Save, Lock, Loader2, AlertTriangle,
    Zap, Radio,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

/* ─── Types ─────────────────────────────────────────────────── */

interface Team { id: string; name: string; shortCode: string | null; flagUrl: string | null; }
interface UpcomingMatch {
    id: string; matchDate: string; status: string;
    homeScore: number | null; awayScore: number | null;
    homeTeam: Team; awayTeam: Team;
    myPrediction: { homeScore: number; awayScore: number; points: number | null } | null;
}
interface RecentPrediction {
    matchDate: string; status: string;
    homeScore: number | null; awayScore: number | null;
    homeTeam: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>;
    awayTeam: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>;
    myHome: number; myAway: number; points: number | null;
}
interface TopRankEntry {
    rank: number; userId: string; name: string;
    username: string; avatar: string | null;
    totalPoints: number; isMe: boolean;
}
interface LeagueDetail {
    id: string; name: string; description: string | null;
    status: string; participantsCount: number; maxParticipants: number;
    closePredictionMinutes: number; myPoints: number; myRank: number;
    scoringRules: { ruleType: string; points: number; description: string | null }[];
    upcomingMatches: UpcomingMatch[];
    recentPredictions: RecentPrediction[];
    topRanking: TopRankEntry[];
}
interface DashboardData {
    myLeagues: { id: string; name: string; participantsCount: number; myPoints: number }[];
    globalRank: number | null;
    totalMembers: number;
    predictionsPending: number;
    tenantRole: string;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function isPredictionClosed(matchDate: string, closeMin = 15) {
    return Date.now() > new Date(matchDate).getTime() - closeMin * 60_000;
}
function isLive(s: string) { return ['LIVE', 'IN_PLAY', 'HALFTIME'].includes(s); }
function isFinished(s: string) { return ['FINISHED', 'FT'].includes(s); }
function fmtTime(d: string) { return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d)); }
function fmtDate(d: string) { return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(d)); }

/* ─── Sub-components ─────────────────────────────────────────── */

function Flag({ team, size = 'sm' }: { team: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>; size?: 'sm' | 'lg' | 'xs' }) {
    const abbr = (team.shortCode ?? team.name.slice(0, 3)).toUpperCase();
    const cls = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 object-cover shadow-sm'
        : size === 'xs'
        ? 'w-5 h-3.5 object-cover rounded border border-slate-200 shrink-0'
        : 'w-7 h-5 object-cover rounded border border-slate-200 shrink-0';
    const fallback = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500'
        : size === 'xs'
        ? 'w-5 h-3.5 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-500 shrink-0'
        : 'w-7 h-5 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0';
    return team.flagUrl
        ? <img src={team.flagUrl} alt={abbr} className={cls} />
        : <div className={fallback}>{abbr.slice(0, 2)}</div>;
}

function PredRow({ match, leagueId, closeMin, onSaved }: {
    match: UpcomingMatch; leagueId: string; closeMin: number; compact?: boolean;
    onSaved: (matchId: string, h: number, a: number) => void;
}) {
    const closed = isPredictionClosed(match.matchDate, closeMin);
    const live = isLive(match.status);
    const finished = isFinished(match.status);
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

    async function submit() {
        const h = parseInt(home), a = parseInt(away);
        if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { setErr('Marcadores inválidos'); return; }
        setSaving(true); setErr(null);
        try {
            await request('/predictions', { method: 'POST', body: JSON.stringify({ matchId: match.id, leagueId, homeScore: h, awayScore: a }) });
            setSaved(true); onSaved(match.id, h, a);
            setTimeout(() => setSaved(false), 2000);
        } catch (e: any) { setErr(e?.message ?? 'Error'); }
        finally { setSaving(false); }
    }

    return (
        <div className={`px-3 py-2.5 border-b border-slate-50 last:border-0 transition-colors ${canPredict ? 'hover:bg-slate-50/60' : ''}`}>
            <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0 w-12 text-right">
                    <span className="text-[9px] font-bold text-slate-400 block leading-tight">{fmtDate(match.matchDate)}</span>
                    <span className="text-[10px] font-black text-slate-600 block">{fmtTime(match.matchDate)}</span>
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
                        <div className="flex items-center gap-1 opacity-50">
                            <span className="w-9 h-8 flex items-center justify-center font-black text-sm text-slate-400 border-2 border-slate-100 rounded-lg bg-slate-50">{match.myPrediction?.homeScore ?? '–'}</span>
                            <span className="text-xs font-black text-slate-300">–</span>
                            <span className="w-9 h-8 flex items-center justify-center font-black text-sm text-slate-400 border-2 border-slate-100 rounded-lg bg-slate-50">{match.myPrediction?.awayScore ?? '–'}</span>
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
            {err && <p className="text-[9px] text-rose-500 mt-1 pl-14 flex items-center gap-1"><AlertTriangle size={9} />{err}</p>}
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────── */

export default function Dashboard() {
    const tenant = useTenantStore((s) => s.tenant);
    const { user, setTenantRole } = useAuthStore();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loadingDash, setLoadingDash] = useState(true);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
    const [leagueDetail, setLeagueDetail] = useState<LeagueDetail | null>(null);
    const [matches, setMatches] = useState<UpcomingMatch[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        request<DashboardData>('/corp/dashboard')
            .then((d) => {
                setData(d);
                if (d.tenantRole) setTenantRole(d.tenantRole);
                if (d.myLeagues.length) setSelectedLeagueId(d.myLeagues[0].id);
            })
            .catch(() => setData(null))
            .finally(() => setLoadingDash(false));
    }, []);

    useEffect(() => {
        if (!selectedLeagueId) return;
        setLoadingDetail(true);
        request<LeagueDetail>(`/corp/leagues/${selectedLeagueId}`)
            .then((l) => { setLeagueDetail(l); setMatches(l.upcomingMatches); })
            .catch(() => setLeagueDetail(null))
            .finally(() => setLoadingDetail(false));
    }, [selectedLeagueId]);

    function onSaved(matchId: string, h: number, a: number) {
        setMatches(prev => prev.map(m => m.id === matchId
            ? { ...m, myPrediction: { homeScore: h, awayScore: a, points: null } }
            : m
        ));
    }

    const Spinner = () => (
        <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: 'var(--color-primary,#f59e0b)', borderTopColor: 'transparent' }} />
    );

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? '';
    const pendingCount = data?.predictionsPending ?? 0;

    const liveMatches = useMemo(() => matches.filter(m => isLive(m.status)), [matches]);
    const openMatches = useMemo(() => matches.filter(m => !isLive(m.status) && !isFinished(m.status)), [matches]);

    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

    /* ── Métricas de rendimiento calculadas desde predicciones recientes ── */
    const aciertos = useMemo(() => leagueDetail?.recentPredictions.filter(p => isFinished(p.status) && (p.points ?? 0) > 0).length ?? 0, [leagueDetail]);
    const errores = useMemo(() => leagueDetail?.recentPredictions.filter(p => isFinished(p.status) && (p.points ?? 0) === 0).length ?? 0, [leagueDetail]);
    const racha = useMemo(() => {
        if (!leagueDetail) return 0;
        let r = 0;
        for (const p of [...leagueDetail.recentPredictions].reverse()) {
            if (!isFinished(p.status)) continue;
            if ((p.points ?? 0) > 0) r++; else break;
        }
        return r;
    }, [leagueDetail]);
    const tasa = useMemo(() => {
        const total = aciertos + errores;
        return total > 0 ? ((aciertos / total) * 100).toFixed(1) : '0.0';
    }, [aciertos, errores]);

    return (
        <CorpLayout>
            {/* ── Header ── */}
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                        {orgName || 'Mi Dashboard'}
                    </h1>
                    {leagueDetail && (
                        <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-wide">
                            {leagueDetail.name}
                            {leagueDetail.participantsCount != null && ` · ${leagueDetail.participantsCount} participante${leagueDetail.participantsCount !== 1 ? 's' : ''}`}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link to={leagueDetail ? `/pollas/${leagueDetail.id}` : '/pollas'}
                        className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                        style={{ background: 'var(--color-primary,#f59e0b)' }}>
                        <Zap size={12} />
                        Pronosticar
                    </Link>
                    {leagueDetail && (
                        <Link to={`/pollas/${leagueDetail.id}`}
                            className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                            <Users size={12} />
                            Invitar
                        </Link>
                    )}
                </div>
            </div>

            {/* ── League selector ── */}
            {!loadingDash && data?.myLeagues && data.myLeagues.length > 1 && (
                <div className="flex gap-1.5 flex-wrap mb-4">
                    {data.myLeagues.map((l) => (
                        <button key={l.id} onClick={() => setSelectedLeagueId(l.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black transition-all border"
                            style={selectedLeagueId === l.id
                                ? { background: 'var(--color-primary,#f59e0b)', color: '#fff', borderColor: 'transparent' }
                                : { background: 'white', color: '#64748b', borderColor: '#f1f5f9' }}>
                            {l.name}
                            <span className="ml-1.5 opacity-70">{l.myPoints}pts</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Empty state ── */}
            {!loadingDash && !selectedLeagueId && (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <Trophy size={32} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">No estás en ninguna polla aún</p>
                    <Link to="/pollas" className="mt-2 inline-block text-sm font-bold hover:underline"
                        style={{ color: 'var(--color-primary,#f59e0b)' }}>
                        Explorar pollas →
                    </Link>
                </div>
            )}

            {selectedLeagueId && (
                loadingDetail ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><Spinner /></div>
                ) : !leagueDetail ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">Error cargando la polla.</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4 items-start">

                        {/* ══ COLUMNA IZQUIERDA: Cupos + Reglas de puntos ══ */}
                        <div className="space-y-4">

                            {/* Cupos de liga */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Cupos de liga</h3>
                                    <Users size={13} className="text-slate-300" />
                                </div>
                                <div className="px-4 py-4">
                                    <div className="flex items-end gap-1 mb-1">
                                        <span className="text-3xl font-black text-slate-900 leading-none">{leagueDetail.participantsCount}</span>
                                        <span className="text-sm text-slate-400 font-bold mb-0.5">/ {leagueDetail.maxParticipants > 0 ? leagueDetail.maxParticipants : '∞'}</span>
                                        {leagueDetail.maxParticipants > 0 && (
                                            <span className="ml-auto text-[11px] font-black text-slate-400">
                                                {Math.round((leagueDetail.participantsCount / leagueDetail.maxParticipants) * 100)}%
                                            </span>
                                        )}
                                    </div>
                                    {leagueDetail.maxParticipants > 0 && (
                                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2">
                                            <div className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(100, (leagueDetail.participantsCount / leagueDetail.maxParticipants) * 100)}%`,
                                                    background: 'var(--color-primary,#f59e0b)'
                                                }} />
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-3">
                                        <Link to={`/pollas/${leagueDetail.id}`}
                                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
                                            <Star size={10} /> Configurar
                                        </Link>
                                        <Link to={`/pollas/${leagueDetail.id}`}
                                            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                                            style={{ background: 'var(--color-primary,#f59e0b)' }}>
                                            <Users size={10} /> Invitar
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Reglas de puntos */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Reglas de puntos</h3>
                                </div>
                                <div className="p-3 space-y-1.5">
                                    {(leagueDetail.scoringRules.length > 0
                                        ? leagueDetail.scoringRules.map(r => ({ label: r.description ?? r.ruleType, pts: r.points, icon: '' }))
                                        : [
                                            { label: 'Marcador exacto', pts: 5, icon: '🎯', sub: 'Ambos goles exactos' },
                                            { label: 'Ganador + gol', pts: 3, icon: '✅', sub: 'Resultado + un marcador correcto' },
                                            { label: 'Solo ganador', pts: 2, icon: '☑', sub: 'Empate o equipo ganador' },
                                            { label: 'Solo gol acertado', pts: 1, icon: '⚽', sub: 'Al menos un marcador exacto' },
                                        ] as any[]
                                    ).map((r: any) => (
                                        <div key={r.label} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
                                            {r.icon && <span className="text-base shrink-0">{r.icon}</span>}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-black text-slate-800 truncate">{r.label}</p>
                                                {r.sub && <p className="text-[9px] text-slate-400 truncate">{r.sub}</p>}
                                            </div>
                                            <span className="text-sm font-black shrink-0" style={{ color: 'var(--color-primary,#f59e0b)' }}>{r.pts} pts</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 pb-3">
                                    <p className="text-[9px] text-slate-400 leading-snug">
                                        El marcador exacto (5pts) no se suma con otros bonos. El resto es aditivo.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ══ COLUMNA CENTRAL: Rendimiento + Predicciones recientes ══ */}
                        <div className="space-y-4">

                            {/* Partidos en vivo */}
                            {liveMatches.length > 0 && (
                                <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-sm">
                                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
                                        <Radio size={12} className="text-rose-400 animate-pulse" />
                                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">En vivo</span>
                                        <span className="ml-auto text-[10px] text-slate-500 font-bold">{liveMatches.length} partido{liveMatches.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="divide-y divide-slate-800">
                                        {liveMatches.map((m) => {
                                            const hc = (m.homeTeam.shortCode ?? m.homeTeam.name.slice(0, 3)).toUpperCase();
                                            const ac = (m.awayTeam.shortCode ?? m.awayTeam.name.slice(0, 3)).toUpperCase();
                                            return (
                                                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        {m.homeTeam.flagUrl ? <img src={m.homeTeam.flagUrl} alt={hc} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-700 shrink-0" />}
                                                        <span className="text-[11px] font-black text-white truncate">{hc}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-base font-black text-rose-400 tabular-nums">{m.homeScore ?? 0}</span>
                                                        <span className="text-xs font-black text-slate-600">–</span>
                                                        <span className="text-base font-black text-rose-400 tabular-nums">{m.awayScore ?? 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                                        <span className="text-[11px] font-black text-white truncate text-right">{ac}</span>
                                                        {m.awayTeam.flagUrl ? <img src={m.awayTeam.flagUrl} alt={ac} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-700 shrink-0" />}
                                                    </div>
                                                    {m.myPrediction && (
                                                        <span className="text-[10px] font-black text-slate-400 shrink-0">{m.myPrediction.homeScore}–{m.myPrediction.awayScore}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Mi rendimiento */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mi rendimiento</h3>
                                </div>
                                <div className="p-3 grid grid-cols-2 gap-2.5">
                                    <div className="rounded-xl p-3 text-white" style={{ background: '#22c55e' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Aciertos</p>
                                        <p className="text-3xl font-black leading-none mt-1">{aciertos}</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-white" style={{ background: '#ef4444' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Errores</p>
                                        <p className="text-3xl font-black leading-none mt-1">{errores}</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-white" style={{ background: '#f59e0b' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Racha</p>
                                        <p className="text-3xl font-black leading-none mt-1">{racha}</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-white" style={{ background: '#3b82f6' }}>
                                        <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Tasa</p>
                                        <p className="text-3xl font-black leading-none mt-1">{tasa}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Predicciones recientes */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Predicciones recientes</h3>
                                    <Link to={`/pollas/${leagueDetail.id}`} className="text-[10px] font-black hover:opacity-70 transition-opacity" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                        VER TODAS
                                    </Link>
                                </div>
                                {leagueDetail.recentPredictions.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <p className="text-sm text-slate-400 font-bold mb-3">Aún no haces predicciones</p>
                                        <Link to={`/pollas/${leagueDetail.id}`}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[11px] font-black transition-opacity hover:opacity-90"
                                            style={{ background: 'var(--color-primary,#f59e0b)' }}>
                                            <Zap size={11} /> IR A PRONÓSTICOS →
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {leagueDetail.recentPredictions.slice(0, 6).map((p, i) => {
                                            const hc = (p.homeTeam.shortCode ?? p.homeTeam.name.slice(0, 3)).toUpperCase();
                                            const ac = (p.awayTeam.shortCode ?? p.awayTeam.name.slice(0, 3)).toUpperCase();
                                            const fin = isFinished(p.status);
                                            const pts = p.points ?? 0;
                                            const isExact = fin && pts >= 5;
                                            const hasPoints = fin && pts > 0 && pts < 5;
                                            return (
                                                <div key={i} className={`px-4 py-3 flex items-center gap-3 ${isExact ? 'bg-emerald-50/60' : hasPoints ? 'bg-amber-50/40' : ''}`}>
                                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                                        {p.homeTeam.flagUrl ? <img src={p.homeTeam.flagUrl} alt={hc} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-100 shrink-0" />}
                                                        <span className="text-[11px] font-black text-slate-800">{hc}</span>
                                                        <span className="text-[10px] text-slate-300 font-bold mx-0.5">vs</span>
                                                        <span className="text-[11px] font-black text-slate-800">{ac}</span>
                                                        {p.awayTeam.flagUrl ? <img src={p.awayTeam.flagUrl} alt={ac} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-100 shrink-0" />}
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-600 shrink-0">{p.myHome}–{p.myAway}</span>
                                                    {fin && <span className="text-[10px] text-slate-400 shrink-0">{p.homeScore}–{p.awayScore}</span>}
                                                    <div className="shrink-0 ml-auto">
                                                        {!fin && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Pendiente</span>}
                                                        {isExact && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">+{pts}pts ⚽</span>}
                                                        {hasPoints && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">+{pts}pts</span>}
                                                        {fin && pts === 0 && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">0pts</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ══ COLUMNA DERECHA: Ranking + Próximos partidos ══ */}
                        <div className="space-y-4">

                            {/* Top actual / Ranking */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                                    <Trophy size={12} className="text-slate-400" />
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Top actual</h3>
                                </div>
                                {leagueDetail.topRanking.length === 0 ? (
                                    <div className="p-6 text-center">
                                        <p className="text-xs text-slate-400 font-bold">El ranking todavía no tiene datos.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {leagueDetail.topRanking.slice(0, 5).map((e) => (
                                            <div key={e.userId}
                                                className={`flex items-center gap-2.5 px-4 py-2.5 ${e.isMe ? 'bg-amber-50' : 'hover:bg-slate-50/60'} transition-colors`}>
                                                <span className="text-xs w-5 text-center font-black text-slate-400 shrink-0 tabular-nums">
                                                    {MEDAL[e.rank] ?? `#${e.rank}`}
                                                </span>
                                                <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                                                    {e.avatar
                                                        ? <img src={e.avatar} alt={e.name} className="w-full h-full object-cover" />
                                                        : <span className="text-[9px] font-black text-slate-500">{e.name.charAt(0).toUpperCase()}</span>
                                                    }
                                                </div>
                                                <span className="text-[11px] font-black truncate flex-1"
                                                    style={e.isMe ? { color: 'var(--color-primary,#f59e0b)' } : { color: '#1e293b' }}>
                                                    {e.isMe ? `${e.name.split(' ')[0]} (Tú)` : e.name.split(' ')[0]}
                                                </span>
                                                <span className="text-[11px] font-black text-slate-700 shrink-0 tabular-nums">{e.totalPoints}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="border-t border-slate-50 px-4 py-2.5">
                                    <Link to="/ranking"
                                        className="text-[10px] font-black flex items-center gap-1 hover:opacity-80 transition-opacity"
                                        style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                        VER RANKING COMPLETO <ChevronRight size={10} />
                                    </Link>
                                </div>
                            </div>

                            {/* Próximos partidos */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Próximos partidos</h3>
                                    <Clock size={12} className="text-slate-300" />
                                </div>
                                {openMatches.length === 0 ? (
                                    <div className="p-6 text-center">
                                        <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
                                        <p className="text-xs font-bold text-slate-500">¡Todos al día!</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {openMatches.slice(0, 5).map((m) => (
                                            <PredRow key={m.id} match={m} leagueId={leagueDetail.id}
                                                closeMin={leagueDetail.closePredictionMinutes}
                                                onSaved={onSaved} />
                                        ))}
                                        {openMatches.length > 5 && (
                                            <div className="px-4 py-2.5 text-center">
                                                <Link to={`/pollas/${leagueDetail.id}`}
                                                    className="text-[10px] font-black hover:opacity-80 transition-opacity"
                                                    style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                    Ver {openMatches.length - 5} más →
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )
            )}
        </CorpLayout>
    );
}
