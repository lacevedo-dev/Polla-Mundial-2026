import React from 'react';
import { motion } from 'motion/react';
import { fade, type PrizePosition } from '../../utils/dashboard';

const BAR_COLORS = ['bg-lime-400', 'bg-amber-400', 'bg-slate-400', 'bg-blue-400', 'bg-rose-400'];

interface PrizesCardProps {
    prizes: {
        net: number;
        positions: PrizePosition[];
        fmt: (n: number) => string;
    };
    totalPrizeLabel?: string;
}

const PrizesCard: React.FC<PrizesCardProps> = ({ prizes, totalPrizeLabel }) => (
    <motion.article {...fade(0.08)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Premios</h2>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                Bolsa: {prizes.net > 0 ? prizes.fmt(prizes.net) : (totalPrizeLabel || '—')}
            </span>
        </div>
        <div className="space-y-3">
            {prizes.positions.map((pos, i) => (
                <div key={`${pos.label}-${i}`} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            {pos.label} ({pos.percentage}%)
                        </span>
                        <span className="text-[11px] font-black text-lime-700">
                            {pos.amount > 0 ? prizes.fmt(pos.amount) : '—'}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pos.percentage}%` }}
                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                            className={`h-full rounded-full ${BAR_COLORS[i] ?? 'bg-slate-300'}`}
                        />
                    </div>
                </div>
            ))}
        </div>
    </motion.article>
);

export default PrizesCard;
