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
    leagueId: string | null;
    leagueName: string | null;
    matchId: string | null;
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
    GOAL_SCORED:       '⚽',
};

const TYPE_LABELS: Record<string, string> = {
    MATCH_REMINDER:    'Recordatorio',
    PREDICTION_CLOSED: 'Cierre',
    RESULT_PUBLISHED:  'Resultado',
    LEAGUE_INVITE:     'Invitación',
    PAYMENT_CONFIRMED: 'Pago',
    GOAL_SCORED:       'Gol',
};

const TYPE_LABELS_FULL: Record<string, string> = {
    MATCH_REMINDER:    'Recordatorio de partido',
    PREDICTION_CLOSED: 'Cierre de predicción',
    RESULT_PUBLISHED:  'Resultado publicado',
    LEAGUE_INVITE:     'Invitación a liga',
    PAYMENT_CONFIRMED: 'Pago confirmado',
    GOAL_SCORED:       '¡Gol marcado!',
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

function isNavigable(type: string): boolean {
    return ['MATCH_REMINDER', 'PREDICTION_CLOSED', 'RESULT_PUBLISHED', 'LEAGUE_INVITE', 'PAYMENT_CONFIRMED', 'GOAL_SCORED'].includes(type);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
    const [open, setOpen]           = useState(false);
    const [data, setData]           = useState<NotifResponse | null>(null);
    const [loading, setLoading]     = useState(false);
    const [activeFilter, setFilter] = useState<string | null>(null);
    const [hideRead, setHideRead]   = useState(true);
    const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
    const containerRef              = useRef<HTMLDivElement>(null);
    const navigate                  = useNavigate();

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

    useEffect(() => {
        void load();
        const timer = setInterval(() => { void load(); }, 60_000);
        return () => clearInterval(timer);
    }, []);

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
            case 'GOAL_SCORED':
                navigate('/pollas');
                break;
            case 'LEAGUE_INVITE':
                navigate('/pollas');
                break;
            case 'PAYMENT_CONFIRMED':
                navigate('/');
                break;
        }
    };

    // ─── Derived state ────────────────────────────────────────────────────────

    const allNotifs = data?.notifications ?? [];
    const baseForFilters = hideRead ? allNotifs.filter(n => !n.read) : allNotifs;
    const typesPresent = Array.from(
        baseForFilters.reduce((acc, n) => {
            if (!acc.has(n.type)) acc.set(n.type, 0);
            if (!n.read) acc.set(n.type, acc.get(n.type)! + 1);
            return acc;
        }, new Map<string, number>()),
    );

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
                className={`relative flex items-center justify-center w-11 h-11 rounded-full shadow-lg border transition-all ${
                    open
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
                style={open ? { borderColor: 'var(--color-primary, #f59e0b)', color: 'var(--color-primary, #f59e0b)' } : undefined}
            >
                <Bell size={19} />
                {unread > 0 && (
                    <span
                        className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full text-black text-[10px] font-black flex items-center justify-center leading-none shadow"
                        style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}
                    >
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div
                    className="fixed inset-x-0 bottom-0 top-[64px] rounded-t-2xl md:absolute md:inset-auto md:top-[calc(100%+8px)] md:right-0 md:bottom-auto md:w-[340px] md:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col z-[100]"
                    style={{ maxHeight: 'calc(100vh - 64px)' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <Bell size={14} className="text-slate-400" />
                            <span className="text-xs font-black uppercase tracking-widest text-slate-200">
                                Notificaciones
                            </span>
                            {unread > 0 && (
                                <span
                                    className="px-1.5 py-0.5 rounded-full text-[10px] font-black text-black"
                                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 20%, transparent)', color: 'var(--color-primary, #f59e0b)' }}
                                >
                                    {unread} nueva{unread !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
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
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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

                    {/* Filtros por tipo */}
                    {typesPresent.length > 1 && (
                        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800 overflow-x-auto">
                            <button
                                onClick={() => setFilter(null)}
                                className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                                    activeFilter === null
                                        ? 'bg-slate-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            >
                                {isDesktop ? <span>Todos</span> : <span className="text-base leading-none">🔔</span>}
                                {unread > 0 && (
                                    <span className="min-w-[15px] h-[15px] px-0.5 rounded-full text-black text-[9px] font-black flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}>
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
                                        <span className="min-w-[15px] h-[15px] px-0.5 rounded-full text-black text-[9px] font-black flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }}>
                                            {unreadOfType}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Lista */}
                    <div className="overflow-y-auto divide-y divide-slate-800/80 flex-1">
                        {loading && !data && (
                            <div className="flex justify-center py-10">
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2" style={{ borderColor: 'var(--color-primary, #f59e0b)' }} />
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
                                    <div className="flex flex-col items-center pt-0.5 shrink-0 gap-1.5">
                                        <span className="text-lg leading-none">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                                        {!n.read && (
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary, #f59e0b)' }} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                {TYPE_LABELS_FULL[n.type] ?? n.type}
                                            </p>
                                            {n.leagueName && (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full truncate max-w-[120px]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 15%, transparent)', color: 'var(--color-primary, #f59e0b)' }}>
                                                    {n.leagueName}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-100 leading-relaxed">{n.body}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <p className="text-[10px] text-slate-500">{fmtRelative(n.sentAt)}</p>
                                            {isClickable && (
                                                <span className="text-[10px] font-bold" style={{ color: 'var(--color-primary, #f59e0b)' }}>→ ver pollas</span>
                                            )}
                                        </div>
                                    </div>
                                    {!n.read && (
                                        <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, #f59e0b) 40%, transparent)' }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
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
