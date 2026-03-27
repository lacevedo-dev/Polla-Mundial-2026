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
  MATCH_REMINDER: 'Recordatorio',
  PREDICTION_CLOSED: 'Cierre de predicción',
  RESULT_PUBLISHED: 'Resultado publicado',
  LEAGUE_INVITE: 'Invitación',
  PAYMENT_CONFIRMED: 'Pago confirmado',
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Initial load + poll every 60s
  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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
      return {
        unreadCount: Math.max(0, prev.unreadCount - (prev.notifications.find(n => n.id === id && !n.read) ? 1 : 0)),
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
    setOpen(v => !v);
    if (!open) void load();
  };

  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-lime-400 text-black text-[10px] font-black flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute left-0 bottom-12 md:left-auto md:right-0 md:bottom-auto md:top-12 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-300">
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
                  title="Marcar todo como leído"
                >
                  <CheckCheck size={12} /> Todo leído
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {loading && !data && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-lime-400" />
              </div>
            )}

            {data && data.notifications.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2 text-slate-500">
                <Bell size={24} className="opacity-30" />
                <p className="text-xs">Sin notificaciones recientes</p>
              </div>
            )}

            {data?.notifications.map(n => (
              <button
                key={n.id}
                onClick={() => { void markRead(n.id); }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors flex gap-3 ${!n.read ? 'bg-slate-800/30' : ''}`}
              >
                {/* Unread dot */}
                <div className="flex flex-col items-center pt-1 shrink-0 gap-1">
                  <span className="text-base leading-none">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </p>
                  <p className="text-xs text-slate-200 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{fmtRelative(n.sentAt)}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          {data && data.notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-800 text-center">
              <p className="text-[10px] text-slate-600">
                Últimas {data.notifications.length} notificaciones · Canal: In-App
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
