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
} from 'lucide-react';
import { BASE_URL, request } from '../../api';

interface NotifSchedule {
  type: 'MATCH_REMINDER' | 'PREDICTION_CLOSED' | 'RESULT_PUBLISHED';
  label: string;
  scheduledAt: string;
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
  requestLog: HourBucket[];
  totalSlotsPlanned: number;
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

function MiniChart({ buckets }: { buckets: HourBucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.requests), 1);
  return (
    <div className="space-y-2">
      <div className="flex h-20 items-end gap-1">
        {buckets.map((bucket) => {
          const height = bucket.requests === 0 ? 4 : Math.max(8, (bucket.requests / max) * 80);
          return (
            <div key={bucket.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm ${bucket.requests > 0 ? 'bg-sky-400' : 'bg-slate-200'}`}
                style={{ height }}
                title={`${bucket.hour}:00 - ${bucket.requests} requests`}
              />
              <span className="text-[9px] text-slate-400">{String(bucket.hour).padStart(2, '0')}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">Distribucion horaria de requests planificados.</p>
    </div>
  );
}

function Flag({ url, name }: { url?: string | null; name: string }) {
  if (!url) {
    return <div className="h-4 w-6 rounded bg-slate-200" aria-hidden="true" />;
  }
  return <img src={url} alt={name} className="h-4 w-6 rounded border border-slate-200 object-cover" />;
}

const AdminSyncPlan: React.FC = () => {
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
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
            <p className="mt-1 text-xs text-slate-500">{timeline.totalSlotsPlanned} slots planeados</p>
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
                      {match.status}
                    </span>
                    <span className="text-xs text-slate-500">{fmtDateTime(match.matchDate)}</span>
                    {!match.externalId && (
                      <span className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 sm:inline-flex">
                        <AlertTriangle size={9} /> Sin vinculo
                      </span>
                    )}
                    <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 sm:inline-flex">
                      {match.requestsAssigned} req
                    </span>
                    {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-slate-100 p-4">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Slots de sincronizacion</p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.syncSlots.map((slot) => (
                          <span key={slot} className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
                            <Clock size={9} />
                            {fmtDateTime(slot)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Notificaciones</p>
                      <div className="space-y-2">
                        {match.notificationSchedule.map((notification) => (
                          <div key={`${match.matchId}-${notification.type}-${notification.scheduledAt}`} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span>{NOTIF_ICON[notification.type]}</span>
                            <span className="flex-1 text-xs font-medium text-slate-700">{notification.label}</span>
                            <span className="text-[11px] font-bold text-slate-500">{fmtDateTime(notification.scheduledAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                      {match.externalId && <span>Fixture: <strong className="text-slate-700">{match.externalId}</strong></span>}
                      {match.lastSyncAt && <span>Ultimo sync: <strong className="text-slate-700">{fmtDateTime(match.lastSyncAt)}</strong></span>}
                      {match.lastSyncStatus && <span>Estado sync: <strong className="text-slate-700">{match.lastSyncStatus}</strong></span>}
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
              <div className="mb-3 flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                <p className="text-sm font-black text-slate-900">Distribucion horaria</p>
              </div>
              <MiniChart buckets={timeline.requestLog} />
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Activity size={14} className="text-lime-500" />
              <p className="text-sm font-black text-slate-900">Eventos en vivo</p>
              {sseConnected && <span className="ml-auto h-2 w-2 rounded-full bg-lime-400" />}
            </div>
            {liveEvents.length === 0 ? (
              <p className="text-xs text-slate-400">{sseConnected ? 'Esperando eventos del servidor...' : 'Conectando al stream...'}</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {liveEvents.map((event, index) => (
                  <div key={`${event.ts}-${index}`} className="flex gap-2">
                    <span className="shrink-0 text-[10px] font-bold text-slate-400">{event.ts}</span>
                    <span className="text-[11px] text-slate-700">{event.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSyncPlan;