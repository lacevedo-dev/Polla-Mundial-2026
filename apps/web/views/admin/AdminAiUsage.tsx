import React from 'react';
import {
    Calendar,
    Download,
    Eye,
    Filter,
    Search,
    Sparkles,
    TrendingUp,
    Users,
    X,
    Zap,
} from 'lucide-react';
import AdminPagination from '../../components/admin/AdminPagination';
import { useAdminAiUsageStore, type AiUsageRecord } from '../../stores/admin.ai-usage.store';

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatFeature(feature: string): string {
    if (feature === 'match_insights') return 'Match Insights';
    return feature.replace(/_/g, ' ');
}

function parseJson(value?: string | null): unknown {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function stringifyJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function JsonPanel({
    title,
    payload,
    emptyState,
    className = '',
}: {
    title: string;
    payload: unknown;
    emptyState: Record<string, string>;
    className?: string;
}) {
    const content = stringifyJson(payload ?? emptyState);

    return (
        <div className={`rounded-2xl border border-slate-200 p-4 ${className}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {title}
                </p>
                <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(content)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                    Copiar
                </button>
            </div>
            <pre className="max-h-[48vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 sm:max-h-[32rem]">
                {content}
            </pre>
        </div>
    );
}

function DetailModal({
    record,
    onClose,
}: {
    record: AiUsageRecord;
    onClose: () => void;
}) {
    const [activeTab, setActiveTab] = React.useState<'request' | 'response'>('request');
    const requestPayload = parseJson(record.requestData) ?? { detalle: record.clientInfo ?? 'Sin requestData' };
    const responsePayload = parseJson(record.responseData) ?? { respuesta: 'Sin responseData' };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-5xl sm:rounded-[1.75rem]">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600">
                            Detalle de consulta IA
                        </p>
                        <h3 className="mt-1 text-xl font-black text-slate-900">{record.user.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            {formatFeature(record.feature)} {'\u00B7'} {formatDate(record.createdAt)}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar detalle"
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Resumen
                            </p>
                            <dl className="mt-3 space-y-3 text-sm">
                                <div>
                                    <dt className="font-black text-slate-900">Usuario</dt>
                                    <dd className="text-slate-600">{record.user.email}</dd>
                                </div>
                                <div>
                                    <dt className="font-black text-slate-900">Plan</dt>
                                    <dd className="text-slate-600">{record.user.plan}</dd>
                                </div>
                                <div>
                                    <dt className="font-black text-slate-900">Créditos consumidos</dt>
                                    <dd className="text-slate-600">{record.creditsUsed}</dd>
                                </div>
                                <div>
                                    <dt className="font-black text-slate-900">Insight generado</dt>
                                    <dd className="text-slate-600">{record.insightGenerated ? 'Sí' : 'No'}</dd>
                                </div>
                                {record.clientInfo ? (
                                    <div>
                                        <dt className="font-black text-slate-900">Contexto</dt>
                                        <dd className="break-words text-slate-600">{record.clientInfo}</dd>
                                    </div>
                                ) : null}
                                {record.leagueId ? (
                                    <div>
                                        <dt className="font-black text-slate-900">League ID</dt>
                                        <dd className="break-all text-slate-600">{record.leagueId}</dd>
                                    </div>
                                ) : null}
                                {record.matchId ? (
                                    <div>
                                        <dt className="font-black text-slate-900">Match ID</dt>
                                        <dd className="break-all text-slate-600">{record.matchId}</dd>
                                    </div>
                                ) : null}
                            </dl>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 lg:hidden">
                            <button
                                type="button"
                                onClick={() => setActiveTab('request')}
                                className={`flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                                    activeTab === 'request'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500'
                                }`}
                            >
                                Solicitud
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('response')}
                                className={`flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                                    activeTab === 'response'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500'
                                }`}
                            >
                                Respuesta
                            </button>
                        </div>

                        <JsonPanel
                            title="Consulta enviada"
                            payload={requestPayload}
                            emptyState={{ detalle: record.clientInfo ?? 'Sin requestData' }}
                            className={activeTab === 'request' ? 'block' : 'hidden lg:block'}
                        />

                        <JsonPanel
                            title="Respuesta registrada"
                            payload={responsePayload}
                            emptyState={{ respuesta: 'Sin responseData' }}
                            className={activeTab === 'response' ? 'block' : 'hidden lg:block'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

const AdminAiUsage: React.FC = () => {
    const {
        records,
        stats,
        total,
        filters,
        isLoading,
        fetchRecords,
        fetchStats,
        setFilters,
    } = useAdminAiUsageStore();

    const [searchInput, setSearchInput] = React.useState('');
    const [featureFilter, setFeatureFilter] = React.useState('');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [selectedRecord, setSelectedRecord] = React.useState<AiUsageRecord | null>(null);

    // Debounce userId search
    const debouncedSearch = React.useDeferredValue(searchInput);
    React.useEffect(() => {
        setFilters({ userId: debouncedSearch || undefined, page: 1 });
    }, [debouncedSearch, setFilters]);

    React.useEffect(() => {
        void fetchRecords();
        void fetchStats();
    }, [filters, fetchRecords, fetchStats]);

    const handleDateFilter = () => {
        setFilters({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            page: 1,
        });
    };

    const exportToCSV = () => {
        const csvContent = [
            ['Fecha', 'Usuario', 'Email', 'Plan', 'Feature', 'Créditos', 'League ID', 'Match ID', 'Detalle cliente'].join(','),
            ...records.map((r) =>
                [
                    formatDate(r.createdAt),
                    r.user.name,
                    r.user.email,
                    r.user.plan,
                    r.feature,
                    r.creditsUsed,
                    r.leagueId || '-',
                    r.matchId || '-',
                    r.clientInfo || '-',
                ].join(','),
            ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ai-usage-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const visibleFrom = total === 0 ? 0 : (filters.page - 1) * filters.limit + 1;
    const visibleTo = total === 0 ? 0 : Math.min(filters.page * filters.limit, total);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 font-brand leading-tight">Consultas IA</h1>
                <p className="mt-1 text-xs text-slate-400">
                    Auditoría completa de uso de créditos de inteligencia artificial
                </p>
            </div>

            {stats && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                                    <Sparkles className="h-6 w-6 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Total Consultas
                                    </p>
                                    <p className="text-2xl font-black text-slate-900">
                                        {stats.totalRecords.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                                    <Zap className="h-6 w-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Créditos Usados
                                    </p>
                                    <p className="text-2xl font-black text-slate-900">
                                        {stats.totalCreditsUsed.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-100">
                                    <TrendingUp className="h-6 w-6 text-lime-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Promedio/Consulta
                                    </p>
                                    <p className="text-2xl font-black text-slate-900">
                                        {stats.totalRecords > 0 ? (stats.totalCreditsUsed / stats.totalRecords).toFixed(1) : '0'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                                    <Users className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Usuarios Activos
                                    </p>
                                    <p className="text-2xl font-black text-slate-900">
                                        {stats.byPlan.reduce((sum, p) => sum + p._count, 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {stats && stats.byPlan.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 p-5">
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Uso por Plan</h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {stats.byPlan.map((planStat) => {
                                const usagePercent =
                                    planStat._sum.totalCredits > 0
                                        ? (planStat._sum.usedCredits / planStat._sum.totalCredits) * 100
                                        : 0;

                                return (
                                    <div key={planStat.plan} className="rounded-xl border border-slate-100 p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                                                {planStat.plan}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">
                                                {planStat._count} usuarios
                                            </span>
                                        </div>
                                        <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className="h-full bg-gradient-to-r from-violet-500 to-violet-600"
                                                style={{ width: `${usagePercent}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-600">
                                                {planStat._sum.usedCredits.toLocaleString()} / {planStat._sum.totalCredits.toLocaleString()}
                                            </span>
                                            <span className="font-black text-violet-600">{usagePercent.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Filtros</h3>
                    </div>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="relative">
                            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Buscar por userId..."
                                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />
                        </div>

                        <select
                            value={featureFilter}
                            onChange={(e) => {
                                setFeatureFilter(e.target.value);
                                setFilters({ feature: e.target.value || undefined, page: 1 });
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                            <option value="">Todas las features</option>
                            <option value="match_insights">Match Insights</option>
                        </select>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                            </div>
                            <div className="relative flex-1">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleDateFilter}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold uppercase text-violet-700 transition-all hover:bg-violet-100"
                        >
                            Aplicar Fechas
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Registros de Uso</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-600">
                                {total.toLocaleString()} registro{total === 1 ? '' : 's'} totales
                            </span>
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">
                                {records.length.toLocaleString()} visibles
                            </span>
                            <span className="text-slate-500">
                                {total > 0 ? `Mostrando ${visibleFrom}-${visibleTo} de ${total}` : 'Sin registros para mostrar'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 transition-all hover:bg-slate-50"
                    >
                        <Download size={14} />
                        Exportar CSV
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Plan</th>
                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Feature</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Créditos</th>
                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Insight</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                                            <p className="text-sm font-bold text-slate-500">Cargando...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center">
                                        <p className="text-sm font-bold text-slate-400">No hay registros</p>
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50">
                                        <td className="px-4 py-3 text-xs font-bold text-slate-600">{formatDate(record.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{record.user.name}</p>
                                                <p className="text-xs text-slate-500">{record.user.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                                                    record.user.plan === 'DIAMOND'
                                                        ? 'bg-violet-100 text-violet-700'
                                                        : record.user.plan === 'GOLD'
                                                          ? 'bg-amber-100 text-amber-700'
                                                          : 'bg-slate-100 text-slate-700'
                                                }`}
                                            >
                                                {record.user.plan}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-600">
                                            <div className="space-y-1">
                                                <p>{formatFeature(record.feature)}</p>
                                                {record.clientInfo ? (
                                                    <p className="max-w-[260px] truncate text-[11px] font-medium text-slate-400">
                                                        {record.clientInfo}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{record.creditsUsed}</td>
                                        <td className="px-4 py-3 text-center">
                                            {record.insightGenerated ? (
                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-lime-100">
                                                    <Sparkles className="h-3 w-3 text-lime-600" />
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRecord(record)}
                                                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-violet-700 transition hover:bg-violet-100"
                                            >
                                                <Eye size={14} />
                                                Ver consulta
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!isLoading && total > 0 ? (
                    <div className="border-t border-slate-100 p-4">
                        <AdminPagination
                            page={filters.page}
                            limit={filters.limit}
                            total={total}
                            onPageChange={(page) => setFilters({ page })}
                        />
                    </div>
                ) : null}
            </div>

            {selectedRecord ? (
                <DetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
            ) : null}
        </div>
    );
};

export default AdminAiUsage;
