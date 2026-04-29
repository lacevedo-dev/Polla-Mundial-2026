import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  XCircle,
  MinusCircle,
  TrendingUp,
  BarChart2,
  Settings2,
  Info,
} from 'lucide-react';
import { BASE_URL, request } from '../../api';

interface NotifSchedule {
  type: 'MATCH_REMINDER' | 'PREDICTION_CLOSED' | 'RESULT_PUBLISHED';
  label: string;
  scheduledAt: string;
}

interface PlannedRequest {
  id: string;
  type:
    | 'STATUS_BATCH'
    | 'STATUS_BATCH_WITH_CARRY_OVER'
    | 'LINK_AND_STATUS'
    | 'EVENTS_HALFTIME'
    | 'EVENTS_FINAL';
  label: string;
  scheduledAt: string;
  requestCost: number;
  matchIds: string[];
  optional?: boolean;
  executionState?: 'enabled' | 'disabled_by_config';
  disabledReason?: 'event_sync_disabled';
  notes?: string;
}

interface MatchSlot {
  matchId: string;
  trackingScope: 'TODAY' | 'CARRY_OVER';
  homeTeam: string;
  awayTeam: string;
  homeFlag?: string | null;
  awayFlag?: string | null;
  matchDate: string;
  status: string;
  externalId: string | null;
  syncSlots: string[];
  notificationSchedule: NotifSchedule[];
  plannedRequests: PlannedRequest[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  requestsAssigned: number;
}

interface HourBucket {
  hour: number;
  requests: number;
  slots: string[];
}

interface SyncTimeline {
  date: string;
  strategy: string;
  intervalMinutes: number;
  requestsUsed: number;
  requestsBudget: number;
  requestsLimit: number;
  nextSyncAt: string | null;
  matches: MatchSlot[];
  plannedRequests: PlannedRequest[];
  requestLog: HourBucket[];
  totalSlotsPlanned: number;
  totalPlannedRequests: number;
}

interface LiveEvent {
  type: string;
  summary: string;
  ts: string;
}

const STRATEGY_STYLES: Record<string, string> = {
  AGGRESSIVE: 'bg-rose-100 text-rose-700',
  BALANCED: 'bg-sky-100 text-sky-700',
  CONSERVATIVE: 'bg-amber-100 text-amber-700',
  EMERGENCY: 'bg-red-100 text-red-800',
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  LIVE: 'bg-rose-100 text-rose-700',
  FINISHED: 'bg-emerald-100 text-emerald-700',
  POSTPONED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const NOTIF_ICON: Record<NotifSchedule['type'], React.ReactNode> = {
  MATCH_REMINDER: <Bell size={12} className="text-sky-500" />,
  PREDICTION_CLOSED: <AlertTriangle size={12} className="text-amber-500" />,
  RESULT_PUBLISHED: <CheckCircle2 size={12} className="text-emerald-500" />,
};

const REQUEST_STYLES: Record<PlannedRequest['type'], string> = {
  STATUS_BATCH: 'border-sky-200 bg-sky-50 text-sky-700',
  STATUS_BATCH_WITH_CARRY_OVER: 'border-violet-200 bg-violet-50 text-violet-700',
  LINK_AND_STATUS: 'border-amber-200 bg-amber-50 text-amber-700',
  EVENTS_HALFTIME: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  EVENTS_FINAL: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const EXECUTION_STATE_STYLES: Record<NonNullable<PlannedRequest['executionState']>, string> = {
  enabled: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  disabled_by_config: 'border-rose-200 bg-rose-50 text-rose-700',
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Bogota',
  });

const isExecutableRequest = (planned: PlannedRequest) =>
  planned.executionState !== 'disabled_by_config';

const getActiveRequestCount = (plannedRequests: PlannedRequest[]) =>
  plannedRequests.filter(isExecutableRequest).length;

function eventSummary(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'sync_started':
      return `Sync iniciado - ${data.matchCount ?? '?'} partidos`;
    case 'sync_completed':
      return `Sync completado - ${data.matchesUpdated ?? 0} partidos actualizados`;
    case 'sync_failed':
      return `Sync fallido - ${data.error ?? 'desconocido'}`;
    case 'match_updated':
      return `Partido actualizado - ${data.status ?? 'sin estado'}`;
    case 'plan_updated':
      return `Plan actualizado - ${data.strategy ?? ''} cada ${data.intervalMinutes ?? '?'} min`;
    case 'rate_limit_warning':
      return `Alerta de limite - ${data.remaining ?? '?'} requests restantes`;
    default:
      return type;
  }
}

function patchTimelineFromEvent(
  previous: SyncTimeline | null,
  type: string,
  data: Record<string, unknown>,
): SyncTimeline | null {
  if (!previous) return previous;

  if (type === 'plan_updated') {
    return {
      ...previous,
      strategy: String(data.strategy ?? previous.strategy),
      intervalMinutes: Number(data.intervalMinutes ?? previous.intervalMinutes),
      requestsUsed: Number(data.requestsUsed ?? previous.requestsUsed),
      requestsBudget: Number(data.requestsAvailable ?? previous.requestsBudget),
    };
  }

  if (type === 'match_updated') {
    const matchId = String(data.matchId ?? '');
    if (!matchId) return previous;

    return {
      ...previous,
      matches: previous.matches.map((match) =>
        match.matchId === matchId
          ? {
              ...match,
              status: String(data.status ?? match.status),
              lastSyncAt: new Date().toISOString(),
              lastSyncStatus: 'SUCCESS',
            }
          : match,
      ),
    };
  }

  return previous;
}

// === HEATMAP HORARIO ESTILO GITHUB ===

const HEATMAP_COLORS = [
  'bg-slate-100',           // 0 requests
  'bg-sky-100',             // 1
  'bg-sky-200',             // 2
  'bg-sky-300',             // 3
  'bg-sky-400',             // 4
  'bg-sky-500',             // 5
  'bg-sky-600',             // 6+
];

const HEATMAP_BORDER = [
  'border-slate-200',
  'border-sky-200',
  'border-sky-200',
  'border-sky-300',
  'border-sky-400',
  'border-sky-500',
  'border-sky-600',
];

function getHeatLevel(requests: number, max: number): number {
  if (requests === 0 || max === 0) return 0;
  const pct = requests / max;
  if (pct <= 0.1) return 1;
  if (pct <= 0.25) return 2;
  if (pct <= 0.45) return 3;
  if (pct <= 0.65) return 4;
  if (pct <= 0.85) return 5;
  return 6;
}

interface TooltipState { hour: number; requests: number; slots: string[]; x: number; y: number }

function HeatmapChart({ buckets, plannedRequests }: { buckets: HourBucket[]; plannedRequests: PlannedRequest[] }) {
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null);
  const max = Math.max(...buckets.map((b) => b.requests), 1);

  // Mapa hora → requests por tipo
  const byHourType = React.useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (let h = 0; h < 24; h++) map[h] = {};
    for (const pr of plannedRequests) {
      if (pr.executionState === 'disabled_by_config') continue;
      const h = new Date(pr.scheduledAt).getHours();
      map[h][pr.type] = (map[h][pr.type] ?? 0) + 1;
    }
    return map;
  }, [plannedRequests]);

  const disabledCount = plannedRequests.filter((p) => p.executionState === 'disabled_by_config').length;
  const enabledCount = plannedRequests.filter((p) => p.executionState !== 'disabled_by_config').length;
  const totalCost = plannedRequests.reduce((acc, p) => acc + p.requestCost, 0);

  const activeHours = buckets.filter((b) => b.requests > 0).length;
  const peakBucket = buckets.reduce((a, b) => (b.requests > a.requests ? b : a), buckets[0]);

  return (
    <div className="space-y-4">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Activos', value: enabledCount, icon: <CheckCircle2 size={11} className="text-emerald-500" />, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Desactivados', value: disabledCount, icon: <XCircle size={11} className="text-rose-400" />, color: 'text-rose-600 bg-rose-50' },
          { label: 'Costo total', value: totalCost, icon: <TrendingUp size={11} className="text-sky-500" />, color: 'text-sky-700 bg-sky-50' },
        ].map((m) => (
          <div key={m.label} className={`rounded-xl px-2.5 py-2 ${m.color} flex items-center gap-1.5`}>
            {m.icon}
            <div>
              <div className="text-[10px] opacity-70">{m.label}</div>
              <div className="text-sm font-black">{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap 24h */}
      <div className="relative">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Distribución horaria</span>
          {peakBucket?.requests > 0 && (
            <span className="text-[10px] text-slate-400">
              Pico: <strong className="text-slate-600">{String(peakBucket.hour).padStart(2,'0')}:00</strong> ({peakBucket.requests} req)
            </span>
          )}
        </div>

        <div className="flex gap-0.5" onMouseLeave={() => setTooltip(null)}>
          {buckets.map((bucket) => {
            const level = getHeatLevel(bucket.requests, max);
            const types = byHourType[bucket.hour] ?? {};
            const typeList = Object.entries(types).map(([t, c]) => `${t}: ${c}`).join(', ');
            return (
              <div
                key={bucket.hour}
                className="flex flex-1 flex-col items-center gap-0.5"
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTooltip({ hour: bucket.hour, requests: bucket.requests, slots: bucket.slots, x: rect.left, y: rect.top });
                }}
              >
                <div
                  className={`w-full cursor-default rounded-[3px] border transition-transform hover:scale-110 hover:shadow-md ${
                    HEATMAP_COLORS[level]
                  } ${HEATMAP_BORDER[level]}`}
                  style={{ height: 28 }}
                  title={`${String(bucket.hour).padStart(2,'0')}:00 — ${bucket.requests} req${typeList ? ' | ' + typeList : ''}`}
                />
                {bucket.hour % 3 === 0 && (
                  <span className="text-[8px] font-bold text-slate-400">{String(bucket.hour).padStart(2,'0')}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-2 flex items-center justify-end gap-1">
          <span className="text-[9px] text-slate-400">Menos</span>
          {HEATMAP_COLORS.map((c, i) => (
            <div key={i} className={`h-2.5 w-2.5 rounded-[2px] border ${c} ${HEATMAP_BORDER[i]}`} />
          ))}
          <span className="text-[9px] text-slate-400">Más</span>
        </div>
      </div>

      {/* Barras por tipo */}
      {Object.values(byHourType).some(t => Object.keys(t).length > 0) && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Por tipo de consulta</span>
          {(['STATUS_BATCH','STATUS_BATCH_WITH_CARRY_OVER','LINK_AND_STATUS','EVENTS_HALFTIME','EVENTS_FINAL'] as PlannedRequest['type'][]).map((type) => {
            const count = plannedRequests.filter((p) => p.type === type && p.executionState !== 'disabled_by_config').length;
            const disabledForType = plannedRequests.filter((p) => p.type === type && p.executionState === 'disabled_by_config').length;
            if (count + disabledForType === 0) return null;
            const pct = Math.round((count / Math.max(enabledCount, 1)) * 100);
            const labels: Record<string, string> = {
              STATUS_BATCH: 'Estados del día',
              STATUS_BATCH_WITH_CARRY_OVER: 'Estados + arrastres',
              LINK_AND_STATUS: 'Sin vínculo + estado',
              EVENTS_HALFTIME: 'Eventos entretiempo',
              EVENTS_FINAL: 'Eventos final',
            };
            return (
              <div key={type} className="flex items-center gap-2">
                <span className={`w-28 shrink-0 truncate text-[10px] font-bold ${REQUEST_STYLES[type].split(' ')[2]}`}>{labels[type]}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100" style={{ height: 7 }}>
                  <div
                    className={`h-full rounded-full transition-all ${REQUEST_STYLES[type].split(' ')[0].replace('border-','bg-')}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[10px] font-bold text-slate-600">{count}</span>
                {disabledForType > 0 && (
                  <span className="text-[10px] text-rose-400" title="Desactivados por configuración">−{disabledForType}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        {activeHours} hora{activeHours !== 1 ? 's' : ''} con actividad · {enabledCount} requests activos · {disabledCount > 0 ? `${disabledCount} desactivados por config` : 'todos activos'}
      </p>
    </div>
  );
}

function Flag({ url, name }: { url?: string | null; name: string }) {
  if (!url) {
    return <div className="h-4 w-6 rounded bg-slate-200" aria-hidden="true" />;
  }
  return <img src={url} alt={name} className="h-4 w-6 rounded border border-slate-200 object-cover" />;
}

const AdminSyncPlan: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [timeline, setTimeline] = React.useState<SyncTimeline | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = React.useState<string | null>(null);
  const [sseConnected, setSseConnected] = React.useState(false);
  const [liveEvents, setLiveEvents] = React.useState<LiveEvent[]>([]);

  const loadTimeline = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await request<SyncTimeline>('/admin/football/plan/timeline');
      setTimeline(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar el plan');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      void loadTimeline();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadTimeline]);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const source = new EventSource(`${BASE_URL}/admin/football/events?token=${encodeURIComponent(token)}`);

    source.onopen = () => setSseConnected(true);
    source.onerror = () => setSseConnected(false);

    ['sync_started', 'sync_completed', 'sync_failed', 'match_updated', 'plan_updated', 'rate_limit_warning'].forEach((type) => {
      source.addEventListener(type, (event: MessageEvent) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(event.data);
        } catch {
          data = {};
        }

        setLiveEvents((previous) => [
          { type, summary: eventSummary(type, data), ts: new Date().toLocaleTimeString('es-CO') },
          ...previous.slice(0, 24),
        ]);
        setTimeline((previous) => patchTimelineFromEvent(previous, type, data));
      });
    });

    return () => {
      source.close();
      setSseConnected(false);
    };
  }, []);

  const carryOverCount = timeline?.matches.filter((match) => match.trackingScope === 'CARRY_OVER').length ?? 0;
  const usagePct = timeline ? Math.round((timeline.requestsUsed / Math.max(1, timeline.requestsLimit)) * 100) : 0;

  return (
    <div className={embedded ? 'space-y-6' : 'min-h-screen bg-slate-50 px-4 py-6 md:px-6 lg:px-8'}>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${embedded ? '' : 'mb-6'}`}>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Plan de sincronizacion</h1>
          <p className="mt-1 text-sm text-slate-500">
            {timeline
              ? `${fmtDay(new Date().toISOString())}${carryOverCount > 0 ? ` | ${carryOverCount} arrastre(s) de ayer` : ''}`
              : 'Cargando...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${sseConnected ? 'bg-lime-50 text-lime-700' : 'bg-slate-100 text-slate-500'}`}>
            {sseConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {sseConnected ? 'En vivo' : 'Desconectado'}
          </div>
          {timeline && (
            <div className="flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700" title="Plan estable - se mantiene entre recargas">
              <CheckCircle2 size={12} />
              Plan estable
            </div>
          )}
          <button
            onClick={() => void loadTimeline()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          { icon: <Bell size={14} className="text-sky-500" />, title: 'Recordatorio 1h', text: 'Se considera para todos los partidos monitoreados.' },
          { icon: <AlertTriangle size={14} className="text-amber-500" />, title: 'Cierre predicciones', text: 'Se muestra siempre segun el cierre configurado por liga.' },
          { icon: <CheckCircle2 size={14} className="text-emerald-500" />, title: 'Resultado publicado', text: 'Se mantiene visible para hoy y arrastres no cerrados.' },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              {item.icon}
              {item.title}
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[10px] font-black uppercase text-lime-700">
                <Activity size={10} /> Activo
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={14} className="text-slate-500" />
          <p className="text-sm font-black text-slate-900">Leyenda de consultas planeadas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['STATUS_BATCH', 'Estados del dia'],
            ['STATUS_BATCH_WITH_CARRY_OVER', 'Estados + arrastres'],
            ['LINK_AND_STATUS', 'Sin vinculo + estado'],
            ['EVENTS_HALFTIME', 'Eventos entretiempo'],
            ['EVENTS_FINAL', 'Eventos final'],
          ].map(([type, label]) => (
            <span
              key={type}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                REQUEST_STYLES[type as PlannedRequest['type']]
              }`}
            >
              <Clock size={10} />
              {label}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Los eventos son opcionales: se planean solo si sobra presupuesto y, si no aportan eventos útiles para un fixture, no se reintentan para no gastar requests del resto.
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Cuando un evento aparece desactivado por configuración, igual se muestra en el plan para dejar claro el costo potencial aunque no se ejecute.
        </p>
      </div>

      {timeline && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Requests hoy</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{timeline.requestsUsed}</p>
            <p className="mt-1 text-xs text-slate-500">{usagePct}% de {timeline.requestsLimit}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Disponibles</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{timeline.requestsBudget}</p>
            <p className="mt-1 text-xs text-slate-500">{timeline.totalPlannedRequests} requests planeados</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estrategia</p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${STRATEGY_STYLES[timeline.strategy] ?? 'bg-slate-100 text-slate-700'}`}>
              {timeline.strategy}
            </span>
            <p className="mt-2 text-xs text-slate-500">Cada {timeline.intervalMinutes} min</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Proximo sync</p>
            <p className="mt-2 text-lg font-black text-slate-900">{timeline.nextSyncAt ? fmtTime(timeline.nextSyncAt) : '-'}</p>
            <p className="mt-1 text-xs text-slate-500">{timeline.matches.length} partido(s) monitoreado(s)</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">Partidos monitoreados</h2>

          {loading && !timeline && (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12">
              <RefreshCw size={20} className="animate-spin text-slate-400" />
            </div>
          )}

          {timeline?.matches.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <Calendar size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-600">No hay partidos para monitorear</p>
              <p className="mt-1 text-xs text-slate-400">La sincronizacion automatica esta en espera.</p>
            </div>
          )}

          {timeline?.matches.map((match) => {
            const expanded = expandedMatch === match.matchId;
            const activeRequests = getActiveRequestCount(match.plannedRequests);
            const totalRequests = match.plannedRequests.length;
            return (
              <div key={match.matchId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => setExpandedMatch(expanded ? null : match.matchId)}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Flag url={match.homeFlag} name={match.homeTeam} />
                    <span className="truncate text-sm font-bold text-slate-900">{match.homeTeam}</span>
                    <span className="text-xs font-black text-slate-400">vs</span>
                    <span className="truncate text-sm font-bold text-slate-900">{match.awayTeam}</span>
                    <Flag url={match.awayFlag} name={match.awayTeam} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {match.trackingScope === 'CARRY_OVER' && (
                      <span className="hidden rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700 sm:inline-flex">
                        Arrastre
                      </span>
                    )}
                    <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-black uppercase sm:inline-flex ${STATUS_STYLES[match.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {match.status === 'LIVE' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
                      {match.status}
                    </span>
                    <span className="text-xs text-slate-500">{fmtDateTime(match.matchDate)}</span>
                    {!match.externalId && (
                      <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 sm:inline-flex" title="Este partido no tiene ID externo vinculado — no se puede sincronizar con la API">
                        <AlertTriangle size={9} /> Sin vínculo
                      </span>
                    )}
                    <div className="hidden flex-col items-end sm:flex">
                      <div className="flex items-center gap-1">
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                          ✓ {activeRequests} activo{activeRequests === 1 ? '' : 's'}
                        </span>
                        {totalRequests !== activeRequests && (
                          <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-600" title="Requests desactivados por configuración">
                            −{totalRequests - activeRequests}
                          </span>
                        )}
                      </div>
                      {match.lastSyncStatus && (
                        <span className={`mt-0.5 text-[9px] font-bold ${
                          match.lastSyncStatus === 'SUCCESS' ? 'text-emerald-600' :
                          match.lastSyncStatus === 'FAILED' ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {match.lastSyncStatus === 'SUCCESS' ? '● Último sync OK' :
                           match.lastSyncStatus === 'FAILED' ? '● Último sync falló' : `● ${match.lastSyncStatus}`}
                        </span>
                      )}
                    </div>
                    {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-slate-100 p-4">
                    {/* Estado del último sync */}
                    {(match.lastSyncAt || match.lastSyncStatus) && (
                      <div className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs border ${
                        match.lastSyncStatus === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        match.lastSyncStatus === 'FAILED' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}>
                        {match.lastSyncStatus === 'SUCCESS' ? <CheckCircle2 size={13} /> :
                         match.lastSyncStatus === 'FAILED' ? <XCircle size={13} /> :
                         <MinusCircle size={13} />}
                        <span className="font-bold">
                          {match.lastSyncStatus === 'SUCCESS' ? 'Último sync exitoso' :
                           match.lastSyncStatus === 'FAILED' ? 'Último sync falló' :
                           match.lastSyncStatus ?? 'Sin estado'}
                        </span>
                        {match.lastSyncAt && (
                          <span className="ml-auto opacity-70">{fmtDateTime(match.lastSyncAt)}</span>
                        )}
                        {match.externalId && (
                          <span className="opacity-60">Fixture #{match.externalId}</span>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Consultas planeadas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.plannedRequests.map((planned) => {
                          const disabled = planned.executionState === 'disabled_by_config';
                          return (
                            <span
                              key={planned.id}
                              title={disabled ? `Desactivado: ${planned.disabledReason ?? 'por configuración'}${planned.notes ? ' · ' + planned.notes : ''}` : planned.notes ?? ''}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-opacity ${
                                disabled ? 'opacity-45 grayscale ' + REQUEST_STYLES[planned.type] : REQUEST_STYLES[planned.type]
                              }`}
                            >
                              {disabled ? <XCircle size={9} /> : <Clock size={9} />}
                              {planned.label} · {fmtTime(planned.scheduledAt)}
                              <span className="ml-0.5 font-normal opacity-60">({planned.requestCost} req)</span>
                              {planned.optional && (
                                <span className="ml-1 rounded-full border border-dashed border-current px-1.5 py-0.5 text-[9px] font-black uppercase">
                                  Opcional
                                </span>
                              )}
                              {disabled && (
                                <span className="ml-1 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-600">
                                  OFF
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Notificaciones programadas</p>
                      {match.notificationSchedule.length === 0 ? (
                        <p className="text-[11px] text-slate-400">Sin notificaciones pendientes</p>
                      ) : (
                        <div className="space-y-1.5">
                          {match.notificationSchedule.map((notification) => (
                            <div key={`${match.matchId}-${notification.type}-${notification.scheduledAt}`} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                              <span>{NOTIF_ICON[notification.type]}</span>
                              <span className="flex-1 text-xs font-medium text-slate-700">{notification.label}</span>
                              <span className="text-[11px] font-bold text-slate-500">{fmtDateTime(notification.scheduledAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-5">
          {timeline && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart2 size={14} className="text-sky-500" />
                <p className="text-sm font-black text-slate-900">Mapa de calor horario</p>
                <span
                  title="Cada celda representa una hora del día. El color indica la intensidad de requests planificados. Pasa el cursor para ver detalles."
                  className="ml-auto cursor-help"
                >
                  <Info size={13} className="text-slate-300 hover:text-slate-500" />
                </span>
              </div>
              <HeatmapChart buckets={timeline.requestLog} plannedRequests={timeline.plannedRequests} />
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Activity size={14} className="text-lime-500" />
              <p className="text-sm font-black text-slate-900">Eventos en vivo</p>
              <span className={`ml-auto flex items-center gap-1.5 text-[10px] font-bold ${ sseConnected ? 'text-lime-600' : 'text-slate-400' }`}>
                <span className={`h-2 w-2 rounded-full ${ sseConnected ? 'bg-lime-400 animate-pulse' : 'bg-slate-300' }`} />
                {sseConnected ? 'Conectado' : 'Sin conexión'}
              </span>
            </div>
            {liveEvents.length === 0 ? (
              <p className="text-xs text-slate-400">{sseConnected ? 'Esperando eventos del servidor...' : 'Conectando al stream...'}</p>
            ) : (
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {liveEvents.map((event, index) => {
                  const isError = event.type === 'sync_failed';
                  const isOk = event.type === 'sync_completed';
                  const isWarn = event.type === 'rate_limit_warning';
                  return (
                    <div key={`${event.ts}-${index}`} className={`flex items-start gap-2 rounded-lg px-2 py-1 text-[11px] ${
                      isError ? 'bg-rose-50 text-rose-700' :
                      isOk ? 'bg-emerald-50 text-emerald-700' :
                      isWarn ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-50 text-slate-700'
                    }`}>
                      <span className="shrink-0 font-bold opacity-60">{event.ts}</span>
                      <span>{event.summary}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSyncPlan;
