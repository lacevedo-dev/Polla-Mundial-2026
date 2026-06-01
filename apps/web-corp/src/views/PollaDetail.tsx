import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Zap, Loader2 } from 'lucide-react';
import { CorpLayout } from '../layouts/CorpLayout';
import { request } from '../api';
import { LeagueDetail, UpcomingMatch } from './PollaDetail/types';
import { isPredictionClosed, isLiveStatus, isFinishedStatus } from './PollaDetail/helpers';
import { LeagueHero } from './PollaDetail/LeagueHero';
import { MatchFiltersBar } from './PollaDetail/MatchFiltersBar';
import { MatchSections } from './PollaDetail/MatchSections';
import { RankingTab } from './PollaDetail/RankingTab';
import { RulesTab } from './PollaDetail/RulesTab';

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
        setMatches(prev => prev.map(m =>
            m.id === matchId ? { ...m, myPrediction: { homeScore: home, awayScore: away, points: null } } : m
        ));
    }

    const pendingCount = matches.filter(m => {
        const cl = isPredictionClosed(m.matchDate, league?.closePredictionMinutes ?? 15);
        return !cl && !isFinishedStatus(m.status) && !isLiveStatus(m.status) && !m.myPrediction;
    }).length;

    const byPhase = phaseFilter === 'ALL' ? matches
        : phaseFilter === 'GROUP' ? matches.filter(m => m.phase === 'GROUP' || !m.phase)
        : matches.filter(m => m.phase && m.phase !== 'GROUP');

    const availableGroups = Array.from(
        new Set(byPhase.filter(m => m.group).map(m => m.group!))
    ).sort();
    const showGroupFilter = phaseFilter !== 'KNOCKOUT' && availableGroups.length > 1;

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

    return (
        <CorpLayout>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4 transition-colors">
                <ArrowLeft size={15} /> Dashboard
            </Link>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary, #f59e0b)' }} />
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
                    <LeagueHero league={league} />

                    {pendingCount > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary,#f59e0b) 10%, white)', borderColor: 'color-mix(in srgb, var(--color-primary,#f59e0b) 35%, white)', color: 'color-mix(in srgb, var(--color-primary,#f59e0b) 80%, #1e293b)' }}>
                            <Zap size={15} />
                            <span>{pendingCount} partido{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de pronostico</span>
                        </div>
                    )}

                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                        {(['partidos', 'ranking', 'reglas'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {tab === 'partidos' && (
                        <div className="space-y-3">
                            <MatchFiltersBar
                                phaseFilter={phaseFilter}
                                groupFilter={groupFilter}
                                viewMode={viewMode}
                                search={search}
                                availableGroups={availableGroups}
                                showGroupFilter={showGroupFilter}
                                onPhaseChange={setPhaseFilter}
                                onGroupChange={setGroupFilter}
                                onViewModeChange={setViewMode}
                                onSearchChange={setSearch}
                            />
                            <MatchSections
                                filtered={filtered}
                                leagueId={league.id}
                                closeMin={league.closePredictionMinutes}
                                viewMode={viewMode}
                                search={search}
                                onSaved={handlePredictionSaved}
                                onGroupSelect={(g) => { setPhaseFilter('GROUP'); setGroupFilter(g); }}
                            />
                        </div>
                    )}

                    {tab === 'ranking' && <RankingTab topRanking={league.topRanking} />}
                    {tab === 'reglas' && <RulesTab scoringRules={league.scoringRules} closePredictionMinutes={league.closePredictionMinutes} />}
                </div>
            )}
        </CorpLayout>
    );
}
