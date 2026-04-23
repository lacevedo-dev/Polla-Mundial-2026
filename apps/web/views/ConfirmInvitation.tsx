import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Ticket, Users, CheckCircle2, Coins, Trophy, Clock, ArrowRight } from 'lucide-react';
import { useLeagueStore } from '../stores/league.store';
import { request } from '../api';

interface LeaguePreview {
    name: string;
    description?: string;
    memberCount?: number;
    adminName?: string;
    baseFee?: number;
    currency?: string;
    maxParticipants?: number | null;
    plan?: string;
}

const ConfirmInvitation: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Try to get code from URL params or localStorage
    const pendingCode = searchParams.get('code') ||
                        localStorage.getItem('pending_league_code');

    const [leaguePreview, setLeaguePreview] = useState<LeaguePreview | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const joinLeague = useLeagueStore((state) => state.joinLeague);

    useEffect(() => {
        // If no pending code, redirect to dashboard
        if (!pendingCode) {
            navigate('/dashboard', { replace: true });
            return;
        }

        // Fetch league preview
        setIsLoading(true);
        request<LeaguePreview>(`/leagues/info-by-code/${pendingCode}`)
            .then((data) => {
                setLeaguePreview(data);
                setError(null);
            })
            .catch((err) => {
                setError(err.message || 'No se pudo cargar la información de la liga');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [pendingCode, navigate]);

    const handleConfirm = async () => {
        if (!pendingCode) return;

        setIsJoining(true);
        setError(null);

        try {
            await joinLeague(pendingCode);

            // Clear pending code from storage
            localStorage.removeItem('pending_league_code');

            // Navigate to dashboard with success state
            navigate('/dashboard', {
                replace: true,
                state: {
                    justJoined: true,
                    leagueName: leaguePreview?.name
                }
            });
        } catch (err: any) {
            setError(err.message || 'Error al unirse a la liga');
        } finally {
            setIsJoining(false);
        }
    };

    const handleSkip = () => {
        // Keep the code in localStorage for later
        // User can join from "My Leagues" page
        navigate('/dashboard', { replace: true });
    };

    const formatCurrency = (amount?: number, currency = 'COP'): string => {
        if (!amount) return 'Gratis';
        try {
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(amount);
        } catch {
            return `${currency} ${amount}`;
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <motion.div
                className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-lime-100 rounded-2xl flex items-center justify-center">
                        <Ticket size={40} className="text-lime-600" />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center">
                    <h2 className="text-2xl font-black font-brand uppercase text-slate-900 mb-2">
                        ¡Tienes una invitación!
                    </h2>
                    <p className="text-sm text-slate-500">
                        Fuiste invitado a unirte a una liga
                    </p>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="bg-slate-100 rounded-2xl p-8 animate-pulse">
                        <div className="h-4 bg-slate-200 rounded mb-3 w-1/2" />
                        <div className="h-8 bg-slate-200 rounded mb-4" />
                        <div className="h-12 bg-slate-200 rounded" />
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                        <p className="text-sm font-bold text-red-700 mb-2">
                            Error al cargar la invitación
                        </p>
                        <p className="text-xs text-red-600">
                            {error}
                        </p>
                    </div>
                )}

                {/* League Preview */}
                {leaguePreview && !isLoading && (
                    <div className="bg-slate-900 rounded-2xl p-5 space-y-4">
                        {/* League Name & Description */}
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-lime-400 mb-2">
                                Liga
                            </p>
                            <p className="text-xl font-black text-white mb-1">
                                {leaguePreview.name}
                            </p>
                            {leaguePreview.description && (
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {leaguePreview.description}
                                </p>
                            )}
                        </div>

                        {/* Code Display */}
                        <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                            <div>
                                <p className="text-[9px] font-black uppercase text-slate-500 mb-1">
                                    Código de Invitación
                                </p>
                                <p className="text-2xl font-black font-mono tracking-widest text-white">
                                    {pendingCode}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <Users size={14} />
                                <span>{leaguePreview.memberCount || 0} miembros</span>
                            </div>
                        </div>

                        {/* League Details */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Admin */}
                            {leaguePreview.adminName && (
                                <div className="flex items-start gap-2 p-3 bg-slate-800 rounded-xl">
                                    <Trophy size={14} className="text-lime-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                                            Organizador
                                        </p>
                                        <p className="text-[11px] font-bold text-white truncate">
                                            {leaguePreview.adminName}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Entry Fee */}
                            <div className="flex items-start gap-2 p-3 bg-slate-800 rounded-xl">
                                <Coins size={14} className="text-lime-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                                        Cuota
                                    </p>
                                    <p className="text-[11px] font-bold text-white truncate">
                                        {formatCurrency(leaguePreview.baseFee, leaguePreview.currency)}
                                    </p>
                                </div>
                            </div>

                            {/* Max Participants */}
                            {leaguePreview.maxParticipants && (
                                <div className="flex items-start gap-2 p-3 bg-slate-800 rounded-xl">
                                    <Users size={14} className="text-lime-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                                            Máx. participantes
                                        </p>
                                        <p className="text-[11px] font-bold text-white truncate">
                                            {leaguePreview.maxParticipants}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Plan */}
                            {leaguePreview.plan && (
                                <div className="flex items-start gap-2 p-3 bg-slate-800 rounded-xl">
                                    <Trophy size={14} className="text-lime-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                                            Plan
                                        </p>
                                        <p className="text-[11px] font-bold text-white truncate capitalize">
                                            {leaguePreview.plan.toLowerCase()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {!isLoading && (
                    <div className="space-y-3">
                        <button
                            onClick={handleConfirm}
                            disabled={isJoining || !!error}
                            className="w-full py-4 rounded-2xl bg-lime-400 text-slate-950 font-black uppercase tracking-wider hover:bg-lime-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl"
                        >
                            {isJoining ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full"
                                    />
                                    Uniéndome...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    Aceptar invitación
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleSkip}
                            disabled={isJoining}
                            className="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Unirme después
                        </button>
                    </div>
                )}

                {/* Info Footer */}
                <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl">
                    <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        Si eliges "Unirme después", podrás aceptar esta invitación en cualquier momento desde "Mis Pollas".
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default ConfirmInvitation;
