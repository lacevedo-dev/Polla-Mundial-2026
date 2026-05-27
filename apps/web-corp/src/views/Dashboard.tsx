import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Trophy, Users, TrendingUp, ChevronRight, Calendar,
    Clock, CheckCircle2, Circle, Star, Save, Lock, Loader2, AlertTriangle,
    LayoutGrid, AlignJustify,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

/* ─── Types ─────────────────────────────────────────────────── */

interface Team { id: string; name: string; shortCode: string | null; flagUrl: string | null; }
interface UpcomingMatch {
    id: string;
    matchDate: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: Team;
    awayTeam: Team;
    myPrediction: { homeScore: number; awayScore: number; points: number | null } | null;
}
interface RecentPrediction {
    matchDate: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>;
    awayTeam: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>;
    myHome: number;
    myAway: number;
    points: number | null;
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

/* ─── Sub-components ─────────────────────────────────────────── */

function Flag({ team, size = 'sm' }: { team: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>; size?: 'sm' | 'lg' }) {
    const abbr = (team.shortCode ?? team.name.slice(0, 3)).toUpperCase();
    const cls = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 object-cover shadow-sm'
        : 'w-7 h-5 object-cover rounded border border-slate-200 shrink-0';
    const fallback = size === 'lg'
        ? 'w-11 h-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500'
        : 'w-7 h-5 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0';
    return team.flagUrl
        ? <img src={team.flagUrl} alt={abbr} className={cls} />
        : <div className={fallback}>{abbr.slice(0, 2)}</div>;
}

function PredRow({ match, leagueId, closeMin, onSaved, compact = false }: {
    match: UpcomingMatch; leagueId: string; closeMin: number; compact?: boolean;
    onSaved: (matchId: string, h: number, a: number) => void;
}) {
    const closed = isPredictionClosed(match.matchDate, closeMin);
    const live = ['LIVE', 'IN_PLAY', 'HALFTIME'].includes(match.status);
    const finished = ['FINISHED', 'FT'].includes(match.status);
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

    const dateFmt = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(match.matchDate));
    const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(match.matchDate));

    /* ── MODO COMPACTO ── */
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

    /* ── MODO EXPANDIDO ── */
    return (
        <div className="border-b border-slate-100 px-4 py-4 last:border-b-0">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{dateFmt} · {timeFmt}</span>
                        {live && <span className="text-[9px] font-black text-rose-500 animate-pulse uppercase">En vivo</span>}
                        {!live && !finished && canPredict && <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary,#f59e0b)' }}>Abierto</span>}
                        {!live && !finished && !canPredict && <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cerrado</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        {match.myPrediction && !isDirty && <CheckCircle2 size={14} className="text-emerald-500" />}
                        {isDirty && !saving && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse block" />}
                        {saving && <Loader2 size={13} className="animate-spin text-slate-400" />}
                    </div>
                </div>
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
                <div className="flex items-center justify-end">
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
    const [viewMode, setViewMode] = useState<'expanded' | 'compact'>('expanded');

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
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, myPrediction: { homeScore: h, awayScore: a, points: null } } : m));
    }

    const Spinner = () => <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--color-primary,#f59e0b)', borderTopColor: 'transparent' }} />;
    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? '';
    const pendingCount = data?.predictionsPending ?? 0;

    return (
        <CorpLayout>
            {/* ── Header ── */}
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-900">{orgName ? `${orgName}` : 'Mi Dashboard'}</h1>
                    <p className="text-xs text-slate-400 mt-0.5">Bienvenido, {user?.name ?? 'jugador'}</p>
                </div>
                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-full text-white" style={{ background: 'var(--color-primary,#f59e0b)' }}>
                            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                        </span>
                    )}
                    <Link to="/pollas" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">Ver pollas →</Link>
                </div>
            </div>

            {/* ── Stats bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Mis pollas', value: loadingDash ? '—' : (data?.myLeagues.length ?? 0), icon: Trophy, style: { color: 'var(--color-primary,#f59e0b)' } },
                    { label: 'Posición global', value: loadingDash ? '—' : (data?.globalRank != null ? `#${data.globalRank}` : '—'), icon: TrendingUp, style: { color: '#10b981' } },
                    { label: 'Miembros', value: loadingDash ? '—' : (data?.totalMembers ?? 0), icon: Users, style: { color: '#0ea5e9' } },
                    { label: 'Por pronosticar', value: loadingDash ? '—' : pendingCount, icon: Calendar, style: { color: '#f43f5e' } },
                ].map(({ label, value, icon: Icon, style }) => (
                    <div key={label} className="bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm flex items-center gap-3">
                        <Icon size={18} style={style} className="shrink-0" />
                        <div>
                            <div className="text-xl font-black text-slate-900 leading-none">{value}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── League tabs ── */}
            {loadingDash ? null : data?.myLeagues && data.myLeagues.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-4">
                    {data.myLeagues.map((l) => (
                        <button key={l.id} onClick={() => setSelectedLeagueId(l.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black transition-all border"
                            style={selectedLeagueId === l.id
                                ? { background: 'var(--color-primary,#f59e0b)', color: '#fff', borderColor: 'transparent' }
                                : { background: 'white', color: '#64748b', borderColor: '#f1f5f9' }}
                        >
                            {l.name}
                            <span className="ml-1.5 opacity-70">{l.myPoints}pts</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Main area ── */}
            {!selectedLeagueId ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <Trophy size={32} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">No estás en ninguna polla aún</p>
                    <Link to="/pollas" className="mt-2 inline-block text-sm font-bold hover:underline" style={{ color: 'var(--color-primary,#f59e0b)' }}>Explorar pollas →</Link>
                </div>
            ) : (
                <div className="flex gap-4 items-start">

                    {/* ── Matches (main column) ── */}
                    <div className="flex-1 min-w-0">
                        {loadingDetail ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-10"><Spinner /></div>
                        ) : !leagueDetail ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">Error cargando la polla.</div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                {/* Polla header */}
                                <div className="px-4 py-4 text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary,#f59e0b), color-mix(in srgb, var(--color-primary,#f59e0b) 55%, #1e293b))' }}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Polla activa</p>
                                            <h2 className="text-lg font-black">{leagueDetail.name}</h2>
                                        </div>
                                        <Link to={`/pollas/${leagueDetail.id}`} className="text-[11px] font-black bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors">
                                            Ver todo <ChevronRight size={11} />
                                        </Link>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-3">
                                        {[
                                            { label: 'Mis puntos', v: leagueDetail.myPoints },
                                            { label: 'Posición', v: `#${leagueDetail.myRank}` },
                                            { label: 'Participantes', v: leagueDetail.participantsCount },
                                        ].map(({ label, v }) => (
                                            <div key={label} className="bg-white/15 rounded-xl p-2 text-center">
                                                <p className="text-base font-black">{v}</p>
                                                <p className="text-[9px] text-white/70">{label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Match list header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><Clock size={13} className="text-slate-400" />Partidos</h3>
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

                                {matches.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-slate-400">
                                        No hay partidos asignados a esta polla aún
                                    </div>
                                ) : (
                                    <div className={viewMode === 'compact' ? '' : 'divide-y divide-slate-100'}>
                                        {matches.slice(0, 10).map((m) => (
                                            <PredRow key={m.id} match={m} leagueId={leagueDetail.id} closeMin={leagueDetail.closePredictionMinutes} onSaved={onSaved} compact={viewMode === 'compact'} />
                                        ))}
                                        {matches.length > 10 && (
                                            <div className="px-4 py-3 text-center">
                                                <Link to={`/pollas/${leagueDetail.id}`} className="text-xs font-bold hover:underline" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                                    Ver todos los {matches.length} partidos →
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Ranking sidebar ── */}
                    <div className="hidden lg:block w-52 shrink-0">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                                <Star size={13} className="text-slate-400" />
                                <span className="text-xs font-black text-slate-900">Ranking</span>
                            </div>
                            {loadingDetail ? (
                                <div className="p-6"><Spinner /></div>
                            ) : !leagueDetail?.topRanking.length ? (
                                <div className="p-4 text-xs text-slate-400 text-center">Sin puntos aún</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {leagueDetail.topRanking.slice(0, 8).map((e) => (
                                        <div key={e.userId} className="flex items-center gap-2 px-3 py-2.5"
                                            style={e.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary,#f59e0b) 8%, white)' } : {}}>
                                            <span className="text-xs w-5 text-center font-bold text-slate-400 shrink-0">{MEDAL[e.rank] ?? `#${e.rank}`}</span>
                                            <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                {e.avatar ? <img src={e.avatar} alt={e.name} className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-slate-400">{e.name.charAt(0)}</span>}
                                            </div>
                                            <span className="text-[11px] font-bold truncate flex-1" style={e.isMe ? { color: 'var(--color-primary,#f59e0b)' } : { color: '#1e293b' }}>
                                                {e.isMe ? 'Tú' : e.name.split(' ')[0]}
                                            </span>
                                            <span className="text-[11px] font-black text-slate-600 shrink-0">{e.totalPoints}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="border-t border-slate-50 px-3 py-2">
                                <Link to="/ranking" className="text-[10px] font-bold flex items-center justify-center gap-1 hover:opacity-80" style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                    Ver ranking completo <ChevronRight size={10} />
                                </Link>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </CorpLayout>
    );
}
