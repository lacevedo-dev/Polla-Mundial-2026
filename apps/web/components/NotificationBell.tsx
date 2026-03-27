import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, X, EyeOff, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { request } from '../api';
import { useLeagueStore } from '../stores/league.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  channel: string;
  sentAt: string;
  leagueId:   string | null;
  leagueName: string | null;
  matchId:    string | null;
}

interface NotifResponse {
  notifications: Notif[];
  unreadCount: number;
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

/** true si la notificación tiene destino navegable */
function isNavigable(type: string): boolean {
  return ['MATCH_REMINDER', 'PREDICTION_CLOSED', 'RESULT_PUBLISHED', 'LEAGUE_INVITE', 'PAYMENT_CONFIRMED'].includes(type);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen]             = useState(false);
  const [data, setData]             = useState<NotifResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [activeFilter, setFilter]   = useState<string | null>(null);
  const [hideRead, setHideRead]     = useState(true);
  const [isDesktop, setIsDesktop]   = useState(() => window.innerWidth >= 768);
  const containerRef                = useRef<HTMLDivElement>(null);
  const navigate                    = useNavigate();
  const setActiveLeague             = useLeagueStore(s => s.setActiveLeague);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    if (!isNavigable(n.type)) return;
    setOpen(false);

    switch (n.type) {
      case 'MATCH_REMINDER':
      case 'PREDICTION_CLOSED':
      case 'RESULT_PUBLISHED':
        // Seleccionar la liga en el store y navegar a predicciones
        if (n.leagueId) setActiveLeague(n.leagueId);
        navigate('/predictions');
        break;
      case 'LEAGUE_INVITE':
        navigate('/my-leagues');
        break;
      case 'PAYMENT_CONFIRMED':
        navigate('/dashboard');
        break;
    }
  };

  // ─── Derived state ──────────────────────────────────────────────────────────

  const allNotifs = data?.notifications ?? [];

  // Tipos presentes respetando hideRead (si "solo nuevas", solo muestro tipos con no leídas)
  const baseForFilters = hideRead ? allNotifs.filter(n => !n.read) : allNotifs;
  const typesPresent = Array.from(
    baseForFilters.reduce((acc, n) => {
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
          className="
            fixed inset-x-0 bottom-0 top-[64px] rounded-t-2xl
            md:absolute md:inset-auto md:top-[calc(100%+8px)] md:right-0 md:bottom-auto md:w-[340px] md:rounded-2xl
            bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col z-[100]
          "
          style={{ maxHeight: 'calc(100vh - 64px)' }}
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
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800">
              {/* Botón "Todos" */}
              <button
                onClick={() => setFilter(null)}
                title="Todos los tipos"
                className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                  activeFilter === null
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {isDesktop ? (
                  <span>Todos</span>
                ) : (
                  <span className="text-base leading-none">🔔</span>
                )}
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
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black transition-colors ${
                    activeFilter === type
                      ? 'bg-slate-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base leading-none">{TYPE_ICONS[type] ?? '🔔'}</span>
                  {isDesktop && <span>{TYPE_LABELS[type] ?? type}</span>}
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
              const isClickable = isNavigable(n.type);

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
                    {/* Tipo + liga */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {TYPE_LABELS_FULL[n.type] ?? n.type}
                      </p>
                      {n.leagueName && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 truncate max-w-[120px]">
                          {n.leagueName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-100 leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-[10px] text-slate-500">{fmtRelative(n.sentAt)}</p>
                      {isClickable && (
                        <span className="text-[10px] text-lime-500 font-bold">→ ir a subsanar</span>
                      )}
                    </div>
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
