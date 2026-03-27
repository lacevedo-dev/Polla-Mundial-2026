import { useEffect, useState, useCallback } from 'react';
import { request } from '../../api';
import { ChevronDown, ChevronRight, RefreshCw, Wifi, WifiOff, Check, X, Database, Clock, BarChart2, Hash } from 'lucide-react';

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

function parseParams(raw: Record<string, unknown> | string | null): Record<string, string> {
    if (!raw) return {};
    try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
    } catch {
        return { raw: String(raw) };
    }
}

function formatCOT(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' }),
        time: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }),
        relative: (() => {
            const diff = Math.floor((Date.now() - d.getTime()) / 1000);
            if (diff < 60) return `hace ${diff}s`;
            if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
            return `hace ${Math.floor(diff / 3600)}h`;
        })(),
    };
}

function parseResponse(body: string | null): { results: number; fixtures: unknown[]; errors: unknown[] } {
    if (!body) return { results: 0, fixtures: [], errors: [] };
    try {
        const p = JSON.parse(body) as Record<string, unknown>;
        return {
            results: (p.results as number) ?? 0,
            fixtures: Array.isArray(p.response) ? (p.response as unknown[]) : [],
            errors: Array.isArray(p.errors) ? (p.errors as unknown[]) : [],
        };
    } catch {
        return { results: 0, fixtures: [], errors: [] };
    }
}

function FixturePreview({ fixtures }: { fixtures: unknown[] }) {
    const preview = fixtures.slice(0, 5) as Array<{
        fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
        teams: { home: { name: string }; away: { name: string } };
        goals: { home: number | null; away: number | null };
        league: { name: string; country: string };
    }>;

    return (
        <div className="mt-3 space-y-1.5">
            {preview.map((f) => {
                const status = f.fixture?.status?.short ?? '?';
                const elapsed = f.fixture?.status?.elapsed;
                const home = f.teams?.home?.name ?? '?';
                const away = f.teams?.away?.name ?? '?';
                const gh = f.goals?.home;
                const ga = f.goals?.away;
                const league = f.league?.name ?? '';
                const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(status);
                const isFinished = ['FT', 'AET', 'PEN'].includes(status);

                return (
                    <div key={f.fixture?.id} className="flex items-center gap-2 rounded-xl bg-slate-800/60 px-3 py-1.5">
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-black ${
                            isLive ? 'bg-rose-500/20 text-rose-300' :
                            isFinished ? 'bg-emerald-500/20 text-emerald-300' :
                            'bg-slate-600/40 text-slate-400'
                        }`}>
                            {isLive && elapsed ? `${elapsed}'` : status}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                            {home} <span className="text-slate-500">vs</span> {away}
                        </span>
                        {(gh !== null || ga !== null) && (
                            <span className="shrink-0 font-mono text-[10px] font-bold text-white">
                                {gh ?? '–'}:{ga ?? '–'}
                            </span>
                        )}
                        <span className="shrink-0 truncate text-[9px] text-slate-500 max-w-[80px]">{league}</span>
                    </div>
                );
            })}
            {fixtures.length > 5 && (
                <p className="pl-3 text-[10px] text-slate-500">+{fixtures.length - 5} más…</p>
            )}
        </div>
    );
}

function RequestCard({ req }: { req: ApiRequest }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'fixtures' | 'raw'>('fixtures');
    const { date, time, relative } = formatCOT(req.timestamp);
    const params = parseParams(req.params);
    const parsed = parseResponse(req.responseBody);
    const ok = req.status === 200;
    const hasErrors = parsed.errors.length > 0;

    return (
        <div className={`rounded-2xl border bg-white transition-shadow ${ok ? 'border-slate-200' : 'border-rose-200'}`}>
            {/* Card header */}
            <div className="flex items-start gap-3 p-4">
                {/* Status dot */}
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-lime-100' : 'bg-rose-100'}`}>
                    {ok
                        ? <Check size={13} className="text-lime-600" />
                        : <X size={13} className="text-rose-600" />
                    }
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-800">{req.endpoint}</span>
                        {req.externalId && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                <Hash size={9} />
                                {req.externalId}
                            </span>
                        )}
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${ok ? 'bg-lime-50 text-lime-700' : 'bg-rose-50 text-rose-700'}`}>
                            HTTP {req.status}
                        </span>
                    </div>

                    {/* Params pills */}
                    {Object.keys(params).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(params).map(([k, v]) => (
                                <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                    <span className="font-black text-slate-400">{k}</span>
                                    <span>{v}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right stats */}
                <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={10} />
                        <span className="font-mono">{time}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{date}</p>
                    <p className="text-[9px] text-slate-300">{relative}</p>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-1.5 px-4 py-2">
                    <Database size={11} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600">{parsed.results}</span>
                    <span className="text-[10px] text-slate-400">fixtures</span>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2">
                    <BarChart2 size={11} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600">{req.matchesFetched ?? 0}</span>
                    <span className="text-[10px] text-slate-400">recibidos</span>
                </div>
                <div className="flex items-center justify-end px-4 py-2">
                    {req.responseBody ? (
                        <button
                            onClick={() => setOpen((o) => !o)}
                            className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-800"
                        >
                            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            Ver respuesta
                        </button>
                    ) : (
                        <span className="text-[10px] text-slate-300">Sin cuerpo</span>
                    )}
                </div>
            </div>

            {/* Expanded response */}
            {open && req.responseBody && (
                <div className="border-t border-slate-100">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 bg-slate-50">
                        <button
                            onClick={() => setTab('fixtures')}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider transition ${tab === 'fixtures' ? 'border-b-2 border-violet-500 text-violet-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Fixtures ({parsed.fixtures.length})
                        </button>
                        <button
                            onClick={() => setTab('raw')}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider transition ${tab === 'raw' ? 'border-b-2 border-violet-500 text-violet-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            JSON crudo
                        </button>
                        {hasErrors && (
                            <span className="ml-2 self-center rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-600">
                                {parsed.errors.length} error(es) API
                            </span>
                        )}
                    </div>

                    <div className="p-4">
                        {tab === 'fixtures' && parsed.fixtures.length > 0 && (
                            <FixturePreview fixtures={parsed.fixtures} />
                        )}
                        {tab === 'fixtures' && parsed.fixtures.length === 0 && (
                            <p className="text-center text-xs text-slate-400 py-4">Sin fixtures en la respuesta</p>
                        )}
                        {tab === 'raw' && (
                            <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-[10px] leading-relaxed text-lime-300 scrollbar-thin">
                                {(() => {
                                    try { return JSON.stringify(JSON.parse(req.responseBody!), null, 2); }
                                    catch { return req.responseBody!; }
                                })()}
                            </pre>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FootballSyncApiLogs() {
    const [data, setData] = useState<ApiLogsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'error'>('all');

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await request<ApiLogsResponse>('/admin/football/requests/today');
            setData(res);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al cargar logs');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = window.setInterval(() => { void load(); }, 15_000);
        return () => window.clearInterval(interval);
    }, [autoRefresh, load]);

    const filtered = data?.requests.filter((r) => {
        if (filterStatus === 'ok') return r.status === 200;
        if (filterStatus === 'error') return r.status !== 200;
        return true;
    }) ?? [];

    const totalFixtures = data?.requests.reduce((s, r) => s + (r.matchesFetched ?? 0), 0) ?? 0;
    const okCount = data?.requests.filter((r) => r.status === 200).length ?? 0;
    const errCount = (data?.total ?? 0) - okCount;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="font-brand text-xl font-black uppercase leading-tight tracking-tight text-slate-900 sm:text-2xl">
                        API-Football · Logs
                    </h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Llamadas realizadas hoy a la API externa (hora Colombia)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh((v) => !v)}
                        className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition ${autoRefresh ? 'border-lime-400 bg-lime-50 text-lime-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                        {autoRefresh ? <Wifi size={13} /> : <WifiOff size={13} />}
                        {autoRefresh ? 'Auto 15s' : 'Manual'}
                    </button>
                    <button
                        onClick={() => void load()}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-sm font-black text-rose-700">Error al cargar</p>
                    <p className="mt-0.5 font-mono text-xs text-rose-600">{error}</p>
                </div>
            )}

            {/* Stats */}
            {data && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        { label: 'Total hoy', value: data.total, color: 'text-slate-900' },
                        { label: 'Exitosos', value: okCount, color: 'text-lime-600' },
                        { label: 'Errores', value: errCount, color: errCount > 0 ? 'text-rose-500' : 'text-slate-400' },
                        { label: 'Fixtures', value: totalFixtures, color: 'text-violet-600' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                            <p className={`mt-1 text-2xl font-black ${color}`}>{value.toLocaleString('es-CO')}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter tabs */}
            {data && data.total > 0 && (
                <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 w-fit">
                    {([['all', 'Todos'], ['ok', 'OK'], ['error', 'Errores']] as const).map(([val, label]) => (
                        <button
                            key={val}
                            onClick={() => setFilterStatus(val)}
                            className={`rounded-xl px-4 py-1.5 text-xs font-black transition ${filterStatus === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && !data && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                    ))}
                </div>
            )}

            {/* Empty state */}
            {data && data.requests.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-8 py-12 text-center">
                    <p className="text-sm font-bold text-slate-400">Sin requests registrados hoy</p>
                    <p className="mt-1 text-xs text-slate-300">El sync aún no se ha ejecutado o no hay datos para hoy (COT).</p>
                </div>
            )}

            {/* Request cards */}
            {filtered.length > 0 && (
                <div className="space-y-3">
                    {filtered.map((req) => (
                        <RequestCard key={req.id} req={req} />
                    ))}
                </div>
            )}

            {/* Empty filter result */}
            {data && data.requests.length > 0 && filtered.length === 0 && (
                <p className="text-center text-sm text-slate-400">No hay requests con ese filtro.</p>
            )}

            {isLoading && data && (
                <div className="flex justify-center py-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-lime-500" />
                </div>
            )}
        </div>
    );
}
