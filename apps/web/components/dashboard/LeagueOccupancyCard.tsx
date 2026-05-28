import React from 'react';
import { motion } from 'motion/react';
import { Settings, Share2, Users } from 'lucide-react';

interface LeagueOccupancyCardProps {
    memberCount: number;
    maxParticipants: number;
    occupancyPct: number;
    isAdmin: boolean;
    hasCode: boolean;
    onConfigOpen: () => void;
    onInviteOpen: () => void;
}

const LeagueOccupancyCard: React.FC<LeagueOccupancyCardProps> = ({
    memberCount,
    maxParticipants,
    occupancyPct,
    isAdmin,
    hasCode,
    onConfigOpen,
    onInviteOpen,
}) => (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Cupos de liga</p>
            <Users size={14} className="text-slate-300" />
        </div>
        <div>
            <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-black text-slate-900">
                    {memberCount}
                    {maxParticipants > 0 && <span className="text-base font-bold text-slate-400"> / {maxParticipants}</span>}
                </span>
                {maxParticipants > 0 && <span className="text-[10px] font-black text-slate-400">{occupancyPct}%</span>}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: maxParticipants > 0 ? `${occupancyPct}%` : '0%' }}
                    transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                    className="h-full rounded-full bg-lime-400"
                />
            </div>
            {maxParticipants === 0 && (
                <p className="mt-1 text-[10px] text-slate-400">Sin límite de participantes</p>
            )}
        </div>
        <div className="flex gap-2">
            {isAdmin && (
                <button
                    onClick={onConfigOpen}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <Settings size={13} /> Configurar
                </button>
            )}
            {hasCode && (
                <button
                    onClick={onInviteOpen}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-[11px] font-black uppercase tracking-wide text-white hover:bg-slate-800 transition-colors"
                >
                    <Share2 size={13} /> Invitar
                </button>
            )}
        </div>
    </article>
);

export default LeagueOccupancyCard;
