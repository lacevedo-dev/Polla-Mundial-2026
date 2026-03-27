import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X, EyeOff, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  data?: string;
}

interface NotifResponse {
  notifications: Notif[];
  unreadCount: number;
}

interface NotifData {
  matchId?: string;
  leagueId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  MATCH_REMINDER:    '⏰',
  PREDICTION_CLOSED: '⚠️',
  RESULT_PUBLISHED:  '✅',
  LEAGUE_INVITE:     '🏆',
  PAYMENT_CONFIRMED: '💳',
};

const TYPE_LABELS: Record<string, string> = {
  MATCH_REMINDER:    'Recordatorio',
  PREDICTION_CLOSED: 'Cierre',
  RESULT_PUBLISHED:  'Resultado',
  LEAGUE_INVITE:     'Invitación',
  PAYMENT_CONFIRMED: 'Pago',
};

const TYPE_LABELS_FULL: Record<string, string> = {
  MATCH_REMINDER:    'Recordatorio de partido',
  PREDICTION_CLOSED: 'Cierre de predicción',
  RESULT_PUBLISHED:  'Resultado publicado',
  LEAGUE_INVITE:     'Invitación a liga',
  PAYMENT_CONFIRMED: 'Pago confirmado',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

function parseData(raw?: string): NotifData {
  if (!raw) return {};
  try { return JSON.parse(raw) as NotifData; } catch { return {}; }
}

/** Devuelve la ruta destino según el tipo de notificación y su data. */
function resolveRoute(type: string, data: NotifData): string | null {
  const { leagueId } = data;
  switch (type) {
    case 'MATCH_REMINDER':
      // Ir a la liga para ver el partido y hacer/revisar predicción
      return leagueId ? `/my-leagues/${leagueId}` : '/my-leagues';
    case 'PREDICTION_CLOSED':
      // Urgente: todavía pueden entrar a predecir en la liga
      return leagueId ? `/my-leagues/${leagueId}` : '/my-leagues';
    case 'RESULT_PUBLISHED':
      // Ver resultado y ranking de la liga
      return leagueId ? `/my-leagues/${leagueId}` : '/ranking';
    case 'LEAGUE_INVITE':
      // Ir a mis ligas para aceptar la invitación
      return '/my-leagues';
    case 'PAYMENT_CONFIRMED':
      return '/dashboard';
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen]             = useState(false);
  const [data, setData]             = useState<NotifResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [activeFilter, setFilter]   = useState<string | null>(null);
  const [hideRead, setHideRead]     = useState(false);
  const containerRef                = useRef<HTMLDivElement>(null);
  const navigate                    = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await request<NotifResponse>('/notifications?limit=50');
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

  const handleNotifClick = async (n: Notif) => {
    void markRead(n.id);
    const notifData = parseData(n.data);
    const route = resolveRoute(n.type, notifData);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  // ─── Derived state ──────────────────────────────────────────────────────────

  const allNotifs = data?.notifications ?? [];

  // Tipos presentes con sus conteos de no leídas
  const typesPresent = Array.from(
    allNotifs.reduce((acc, n) => {
      if (!acc.has(n.type)) acc.set(n.type, 0);
      if (!n.read) acc.set(n.type, acc.get(n.type)! + 1);
      return acc;
    }, new Map<string, number>()),
  );

  // Lista filtrada
  const visible = allNotifs.filter(n => {
    if (activeFilter && n.type !== activeFilter) return false;
    if (hideRead && n.read) return false;
    return true;
  });

  const unread = data?.unreadCount ?? 0;

  return (
    <div ref={containerRef} className="fixed top-3 right-14 md:right-4 z-[100]">
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

      {/* Panel */}
      {open && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 w-[340px] max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: 'calc(100vh - 80px)' }}
        >
          {/* ── Header row 1: título + acciones ─────────────────────────── */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-800">
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
              {/* Ocultar/mostrar leídas */}
              <button
                onClick={() => setHideRead(v => !v)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  hideRead
                    ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={hideRead ? 'Mostrar leídas' : 'Ocultar leídas'}
              >
                {hideRead ? <Eye size={12} /> : <EyeOff size={12} />}
                {hideRead ? 'Mostrar' : 'Solo nuevas'}
              </button>

              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-lime-400 hover:bg-slate-800 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={12} />
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

          {/* ── Header row 2: filtros por tipo ──────────────────────────── */}
          {typesPresent.length > 1 && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800 overflow-x-auto scrollbar-none">
              {/* Botón "Todos" */}
              <button
                onClick={() => setFilter(null)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                  activeFilter === null
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                Todos
                {unread > 0 && (
                  <span className="min-w-[15px] h-[15px] px-0.5 rounded-full bg-lime-400 text-black text-[9px] font-black flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>

              {typesPresent.map(([type, unreadOfType]) => (
                <button
                  key={type}
                  onClick={() => setFilter(activeFilter === type ? null : type)}
                  title={TYPE_LABELS_FULL[type] ?? type}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black transition-colors ${
                    activeFilter === type
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-sm leading-none">{TYPE_ICONS[type] ?? '🔔'}</span>
                  <span>{TYPE_LABELS[type] ?? type}</span>
                  {unreadOfType > 0 && (
                    <span className="min-w-[15px] h-[15px] px-0.5 rounded-full bg-lime-400 text-black text-[9px] font-black flex items-center justify-center">
                      {unreadOfType}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Lista scrolleable ────────────────────────────────────────── */}
          <div className="overflow-y-auto divide-y divide-slate-800/80 flex-1">
            {loading && !data && (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-lime-400" />
              </div>
            )}

            {data && visible.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-2 text-slate-500">
                <Bell size={26} className="opacity-25" />
                <p className="text-xs">
                  {hideRead ? 'No hay notificaciones sin leer' : 'Sin notificaciones recientes'}
                </p>
              </div>
            )}

            {visible.map(n => {
              const notifData  = parseData(n.data);
              const route      = resolveRoute(n.type, notifData);
              const isClickable = !!route;

              return (
                <button
                  key={n.id}
                  onClick={() => { void handleNotifClick(n); }}
                  className={`w-full text-left px-4 py-3.5 transition-colors flex gap-3 ${
                    !n.read ? 'bg-slate-800/25' : ''
                  } ${isClickable ? 'hover:bg-slate-800/60 cursor-pointer' : 'cursor-default'}`}
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
                      {TYPE_LABELS_FULL[n.type] ?? n.type}
                      {isClickable && (
                        <span className="ml-1.5 text-slate-600 normal-case tracking-normal font-normal">→ ver</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-100 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-slate-500 mt-1.5">{fmtRelative(n.sentAt)}</p>
                  </div>

                  {/* Indicador lateral de no leída */}
                  {!n.read && (
                    <div className="w-1 self-stretch rounded-full bg-lime-400/40 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {data && allNotifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 text-center shrink-0">
              <p className="text-[10px] text-slate-600">
                {visible.length} de {allNotifs.length} · In-App
                {activeFilter && ` · ${TYPE_LABELS[activeFilter] ?? activeFilter}`}
                {hideRead && ' · solo sin leer'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
