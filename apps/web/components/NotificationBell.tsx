import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { request } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  channel: string;
  sentAt: string;
}

interface NotifResponse {
  notifications: Notif[];
  unreadCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  MATCH_REMINDER: '⏰',
  PREDICTION_CLOSED: '⚠️',
  RESULT_PUBLISHED: '✅',
  LEAGUE_INVITE: '🏆',
  PAYMENT_CONFIRMED: '💳',
};

const TYPE_LABELS: Record<string, string> = {
  MATCH_REMINDER: 'Recordatorio de partido',
  PREDICTION_CLOSED: 'Cierre de predicción',
  RESULT_PUBLISHED: 'Resultado publicado',
  LEAGUE_INVITE: 'Invitación a liga',
  PAYMENT_CONFIRMED: 'Pago confirmado',
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Botón flotante fijo en la esquina superior derecha.
 * El panel se despliega hacia abajo y a la izquierda.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await request<NotifResponse>('/notifications?limit=20');
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial + polling cada 60s
  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id: string) => {
    await request(`/notifications/${id}/read`, { method: 'PATCH' });
    setData(prev => {
      if (!prev) return prev;
      const wasUnread = prev.notifications.find(n => n.id === id && !n.read);
      return {
        unreadCount: Math.max(0, prev.unreadCount - (wasUnread ? 1 : 0)),
        notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      };
    });
  };

  const markAllRead = async () => {
    await request('/notifications/read-all', { method: 'PATCH' });
    setData(prev => prev ? {
      unreadCount: 0,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
    } : prev);
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  const unread = data?.unreadCount ?? 0;

  return (
    /* Contenedor fijo en esquina superior derecha — siempre visible */
    <div ref={containerRef} className="fixed top-4 right-4 z-[100]">
      {/* Botón campana */}
      <button
        onClick={handleOpen}
        aria-label="Notificaciones"
        className={`
          relative flex items-center justify-center w-11 h-11 rounded-full shadow-lg border transition-all
          ${open
            ? 'bg-slate-800 border-amber-500/50 text-amber-400'
            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
          }
        `}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-lime-400 text-black text-[10px] font-black flex items-center justify-center leading-none shadow">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel — se abre hacia abajo y a la izquierda */}
      {open && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 w-[340px] max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 80px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-200">
                Notificaciones
              </span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-lime-400/15 text-lime-400 text-[10px] font-black">
                  {unread} nueva{unread !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-lime-400 hover:bg-slate-800 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={12} /> Todo leído
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Lista scrolleable */}
          <div className="overflow-y-auto divide-y divide-slate-800/80" style={{ maxHeight: 'calc(100vh - 170px)' }}>
            {loading && !data && (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-lime-400" />
              </div>
            )}

            {data && data.notifications.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-2 text-slate-500">
                <Bell size={26} className="opacity-25" />
                <p className="text-xs">Sin notificaciones recientes</p>
              </div>
            )}

            {data?.notifications.map(n => (
              <button
                key={n.id}
                onClick={() => { void markRead(n.id); }}
                className={`w-full text-left px-4 py-3.5 hover:bg-slate-800/60 transition-colors flex gap-3 ${!n.read ? 'bg-slate-800/25' : ''}`}
              >
                {/* Ícono + punto no leído */}
                <div className="flex flex-col items-center pt-0.5 shrink-0 gap-1.5">
                  <span className="text-lg leading-none">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </p>
                  <p className="text-xs text-slate-100 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-slate-500 mt-1.5">{fmtRelative(n.sentAt)}</p>
                </div>

                {/* Indicador lateral de no leída */}
                {!n.read && (
                  <div className="w-1 self-stretch rounded-full bg-lime-400/40 shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          {data && data.notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 text-center">
              <p className="text-[10px] text-slate-600">
                Últimas {data.notifications.length} · In-App
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
