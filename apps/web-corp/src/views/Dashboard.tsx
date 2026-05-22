import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Trophy, Users, TrendingUp, ChevronRight, Calendar,
    Shield, Clock, CheckCircle2, Circle, Star, ListChecks,
} from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { request } from '../api';

/* ─── Types ─────────────────────────────────────────────────── */

interface Team { id: string; name: string; shortName: string; logo: string | null; }
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
    homeTeam: Pick<Team, 'name' | 'shortName' | 'logo'>;
    awayTeam: Pick<Team, 'name' | 'shortName' | 'logo'>;
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
    scoringRules: { type: string; points: number; label: string }[];
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

function fmtDate(d: string) {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
}
function isPredictionClosed(matchDate: string, closeMin = 15) {
    return Date.now() > new Date(matchDate).getTime() - closeMin * 60_000;
}

/* ─── Sub-components ─────────────────────────────────────────── */

function TeamBadge({ team, size = 'md' }: { team: Pick<Team, 'name' | 'shortName' | 'logo'>; size?: 'sm' | 'md' }) {
    const sz = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-9 h-9 text-xs';
    return (
        <div className="flex flex-col items-center gap-1">
            {team.logo ? (
                <img src={team.logo} alt={team.shortName} className={`${sz} object-contain rounded`} />
            ) : (
                <div className={`${sz} rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500`}>
                    {team.shortName?.slice(0, 2) ?? '?'}
                </div>
            )}
            <span className={`font-bold text-slate-700 ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'} text-center leading-tight`}>{team.shortName ?? team.name}</span>
        </div>
    );
}

function MatchRow({ match, closeMin }: { match: UpcomingMatch; closeMin: number }) {
    const closed = isPredictionClosed(match.matchDate, closeMin);
    const hasPred = !!match.myPrediction;
    const isLive = match.status === 'LIVE' || match.status === 'IN_PLAY' || match.status === 'HALFTIME';
    const isFinished = match.status === 'FINISHED' || match.status === 'FT';

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
            {/* Status indicator */}
            <div className="shrink-0 w-5 flex justify-center">
                {isLive ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse block" />
                ) : hasPred ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                ) : closed ? (
                    <Circle size={14} className="text-slate-300" />
                ) : (
                    <Circle size={14} className="text-slate-200" />
                )}
            </div>

            {/* Teams */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <TeamBadge team={match.homeTeam} size="sm" />
                <div className="flex-1 text-center">
                    {isFinished || isLive ? (
                        <span className="text-sm font-black text-slate-900">
                            {match.homeScore ?? 0} – {match.awayScore ?? 0}
                        </span>
                    ) : (
                        <div>
                            <p className="text-[10px] text-slate-400 leading-none">{fmtDate(match.matchDate)}</p>
                            {hasPred && (
                                <p className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                    Pred: {match.myPrediction!.homeScore}–{match.myPrediction!.awayScore}
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <TeamBadge team={match.awayTeam} size="sm" />
            </div>

            {/* Points or action */}
            <div className="shrink-0 w-14 text-right">
                {isFinished && hasPred && match.myPrediction!.points != null ? (
                    <span className="text-xs font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                        +{match.myPrediction!.points} pts
                    </span>
                ) : !closed && !hasPred ? (
                    <span className="text-[10px] font-bold text-sky-500">Pronosticar</span>
                ) : null}
            </div>
        </div>
    );
}

function TopRankingList({ ranking }: { ranking: TopRankEntry[] }) {
    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return (
        <div className="divide-y divide-slate-50">
            {ranking.map((entry) => (
                <div key={entry.userId}
                    className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                    style={entry.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' } : {}}
                >
                    <span className="text-sm w-5 text-center shrink-0">{MEDAL[entry.rank] ?? `#${entry.rank}`}</span>
                    <div className="w-7 h-7 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {entry.avatar
                            ? <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                            : <span className="text-[10px] font-black text-slate-400">{entry.name.charAt(0)}</span>
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#1e293b' }}>
                            {entry.name}{entry.isMe && <span className="opacity-60 ml-1">(tú)</span>}
                        </p>
                    </div>
                    <span className="text-xs font-black text-slate-700 shrink-0">{entry.totalPoints} pts</span>
                </div>
            ))}
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
    const [loadingDetail, setLoadingDetail] = useState(false);

    const orgName = tenant?.branding?.companyDisplayName ?? tenant?.name ?? 'tu organización';
    const isAdmin = user?.tenantRole === 'OWNER' || user?.tenantRole === 'ADMIN';

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
            .then(setLeagueDetail)
            .catch(() => setLeagueDetail(null))
            .finally(() => setLoadingDetail(false));
    }, [selectedLeagueId]);

    const Spinner = () => (
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
    );

    return (
        <CorpLayout>
            {/* ── Top stats bar ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Mis pollas', value: loadingDash ? '—' : (data?.myLeagues.length ?? 0), icon: Trophy, c: 'primary' },
                    { label: 'Posición global', value: loadingDash ? '—' : (data?.globalRank != null ? `#${data.globalRank}` : '—'), icon: TrendingUp, c: 'emerald' },
                    { label: 'Miembros', value: loadingDash ? '—' : (data?.totalMembers ?? 0), icon: Users, c: 'sky' },
                    { label: 'Por pronosticar', value: loadingDash ? '—' : (data?.predictionsPending ?? 0), icon: Calendar, c: 'rose' },
                ].map(({ label, value, icon: Icon, c }) => {
                    const isPrimary = c === 'primary';
                    const iconBg = isPrimary
                        ? undefined
                        : c === 'emerald' ? 'bg-emerald-50' : c === 'sky' ? 'bg-sky-50' : 'bg-rose-50';
                    const iconColor = isPrimary
                        ? undefined
                        : c === 'emerald' ? 'text-emerald-600' : c === 'sky' ? 'text-sky-600' : 'text-rose-500';
                    return (
                        <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                            <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${iconBg ?? ''}`}
                                style={isPrimary ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, white)' } : undefined}
                            >
                                <Icon size={17}
                                    className={iconColor ?? ''}
                                    style={isPrimary ? { color: 'var(--color-primary, #f59e0b)' } : undefined}
                                />
                            </div>
                            <div className="text-2xl font-black text-slate-900">{value}</div>
                            <div className="text-xs text-slate-500 font-medium mt-0.5">{label}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Main layout: sidebar + center + right ── */}
            <div className="flex gap-4">

                {/* Left sidebar: my leagues */}
                <div className="hidden lg:flex flex-col w-52 shrink-0 gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1">Mis Pollas</p>
                    {loadingDash ? (
                        <div className="py-6"><Spinner /></div>
                    ) : !data?.myLeagues.length ? (
                        <Link to="/pollas" className="text-xs text-slate-400 hover:underline px-1">Explorar pollas →</Link>
                    ) : (
                        data.myLeagues.map((l) => (
                            <button key={l.id} onClick={() => setSelectedLeagueId(l.id)}
                                className="w-full text-left rounded-xl px-3 py-2.5 transition-all border text-sm font-bold truncate"
                                style={selectedLeagueId === l.id
                                    ? { backgroundColor: 'var(--color-primary, #f59e0b)', color: '#fff', borderColor: 'transparent' }
                                    : { backgroundColor: 'white', color: '#334155', borderColor: '#f1f5f9' }}
                            >
                                <span className="block truncate">{l.name}</span>
                                <span className="text-[10px] font-normal opacity-70">{l.myPoints} pts</span>
                            </button>
                        ))
                    )}
                    <Link to="/pollas" className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 px-1 mt-1 transition-colors">
                        Ver todas <ChevronRight size={11} />
                    </Link>

                    {isAdmin && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1.5">Admin</p>
                            <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors mb-1">
                                <Shield size={13} /> Panel admin
                            </Link>
                            <Link to="/admin/members" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors">
                                <Users size={13} /> Miembros
                            </Link>
                        </div>
                    )}
                </div>

                {/* Center: league detail */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Mobile league picker */}
                    <div className="lg:hidden">
                        {loadingDash ? null : data?.myLeagues.length ? (
                            <select
                                value={selectedLeagueId ?? ''}
                                onChange={(e) => setSelectedLeagueId(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none"
                                style={{ color: 'var(--color-primary, #f59e0b)' }}
                            >
                                {data.myLeagues.map((l) => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        ) : (
                            <Link to="/pollas" className="block text-center py-3 rounded-xl bg-white border border-slate-100 text-sm font-bold" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                Explorar pollas →
                            </Link>
                        )}
                    </div>

                    {/* League header card */}
                    {!selectedLeagueId ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
                            <Trophy size={36} className="mx-auto mb-3 text-slate-200" />
                            <p className="font-bold text-slate-500 text-sm">Selecciona una polla para ver el detalle</p>
                            <Link to="/pollas" className="mt-3 inline-block text-sm font-bold hover:underline" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                Ver todas las pollas →
                            </Link>
                        </div>
                    ) : loadingDetail ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex justify-center">
                            <Spinner />
                        </div>
                    ) : !leagueDetail ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
                            No se pudo cargar el detalle.
                        </div>
                    ) : (
                        <>
                            {/* League hero */}
                            <div className="rounded-2xl p-5 text-white shadow-md"
                                style={{ background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 60%, #1e293b))' }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Polla activa</p>
                                        <h2 className="text-xl font-black leading-tight truncate">{leagueDetail.name}</h2>
                                        {leagueDetail.description && (
                                            <p className="text-sm text-white/70 mt-1 line-clamp-1">{leagueDetail.description}</p>
                                        )}
                                    </div>
                                    <Link to={`/pollas/${leagueDetail.id}`}
                                        className="shrink-0 flex items-center gap-1.5 text-[11px] font-black bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2 transition-colors"
                                    >
                                        Ver <ChevronRight size={12} />
                                    </Link>
                                </div>

                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    {[
                                        { label: 'Mis puntos', value: leagueDetail.myPoints },
                                        { label: 'Mi posición', value: `#${leagueDetail.myRank}` },
                                        { label: 'Participantes', value: `${leagueDetail.participantsCount}/${leagueDetail.maxParticipants}` },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="bg-white/15 rounded-xl p-3 text-center">
                                            <p className="text-lg font-black">{value}</p>
                                            <p className="text-[10px] text-white/70 font-medium mt-0.5">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Upcoming matches */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-50">
                                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" /> Próximos partidos
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-400">{leagueDetail.upcomingMatches.length} partidos</span>
                                </div>
                                {leagueDetail.upcomingMatches.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">No hay partidos próximos</div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {leagueDetail.upcomingMatches.slice(0, 6).map((m) => (
                                            <MatchRow key={m.id} match={m} closeMin={leagueDetail.closePredictionMinutes} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent predictions */}
                            {leagueDetail.recentPredictions.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-50">
                                        <ListChecks size={14} className="text-slate-400" />
                                        <h3 className="font-black text-slate-900 text-sm">Pronósticos recientes</h3>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        {leagueDetail.recentPredictions.map((p, i) => {
                                            const finished = p.status === 'FINISHED' || p.status === 'FT';
                                            return (
                                                <div key={i} className="flex items-center gap-3 px-4 py-3">
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        <TeamBadge team={p.homeTeam} size="sm" />
                                                        <span className="text-xs font-black text-slate-500 mx-1">
                                                            {finished ? `${p.homeScore ?? 0}–${p.awayScore ?? 0}` : fmtDate(p.matchDate).split(' ').slice(-2).join(' ')}
                                                        </span>
                                                        <TeamBadge team={p.awayTeam} size="sm" />
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-[10px] text-slate-400">Tu pred: {p.myHome}–{p.myAway}</p>
                                                        {finished && p.points != null && (
                                                            <p className="text-xs font-black" style={{ color: p.points > 0 ? 'var(--color-primary, #f59e0b)' : '#94a3b8' }}>
                                                                {p.points > 0 ? `+${p.points} pts` : 'Sin puntos'}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Scoring rules */}
                            {leagueDetail.scoringRules.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3.5 border-b border-slate-50">
                                        <h3 className="font-black text-slate-900 text-sm">Reglas de puntos</h3>
                                    </div>
                                    <div className="px-4 py-2 divide-y divide-slate-50">
                                        {leagueDetail.scoringRules.map((r) => (
                                            <div key={r.type} className="flex items-center justify-between py-2">
                                                <span className="text-xs text-slate-600 font-medium">{r.label}</span>
                                                <span className="text-xs font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>{r.points} pts</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right sidebar: top ranking */}
                <div className="hidden xl:flex flex-col w-52 shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-2">Top Actual</p>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {loadingDetail ? (
                            <div className="p-6"><Spinner /></div>
                        ) : !leagueDetail?.topRanking.length ? (
                            <div className="p-4 text-xs text-slate-400 text-center">Sin datos aún</div>
                        ) : (
                            <TopRankingList ranking={leagueDetail.topRanking} />
                        )}
                        <div className="border-t border-slate-50 px-4 py-2.5">
                            <Link to="/ranking" className="text-[11px] font-bold flex items-center justify-center gap-1 transition-colors hover:opacity-80" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                Ver ranking completo <ChevronRight size={11} />
                            </Link>
                        </div>
                    </div>

                    {/* Global stats */}
                    <div className="mt-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Organización</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 flex items-center gap-1.5"><Users size={11} /> Miembros</span>
                                <span className="text-xs font-black text-slate-700">{data?.totalMembers ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 flex items-center gap-1.5"><Trophy size={11} /> Pollas</span>
                                <span className="text-xs font-black text-slate-700">{data?.myLeagues.length ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 flex items-center gap-1.5"><Star size={11} /> Mi posición</span>
                                <span className="text-xs font-black" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                    {data?.globalRank != null ? `#${data.globalRank}` : '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </CorpLayout>
    );
}
