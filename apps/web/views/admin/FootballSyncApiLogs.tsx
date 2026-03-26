import { useEffect, useState } from 'react';
import { request } from '../../api';
import { ChevronDown, ChevronRight, RefreshCw, Wifi } from 'lucide-react';

interface ApiRequest {
    id: string;
    endpoint: string;
    params: Record<string, unknown> | string | null;
    status: number;
    matchesFetched: number;
    externalId: string | null;
    responseBody: string | null;
    timestamp: string;
}

interface ApiLogsResponse {
    total: number;
    requests: ApiRequest[];
}

function parseParams(params: Record<string, unknown> | string | null): string {
    if (!params) return '—';
    if (typeof params === 'string') {
        try { return JSON.stringify(JSON.parse(params), null, 2); } catch { return params; }
    }
    return JSON.stringify(params, null, 2);
}

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ResponseBody({ body }: { body: string | null }) {
    const [open, setOpen] = useState(false);
    if (!body) return <span className="text-slate-400 text-xs">Sin respuesta</span>;

    let parsed: unknown = null;
    let preview = '';
    try {
        parsed = JSON.parse(body);
        const p = parsed as Record<string, unknown>;
        const results = p.results as number | undefined;
        const fixtures = Array.isArray(p.response) ? (p.response as unknown[]).length : 0;
        preview = `${results ?? fixtures} fixtures`;
    } catch {
        preview = `${body.length} chars`;
    }

    return (
        <div>
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 text-xs font-bold text-lime-700 hover:text-lime-900"
            >
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {preview}
            </button>
            {open && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-relaxed text-lime-300">
                    {parsed ? JSON.stringify(parsed, null, 2) : body}
                </pre>
            )}
        </div>
    );
}

export default function FootballSyncApiLogs() {
    const [data, setData] = useState<ApiLogsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await request<ApiLogsResponse>('/football-sync/requests/today');
            setData(res);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al cargar logs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = window.setInterval(() => { void load(); }, 15_000);
        return () => window.clearInterval(interval);
    }, [autoRefresh]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="font-brand text-xl font-black uppercase leading-tight tracking-tight text-slate-900 sm:text-2xl">
                        Requests API-Football
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Historial de llamadas realizadas hoy a la API externa con sus respuestas
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh((v) => !v)}
                        className={`flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition ${autoRefresh ? 'border-lime-400 bg-lime-50 text-lime-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Wifi className="h-3.5 w-3.5" />
                        {autoRefresh ? 'Auto' : 'Manual'}
                    </button>
                    <button
                        onClick={() => void load()}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-medium text-rose-700">{error}</p>
                </div>
            )}

            {/* Stats bar */}
            {data && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total hoy</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{data.total}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Exitosos</p>
                        <p className="mt-1 text-2xl font-black text-lime-600">
                            {data.requests.filter((r) => r.status === 200).length}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Errores</p>
                        <p className="mt-1 text-2xl font-black text-rose-500">
                            {data.requests.filter((r) => r.status !== 200).length}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fixtures recibidos</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">
                            {data.requests.reduce((sum, r) => sum + (r.matchesFetched ?? 0), 0)}
                        </p>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
                {isLoading && !data && (
                    <div className="flex items-center justify-center p-12">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-lime-500" />
                    </div>
                )}

                {data && data.requests.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-400">
                        No hay requests registrados hoy
                    </div>
                )}

                {data && data.requests.length > 0 && (
                    <div className="divide-y divide-slate-100">
                        {/* Header row */}
                        <div className="grid grid-cols-[80px_100px_1fr_120px_80px] gap-3 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            <span>Hora</span>
                            <span>Estado</span>
                            <span>Endpoint / Params</span>
                            <span>Respuesta</span>
                            <span>Fixtures</span>
                        </div>

                        {data.requests.map((req) => (
                            <div key={req.id} className="grid grid-cols-[80px_100px_1fr_120px_80px] items-start gap-3 px-5 py-3 hover:bg-slate-50">
                                <span className="pt-0.5 font-mono text-xs text-slate-500">{formatTime(req.timestamp)}</span>

                                <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-black ${req.status === 200 ? 'bg-lime-100 text-lime-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {req.status}
                                </span>

                                <div>
                                    <p className="text-xs font-bold text-slate-800">
                                        {req.endpoint}
                                        {req.externalId && <span className="ml-1.5 text-slate-400">#{req.externalId}</span>}
                                    </p>
                                    <pre className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                                        {parseParams(req.params)}
                                    </pre>
                                </div>

                                <ResponseBody body={req.responseBody} />

                                <span className="pt-0.5 font-mono text-sm font-bold text-slate-700">
                                    {req.matchesFetched ?? 0}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
