import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Trophy, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OnboardingBannerProps {
    visible: boolean;
    onDismiss: () => void;
}

const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ visible, onDismiss }) => {
    const navigate = useNavigate();

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' as const }}
                    className="overflow-hidden rounded-[2rem] bg-slate-900 p-6 text-white"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lime-400 text-slate-900">
                                <Trophy size={20} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-lime-400">Bienvenido</p>
                                <h2 className="text-base font-black uppercase tracking-tight text-white">Polla 2026</h2>
                            </div>
                        </div>
                        <button
                            onClick={onDismiss}
                            className="flex-shrink-0 rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                            aria-label="Cerrar bienvenida"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="mt-4 space-y-2.5">
                        {[
                            { num: '①', label: 'Pronostica el resultado', detail: 'antes de que cierre (15 min antes del pito)' },
                            { num: '②', label: 'Marcador exacto = 3 pts', detail: 'Solo ganador = 1 pt' },
                            { num: '③', label: 'Sube en el ranking', detail: 'de tu grupo' },
                        ].map(({ num, label, detail }) => (
                            <div key={num} className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-400/20 text-[11px] font-black text-lime-400">
                                    {num}
                                </span>
                                <div>
                                    <span className="text-sm font-bold text-white">{label}</span>
                                    <span className="ml-1.5 text-xs text-slate-400">{detail}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => navigate('/predictions')}
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-5 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-slate-900 hover:bg-lime-300 transition-colors"
                    >
                        Ver partidos disponibles <ArrowRight size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OnboardingBanner;
