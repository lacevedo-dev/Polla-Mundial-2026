import React from 'react';
import { motion } from 'motion/react';
import { fade } from '../../utils/dashboard';

interface PrizesCardProps {
    prizes: {
        net: number;
        first: number;
        second: number;
        third: number;
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
            {[
                { label: '1er puesto (60%)', width: 60, amount: prizes.first, color: 'bg-lime-400' },
                { label: '2do puesto (30%)', width: 30, amount: prizes.second, color: 'bg-amber-400' },
                { label: '3er puesto (10%)', width: 10, amount: prizes.third, color: 'bg-slate-400' },
            ].map((prize) => (
                <div key={prize.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{prize.label}</span>
                        <span className="text-[11px] font-black text-lime-700">{prize.amount > 0 ? prizes.fmt(prize.amount) : '—'}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${prize.width}%` }}
                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
                            className={`h-full rounded-full ${prize.color}`}
                        />
                    </div>
                </div>
            ))}
        </div>
    </motion.article>
);

export default PrizesCard;
