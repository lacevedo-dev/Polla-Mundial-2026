import React from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const DISMISSED_KEY = 'push_prompt_dismissed';
const DISMISS_DURATION_DAYS = 7; // Volver a mostrar después de 7 días

/**
 * Banner/Prompt para solicitar activación de notificaciones push
 * Se muestra cuando:
 * - El navegador soporta push
 * - El usuario no ha concedido permisos o no está suscrito
 * - No ha sido descartado recientemente
 */
export const PushNotificationPrompt: React.FC = () => {
  const { supported, permission, subscribed, loading, subscribe } = usePushNotifications();
  
  const [dismissed, setDismissed] = React.useState(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return false;
    
    try {
      const dismissedAt = parseInt(stored, 10);
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      return daysSinceDismissed < DISMISS_DURATION_DAYS;
    } catch {
      return false;
    }
  });

  // No mostrar si:
  // - No hay soporte
  // - Ya está suscrito
  // - Permisos denegados
  // - Fue descartado recientemente
  if (!supported || subscribed || permission === 'denied' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const handleActivate = async () => {
    await subscribe();
    // Si se suscribió exitosamente, el componente se ocultará automáticamente
    // porque subscribed cambiará a true
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-40 pt-safe"
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="rounded-2xl border border-lime-300 bg-gradient-to-br from-lime-50 to-lime-100 p-4 shadow-lg">
            <div className="flex items-start gap-3">
              {/* Icono */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400">
                <Bell size={20} className="text-slate-950" />
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900">
                  🔔 Activa las notificaciones
                </h3>
                <p className="mt-1 text-xs text-slate-700">
                  Recibe avisos de partidos próximos, cierres de predicciones y resultados
                  directamente en este dispositivo.
                </p>

                {/* Botones */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleActivate}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Bell size={13} />
                    {loading ? 'Activando...' : 'Activar ahora'}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Más tarde
                  </button>
                </div>
              </div>

              {/* Botón cerrar */}
              <button
                onClick={handleDismiss}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Variante compacta para mostrar en el dashboard como card
 */
export const PushNotificationCard: React.FC = () => {
  const { supported, permission, subscribed, loading, subscribe } = usePushNotifications();
  
  const [dismissed, setDismissed] = React.useState(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return false;
    
    try {
      const dismissedAt = parseInt(stored, 10);
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      return daysSinceDismissed < DISMISS_DURATION_DAYS;
    } catch {
      return false;
    }
  });

  if (!supported || subscribed || permission === 'denied' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const handleActivate = async () => {
    await subscribe();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative overflow-hidden rounded-2xl border border-lime-300 bg-gradient-to-br from-lime-400 to-lime-500 p-3 shadow-lg"
    >
      {/* Botón cerrar */}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-lg p-1 text-slate-950/40 transition hover:bg-slate-950/10 hover:text-slate-950"
        aria-label="Cerrar"
      >
        <X size={12} />
      </button>

      {/* Contenido */}
      <div className="flex items-center gap-3 pr-6">
        {/* Icono */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950/10">
          <Bell size={16} className="text-slate-950" />
        </div>
        
        {/* Texto y botón */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-950 mb-1">
            Activa las notificaciones
          </p>
          <p className="text-[10px] font-medium text-slate-950/70 mb-2 leading-tight">
            Recibe avisos de partidos y resultados en este navegador
          </p>
          <button
            onClick={handleActivate}
            disabled={loading}
            className="rounded-lg bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-lime-400 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Activando...' : '🔔 Activar'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
