import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AlertCircle, Check, ChevronDown, FlaskConical, Loader2,
    Trophy, Users, X, Zap,
} from 'lucide-react';
import { request } from '../../api';

interface League {
    id: string;
    name: string;
    memberCount: number;
    status: string;
}

interface Match {
    id: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    matchDate: string;
    status: string | null;
}

interface SeedResult {
    league: string;
    members: number;
    matches: number;
    created: number;
    skipped: number;
}

interface Props {
    onClose: () => void;
}

const BulkSeedPredictionsModal: React.FC<Props> = ({ onClose }) => {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [leagueError, setLeagueError] = useState('');

    const [selectedLeagueId, setSelectedLeagueId] = useState('');
    const [leagueOpen, setLeagueOpen] = useState(false);

    const [matches, setMatches] = useState<Match[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
    const [useAllMatches, setUseAllMatches] = useState(true);

    const [seeding, setSeeding] = useState(false);
    const [result, setResult] = useState<SeedResult | null>(null);
    const [seedError, setSeedError] = useState('');

    useEffect(() => {
        setLoadingLeagues(true);
        request<{ data: League[] }>('/admin/leagues?limit=100&page=1')
            .then(res => setLeagues(res.data))
            .catch(() => setLeagueError('No se pudieron cargar las pollas'))
            .finally(() => setLoadingLeagues(false));
    }, []);

    const loadMatches = useCallback(async (leagueId: string) => {
        if (!leagueId) return;
        setLoadingMatches(true);
        setMatches([]);
        setSelectedMatchIds(new Set());
        try {
            const res = await request<{ data: Match[] }>(`/admin/matches?limit=100&page=1&status=SCHEDULED`);
            setMatches(res.data);
        } catch {
            /* no critical */
        } finally {
            setLoadingMatches(false);
        }
    }, []);

    const handleSelectLeague = (id: string) => {
        setSelectedLeagueId(id);
        setLeagueOpen(false);
        setResult(null);
        setSeedError('');
        void loadMatches(id);
    };

    const toggleMatch = (id: string) => {
        setSelectedMatchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSeed = async () => {
        if (!selectedLeagueId) return;
        setSeeding(true);
        setSeedError('');
        setResult(null);
        try {
            const body: { leagueId: string; matchIds?: string[] } = { leagueId: selectedLeagueId };
            if (!useAllMatches && selectedMatchIds.size > 0) {
                body.matchIds = [...selectedMatchIds];
            }
            const res = await request<SeedResult>('/admin/predictions/bulk-seed', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            setResult(res);
        } catch (e: any) {
            setSeedError(e?.message ?? 'Error al generar pronósticos');
        } finally {
            setSeeding(false);
        }
    };

    const selectedLeague = leagues.find(l => l.id === selectedLeagueId);

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="w-full sm:max-w-lg bg-white sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                            <FlaskConical size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Pronósticos de prueba</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carga masiva para testing</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>

                    {/* Info banner */}
                    <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
                        <Zap size={13} className="shrink-0 mt-0.5" />
                        <p>Genera pronósticos aleatorios para <strong>todos los participantes activos</strong> de la polla seleccionada. Útil para probar el sistema sin ingresar manualmente cada predicción. <strong>Solo crea pronósticos nuevos</strong> (no sobreescribe existentes).</p>
                    </div>

                    {/* League selector */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Polla</label>
                        {loadingLeagues ? (
                            <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                                <Loader2 size={14} className="animate-spin" /> Cargando pollas…
                            </div>
                        ) : leagueError ? (
                            <p className="text-xs text-rose-600">{leagueError}</p>
                        ) : (
                            <div className="relative">
                                <button
                                    onClick={() => setLeagueOpen(o => !o)}
                                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white hover:border-violet-400 transition-colors"
                                >
                                    <span className={selectedLeague ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                                        {selectedLeague ? selectedLeague.name : 'Selecciona una polla…'}
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${leagueOpen ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {leagueOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-52 overflow-y-auto"
                                            style={{ scrollbarWidth: 'thin' }}
                                        >
                                            {leagues.map(l => (
                                                <button
                                                    key={l.id}
                                                    onClick={() => handleSelectLeague(l.id)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 transition-colors border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                                                        <Trophy size={12} className="text-violet-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{l.name}</p>
                                                        <p className="text-[10px] text-slate-400 capitalize">{l.status.toLowerCase()}</p>
                                                    </div>
                                                    {l.id === selectedLeagueId && <Check size={13} className="text-violet-600 shrink-0" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* Scope selector */}
                    {selectedLeagueId && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Partidos a pronosticar</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setUseAllMatches(true)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${useAllMatches ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}
                                >
                                    Todos los programados (últimos 7 días en adelante)
                                </button>
                                <button
                                    onClick={() => setUseAllMatches(false)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${!useAllMatches ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}
                                >
                                    Seleccionar manualmente
                                </button>
                            </div>

                            {/* Manual match selection */}
                            {!useAllMatches && (
                                <div className="space-y-2">
                                    {loadingMatches ? (
                                        <div className="flex items-center gap-2 py-4 text-sm text-slate-400 justify-center">
                                            <Loader2 size={14} className="animate-spin" /> Cargando partidos…
                                        </div>
                                    ) : matches.length === 0 ? (
                                        <p className="text-center text-sm text-slate-400 py-3">No hay partidos SCHEDULED disponibles</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-slate-400">{matches.length} partidos programados</p>
                                                <button
                                                    onClick={() => setSelectedMatchIds(
                                                        selectedMatchIds.size === matches.length
                                                            ? new Set()
                                                            : new Set(matches.map(m => m.id))
                                                    )}
                                                    className="text-[10px] font-bold text-violet-600 hover:text-violet-700"
                                                >
                                                    {selectedMatchIds.size === matches.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                </button>
                                            </div>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                {matches.map(m => (
                                                    <label
                                                        key={m.id}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMatchIds.has(m.id) ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-violet-200'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedMatchIds.has(m.id)}
                                                            onChange={() => toggleMatch(m.id)}
                                                            className="w-4 h-4 accent-violet-500 shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{m.homeTeam.name} vs {m.awayTeam.name}</p>
                                                            <p className="text-[10px] text-slate-400">
                                                                {new Date(m.matchDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {seedError && (
                        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                            <AlertCircle size={14} /> {seedError}
                        </div>
                    )}

                    {/* Result */}
                    <AnimatePresence>
                        {result && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-lime-50 border border-lime-300 rounded-2xl space-y-3"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-lime-400 rounded-full flex items-center justify-center">
                                        <Check size={14} strokeWidth={3} className="text-slate-900" />
                                    </div>
                                    <p className="text-sm font-black text-slate-900">¡Pronósticos generados!</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
                                        <p className="text-2xl font-black text-lime-600">{result.created}</p>
                                        <p className="text-slate-500 mt-0.5">creados</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-lime-200 text-center">
                                        <p className="text-2xl font-black text-slate-400">{result.skipped}</p>
                                        <p className="text-slate-500 mt-0.5">omitidos (ya existían)</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 text-center">
                                    <Users size={10} className="inline mr-1" />
                                    {result.members} participantes · {result.matches} partidos · polla: <strong>{result.league}</strong>
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* CTA */}
                    <button
                        onClick={() => void handleSeed()}
                        disabled={seeding || !selectedLeagueId || (!useAllMatches && selectedMatchIds.size === 0)}
                        className="w-full py-3 rounded-2xl bg-violet-600 text-white font-black uppercase text-sm hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                        {seeding
                            ? <><Loader2 size={16} className="animate-spin" /> Generando pronósticos…</>
                            : <><FlaskConical size={16} /> Generar pronósticos de prueba</>
                        }
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default BulkSeedPredictionsModal;
