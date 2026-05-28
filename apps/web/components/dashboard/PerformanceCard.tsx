import React from 'react';
import { motion } from 'motion/react';
import { fade } from '../../utils/dashboard';

interface PerformanceStats {
    aciertos?: number;
    errores?: number;
    racha?: number;
    tasa?: number;
}

interface PerformanceCardProps {
    stats: PerformanceStats | null;
}

const PerformanceCard: React.FC<PerformanceCardProps> = ({ stats }) => (
    <motion.article {...fade(0.12)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Mi rendimiento</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-lime-400 to-lime-500 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-900 opacity-70">Aciertos</p>
                <p className="mt-1.5 text-3xl font-black text-lime-950">{stats?.aciertos ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-950 opacity-70">Errores</p>
                <p className="mt-1.5 text-3xl font-black text-rose-950">{stats?.errores ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-950 opacity-70">Racha</p>
                <p className="mt-1.5 text-3xl font-black text-amber-950">{stats?.racha ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white opacity-70">Tasa</p>
                <p className="mt-1.5 text-3xl font-black text-white">{(stats?.tasa ?? 0).toFixed(1)}%</p>
            </div>
        </div>
    </motion.article>
);

export default PerformanceCard;
