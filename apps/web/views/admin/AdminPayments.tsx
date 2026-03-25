import React from 'react';
import {
    AlertCircle, Bell, BellOff, CheckCircle2, Clock,
    Coins, Filter, RefreshCw, Send, XCircle,
} from 'lucide-react';
import { request } from '../../api';
import AdminPagination from '../../components/admin/AdminPagination';

type ObligationStatus = 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED';
type ObligationCategory = 'PRINCIPAL' | 'MATCH' | 'GROUP' | 'ROUND' | 'PHASE';

interface ObligationItem {
    id: string;
    category: ObligationCategory;
    referenceLabel: string;
    unitAmount: number;
    multiplier: number;
    totalAmount: number;
    currency: string;
    status: ObligationStatus;
    deadlineAt: string;
    reminder30SentAt: string | null;
    reminder10SentAt: string | null;
    paidAt: string | null;
    expiredAt: string | null;
    user: { id: string; name: string; username: string; avatar: string; email: string };
    league: { id: string; name: string };
}

interface ObligationStats {
    pendingCount: number;
    paidCount: number;
    expiredCount: number;
    cancelledCount: number;
    pendingAmount: number;
}

interface PaginatedResponse {
    data: ObligationItem[];
    total: number;
    page: number;
    limit: number;
}

const STATUS_LABELS: Record<ObligationStatus, string> = {
    PENDING_PAYMENT: 'Pendiente',
    PAID: 'Pagado',
    EXPIRED: 'Vencido',
    CANCELLED: 'Cancelado',
};

const STATUS_CLASSES: Record<ObligationStatus, string> = {
    PENDING_PAYMENT: 'bg-rose-100 text-rose-700 border-rose-200',
    PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    EXPIRED: 'bg-amber-100 text-amber-700 border-amber-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

const CATEGORY_LABELS: Record<ObligationCategory, string> = {
    PRINCIPAL: 'Principal',
    MATCH: 'Partido',
    GROUP: 'Grupo',
    ROUND: 'Ronda',
    PHASE: 'Fase',
};

function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: currency ?? 'COP',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const AdminPayments: React.FC = () => {
    const [data, setData] = React.useState<ObligationItem[]>([]);
    const [stats, setStats] = React.useState<ObligationStats | null>(null);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const limit = 20;

    const [filterStatus, setFilterStatus] = React.useState<ObligationStatus | ''>('');
    const [filterLeague, setFilterLeague] = React.useState('');
    const [filterUser, setFilterUser] = React.useState('');
    const [filterCategory, setFilterCategory] = React.useState<ObligationCategory | ''>('');

    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [notifyingId, setNotifyingId] = React.useState<string | null>(null);
    const [bulkNotifying, setBulkNotifying] = React.useState(false);
    const [bulkExpiring, setBulkExpiring] = React.useState(false);
    const [toast, setToast] = React.useState<{ msg: string; ok: boolean } | null>(null);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                ...(filterStatus && { status: filterStatus }),
                ...(filterLeague && { leagueId: filterLeague }),
                ...(filterUser && { userId: filterUser }),
                ...(filterCategory && { category: filterCategory }),
            });
            const [res, statsRes] = await Promise.all([
                request<PaginatedResponse>(`/admin/payments/obligations?${params.toString()}`),
                request<ObligationStats>(`/admin/payments/stats${filterLeague ? `?leagueId=${filterLeague}` : ''}`),
            ]);
            setData(res.data);
            setTotal(res.total);
            setStats(statsRes);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al cargar datos');
        } finally {
            setLoading(false);
        }
    }, [page, filterStatus, filterLeague, filterUser, filterCategory]);

    React.useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleNotifyOne = async (id: string) => {
        setNotifyingId(id);
        try {
            const res = await request<{ sent: boolean; reason?: string }>(`/admin/payments/obligations/${id}/notify`, { method: 'POST' });
            showToast(res.sent ? 'Notificación enviada' : (res.reason ?? 'No se pudo enviar'));
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Error al notificar', false);
        } finally {
            setNotifyingId(null);
        }
    };

    const handleBulkNotify = async () => {
        setBulkNotifying(true);
        try {
            const params = filterLeague ? `?leagueId=${filterLeague}` : '';
            const res = await request<{ sent: number; total: number }>(`/admin/payments/obligations/notify-bulk${params}`, { method: 'POST' });
            showToast(`${res.sent} de ${res.total} notificaciones enviadas`);
            void fetchData();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Error al notificar', false);
        } finally {
            setBulkNotifying(false);
        }
    };

    const handleExpireOverdue = async () => {
        setBulkExpiring(true);
        try {
            const res = await request<{ expired: number }>('/admin/payments/obligations/expire-overdue', { method: 'POST' });
            showToast(`${res.expired} obligaciones vencidas`);
            void fetchData();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Error al vencer', false);
        } finally {
            setBulkExpiring(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-brand uppercase tracking-tight leading-tight">
                        Gestión de Pagos
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Obligaciones de participación · {total.toLocaleString()} registros
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => void handleBulkNotify()}
                        disabled={bulkNotifying}
                        className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                    >
                        {bulkNotifying
                            ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-amber-800" />
                            : <Send className="h-3.5 w-3.5" />
                        }
                        Notificar pendientes
                    </button>
                    <button
                        onClick={() => void handleExpireOverdue()}
                        disabled={bulkExpiring}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        {bulkExpiring
                            ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                            : <Clock className="h-3.5 w-3.5" />
                        }
                        Vencer vencidos
                    </button>
                    <button
                        onClick={() => void fetchData()}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        title="Recargar"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-rose-500">Pendientes</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{stats.pendingCount}</p>
                        <p className="text-xs font-bold text-rose-600">{formatCurrency(stats.pendingAmount, 'COP')}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">Pagados</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{stats.paidCount}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-600">Vencidos</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{stats.expiredCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Cancelados</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{stats.cancelledCount}</p>
                    </div>
                </div>
            ) : null}

            {/* Filters */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Filtros</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value as ObligationStatus | ''); setPage(1); }}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">Todos los estados</option>
                        {(Object.keys(STATUS_LABELS) as ObligationStatus[]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                    <select
                        value={filterCategory}
                        onChange={(e) => { setFilterCategory(e.target.value as ObligationCategory | ''); setPage(1); }}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        <option value="">Todas las categorías</option>
                        {(Object.keys(CATEGORY_LABELS) as ObligationCategory[]).map((c) => (
                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                        ))}
                    </select>
                    <input
                        value={filterLeague}
                        onChange={(e) => { setFilterLeague(e.target.value); setPage(1); }}
                        placeholder="ID de la liga..."
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <input
                        value={filterUser}
                        onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
                        placeholder="ID del usuario..."
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                </div>
            </div>

            {/* Error */}
            {error ? (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
            ) : null}

            {/* List */}
            {loading ? (
                <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 animate-pulse flex gap-3 items-center">
                            <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-40 bg-slate-200 rounded" />
                                <div className="h-3 w-24 bg-slate-100 rounded" />
                            </div>
                            <div className="h-6 w-16 bg-slate-100 rounded-full" />
                        </div>
                    ))}
                </div>
            ) : data.length === 0 ? (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
                    <Coins className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-400">No hay obligaciones con los filtros actuales</p>
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                        {data.map((ob) => {
                            const isPending = ob.status === 'PENDING_PAYMENT';
                            const reminderSent = !!ob.reminder30SentAt;
                            const deadlinePast = ob.deadlineAt && new Date(ob.deadlineAt) < new Date();
                            const statusBorderMap: Record<ObligationStatus, string> = {
                                PENDING_PAYMENT: 'border-l-rose-400',
                                PAID: 'border-l-emerald-400',
                                EXPIRED: 'border-l-amber-400',
                                CANCELLED: 'border-l-slate-300',
                            };

                            return (
                                <div
                                    key={ob.id}
                                    className={`rounded-2xl border border-slate-200 border-l-4 ${statusBorderMap[ob.status]} bg-white p-4 shadow-sm ${isPending && deadlinePast ? 'bg-rose-50/30' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={ob.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(ob.user.name)}&background=e2e8f0&color=64748b`}
                                            className="h-9 w-9 shrink-0 rounded-full object-cover mt-0.5"
                                            alt={ob.user.name}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-bold text-slate-800 truncate">{ob.user.name}</p>
                                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${STATUS_CLASSES[ob.status]}`}>
                                                    {STATUS_LABELS[ob.status]}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate">{ob.user.email}</p>
                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <span className="text-xs text-slate-600 font-bold truncate">{ob.league.name}</span>
                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
                                                    {CATEGORY_LABELS[ob.category]}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-xs font-black text-slate-900">
                                                        {formatCurrency(ob.totalAmount, ob.currency)}
                                                        {ob.multiplier > 1 && <span className="text-[10px] text-slate-400 font-normal ml-1">×{ob.multiplier}</span>}
                                                    </p>
                                                    <p className={`text-[10px] font-bold ${deadlinePast && isPending ? 'text-rose-600' : 'text-slate-400'}`}>
                                                        Límite: {formatDate(ob.deadlineAt)}
                                                        {ob.paidAt && <span className="text-emerald-600"> · Pagó {formatDate(ob.paidAt)}</span>}
                                                    </p>
                                                </div>
                                                {isPending && (
                                                    <button
                                                        onClick={() => void handleNotifyOne(ob.id)}
                                                        disabled={notifyingId === ob.id}
                                                        title={reminderSent ? 'Reenviar notificación' : 'Enviar recordatorio'}
                                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                                                            reminderSent
                                                                ? 'border border-slate-200 bg-white text-slate-400 hover:text-amber-600'
                                                                : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
                                                        } disabled:opacity-50`}
                                                    >
                                                        {notifyingId === ob.id
                                                            ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700" />
                                                            : reminderSent ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                            {['Usuario', 'Liga', 'Categoría', 'Monto', 'Deadline', 'Estado', 'Acción'].map((h) => (
                                <p key={h} className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{h}</p>
                            ))}
                        </div>
                        <div className="divide-y divide-slate-100">
                            {data.map((ob) => {
                                const isPending = ob.status === 'PENDING_PAYMENT';
                                const reminderSent = !!ob.reminder30SentAt;
                                const deadlinePast = ob.deadlineAt && new Date(ob.deadlineAt) < new Date();

                                return (
                                    <div
                                        key={ob.id}
                                        className={`grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-slate-50 ${
                                            isPending && deadlinePast ? 'bg-rose-50/30' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <img
                                                src={ob.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(ob.user.name)}&background=e2e8f0&color=64748b`}
                                                className="h-7 w-7 shrink-0 rounded-full object-cover"
                                                alt={ob.user.name}
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-bold text-slate-800">{ob.user.name}</p>
                                                <p className="truncate text-[10px] text-slate-400">{ob.user.email}</p>
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-bold text-slate-700">{ob.league.name}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{ob.referenceLabel}</p>
                                        </div>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
                                            {CATEGORY_LABELS[ob.category]}
                                        </span>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-900">{formatCurrency(ob.totalAmount, ob.currency)}</p>
                                            {ob.multiplier > 1 && <p className="text-[9px] text-slate-400">x{ob.multiplier}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[10px] font-bold ${deadlinePast ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {formatDate(ob.deadlineAt)}
                                            </p>
                                            {ob.paidAt ? (
                                                <p className="text-[9px] text-emerald-600">Pagó {formatDate(ob.paidAt)}</p>
                                            ) : ob.expiredAt ? (
                                                <p className="text-[9px] text-amber-600">Venció {formatDate(ob.expiredAt)}</p>
                                            ) : null}
                                        </div>
                                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${STATUS_CLASSES[ob.status]}`}>
                                            {STATUS_LABELS[ob.status]}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {isPending ? (
                                                <button
                                                    onClick={() => void handleNotifyOne(ob.id)}
                                                    disabled={notifyingId === ob.id}
                                                    title={reminderSent
                                                        ? `Reenviar notificación (enviado ${formatDateTime(ob.reminder30SentAt)})`
                                                        : 'Enviar recordatorio de pago'}
                                                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                                                        reminderSent
                                                            ? 'border border-slate-200 bg-white text-slate-400 hover:text-amber-600'
                                                            : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
                                                    } disabled:opacity-50`}
                                                >
                                                    {notifyingId === ob.id
                                                        ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700" />
                                                        : reminderSent ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />
                                                    }
                                                </button>
                                            ) : ob.status === 'PAID' ? (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                </div>
                                            ) : ob.status === 'EXPIRED' ? (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                                                    <XCircle className="h-3.5 w-3.5 text-amber-500" />
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            <AdminPagination
                page={page}
                limit={limit}
                total={total}
                onPageChange={(p) => setPage(p)}
            />

            {/* Toast */}
            {toast ? (
                <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg transition-all ${
                    toast.ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                }`}>
                    {toast.msg}
                </div>
            ) : null}
        </div>
    );
};

export default AdminPayments;
