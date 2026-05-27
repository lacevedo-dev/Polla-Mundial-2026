import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Trophy, Users, TrendingUp, ChevronRight, Calendar,
    Clock, CheckCircle2, Star, Save, Lock, Loader2, AlertTriangle,
    Zap, Radio, Target, BarChart2, ArrowRight, Medal,
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
    const [dashTab, setDashTab] = useState<'proximos' | 'recientes' | 'ranking'>('proximos');

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
    const finishedMatches = useMemo(() => matches.filter(m => isFinished(m.status)), [matches]);

    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

    return (
        <CorpLayout>
            {/* ── Header ── */}
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-black text-slate-900 leading-tight">
                        {orgName || 'Mi Dashboard'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Hola, <span className="font-bold text-slate-600">{user?.name?.split(' ')[0] ?? 'jugador'}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {pendingCount > 0 && (
                        <Link to="/pollas"
                            className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                            style={{ background: 'var(--color-primary,#f59e0b)' }}>
                            <Zap size={11} />
                            {pendingCount} por pronosticar
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Stats bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                {[
                    { label: 'Mis pollas', value: loadingDash ? '—' : (data?.myLeagues.length ?? 0), icon: Trophy, color: 'var(--color-primary,#f59e0b)', bg: 'bg-amber-50' },
                    { label: 'Posición global', value: loadingDash ? '—' : (data?.globalRank != null ? `#${data.globalRank}` : '—'), icon: TrendingUp, color: '#10b981', bg: 'bg-emerald-50' },
                    { label: 'Miembros', value: loadingDash ? '—' : (data?.totalMembers ?? 0), icon: Users, color: '#0ea5e9', bg: 'bg-sky-50' },
                    { label: 'Pendientes', value: loadingDash ? '—' : pendingCount, icon: Calendar, color: pendingCount > 0 ? '#f43f5e' : '#94a3b8', bg: pendingCount > 0 ? 'bg-rose-50' : 'bg-slate-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className={`${bg} rounded-2xl px-4 py-3 border border-white shadow-sm flex items-center gap-3`}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white shadow-sm">
                            <Icon size={15} style={{ color }} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-lg font-black text-slate-900 leading-none">{value}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── League tabs ── */}
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
                <div className="flex gap-4 items-start">

                    {/* ── Columna principal ── */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {loadingDetail ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-10"><Spinner /></div>
                        ) : !leagueDetail ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
                                Error cargando la polla.
                            </div>
                        ) : (
                            <>
                                {/* ── Polla hero card ── */}
                                <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                                    <div className="px-5 py-4 text-white"
                                        style={{ background: 'linear-gradient(135deg, var(--color-primary,#f59e0b), color-mix(in srgb, var(--color-primary,#f59e0b) 50%, #0f172a))' }}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50 mb-0.5">Polla activa</p>
                                                <h2 className="text-base font-black leading-tight">{leagueDetail.name}</h2>
                                                {leagueDetail.description && (
                                                    <p className="text-[10px] text-white/60 mt-0.5 leading-snug line-clamp-1">{leagueDetail.description}</p>
                                                )}
                                            </div>
                                            <Link to={`/pollas/${leagueDetail.id}`}
                                                className="shrink-0 text-[10px] font-black bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                                Ver todo <ArrowRight size={10} />
                                            </Link>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-3">
                                            {[
                                                { label: 'Mis puntos', v: leagueDetail.myPoints, icon: <Target size={11} /> },
                                                { label: 'Posición', v: `#${leagueDetail.myRank}`, icon: <Medal size={11} /> },
                                                { label: 'Jugadores', v: leagueDetail.participantsCount, icon: <Users size={11} /> },
                                            ].map(({ label, v, icon }) => (
                                                <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1 text-white/50 mb-0.5">{icon}</div>
                                                    <p className="text-base font-black leading-none">{v}</p>
                                                    <p className="text-[9px] text-white/60 mt-0.5">{label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Partidos en vivo ── */}
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
                                                const pred = m.myPrediction;
                                                return (
                                                    <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            {m.homeTeam.flagUrl
                                                                ? <img src={m.homeTeam.flagUrl} alt={hc} className="w-6 h-4 object-cover rounded shrink-0" />
                                                                : <div className="w-6 h-4 rounded bg-slate-700 shrink-0 flex items-center justify-center text-[7px] font-black text-slate-400">{hc.slice(0, 2)}</div>
                                                            }
                                                            <span className="text-[11px] font-black text-white truncate">{hc}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <span className="text-lg font-black text-rose-400 tabular-nums">{m.homeScore ?? 0}</span>
                                                            <span className="text-xs font-black text-slate-600">–</span>
                                                            <span className="text-lg font-black text-rose-400 tabular-nums">{m.awayScore ?? 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                                            <span className="text-[11px] font-black text-white truncate">{ac}</span>
                                                            {m.awayTeam.flagUrl
                                                                ? <img src={m.awayTeam.flagUrl} alt={ac} className="w-6 h-4 object-cover rounded shrink-0" />
                                                                : <div className="w-6 h-4 rounded bg-slate-700 shrink-0 flex items-center justify-center text-[7px] font-black text-slate-400">{ac.slice(0, 2)}</div>
                                                            }
                                                        </div>
                                                        {pred && (
                                                            <div className="shrink-0 text-right">
                                                                <span className="text-[9px] text-slate-500 font-bold block">Mi pred</span>
                                                                <span className="text-[11px] font-black text-slate-300">{pred.homeScore}–{pred.awayScore}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* ── Tabs: Próximos / Recientes / Ranking ── */}
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {/* Tab header */}
                                    <div className="flex border-b border-slate-100">
                                        {([
                                            { id: 'proximos', label: 'Próximos', icon: <Clock size={11} />, count: openMatches.length },
                                            { id: 'recientes', label: 'Recientes', icon: <BarChart2 size={11} />, count: leagueDetail.recentPredictions.length },
                                            { id: 'ranking', label: 'Ranking', icon: <Star size={11} />, count: leagueDetail.topRanking.length },
                                        ] as const).map((t) => (
                                            <button key={t.id} onClick={() => setDashTab(t.id)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-[11px] font-black transition-all border-b-2 ${
                                                    dashTab === t.id
                                                        ? 'border-current text-slate-900'
                                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                                }`}
                                                style={dashTab === t.id ? { borderColor: 'var(--color-primary,#f59e0b)', color: 'var(--color-primary,#f59e0b)' } : {}}>
                                                {t.icon}
                                                {t.label}
                                                {t.count > 0 && (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${dashTab === t.id ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {t.count}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab: Próximos partidos */}
                                    {dashTab === 'proximos' && (
                                        openMatches.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
                                                <p className="text-sm font-bold text-slate-500">¡Sin partidos pendientes!</p>
                                                <p className="text-xs text-slate-400 mt-0.5">Todos los pronósticos están al día.</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                {openMatches.slice(0, 8).map((m) => (
                                                    <PredRow key={m.id} match={m} leagueId={leagueDetail.id}
                                                        closeMin={leagueDetail.closePredictionMinutes}
                                                        onSaved={onSaved} compact />
                                                ))}
                                                {openMatches.length > 8 && (
                                                    <div className="px-4 py-3 text-center">
                                                        <Link to={`/pollas/${leagueDetail.id}`}
                                                            className="text-xs font-bold hover:underline"
                                                            style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                            Ver todos los {openMatches.length} partidos →
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    )}

                                    {/* Tab: Predicciones recientes */}
                                    {dashTab === 'recientes' && (
                                        leagueDetail.recentPredictions.length === 0 ? (
                                            <div className="p-8 text-center text-sm text-slate-400">
                                                Aún no tienes predicciones registradas.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                {leagueDetail.recentPredictions.map((p, i) => {
                                                    const hc = (p.homeTeam.shortCode ?? p.homeTeam.name.slice(0, 3)).toUpperCase();
                                                    const ac = (p.awayTeam.shortCode ?? p.awayTeam.name.slice(0, 3)).toUpperCase();
                                                    const finished = isFinished(p.status);
                                                    const pts = p.points ?? 0;
                                                    const isPending = !finished;
                                                    const isExact = finished && pts >= 5;
                                                    const hasPoints = finished && pts > 0 && pts < 5;
                                                    return (
                                                        <div key={i} className={`px-4 py-3 flex items-center gap-3 ${
                                                            isExact ? 'bg-emerald-50/50' : hasPoints ? 'bg-amber-50/40' : ''
                                                        }`}>
                                                            {/* Equipos */}
                                                            <div className="flex items-center gap-1 min-w-0">
                                                                {p.homeTeam.flagUrl
                                                                    ? <img src={p.homeTeam.flagUrl} alt={hc} className="w-5 h-3.5 object-cover rounded shrink-0" />
                                                                    : <div className="w-5 h-3.5 rounded bg-slate-100 shrink-0" />
                                                                }
                                                                <span className="text-[11px] font-black text-slate-800">{hc}</span>
                                                                <span className="text-[10px] text-slate-300 font-bold mx-0.5">vs</span>
                                                                <span className="text-[11px] font-black text-slate-800">{ac}</span>
                                                                {p.awayTeam.flagUrl
                                                                    ? <img src={p.awayTeam.flagUrl} alt={ac} className="w-5 h-3.5 object-cover rounded shrink-0" />
                                                                    : <div className="w-5 h-3.5 rounded bg-slate-100 shrink-0" />
                                                                }
                                                            </div>
                                                            {/* Mi pronóstico */}
                                                            <div className="shrink-0 flex items-center gap-1">
                                                                <span className="text-[10px] text-slate-400 font-bold">Mi pred:</span>
                                                                <span className="text-[11px] font-black text-slate-700">{p.myHome}–{p.myAway}</span>
                                                            </div>
                                                            {/* Resultado real */}
                                                            {finished && (
                                                                <div className="shrink-0 flex items-center gap-1">
                                                                    <span className="text-[10px] text-slate-400 font-bold">Real:</span>
                                                                    <span className="text-[11px] font-black text-slate-700">{p.homeScore}–{p.awayScore}</span>
                                                                </div>
                                                            )}
                                                            {/* Badge puntos */}
                                                            <div className="ml-auto shrink-0">
                                                                {isPending && (
                                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Pendiente</span>
                                                                )}
                                                                {isExact && (
                                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">+{pts}pts ⚽</span>
                                                                )}
                                                                {hasPoints && (
                                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">+{pts}pts</span>
                                                                )}
                                                                {finished && pts === 0 && (
                                                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">0pts</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )
                                    )}

                                    {/* Tab: Ranking */}
                                    {dashTab === 'ranking' && (
                                        leagueDetail.topRanking.length === 0 ? (
                                            <div className="p-8 text-center text-sm text-slate-400">Sin puntos aún.</div>
                                        ) : (
                                            <>
                                                <div className="divide-y divide-slate-50">
                                                    {leagueDetail.topRanking.slice(0, 10).map((e) => (
                                                        <div key={e.userId}
                                                            className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${e.isMe ? 'bg-amber-50' : 'hover:bg-slate-50/60'}`}>
                                                            <span className="text-sm w-6 text-center font-black text-slate-400 shrink-0 tabular-nums">
                                                                {MEDAL[e.rank] ?? `#${e.rank}`}
                                                            </span>
                                                            <div className="w-7 h-7 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                                                                {e.avatar
                                                                    ? <img src={e.avatar} alt={e.name} className="w-full h-full object-cover" />
                                                                    : <span className="text-[10px] font-black text-slate-500">{e.name.charAt(0).toUpperCase()}</span>
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-[12px] font-black truncate ${e.isMe ? '' : 'text-slate-800'}`}
                                                                    style={e.isMe ? { color: 'var(--color-primary,#f59e0b)' } : {}}>
                                                                    {e.isMe ? `${e.name.split(' ')[0]} (Tú)` : e.name.split(' ')[0]}
                                                                </p>
                                                                {e.username && (
                                                                    <p className="text-[9px] text-slate-400 font-medium truncate">@{e.username}</p>
                                                                )}
                                                            </div>
                                                            <span className="text-sm font-black text-slate-800 shrink-0 tabular-nums">{e.totalPoints}</span>
                                                            <span className="text-[9px] text-slate-400 font-bold shrink-0">pts</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="border-t border-slate-50 px-4 py-2.5">
                                                    <Link to="/ranking"
                                                        className="text-[11px] font-black flex items-center justify-center gap-1 hover:opacity-80"
                                                        style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                        Ver ranking completo <ChevronRight size={11} />
                                                    </Link>
                                                </div>
                                            </>
                                        )
                                    )}
                                </div>

                                {/* ── Partidos terminados (colapsados) ── */}
                                {finishedMatches.length > 0 && dashTab === 'proximos' && (
                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                                <CheckCircle2 size={12} className="text-slate-400" /> Finalizados
                                            </h3>
                                            <span className="text-[10px] text-slate-400 font-bold">{finishedMatches.length} partidos</span>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {finishedMatches.slice(0, 5).map((m) => {
                                                const hc = (m.homeTeam.shortCode ?? m.homeTeam.name.slice(0, 3)).toUpperCase();
                                                const ac = (m.awayTeam.shortCode ?? m.awayTeam.name.slice(0, 3)).toUpperCase();
                                                const pts = m.myPrediction?.points;
                                                return (
                                                    <div key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                            <Flag team={m.homeTeam} size="xs" />
                                                            <span className="text-[11px] font-black text-slate-700 truncate">{hc}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <span className="text-sm font-black text-slate-900 tabular-nums">{m.homeScore ?? 0}</span>
                                                            <span className="text-xs text-slate-300 font-black">–</span>
                                                            <span className="text-sm font-black text-slate-900 tabular-nums">{m.awayScore ?? 0}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                                            <span className="text-[11px] font-black text-slate-700 truncate text-right">{ac}</span>
                                                            <Flag team={m.awayTeam} size="xs" />
                                                        </div>
                                                        <div className="shrink-0 w-14 text-right">
                                                            {pts != null
                                                                ? <span className={`text-[11px] font-black tabular-nums ${pts > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                    {pts > 0 ? `+${pts}pts` : '0pts'}
                                                                  </span>
                                                                : <span className="text-[10px] text-slate-300 font-bold">—</span>
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {finishedMatches.length > 5 && (
                                            <div className="px-4 py-2.5 border-t border-slate-50 text-center">
                                                <Link to={`/pollas/${leagueDetail.id}`}
                                                    className="text-[10px] font-bold hover:underline"
                                                    style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                    Ver {finishedMatches.length - 5} más →
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Sidebar desktop: Scoring rules ── */}
                    {leagueDetail && (
                        <div className="hidden xl:block w-56 shrink-0 space-y-4">
                            {/* Reglas de puntuación */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wide">Puntuación</h3>
                                </div>
                                <div className="p-3 space-y-1.5">
                                    {leagueDetail.scoringRules.length > 0
                                        ? leagueDetail.scoringRules.map((r) => (
                                            <div key={r.ruleType} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{r.description ?? r.ruleType}</span>
                                                <span className="text-[11px] font-black shrink-0" style={{ color: 'var(--color-primary,#f59e0b)' }}>{r.points}pts</span>
                                            </div>
                                        ))
                                        : [
                                            { label: 'Marcador exacto', pts: 5, icon: '🎯' },
                                            { label: 'Ganador + gol', pts: 3, icon: '✅' },
                                            { label: 'Solo ganador', pts: 2, icon: '👍' },
                                            { label: 'Solo gol', pts: 1, icon: '⚽' },
                                        ].map((r) => (
                                            <div key={r.label} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                                                <span className="text-sm">{r.icon}</span>
                                                <span className="text-[10px] font-bold text-slate-600 flex-1 truncate">{r.label}</span>
                                                <span className="text-[11px] font-black shrink-0" style={{ color: 'var(--color-primary,#f59e0b)' }}>{r.pts}pts</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            {/* Mi posición */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wide">Mi posición</h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-slate-900">#{leagueDetail.myRank}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">de {leagueDetail.participantsCount} jugadores</p>
                                    </div>
                                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                                        <span className="text-[10px] font-bold text-slate-500">Mis puntos</span>
                                        <span className="text-base font-black" style={{ color: 'var(--color-primary,#f59e0b)' }}>{leagueDetail.myPoints}</span>
                                    </div>
                                    <Link to={`/pollas/${leagueDetail.id}`}
                                        className="flex items-center justify-center gap-1 text-[10px] font-black py-2 rounded-xl w-full border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600">
                                        Ver polla completa <ChevronRight size={10} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </CorpLayout>
    );
}
