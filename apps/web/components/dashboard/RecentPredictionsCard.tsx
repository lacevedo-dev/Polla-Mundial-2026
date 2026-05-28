import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fade } from '../../utils/dashboard';

interface PredictionItem {
    id: string;
    match: string;
    tuPrediccion: string;
    resultado: string;
    puntos: number;
    acierto: boolean;
    fecha: string;
}

interface RecentPredictionsCardProps {
    predictions: PredictionItem[] | null;
}

const RecentPredictionsCard: React.FC<RecentPredictionsCardProps> = ({ predictions }) => (
    <motion.article {...fade(0.16)} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900">Predicciones recientes</h2>
            <Link to="/predictions" className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 hover:text-lime-600 transition-colors">
                Ver todas
            </Link>
        </div>
        {predictions && predictions.length > 0 ? (
            <div className="space-y-2">
                {predictions.slice(0, 3).map((p, i) => {
                    const isPending = p.resultado === 'Pendiente' || !p.resultado;
                    const hasPoints = p.puntos > 0;
                    const badge = isPending
                        ? { label: 'Pendiente', cls: 'bg-slate-100 text-slate-500' }
                        : p.acierto
                        ? { label: 'Exacto', cls: 'bg-lime-100 text-lime-700' }
                        : hasPoints
                        ? { label: `+${p.puntos} pts`, cls: 'bg-amber-100 text-amber-700' }
                        : { label: 'Sin puntos', cls: 'bg-rose-100 text-rose-700' };
                    return (
                        <motion.div
                            key={p.id}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.06 }}
                            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 ${
                                isPending ? 'border-slate-100 bg-slate-50'
                                : p.acierto ? 'border-lime-100 bg-lime-50/50'
                                : hasPoints ? 'border-amber-100 bg-amber-50/50'
                                : 'border-rose-100 bg-rose-50/40'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-slate-900">{p.match}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        Mi pronóstico: <span className="text-slate-600">{p.tuPrediccion}</span>
                                    </span>
                                    {!isPending && (
                                        <span className="text-[10px] font-bold text-slate-400">
                                            Resultado: <span className="text-slate-600">{p.resultado}</span>
                                        </span>
                                    )}
                                    {!isPending && (
                                        <span className={`text-[10px] font-black ${hasPoints ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {hasPoints ? `Sumó ${p.puntos} pts` : 'No sumó puntos'}
                                        </span>
                                    )}
                                    <span className="text-[9px] text-slate-300">{p.fecha}</span>
                                </div>
                            </div>
                            <div className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${badge.cls}`}>
                                {badge.label}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-500">Aún no haces predicciones</p>
                <Link
                    to="/predictions"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-bold uppercase text-slate-900 hover:bg-lime-500 transition-colors"
                >
                    Ir a pronósticos <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        )}
    </motion.article>
);

export default RecentPredictionsCard;
