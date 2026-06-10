import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Trophy, Users, ChevronRight,
    Clock, CheckCircle2, Star, Save, Lock, Loader2, AlertTriangle,
    Zap, Radio, X,
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
interface LeagueSummary { id: string; name: string; participantsCount: number; myPoints: number; }
interface DashboardData {
    myLeagues: LeagueSummary[];
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
            await request('/corp/predictions', { method: 'POST', body: JSON.stringify({ matchId: match.id, leagueId, homeScore: h, awayScore: a }) });
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

/* ─── MatchCard: tarjeta tipo "próximo reto" con inputs centrados ─── */
function MatchCard({ match, leagueId, closeMin, onSaved, onDirtyChange, forceSave, resetTick }: {
    match: UpcomingMatch; leagueId: string; closeMin: number;
    onSaved: (matchId: string, h: number, a: number) => void;
    onDirtyChange?: (matchId: string, dirty: boolean, home: string, away: string) => void;
    forceSave?: number;
    resetTick?: number;
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
    const hasPred = !!match.myPrediction;
    const prevForceSave = useRef(forceSave);
    const prevResetTick = useRef(resetTick);

    useEffect(() => {
        onDirtyChange?.(match.id, isDirty, home, away);
    }, [isDirty, home, away]);

    useEffect(() => {
        if (forceSave !== prevForceSave.current && forceSave !== undefined) {
            prevForceSave.current = forceSave;
            if (isDirty && canPredict) void submit();
        }
    }, [forceSave]);

    useEffect(() => {
        if (resetTick !== prevResetTick.current && resetTick !== undefined) {
            prevResetTick.current = resetTick;
            setHome(initHome);
            setAway(initAway);
            setErr(null);
            onDirtyChange?.(match.id, false, initHome, initAway);
        }
    }, [resetTick]);

    function handleHomeChange(v: string) {
        setHome(v);
        onDirtyChange?.(match.id, v !== initHome || away !== initAway, v, away);
    }
    function handleAwayChange(v: string) {
        setAway(v);
        onDirtyChange?.(match.id, home !== initHome || v !== initAway, home, v);
    }

    async function submit() {
        const h = parseInt(home), a = parseInt(away);
        if (isNaN(h) || isNaN(a) || h < 0 || a < 0) { setErr('Marcadores inválidos'); return; }
        setSaving(true); setErr(null);
        try {
            await request('/corp/predictions', { method: 'POST', body: JSON.stringify({ matchId: match.id, leagueId, homeScore: h, awayScore: a }) });
            setSaved(true); onSaved(match.id, h, a);
            onDirtyChange?.(match.id, false, home, away);
            setTimeout(() => setSaved(false), 2000);
        } catch (e: any) { setErr(e?.message ?? 'Error'); }
        finally { setSaving(false); }
    }

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${
            saved ? 'border-emerald-200 bg-emerald-50/30' :
            hasPred && !isDirty ? 'border-amber-100' :
            'border-slate-100'
        }`}>
            {/* Fecha + estado */}
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400">
                    {fmtDate(match.matchDate)} · {fmtTime(match.matchDate)}
                </span>
                {live && <span className="text-[9px] font-black text-rose-500 animate-pulse bg-rose-50 px-2 py-0.5 rounded-full">● EN VIVO</span>}
                {closed && !finished && <span className="flex items-center gap-0.5 text-[9px] font-black text-slate-400"><Lock size={8} /> Cerrado</span>}
                {saved && <span className="text-[9px] font-black text-emerald-600">✓ Guardado</span>}
                {hasPred && !isDirty && !saved && canPredict && <CheckCircle2 size={12} className="text-emerald-400" />}
            </div>

            {/* Equipos + inputs centrados */}
            <div className="flex items-center gap-3">
                {/* Local */}
                <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    {match.homeTeam.flagUrl
                        ? <img src={match.homeTeam.flagUrl} alt={homeCode} className="w-10 h-7 object-cover rounded-md shadow-sm" />
                        : <div className="w-10 h-7 rounded-md bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-500">{homeCode.slice(0,2)}</div>}
                    <p className="text-sm font-black text-slate-900">{homeCode}</p>
                    <p className="text-[9px] text-slate-400 truncate w-full text-center">{match.homeTeam.name}</p>
                </div>

                {/* Inputs / marcador */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                    {finished || live ? (
                        <div className="flex items-center gap-1">
                            <span className={`text-2xl font-black ${live ? 'text-rose-500' : 'text-slate-800'}`}>{match.homeScore ?? 0}</span>
                            <span className="text-slate-300 font-black">–</span>
                            <span className={`text-2xl font-black ${live ? 'text-rose-500' : 'text-slate-800'}`}>{match.awayScore ?? 0}</span>
                        </div>
                    ) : canPredict ? (
                        <div className="flex items-center gap-1.5">
                            <input type="number" min={0} max={99} inputMode="numeric" value={home} placeholder="0"
                                onChange={e => handleHomeChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="w-11 h-11 text-center font-black text-lg rounded-xl border-2 focus:outline-none transition-colors appearance-none"
                                style={{ borderColor: isDirty || home !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                            <span className="text-slate-300 font-black text-lg">:</span>
                            <input type="number" min={0} max={99} inputMode="numeric" value={away} placeholder="0"
                                onChange={e => handleAwayChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                                className="w-11 h-11 text-center font-black text-lg rounded-xl border-2 focus:outline-none transition-colors appearance-none"
                                style={{ borderColor: isDirty || away !== '' ? 'var(--color-primary,#f59e0b)' : '#e2e8f0' }} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 opacity-60">
                            <span className="w-11 h-11 flex items-center justify-center font-black text-lg text-slate-500 border-2 border-slate-100 rounded-xl bg-slate-50">
                                {hasPred ? match.myPrediction!.homeScore : '–'}
                            </span>
                            <span className="text-slate-300 font-black">:</span>
                            <span className="w-11 h-11 flex items-center justify-center font-black text-lg text-slate-500 border-2 border-slate-100 rounded-xl bg-slate-50">
                                {hasPred ? match.myPrediction!.awayScore : '–'}
                            </span>
                        </div>
                    )}
                    <span className="text-[8px] text-slate-300 font-bold">Mi pronóstico</span>
                </div>

                {/* Visitante */}
                <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    {match.awayTeam.flagUrl
                        ? <img src={match.awayTeam.flagUrl} alt={awayCode} className="w-10 h-7 object-cover rounded-md shadow-sm" />
                        : <div className="w-10 h-7 rounded-md bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-500">{awayCode.slice(0,2)}</div>}
                    <p className="text-sm font-black text-slate-900">{awayCode}</p>
                    <p className="text-[9px] text-slate-400 truncate w-full text-center">{match.awayTeam.name}</p>
                </div>
            </div>

            {/* Botón guardar */}
            {canPredict && (
                <button onClick={submit} disabled={saving || !isDirty}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all disabled:opacity-40"
                    style={saved
                        ? { backgroundColor: '#d1fae5', color: '#059669' }
                        : { backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }}>
                    {saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <CheckCircle2 size={11} /> : <Save size={11} />}
                    {saved ? '¡Guardado!' : 'Guardar pronóstico'}
                </button>
            )}
            {err && <p className="text-[9px] text-rose-500 flex items-center gap-1 justify-center"><AlertTriangle size={9} />{err}</p>}
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
    const [allLeagues, setAllLeagues] = useState<LeagueSummary[]>([]);
    const [pendingDrafts, setPendingDrafts] = useState<Map<string, { home: string; away: string }>>(new Map());
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [forceSaveTick, setForceSaveTick] = useState(0);
    const [resetTick, setResetTick] = useState(0);
    const [pendingNavTo, setPendingNavTo] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        request<DashboardData>('/corp/dashboard')
            .then(async (d) => {
                setData(d);
                if (d.tenantRole) setTenantRole(d.tenantRole);
                if (d.myLeagues.length) {
                    setSelectedLeagueId(d.myLeagues[0].id);
                } else {
                    /* Fallback: cargar todas las pollas del tenant */
                    try {
                        const all = await request<{ id: string; name: string; participantsCount: number; myPoints: number }[]>('/corp/leagues');
                        if (all.length) {
                            setAllLeagues(all);
                            setSelectedLeagueId(all[0].id);
                        }
                    } catch { /* ignorar */ }
                }
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
        setPendingDrafts(prev => { const next = new Map(prev); next.delete(matchId); return next; });
    }

    const onDirtyChange = useCallback((matchId: string, dirty: boolean, home: string, away: string) => {
        setPendingDrafts(prev => {
            const next = new Map(prev);
            if (dirty) next.set(matchId, { home, away }); else next.delete(matchId);
            return next;
        });
    }, []);

    const hasDirtyChanges = pendingDrafts.size > 0;

    async function handleSaveAll() {
        if (!leagueDetail || pendingDrafts.size === 0) return;
        setIsSavingAll(true);
        try {
            await Promise.all(
                Array.from(pendingDrafts.entries()).map(([matchId, { home, away }]) => {
                    const h = parseInt(home), a = parseInt(away);
                    if (isNaN(h) || isNaN(a)) return Promise.resolve();
                    return request('/corp/predictions', {
                        method: 'POST',
                        body: JSON.stringify({ matchId, leagueId: leagueDetail.id, homeScore: h, awayScore: a }),
                    }).then(() => onSaved(matchId, h, a));
                })
            );
        } finally {
            setIsSavingAll(false);
        }
    }

    function discardAll() {
        setPendingDrafts(new Map());
        setResetTick(t => t + 1);
    }

    function guardedNavigate(to: string) {
        if (hasDirtyChanges) { setPendingNavTo(to); }
        else { navigate(to); }
    }

    useEffect(() => {
        if (!hasDirtyChanges) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasDirtyChanges]);

    const Spinner = () => (
        <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: 'var(--color-primary,#f59e0b)', borderTopColor: 'transparent' }} />
    );

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? '';
    const pendingCount = data?.predictionsPending ?? 0;

    const liveMatches = useMemo(() => matches.filter(m => isLive(m.status)), [matches]);
    const openMatches = useMemo(() => matches.filter(m => !isLive(m.status) && !isFinished(m.status)), [matches]);

    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

    /* ── Permisos basados en rol y configuración del tenant ── */
    const tenantRole = data?.tenantRole ?? '';
    const isAdmin = tenantRole === 'OWNER' || tenantRole === 'ADMIN';
    const canInvite = isAdmin || !(tenant?.config?.requireInvitation ?? true);
    /* Solo próximos 3 partidos ordenados por fecha */
    const nextMatches = useMemo(() => [...openMatches]
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
        .slice(0, 3), [openMatches]);

    /* Partido más próximo sin pronóstico */
    const nextUnsaved = useMemo(() => nextMatches.find(m => !m.myPrediction), [nextMatches]);
    /* Puntos totales del usuario en la liga */
    const myPoints = leagueDetail?.myPoints ?? 0;
    const myRank = leagueDetail?.myRank ?? null;

    /* Ligas a mostrar en el selector: las propias o fallback a todas las del tenant */
    const displayLeagues = (data?.myLeagues.length ?? 0) > 0 ? (data?.myLeagues ?? []) : allLeagues;

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
                    {leagueDetail && canInvite && (
                        <Link to={`/pollas/${leagueDetail.id}`}
                            className="flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                            <Users size={12} />
                            Invitar
                        </Link>
                    )}
                </div>
            </div>

            {/* ── League selector ── */}
            {!loadingDash && displayLeagues.length > 1 && (
                <div className="flex gap-1.5 flex-wrap mb-4">
                    {displayLeagues.map((l) => (
                        <button key={l.id} onClick={() => setSelectedLeagueId(l.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-black transition-all border"
                            style={selectedLeagueId === l.id
                                ? { background: 'var(--color-primary,#f59e0b)', color: '#fff', borderColor: 'transparent' }
                                : { background: 'white', color: '#64748b', borderColor: '#f1f5f9' }}>
                            {l.name}
                            {l.myPoints > 0 && <span className="ml-1.5 opacity-70">{l.myPoints}pts</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Empty state: solo si no hay ninguna polla en el tenant ── */}
            {!loadingDash && !selectedLeagueId && displayLeagues.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <Trophy size={32} className="mx-auto mb-3 text-slate-200" />
                    <p className="text-sm font-bold text-slate-400">No hay pollas disponibles aún</p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-4 items-start">

                        {/* ══ COLUMNA IZQUIERDA: Mi desempeño + Próximo reto + Stats ══ */}
                        <div className="space-y-4">

                            {/* Mi desempeño — tarjeta oscura estilo spectator */}
                            <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e293b 100%)' }}>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-primary,#f59e0b)' }}>Mi desempeño</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">Puntos acumulados</p>
                                        </div>
                                        {myRank && (
                                            <span className="rounded-xl bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                                                Puesto #{myRank}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-end gap-3">
                                        <div>
                                            <p className="text-5xl font-black text-white leading-none">{myPoints}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">pts totales</p>
                                        </div>
                                        <div className="ml-auto opacity-60">
                                            <Trophy size={40} className="text-amber-400" />
                                        </div>
                                    </div>
                                    {/* Barra progreso de cupos */}
                                    <div className="pt-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[9px] text-slate-400 font-bold">{leagueDetail.participantsCount} participante{leagueDetail.participantsCount !== 1 ? 's' : ''}</span>
                                            {leagueDetail.maxParticipants > 0 && (
                                                <span className="text-[9px] text-slate-400 font-bold">máx {leagueDetail.maxParticipants}</span>
                                            )}
                                        </div>
                                        {leagueDetail.maxParticipants > 0 && (
                                            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                                <div className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${Math.min(100, (leagueDetail.participantsCount / leagueDetail.maxParticipants) * 100)}%`,
                                                        background: 'var(--color-primary,#f59e0b)'
                                                    }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Acciones admin */}
                                {(isAdmin || canInvite) && (
                                    <div className="flex gap-2 px-4 pb-4">
                                        {isAdmin && (
                                            <Link to={`/pollas/${leagueDetail.id}`}
                                                className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white">
                                                <Star size={10} /> Configurar
                                            </Link>
                                        )}
                                        {canInvite && (
                                            <Link to={`/pollas/${leagueDetail.id}`}
                                                className="flex-1 flex items-center justify-center gap-1 text-[10px] font-black py-2 rounded-xl text-slate-900 transition-opacity hover:opacity-90"
                                                style={{ background: 'var(--color-primary,#f59e0b)' }}>
                                                <Users size={10} /> Invitar
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Tu próximo reto */}
                            {nextUnsaved ? (
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tu próximo reto</p>
                                        <Clock size={12} className="text-slate-300" />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-center flex-1 min-w-0">
                                            {nextUnsaved.homeTeam.flagUrl
                                                ? <img src={nextUnsaved.homeTeam.flagUrl} alt="" className="w-8 h-6 object-cover rounded mx-auto mb-1" />
                                                : null}
                                            <p className="text-lg font-black uppercase text-slate-900 leading-none">
                                                {(nextUnsaved.homeTeam.shortCode ?? nextUnsaved.homeTeam.name.slice(0, 3)).toUpperCase()}
                                            </p>
                                            <p className="text-[9px] text-slate-400 truncate">{nextUnsaved.homeTeam.name}</p>
                                        </div>
                                        <span className="text-xs font-bold text-slate-300">vs</span>
                                        <div className="text-center flex-1 min-w-0">
                                            {nextUnsaved.awayTeam.flagUrl
                                                ? <img src={nextUnsaved.awayTeam.flagUrl} alt="" className="w-8 h-6 object-cover rounded mx-auto mb-1" />
                                                : null}
                                            <p className="text-lg font-black uppercase text-slate-900 leading-none">
                                                {(nextUnsaved.awayTeam.shortCode ?? nextUnsaved.awayTeam.name.slice(0, 3)).toUpperCase()}
                                            </p>
                                            <p className="text-[9px] text-slate-400 truncate">{nextUnsaved.awayTeam.name}</p>
                                        </div>
                                    </div>
                                    <Link to={`/pollas/${leagueDetail.id}`}
                                        className="flex w-full items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide text-white transition-opacity hover:opacity-90"
                                        style={{ background: 'var(--color-primary,#f59e0b)' }}>
                                        <Zap size={12} /> Pronosticar
                                    </Link>
                                    <p className="text-[9px] text-slate-400 text-center">
                                        {fmtDate(nextUnsaved.matchDate)} · {fmtTime(nextUnsaved.matchDate)}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-4 text-center space-y-1.5">
                                    <CheckCircle2 size={20} className="text-emerald-400 mx-auto" />
                                    <p className="text-xs font-black text-slate-700">¡Al día con pronósticos!</p>
                                    <p className="text-[10px] text-slate-400">No tienes partidos pendientes.</p>
                                </div>
                            )}

                            {/* Mis estadísticas — colores suaves */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mis estadísticas</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-lime-50 p-3 text-center">
                                        <p className="text-[10px] font-black text-lime-700">Aciertos</p>
                                        <p className="text-2xl font-black text-lime-900">{aciertos}</p>
                                    </div>
                                    <div className="rounded-xl bg-rose-50 p-3 text-center">
                                        <p className="text-[10px] font-black text-rose-700">Errores</p>
                                        <p className="text-2xl font-black text-rose-900">{errores}</p>
                                    </div>
                                    <div className="rounded-xl bg-amber-50 p-3 text-center">
                                        <p className="text-[10px] font-black text-amber-700">Racha</p>
                                        <p className="text-2xl font-black text-amber-900">{racha}</p>
                                    </div>
                                    <div className="rounded-xl bg-blue-50 p-3 text-center">
                                        <p className="text-[10px] font-black text-blue-700">Tasa</p>
                                        <p className="text-2xl font-black text-blue-900">{tasa}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* Reglas de puntos — colapsable */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Reglas de puntos</h3>
                                </div>
                                <div className="p-3 space-y-1.5">
                                    {(leagueDetail.scoringRules.length > 0
                                        ? leagueDetail.scoringRules.map(r => ({ label: r.description ?? r.ruleType, pts: r.points, icon: '' }))
                                        : [
                                            { label: 'Marcador exacto', pts: 5, icon: '🎯' },
                                            { label: 'Ganador + gol', pts: 3, icon: '✅' },
                                            { label: 'Solo ganador', pts: 2, icon: '☑' },
                                            { label: 'Solo gol acertado', pts: 1, icon: '⚽' },
                                        ] as any[]
                                    ).map((r: any) => (
                                        <div key={r.label} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                                            {r.icon && <span className="text-sm shrink-0">{r.icon}</span>}
                                            <p className="text-[11px] font-black text-slate-800 flex-1 truncate">{r.label}</p>
                                            <span className="text-sm font-black shrink-0" style={{ color: 'var(--color-primary,#f59e0b)' }}>{r.pts}pts</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ══ COLUMNA CENTRAL: En vivo + Próximos partidos + Predicciones recientes ══ */}
                        <div className="space-y-4">

                            {/* Partidos en vivo */}
                            {liveMatches.length > 0 && (
                                <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-sm">
                                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800">
                                        <Radio size={12} className="text-rose-400 animate-pulse" />
                                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">En vivo</span>
                                        <span className="ml-auto text-[10px] text-slate-500 font-bold">{liveMatches.length} partido{liveMatches.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {liveMatches.map((m) => {
                                            const hc = (m.homeTeam.shortCode ?? m.homeTeam.name.slice(0, 3)).toUpperCase();
                                            const ac = (m.awayTeam.shortCode ?? m.awayTeam.name.slice(0, 3)).toUpperCase();
                                            return (
                                                <div key={m.id} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                                        {m.homeTeam.flagUrl ? <img src={m.homeTeam.flagUrl} alt={hc} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-700 shrink-0" />}
                                                        <span className="text-[11px] font-black text-white truncate">{hc}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-base font-black text-rose-400">{m.homeScore ?? 0}</span>
                                                        <span className="text-xs font-black text-slate-600">–</span>
                                                        <span className="text-base font-black text-rose-400">{m.awayScore ?? 0}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                                                        <span className="text-[11px] font-black text-white truncate text-right">{ac}</span>
                                                        {m.awayTeam.flagUrl ? <img src={m.awayTeam.flagUrl} alt={ac} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-700 shrink-0" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Próximos partidos — tarjetas tipo "próximo reto" */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock size={11} className="text-slate-400" /> Próximos partidos
                                    </h3>
                                    {openMatches.length > 3 && (
                                        <Link to={`/pollas/${leagueDetail.id}`}
                                            className="text-[10px] font-black hover:opacity-80 transition-opacity"
                                            style={{ color: 'var(--color-primary,#f59e0b)' }}>
                                            Ver {openMatches.length - 3} más →
                                        </Link>
                                    )}
                                </div>
                                {nextMatches.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                                        <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
                                        <p className="text-xs font-bold text-slate-500">¡Todos los pronósticos al día!</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                        {nextMatches.map((m) => (
                                            <MatchCard key={m.id} match={m} leagueId={leagueDetail.id}
                                                closeMin={leagueDetail.closePredictionMinutes}
                                                onSaved={onSaved}
                                                onDirtyChange={onDirtyChange}
                                                forceSave={forceSaveTick}
                                                resetTick={resetTick} />
                                        ))}
                                    </div>
                                )}
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
                                        {leagueDetail.recentPredictions.slice(0, 5).map((p, i) => {
                                            const hc = (p.homeTeam.shortCode ?? p.homeTeam.name.slice(0, 3)).toUpperCase();
                                            const ac = (p.awayTeam.shortCode ?? p.awayTeam.name.slice(0, 3)).toUpperCase();
                                            const fin = isFinished(p.status);
                                            const pts = p.points ?? 0;
                                            const isExact = fin && pts >= 5;
                                            const hasPoints = fin && pts > 0 && pts < 5;
                                            return (
                                                <div key={i} className={`px-4 py-3 flex items-center gap-3 ${
                                                    isExact ? 'bg-emerald-50/60' : hasPoints ? 'bg-amber-50/40' : ''
                                                }`}>
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        {p.homeTeam.flagUrl ? <img src={p.homeTeam.flagUrl} alt={hc} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-100 shrink-0" />}
                                                        <span className="text-[11px] font-black text-slate-800 truncate">{hc}</span>
                                                        <span className="text-[10px] text-slate-300 font-bold">vs</span>
                                                        <span className="text-[11px] font-black text-slate-800 truncate">{ac}</span>
                                                        {p.awayTeam.flagUrl ? <img src={p.awayTeam.flagUrl} alt={ac} className="w-5 h-3.5 object-cover rounded shrink-0" /> : <div className="w-5 h-3.5 rounded bg-slate-100 shrink-0" />}
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-[11px] font-black text-slate-700">{p.myHome}–{p.myAway}</p>
                                                        {fin && <p className="text-[9px] text-slate-400">Real: {p.homeScore}–{p.awayScore}</p>}
                                                    </div>
                                                    <div className="shrink-0 w-16 text-right">
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

                        {/* ══ COLUMNA DERECHA: Ranking ══ */}
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
                                        {leagueDetail.topRanking.slice(0, 8).map((e) => (
                                            <div key={e.userId}
                                                className={`flex items-center gap-2.5 px-4 py-2.5 ${e.isMe ? 'bg-amber-50' : 'hover:bg-slate-50/60'} transition-colors`}>
                                                <span className="text-xs w-5 text-center font-black text-slate-400 shrink-0 tabular-nums">
                                                    {MEDAL[e.rank] ?? `#${e.rank}`}
                                                </span>
                                                <div className="w-7 h-7 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                                                    {e.avatar
                                                        ? <img src={e.avatar} alt={e.name} className="w-full h-full object-cover" />
                                                        : <span className="text-[9px] font-black text-slate-500">{e.name.charAt(0).toUpperCase()}</span>
                                                    }
                                                </div>
                                                <span className="text-[11px] font-black truncate flex-1"
                                                    style={e.isMe ? { color: 'var(--color-primary,#f59e0b)' } : { color: '#1e293b' }}>
                                                    {e.isMe ? `${e.name.split(' ')[0]} (Tú)` : e.name.split(' ')[0]}
                                                </span>
                                                <span className="text-[11px] font-black text-slate-700 shrink-0 tabular-nums">{e.totalPoints}pts</span>
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
                        </div>

                    </div>
                )
            )}
        {/* FAB — guardar todos los pronósticos pendientes */}
        {hasDirtyChanges && (
            <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSavingAll}
                className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-70 md:bottom-6 md:right-6"
                style={{ backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff', boxShadow: '0 8px 20px rgba(245,158,11,0.4)' }}>
                {isSavingAll
                    ? <><Loader2 size={14} className="animate-spin" /><span>Guardando...</span></>
                    : <><Save size={14} /><span>Guardar {pendingDrafts.size} pronóstico{pendingDrafts.size !== 1 ? 's' : ''}</span></>}
            </button>
        )}

        {/* Modal — cambios sin guardar al navegar */}
        {pendingNavTo !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="font-black text-slate-900 text-base">¿Salir sin guardar?</p>
                            <p className="text-sm text-slate-500 mt-1">Tienes {pendingDrafts.size} pronóstico{pendingDrafts.size !== 1 ? 's' : ''} sin guardar. ¿Qué deseas hacer?</p>
                        </div>
                        <button onClick={() => setPendingNavTo(null)} className="shrink-0 text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={async () => { await handleSaveAll(); navigate(pendingNavTo!); setPendingNavTo(null); }}
                            disabled={isSavingAll}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-60"
                            style={{ backgroundColor: 'var(--color-primary,#f59e0b)', color: '#fff' }}>
                            {isSavingAll ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Guardar y salir
                        </button>
                        <button
                            onClick={() => { discardAll(); navigate(pendingNavTo!); setPendingNavTo(null); }}
                            className="w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                            Descartar y salir
                        </button>
                        <button
                            onClick={() => setPendingNavTo(null)}
                            className="w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </CorpLayout>
    );
}
