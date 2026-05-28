import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { fade } from '../../utils/dashboard';

interface MyStatsCardProps {
    totalPoints: number;
    exactPredictions: number;
    correctResults: number;
    streak?: number | null;
    rate?: number | null;
    rank?: number | null;
    totalPredictions: number;
}

const MyStatsCard: React.FC<MyStatsCardProps> = ({
    totalPoints,
    exactPredictions,
    correctResults,
    streak,
    rate,
    rank,
    totalPredictions,
}) => (
    <motion.article {...fade(0.1)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Mi rendimiento</h2>
            <TrendingUp size={15} className="text-slate-300" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-0.5">Puntos</p>
                <p className="text-[26px] font-black text-lime-400 leading-none">{totalPoints}</p>
            </div>
            {rank != null && (
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Posición</p>
                    <p className="text-[26px] font-black text-slate-900 leading-none">#{rank}</p>
                </div>
            )}
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Exactos</p>
                <p className="text-[22px] font-black text-slate-900 leading-none">{exactPredictions}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Acertados</p>
                <p className="text-[22px] font-black text-slate-900 leading-none">{correctResults}</p>
            </div>
            {streak != null && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-400 mb-0.5">Racha</p>
                    <p className="text-[22px] font-black text-amber-600 leading-none">{streak} 🔥</p>
                </div>
            )}
            {rate != null && (
                <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-3">
                    <p className="text-[8px] font-black uppercase tracking-widest text-teal-500 mb-0.5">Tasa</p>
                    <p className="text-[22px] font-black text-teal-600 leading-none">{Math.round(rate)}%</p>
                </div>
            )}
        </div>
        {totalPredictions > 0 && (
            <p className="mt-3 text-[9px] text-slate-400 text-center">
                {totalPredictions} predicciones registradas
            </p>
        )}
    </motion.article>
);

export default MyStatsCard;
