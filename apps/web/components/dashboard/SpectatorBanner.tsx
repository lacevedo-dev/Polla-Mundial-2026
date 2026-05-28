import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye } from 'lucide-react';

interface SpectatorBannerProps {
    visible: boolean;
    onExit: () => void;
}

const SpectatorBanner: React.FC<SpectatorBannerProps> = ({ visible, onExit }) => (
    <AnimatePresence>
        {visible && (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' as const }}
                className="flex items-center justify-between gap-4 rounded-2xl bg-violet-600 px-5 py-3"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Eye size={16} className="text-violet-200 flex-shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Modo espectador activo</p>
                        <p className="text-[11px] text-violet-200 hidden sm:block">Estás viendo la liga como un participante.</p>
                    </div>
                </div>
                <button
                    onClick={onExit}
                    className="flex-shrink-0 rounded-xl border border-violet-400 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white hover:bg-white/20 transition-colors"
                >
                    Volver a admin
                </button>
            </motion.div>
        )}
    </AnimatePresence>
);

export default SpectatorBanner;
