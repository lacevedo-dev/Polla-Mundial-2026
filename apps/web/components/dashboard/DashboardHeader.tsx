import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Eye, EyeOff, Settings, Share2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fade } from '../../utils/dashboard';

interface League {
    id: string;
    name: string;
    code?: string;
    label?: string;
    meta?: string;
}

interface DashboardHeaderProps {
    activeLeague: League | null;
    myLeagues: League[];
    isAdmin: boolean;
    isRealAdmin: boolean;
    spectatorMode: boolean;
    userPlan?: string | null;
    nextUnsaved: boolean;
    leagueDropOpen: boolean;
    onLeagueDropToggle: () => void;
    onLeagueSelect: (id: string) => void;
    onSpectatorToggle: () => void;
    onSpectatorExit: () => void;
    onInviteOpen: () => void;
    onConfigOpen: () => void;
    buildLeagueMeta: (league: League) => string[];
    buildLeagueLabel: (league: League) => string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    activeLeague,
    myLeagues,
    isAdmin,
    isRealAdmin,
    spectatorMode,
    userPlan,
    nextUnsaved,
    leagueDropOpen,
    onLeagueDropToggle,
    onLeagueSelect,
    onSpectatorToggle,
    onSpectatorExit,
    onInviteOpen,
    onConfigOpen,
    buildLeagueMeta,
    buildLeagueLabel,
}) => {
    const navigate = useNavigate();

    return (
        <motion.header {...fade(0)} className="space-y-3">
            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                    isAdmin ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                    {isAdmin ? 'Administrador' : 'Participante'}
                </span>

                {isRealAdmin && (
                    <button
                        onClick={onSpectatorToggle}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                            spectatorMode
                                ? 'border-violet-300 bg-violet-50 text-violet-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600'
                        }`}
                    >
                        {spectatorMode
                            ? <><EyeOff size={11} /> Salir de espectador</>
                            : <><Eye size={11} /> Ver como espectador</>}
                    </button>
                )}

                {userPlan && (
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        userPlan === 'DIAMOND'
                            ? 'border-purple-300 bg-purple-50 text-purple-700'
                            : userPlan === 'GOLD'
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}>
                        Plan {userPlan}
                    </span>
                )}
            </div>

            {/* Title + action row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* League name dropdown */}
                <div className="relative">
                    <button
                        onClick={onLeagueDropToggle}
                        className="flex items-start gap-2 text-left group"
                    >
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black font-brand uppercase tracking-tight text-slate-900 sm:text-4xl group-hover:text-lime-700 transition-colors leading-none">
                                {activeLeague?.name ?? 'Sin liga'}
                            </h1>
                            {activeLeague && buildLeagueMeta(activeLeague).length > 0 && (
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:text-[11px]">
                                    {buildLeagueMeta(activeLeague).join(' · ')}
                                </p>
                            )}
                        </div>
                        <motion.div
                            animate={{ rotate: leagueDropOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-1"
                        >
                            <ChevronDown size={20} className="text-slate-400 group-hover:text-lime-600 transition-colors" />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {leagueDropOpen && (
                            <>
                                <div className="fixed inset-0 z-20" onClick={onLeagueDropToggle} />
                                <motion.div
                                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                    transition={{ duration: 0.16, ease: 'easeOut' as const }}
                                    className="absolute top-full mt-2 left-0 z-30 min-w-[240px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                                >
                                    {myLeagues.map((league) => (
                                        <button
                                            key={league.id}
                                            onClick={() => onLeagueSelect(league.id)}
                                            className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                                                league.id === activeLeague?.id
                                                    ? 'bg-lime-50 text-lime-700'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            {buildLeagueLabel(league)}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {nextUnsaved && (
                        <button
                            onClick={() => navigate('/predictions')}
                            title="Pronosticar"
                            className="flex items-center gap-2 rounded-2xl bg-lime-400 px-3 py-2.5 sm:px-4 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-lime-500 transition-all"
                        >
                            <Zap size={15} />
                            <span className="hidden sm:inline">Pronosticar</span>
                        </button>
                    )}
                    {activeLeague?.code && (
                        <button
                            onClick={onInviteOpen}
                            title="Invitar"
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 text-sm font-black uppercase tracking-wide text-slate-700 hover:border-slate-300 transition-all"
                        >
                            <Share2 size={15} />
                            <span className="hidden sm:inline">Invitar</span>
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={onConfigOpen}
                            title="Configurar"
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4 text-sm font-black uppercase tracking-wide text-slate-700 hover:border-slate-300 transition-all"
                        >
                            <Settings size={15} />
                            <span className="hidden sm:inline">Configurar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Spectator sub-banner */}
            <AnimatePresence>
                {spectatorMode && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-600 px-4 py-2.5">
                            <div className="flex items-center gap-2">
                                <Eye size={13} className="text-violet-200" />
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white">Modo espectador activo</p>
                            </div>
                            <button
                                onClick={onSpectatorExit}
                                className="rounded-lg border border-violet-400 px-3 py-1 text-[10px] font-black uppercase text-white hover:bg-white/10 transition-colors"
                            >
                                Volver
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
};

export default DashboardHeader;
