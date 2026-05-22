import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, Circle, ListChecks, Users, Trophy, Star } from 'lucide-react';
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
    scoringRules: { ruleType: string; points: number; description: string | null; multiplier: number }[];
    upcomingMatches: UpcomingMatch[];
    recentPredictions: RecentPrediction[];
    topRanking: TopRankEntry[];
}

/* ─── Helpers ────────────────────────────────────────────────── */

function fmtDate(d: string) {
    return new Intl.DateTimeFormat('es-CO', {
        weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(d));
}
function isPredictionClosed(matchDate: string, closeMin = 15) {
    return Date.now() > new Date(matchDate).getTime() - closeMin * 60_000;
}

function TeamBadge({ team, size = 'md' }: { team: Pick<Team, 'name' | 'shortCode' | 'flagUrl'>; size?: 'sm' | 'md' }) {
    const sz = size === 'sm' ? 'w-7 h-7 text-[9px]' : 'w-10 h-10 text-xs';
    const abbr = team.shortCode?.slice(0, 3) ?? team.name.slice(0, 3).toUpperCase();
    return (
        <div className="flex flex-col items-center gap-1">
            {team.flagUrl ? (
                <img src={team.flagUrl} alt={abbr} className={`${sz} object-contain rounded`} />
            ) : (
                <div className={`${sz} rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500`}>
                    {abbr.slice(0, 2)}
                </div>
            )}
            <span className={`font-bold text-slate-700 ${size === 'sm' ? 'text-[9px]' : 'text-[11px]'} text-center leading-tight`}>
                {team.shortCode ?? team.name}
            </span>
        </div>
    );
}

/* ─── Component ─────────────────────────────────────────────── */

export default function PollaDetail() {
    const { id } = useParams<{ id: string }>();
    const [league, setLeague] = useState<LeagueDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'partidos' | 'ranking' | 'reglas'>('partidos');

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        request<LeagueDetail>(`/corp/leagues/${id}`)
            .then(setLeague)
            .catch(() => setLeague(null))
            .finally(() => setLoading(false));
    }, [id]);

    const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

    return (
        <CorpLayout>
            {/* Back */}
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
                        style={{ background: 'linear-gradient(135deg, var(--color-primary, #f59e0b), color-mix(in srgb, var(--color-primary, #f59e0b) 55%, #1e293b))' }}
                    >
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

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                        {(['partidos', 'ranking', 'reglas'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Tab: Partidos */}
                    {tab === 'partidos' && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-50">
                                <h2 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                    <Clock size={14} className="text-slate-400" /> Partidos
                                </h2>
                                <span className="text-[10px] font-bold text-slate-400">{league.upcomingMatches.length} en la polla</span>
                            </div>
                            {league.upcomingMatches.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">No hay partidos en esta polla aún</div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {league.upcomingMatches.map((m) => {
                                        const closed = isPredictionClosed(m.matchDate, league.closePredictionMinutes);
                                        const hasPred = !!m.myPrediction;
                                        const isLive = m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'HALFTIME';
                                        const isFinished = m.status === 'FINISHED' || m.status === 'FT';
                                        return (
                                            <div key={m.id} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors">
                                                <div className="shrink-0 w-5 flex justify-center">
                                                    {isLive ? (
                                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse block" />
                                                    ) : hasPred ? (
                                                        <CheckCircle2 size={15} className="text-emerald-500" />
                                                    ) : (
                                                        <Circle size={15} className="text-slate-200" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <TeamBadge team={m.homeTeam} size="md" />
                                                    <div className="flex-1 text-center">
                                                        {isFinished || isLive ? (
                                                            <div>
                                                                <span className="text-xl font-black text-slate-900">
                                                                    {m.homeScore ?? 0} – {m.awayScore ?? 0}
                                                                </span>
                                                                {isLive && <p className="text-[9px] font-bold text-rose-500 mt-0.5 animate-pulse">EN VIVO</p>}
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <p className="text-xs text-slate-400">{fmtDate(m.matchDate)}</p>
                                                                {hasPred && (
                                                                    <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--color-primary, #f59e0b)' }}>
                                                                        Pred: {m.myPrediction!.homeScore}–{m.myPrediction!.awayScore}
                                                                    </p>
                                                                )}
                                                                {!hasPred && !closed && (
                                                                    <p className="text-[10px] font-bold text-sky-500 mt-0.5">Pendiente de pronóstico</p>
                                                                )}
                                                                {!hasPred && closed && (
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">Cerrado</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <TeamBadge team={m.awayTeam} size="md" />
                                                </div>
                                                {isFinished && hasPred && m.myPrediction!.points != null && (
                                                    <div className="shrink-0 text-right">
                                                        <span className="text-sm font-black" style={{ color: m.myPrediction!.points > 0 ? 'var(--color-primary, #f59e0b)' : '#94a3b8' }}>
                                                            {m.myPrediction!.points > 0 ? `+${m.myPrediction!.points}` : '0'} pts
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Recent predictions section */}
                            {league.recentPredictions.length > 0 && (
                                <>
                                    <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100">
                                        <ListChecks size={13} className="text-slate-400" />
                                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide">Últimos pronósticos</h3>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        {league.recentPredictions.map((p, i) => {
                                            const finished = p.status === 'FINISHED' || p.status === 'FT';
                                            return (
                                                <div key={i} className="flex items-center gap-3 px-4 py-3">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <TeamBadge team={p.homeTeam} size="sm" />
                                                        <span className="text-xs font-black text-slate-500 mx-1">
                                                            {finished ? `${p.homeScore ?? 0}–${p.awayScore ?? 0}` : fmtDate(p.matchDate)}
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
                                </>
                            )}
                        </div>
                    )}

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
                                            style={entry.isMe ? { backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 8%, white)' } : undefined}
                                        >
                                            <span className="text-base w-8 text-center shrink-0 font-bold text-slate-400">
                                                {MEDAL[entry.rank] ?? `#${entry.rank}`}
                                            </span>
                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                                {entry.avatar
                                                    ? <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                                                    : <span className="text-xs font-black text-slate-400">{entry.name.charAt(0)}</span>
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate"
                                                    style={entry.isMe ? { color: 'var(--color-primary, #f59e0b)' } : { color: '#1e293b' }}>
                                                    {entry.name}{entry.isMe && <span className="text-xs opacity-60 ml-1">(tú)</span>}
                                                </p>
                                                {entry.username && (
                                                    <p className="text-[10px] text-slate-400">@{entry.username}</p>
                                                )}
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
