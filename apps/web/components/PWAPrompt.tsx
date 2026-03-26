import React from 'react';
import { Bell, BellOff, Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { usePushNotifications } from '../hooks/usePushNotifications';

const DISMISSED_KEY = 'pwa_prompt_dismissed';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = React.useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  );
  const [installing, setInstalling] = React.useState(false);

  if (isInstalled || dismissed || !isInstallable) return null;

  const handleInstall = async () => {
    setInstalling(true);
    await install();
    setInstalling(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  return (
    <div
      role="banner"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-bottom md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-sm"
    >
      <div className="rounded-[1.25rem] border border-lime-300 bg-slate-950 p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 font-black text-slate-950">
            26
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">Instala Polla 2026</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Acceso rápido desde tu pantalla de inicio y notificaciones en tiempo real.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-lime-300 disabled:opacity-60"
                aria-label="Instalar aplicación"
              >
                <Download size={13} />
                {installing ? 'Instalando...' : 'Instalar'}
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 transition hover:border-slate-500 hover:text-slate-300"
                aria-label="Cerrar aviso de instalación"
              >
                Ahora no
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1 text-slate-500 hover:text-slate-300"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotificationToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (!supported || permission === 'denied') return null;

  return (
    <div className={className}>
      {error && (
        <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        aria-pressed={subscribed}
        aria-label={subscribed ? 'Desactivar notificaciones push' : 'Activar notificaciones push'}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition
          ${subscribed
            ? 'border-lime-300 bg-lime-50 text-lime-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-lime-300 hover:bg-lime-50'
          } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {subscribed ? (
          <Bell size={18} className="shrink-0 text-lime-600" />
        ) : (
          <BellOff size={18} className="shrink-0 text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {loading ? 'Procesando...' : subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
          </p>
          <p className="text-xs text-slate-500">
            {subscribed
              ? 'Recibirás avisos de partidos, cierres y resultados'
              : 'Avisos de partidos, cierres y resultados en tu móvil'}
          </p>
        </div>
        <span
          className={`ml-auto inline-block h-5 w-9 rounded-full transition-colors ${subscribed ? 'bg-lime-400' : 'bg-slate-200'}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};
