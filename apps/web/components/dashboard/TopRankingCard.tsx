import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fade } from '../../utils/dashboard';

interface TopPlayer {
    id: string;
    name: string;
    points: number;
}

interface TopRankingCardProps {
    topPlayers: TopPlayer[];
    prizes: {
        first: number;
        second: number;
        third: number;
        fmt: (n: number) => string;
    };
}

const TopRankingCard: React.FC<TopRankingCardProps> = ({ topPlayers, prizes }) => {
    const navigate = useNavigate();

    return (
        <motion.article {...fade(0.08)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">
                    <Trophy className="h-4 w-4 text-lime-500" /> Top actual
                </h2>
            </div>
            {topPlayers.length > 0 ? (
                <div className="space-y-2">
                    {topPlayers.map((player, i) => {
                        const prizeAmt = i === 0 ? prizes.first : i === 1 ? prizes.second : prizes.third;
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                        return (
                            <motion.div
                                key={player.id}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + i * 0.08 }}
                                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${i === 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                                    i === 0 ? 'bg-amber-400 text-slate-950' : i === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                    {medal}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black uppercase text-slate-900">{player.name}</p>
                                    <p className="text-[10px] text-slate-400">{player.points} pts</p>
                                </div>
                                {prizeAmt > 0 && (
                                    <span className="flex-shrink-0 text-[11px] font-black text-lime-700">{prizes.fmt(prizeAmt)}</span>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                    El ranking todavía no tiene datos.
                </div>
            )}
            <button
                onClick={() => navigate('/ranking')}
                className="flex w-full items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-lime-600 transition-colors py-1"
            >
                Ver ranking completo <ArrowRight size={12} />
            </button>
        </motion.article>
    );
};

export default TopRankingCard;
