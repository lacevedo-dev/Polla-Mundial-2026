import React from 'react';
import { Activity, AlertTriangle, Bell, Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, RefreshCw, Wifi, WifiOff, Zap } from 'lucide-react';
import { request, BASE_URL } from '../../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifSchedule {
  type: 'MATCH_REMINDER' | 'PREDICTION_CLOSED' | 'RESULT_PUBLISHED';
  label: string;
  scheduledAt: string;
}

interface MatchSlot {
  matchId: string;
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

interface SyncEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });

const STRATEGY_STYLES: Record<string, { label: string; color: string }> = {
  AGGRESSIVE: { label: 'Agresiva', color: 'bg-rose-100 text-rose-700' },
  BALANCED:   { label: 'Balanceada', color: 'bg-sky-100 text-sky-700' },
  CONSERVATIVE: { label: 'Conservadora', color: 'bg-amber-100 text-amber-700' },
  EMERGENCY:  { label: 'Emergencia', color: 'bg-red-100 text-red-800' },
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  LIVE:      'bg-rose-100 text-rose-700',
  FINISHED:  'bg-emerald-100 text-emerald-700',
  POSTPONED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const NOTIF_ICON: Record<string, React.ReactNode> = {
  MATCH_REMINDER:    <Bell size={11} className="text-sky-500" />,
  PREDICTION_CLOSED: <AlertTriangle size={11} className="text-amber-500" />,
  RESULT_PUBLISHED:  <CheckCircle2 size={11} className="text-emerald-500" />,
};

function Flag({ url, code, name }: { url?: string | null; code?: string | null; name: string }) {
  const src = url || (code ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : null);
  if (!src) return <div className="h-4 w-6 rounded bg-slate-200" aria-hidden="true" />;
  return <img src={src} alt={name} className="h-4 w-6 rounded object-cover border border-slate-200" />;
}

// ─── Bar chart for hourly distribution ───────────────────────────────────────

const HourlyChart: React.FC<{ data: HourBucket[]; limit: number }> = ({ data, limit }) => {
  const maxR = Math.max(...data.map((d) => d.requests), 1);
  const now = new Date().getHours();

  return (
    <div className="mt-3" aria-label="Distribución horaria de requests">
      <div className="flex items-end gap-0.5 h-16">
        {data.map((bucket) => {
          const height = bucket.requests === 0 ? 2 : Math.max(4, (bucket.requests / maxR) * 60);
          const isPast = bucket.hour < now;
          const isCurrent = bucket.hour === now;
          return (
            <div key={bucket.hour} className="group relative flex-1 flex flex-col items-center justify-end">
              <div
                style={{ height: `${height}px` }}
                className={`w-full rounded-sm transition-all ${
                  isCurrent ? 'bg-lime-400' : isPast ? 'bg-slate-200' : 'bg-sky-300 group-hover:bg-sky-400'
                }`}
                aria-label={`${bucket.hour}h: ${bucket.requests} requests`}
              />
              {/* Tooltip */}
              {bucket.requests > 0 && (
                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow">
                  {bucket.hour}h · {bucket.requests}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-slate-400">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
      <p className="mt-1 text-[10px] text-slate-400">Límite diario: {limit} requests</p>
    </div>
  );
};

// ─── Live event feed ──────────────────────────────────────────────────────────

interface LiveEvent { type: string; summary: string; ts: string; }

function eventSummary(type: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'sync_started':    return `Sync iniciado — ${data.matchCount ?? '?'} partidos (${data.triggeredBy ?? ''})`;
    case 'sync_completed':  return `Sync completado — ${data.matchesUpdated ?? 0} actualizados, ${data.requestsUsed ?? 0} requests`;
    case 'sync_failed':     return `Sync fallido: ${data.error ?? 'desconocido'}`;
    case 'match_updated':   return `Partido actualizado (${data.homeScore ?? '?'}-${data.awayScore ?? '?'} · ${data.status})`;
    case 'plan_updated':    return `Plan actualizado: ${data.strategy} · cada ${data.intervalMinutes} min`;
    case 'rate_limit_warning': return `Alerta de límite: ${data.remaining} requests restantes (${data.percentage}% usado)`;
    default:                return type;
  }
}

const EVENT_COLOR: Record<string, string> = {
  sync_started:       'bg-sky-100 text-sky-700',
  sync_completed:     'bg-emerald-100 text-emerald-700',
  sync_failed:        'bg-rose-100 text-rose-700',
  match_updated:      'bg-violet-100 text-violet-700',
  plan_updated:       'bg-amber-100 text-amber-700',
  rate_limit_warning: 'bg-orange-100 text-orange-700',
};

// ─── Main component ───────────────────────────────────────────────────────────

const AdminSyncPlan: React.FC = () => {
  const [timeline, setTimeline] = React.useState<SyncTimeline | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sseConnected, setSseConnected] = React.useState(false);
  const [liveEvents, setLiveEvents] = React.useState<LiveEvent[]>([]);
  const [expandedMatch, setExpandedMatch] = React.useState<string | null>(null);
  const esRef = React.useRef<EventSource | null>(null);

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

  // Connect SSE
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${BASE_URL}/admin/football/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    const TYPES = ['sync_started', 'sync_completed', 'sync_failed', 'match_updated', 'plan_updated', 'rate_limit_warning'];
    TYPES.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(e.data); } catch { /* */ }
        setLiveEvents((prev) => [
          { type, summary: eventSummary(type, data), ts: new Date().toLocaleTimeString('es-CO') },
          ...prev.slice(0, 49),
        ]);
        // Refresh timeline on sync events
        if (type === 'sync_completed' || type === 'plan_updated') {
          void loadTimeline();
        }
      });
    });

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [loadTimeline]);

  React.useEffect(() => { void loadTimeline(); }, [loadTimeline]);

  const strategy = timeline ? STRATEGY_STYLES[timeline.strategy] ?? { label: timeline.strategy, color: 'bg-slate-100 text-slate-600' } : null;
  const usagePct = timeline ? Math.round((timeline.requestsUsed / timeline.requestsLimit) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Plan de Sincronización</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {timeline ? fmtDate(new Date().toISOString()) : 'Cargando…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* SSE indicator */}
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${sseConnected ? 'bg-lime-50 text-lime-700' : 'bg-slate-100 text-slate-500'}`}>
            {sseConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {sseConnected ? 'En vivo' : 'Desconectado'}
          </div>
          <button
            onClick={() => void loadTimeline()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            aria-label="Actualizar plan"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">
          {error}
        </div>
      )}

      {/* Auto-notification schedulers strip */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Procesos automáticos de notificación (siempre activos)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { icon: <Bell size={13} className="text-sky-500" />, label: 'Recordatorio 1h', desc: 'Avisa a todos los miembros de la liga 1 hora antes del partido', color: 'bg-sky-50 border-sky-200' },
            { icon: <AlertTriangle size={13} className="text-amber-500" />, label: 'Cierre predicciones', desc: 'Alerta a quien no ha pronosticado cuando quedan ≤5 min para cierre', color: 'bg-amber-50 border-amber-200' },
            { icon: <CheckCircle2 size={13} className="text-emerald-500" />, label: 'Resultado publicado', desc: 'Notifica puntos obtenidos tras finalizar el partido', color: 'bg-emerald-50 border-emerald-200' },
          ].map((item) => (
            <div key={item.label} className={`flex items-start gap-2.5 rounded-xl border p-3 ${item.color}`}>
              <span className="mt-0.5 shrink-0">{item.icon}</span>
              <div>
                <p className="text-xs font-black text-slate-800">{item.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.desc}</p>
              </div>
              <span className="ml-auto shrink-0 flex items-center gap-1 text-[9px] font-black uppercase text-lime-600 bg-lime-50 border border-lime-200 rounded-full px-1.5 py-0.5">
                <Activity size={8} /> Activo
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {timeline && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Requests used */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Requests hoy</p>
            <p className="mt-1.5 text-2xl font-black text-slate-900">{timeline.requestsUsed}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-1.5 rounded-full transition-all ${usagePct > 90 ? 'bg-rose-400' : usagePct > 70 ? 'bg-amber-400' : 'bg-lime-400'}`}
                style={{ width: `${Math.min(100, usagePct)}%` }}
                role="progressbar"
                aria-valuenow={usagePct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{usagePct}% de {timeline.requestsLimit}</p>
          </div>

          {/* Budget */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Disponibles</p>
            <p className="mt-1.5 text-2xl font-black text-slate-900">{timeline.requestsBudget}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {timeline.totalSlotsPlanned} slots planeados
            </p>
          </div>

          {/* Strategy */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estrategia</p>
            <div className="mt-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${strategy?.color}`}>
                {strategy?.label}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Cada {timeline.intervalMinutes} min</p>
          </div>

          {/* Next sync */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Próximo sync</p>
            <p className="mt-1.5 text-lg font-black text-slate-900">
              {timeline.nextSyncAt ? fmt(timeline.nextSyncAt) : '—'}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {timeline.matches.length} partido{timeline.matches.length !== 1 ? 's' : ''} hoy
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main: matches list */}
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">
            Partidos del día
          </h2>

          {loading && !timeline && (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12">
              <RefreshCw size={20} className="animate-spin text-slate-400" />
            </div>
          )}

          {timeline?.matches.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <Calendar size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-600">No hay partidos para hoy</p>
              <p className="mt-1 text-xs text-slate-400">La sincronización automática está en espera.</p>
            </div>
          )}

          {timeline?.matches.map((match) => {
            const isExpanded = expandedMatch === match.matchId;
            const syncBadge = match.lastSyncStatus === 'SUCCESS'
              ? 'bg-emerald-100 text-emerald-700'
              : match.lastSyncStatus === 'FAILED'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-500';

            return (
              <div
                key={match.matchId}
                className="rounded-[1.25rem] border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedMatch(isExpanded ? null : match.matchId)}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 transition"
                  aria-expanded={isExpanded}
                >
                  {/* Teams */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Flag url={match.homeFlag} name={match.homeTeam} />
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900">{match.homeTeam}</span>
                    <span className="shrink-0 text-xs font-black text-slate-400">vs</span>
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900">{match.awayTeam}</span>
                    <Flag url={match.awayFlag} name={match.awayTeam} />
                  </div>

                  {/* Meta */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_COLOR[match.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {match.status}
                    </span>
                    <span className="text-xs text-slate-500">{fmt(match.matchDate)}</span>
                    {!match.externalId && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
                        <AlertTriangle size={9} /> Sin vínculo
                      </span>
                    )}
                    <span className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${syncBadge}`}>
                      {match.requestsAssigned} req
                    </span>
                    {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    {/* Sync slots timeline */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                        Slots de sincronización ({match.syncSlots.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.syncSlots.slice(0, 20).map((slot) => {
                          const isPast = new Date(slot) < new Date();
                          return (
                            <span
                              key={slot}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                                isPast
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              <Clock size={9} />
                              {fmt(slot)}
                            </span>
                          );
                        })}
                        {match.syncSlots.length > 20 && (
                          <span className="text-[10px] text-slate-400">+{match.syncSlots.length - 20} más</span>
                        )}
                      </div>
                    </div>

                    {/* Notification schedule */}
                    {match.notificationSchedule.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                          Notificaciones programadas
                        </p>
                        <div className="space-y-1.5">
                          {match.notificationSchedule.map((n, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                              <span className="shrink-0">{NOTIF_ICON[n.type]}</span>
                              <span className="flex-1 text-xs font-medium text-slate-700">{n.label}</span>
                              <span className="text-[11px] font-bold text-slate-500">{fmt(n.scheduledAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sync meta */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      {match.externalId && <span>Fixture: <strong className="text-slate-700">{match.externalId}</strong></span>}
                      {match.lastSyncAt && <span>Último sync: <strong className="text-slate-700">{fmt(match.lastSyncAt)}</strong></span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar: chart + live events */}
        <div className="space-y-5">
          {/* Hourly chart */}
          {timeline && (
            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                <p className="text-sm font-black text-slate-900">Distribución horaria</p>
              </div>
              <HourlyChart data={timeline.requestLog} limit={timeline.requestsLimit} />
              <div className="mt-3 flex gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-lime-400" /> Ahora</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-slate-200" /> Pasado</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-sky-300" /> Pendiente</span>
              </div>
            </div>
          )}

          {/* Live event feed */}
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-lime-500" />
              <p className="text-sm font-black text-slate-900">Eventos en vivo</p>
              {sseConnected && (
                <span className="ml-auto inline-block h-2 w-2 rounded-full bg-lime-400 animate-pulse" aria-label="Conectado" />
              )}
            </div>

            {liveEvents.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">
                {sseConnected
                  ? 'Esperando eventos del servidor...'
                  : 'Conectando al stream de eventos...'}
              </p>
            ) : (
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" aria-live="polite" aria-label="Eventos de sincronización en vivo">
                {liveEvents.map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-[10px] font-bold text-slate-400 tabular-nums">{ev.ts}</span>
                    <span className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${EVENT_COLOR[ev.type] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ev.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-700 leading-snug">{ev.summary}</span>
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
