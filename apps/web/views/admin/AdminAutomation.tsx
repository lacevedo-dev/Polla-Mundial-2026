import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react';
import { request } from '../../api';

interface ChannelInfo {
  enabled: boolean;
  description: string;
  subscriberCount?: number;
  usersWithPhone?: number;
}

interface SchedulerDef {
  id: string;
  name: string;
  cron: string;
  description: string;
  notifType: string;
  icon: string;
  audience: string;
  channels: string[];
}

interface AutomationStatus {
  channels: Record<string, ChannelInfo>;
  schedulers: SchedulerDef[];
  stats: { notifLast24h: number; pushSubscribers: number; usersWithPhone: number };
}

interface EventState {
  scheduledAt: string;
  sentCount: number;
  done: boolean;
  lastSentAt: string | null;
  overdue: boolean;
  closeMinutes?: number;
}

interface MatrixMatch {
  id: string;
  trackingScope?: 'TODAY' | 'CARRY_OVER';
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  status: string;
  tournament: string | null;
  events: {
    reminder: EventState;
    closing: EventState;
    result: EventState & { scheduledAt: string | null };
  };
}

interface TodayMatrix {
  date: string;
  matches: MatrixMatch[];
}

interface NotifRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  channel: string;
  sentAt: string;
  user: { name: string; email: string };
  // campos enriquecidos por el backend desde el JSON data
  matchId:     string | null;
  leagueId:    string | null;
  trigger:     string | null;
  pushSent:    number | null;
  pushFailed:  number | null;
  pushDevices: number | null;
  whatsapp:    boolean | null;
}

interface HistoryResponse {
  countByType: Record<string, number>;
  recent: NotifRecord[];
  total: number;
  page: number;
  limit: number;
}

type TabId = 'matrix' | 'history' | 'schedulers' | 'channels';

interface IncidentInfo {
  match: MatrixMatch;
  eventKey: 'reminder' | 'closing' | 'result';
  label: string;
  step: string;
}

interface RetryResult {
  ok: boolean;
  runId: string | null;
  summary: string;
}

const TYPE_LABELS: Record<string, string> = {
  MATCH_REMINDER: 'Recordatorio 1h',
  PREDICTION_CLOSED: 'Cierre predicciones',
  RESULT_PUBLISHED: 'Resultado publicado',
};

const TYPE_BADGES: Record<string, string> = {
  MATCH_REMINDER: 'border-sky-200 bg-sky-50 text-sky-700',
  PREDICTION_CLOSED: 'border-amber-200 bg-amber-50 text-amber-700',
  RESULT_PUBLISHED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  inApp: { label: 'In-App', icon: <Bell size={14} /> },
  push: { label: 'Push', icon: <Smartphone size={14} /> },
  whatsapp: { label: 'WhatsApp', icon: <MessageSquare size={14} /> },
  sms: { label: 'SMS', icon: <Phone size={14} /> },
  email: { label: 'Email', icon: <Send size={14} /> },
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  LIVE: 'En curso',
  FINISHED: 'Finalizado',
  POSTPONED: 'Postergado',
  CANCELLED: 'Cancelado',
};

const STATUS_BADGES: Record<string, string> = {
  SCHEDULED: 'border-blue-200 bg-blue-50 text-blue-700',
  LIVE: 'border-rose-200 bg-rose-50 text-rose-700',
  FINISHED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  POSTPONED: 'border-amber-200 bg-amber-50 text-amber-700',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-600',
};

function repairMojibake(value: string) {
  if (!/[\u00C3\u00C2\u00E2]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return decoded.includes('\uFFFD') ? value : decoded;
  } catch {
    return value;
  }
}

function text(value?: string | null) {
  if (!value) return '';
  return repairMojibake(value);
}

function TimeFrameCard({
  icon,
  title,
  timezone,
  description,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  timezone: string;
  description: string;
  detail: string;
  tone: 'sky' | 'amber';
}) {
  const tones = {
    sky: {
      wrapper: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white',
      chip: 'border-sky-200 bg-white text-sky-700',
      title: 'text-sky-900',
      icon: 'bg-sky-100 text-sky-700',
      detail: 'text-sky-700/80',
    },
    amber: {
      wrapper: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
      chip: 'border-amber-200 bg-white text-amber-700',
      title: 'text-amber-900',
      icon: 'bg-amber-100 text-amber-700',
      detail: 'text-amber-700/80',
    },
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones.wrapper}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-xl p-2 ${tones.icon}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-black tracking-tight ${tones.title}`}>{title}</p>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${tones.chip}`}>
              {timezone}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
          <p className={`mt-2 text-[11px] font-semibold uppercase tracking-widest ${tones.detail}`}>{detail}</p>
        </div>
      </div>
    </div>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function EventCell({
  ev,
  onOverdueClick,
}: {
  ev: EventState & { scheduledAt: string | null };
  onOverdueClick?: () => void;
}) {
  const time = ev.scheduledAt;

  if (ev.done) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          Enviado {ev.sentCount}
        </span>
        {ev.lastSentAt && <span className="text-[10px] text-slate-500">{fmtTime(ev.lastSentAt)}</span>}
      </div>
    );
  }

  if (ev.overdue) {
    return (
      <div
        className="flex flex-col items-center gap-1 cursor-pointer"
        onClick={onOverdueClick}
        title={onOverdueClick ? 'Click para ver detalle y reintentar' : undefined}
      >
        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600 transition hover:ring-2 hover:ring-red-300/40">
          Pendiente
        </span>
        {time && <span className="text-[10px] text-slate-500">{fmtTime(time)}</span>}
      </div>
    );
  }

  if (!time) return <span className="text-sm text-slate-400">—</span>;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
        <Clock size={9} /> {fmtTime(time)}
      </span>
    </div>
  );
}

function MatrixRow({
  match,
  expanded,
  onExpand,
  onIncident,
}: {
  match: MatrixMatch;
  expanded: boolean;
  onExpand: (id: string) => void;
  onIncident?: (info: IncidentInfo) => void;
}) {
  const makeIncidentHandler = (eventKey: 'reminder' | 'closing' | 'result', label: string, step: string) =>
    onIncident ? () => onIncident({ match, eventKey, label, step }) : undefined;

  return (
    <>
      <div
        className="grid cursor-pointer items-center px-4 py-3 transition-colors hover:bg-slate-50"
        style={{ gridTemplateColumns: 'minmax(0,1.2fr) auto 1fr 1fr 1fr 1.2rem' }}
        onClick={() => onExpand(match.id)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">
              {match.homeTeam} vs {match.awayTeam}
            </p>
            {match.trackingScope === 'CARRY_OVER' && (
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700">
                Arrastre
              </span>
            )}
          </div>
          {match.tournament && <p className="truncate text-[10px] text-slate-500">{match.tournament}</p>}
        </div>

        <div className="flex flex-col items-center gap-1 px-3">
          <span className="text-sm font-bold text-slate-700">{fmtTime(match.matchDate)}</span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_BADGES[match.status] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            {STATUS_LABELS[match.status] ?? match.status}
          </span>
        </div>

        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}><EventCell ev={match.events.reminder} onOverdueClick={makeIncidentHandler('reminder', 'Recordatorio', 'MATCH_REMINDER')} /></div>
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}><EventCell ev={match.events.closing} onOverdueClick={makeIncidentHandler('closing', 'Cierre predicciones', 'PREDICTION_CLOSING')} /></div>
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}><EventCell ev={match.events.result} onOverdueClick={makeIncidentHandler('result', 'Resultado', 'RESULT_NOTIFICATION')} /></div>
        <div className="flex justify-end text-slate-400">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 pb-4">
          <div className="grid gap-3 pt-3 md:grid-cols-3">
            {([
              { key: 'reminder', label: 'Recordatorio', type: 'MATCH_REMINDER' },
              { key: 'closing', label: 'Cierre de predicciones', type: 'PREDICTION_CLOSED' },
              { key: 'result', label: 'Resultado', type: 'RESULT_PUBLISHED' },
            ] as const).map(({ key, label, type }) => {
              const ev = match.events[key];
              return (
                <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${TYPE_BADGES[type]}`}>{label}</p>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <p><span className="text-slate-500">Programado: </span>{ev.scheduledAt ? fmtFull(ev.scheduledAt) : '—'}</p>
                    <p><span className="text-slate-500">Enviadas: </span><span className={ev.sentCount > 0 ? 'font-bold text-emerald-700' : 'text-slate-500'}>{ev.sentCount}</span></p>
                    {ev.lastSentAt && <p><span className="text-slate-500">Último envío: </span>{fmtFull(ev.lastSentAt)}</p>}
                    {'closeMinutes' in ev && ev.closeMinutes !== undefined && <p><span className="text-slate-500">Cierre configurado: </span>{ev.closeMinutes} min antes</p>}
                    {ev.overdue && <p className="font-semibold text-red-600">No se ha enviado y ya venció la ventana.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function PushTestPanel({ pushSubscribers, pushEnabled }: { pushSubscribers: number; pushEnabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await request<{ ok: boolean; message: string }>('/admin/automation/test-push', { method: 'POST' });
      setResult(res);
    } catch {
      setResult({ ok: false, message: 'Error al enviar push de prueba.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Validar notificaciones push</p>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
              pushEnabled ? 'border-lime-200 bg-lime-50 text-lime-700' : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              {pushEnabled ? 'VAPID activo' : 'VAPID inactivo'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {pushSubscribers.toLocaleString()} suscripci{pushSubscribers === 1 ? 'ón' : 'ones'}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Envía una notificación de prueba al usuario autenticado para verificar que la configuración push responde.
            Si tu navegador no tiene una suscripción activa, no vas a ver nada aunque el sistema tenga otros dispositivos registrados.
          </p>
        </div>
        <button
          onClick={handleTest}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          <Send size={13} />
          {loading ? 'Enviando...' : 'Probar push'}
        </button>
      </div>
      {result && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${result.ok ? 'border-lime-200 bg-lime-50 text-lime-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}

function PushBadge({ sent, failed, devices }: { sent: number | null; failed: number | null; devices: number | null }) {
  if (devices === null) return <span className="text-[10px] text-slate-400">—</span>;
  if (devices === 0) return <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-400">Sin suscripciones</span>;
  if (sent && sent > 0) return <span className="inline-flex items-center gap-1 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[10px] font-black text-lime-700"><CheckCircle2 size={10} /> Push {sent}/{devices}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700"><XCircle size={10} /> Push falló {failed}/{devices}</span>;
}

function HistoryRow({ notification: n }: { notification: NotifRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="cursor-pointer border-b border-slate-200 last:border-0 hover:bg-slate-50" onClick={() => setExpanded((v) => !v)}>
      <div className="grid items-start gap-x-3 px-4 py-3" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto' }}>
        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${TYPE_BADGES[n.type] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>
          {TYPE_LABELS[n.type] ?? text(n.type)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{text(n.body)}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{text(n.user.name)} — {text(n.user.email)}</p>
          {n.trigger && <p className="mt-0.5 truncate text-[10px] text-slate-400 italic">↳ {text(n.trigger)}</p>}
        </div>
        <PushBadge sent={n.pushSent} failed={n.pushFailed} devices={n.pushDevices} />
        <span className="whitespace-nowrap text-xs text-slate-500">{fmtFull(n.sentAt)}</span>
      </div>
      {expanded && (
        <div className="space-y-1 bg-slate-50 px-4 pb-3 pt-2 text-xs text-slate-600">
          <p><span className="font-semibold text-slate-500">Título: </span>{text(n.title)}</p>
          {n.trigger && <p><span className="font-semibold text-slate-500">Motivo: </span>{text(n.trigger)}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <PushBadge sent={n.pushSent} failed={n.pushFailed} devices={n.pushDevices} />
            {n.whatsapp !== null && (
              n.whatsapp
                ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700"><CheckCircle2 size={10} /> WhatsApp</span>
                : <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-400">Sin WhatsApp</span>
            )}
          </div>
          {n.matchId && <p><span className="text-slate-500">Partido: </span><span className="font-mono text-slate-700">{text(n.matchId)}</span></p>}
          {n.leagueId && <p><span className="text-slate-500">Liga: </span><span className="font-mono text-slate-700">{text(n.leagueId)}</span></p>}
        </div>
      )}
    </div>
  );
}

function ChannelCard({ id, info }: { id: string; info: ChannelInfo }) {
  const meta = CHANNEL_META[id];
  return (
    <div className={`rounded-xl border p-4 ${info.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="text-slate-500">{meta?.icon}</span>
          {meta?.label ?? id}
        </div>
        {info.enabled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-700"><CheckCircle2 size={12} /> Activo</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500"><XCircle size={12} /> Inactivo</span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{text(info.description)}</p>
      {typeof info.subscriberCount === 'number' && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {info.subscriberCount.toLocaleString()} suscripci{info.subscriberCount === 1 ? 'ón' : 'ones'} push
        </p>
      )}
      {typeof info.usersWithPhone === 'number' && (
        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {info.usersWithPhone.toLocaleString()} usuarios con teléfono
        </p>
      )}
    </div>
  );
}

function SchedulerCard({ scheduler, channelStatus }: { scheduler: SchedulerDef; channelStatus: AutomationStatus['channels'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{text(scheduler.icon)}</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{text(scheduler.name)}</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${TYPE_BADGES[scheduler.notifType] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>
              {TYPE_LABELS[scheduler.notifType] ?? scheduler.notifType}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-700"><Activity size={12} /> Activo</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-slate-500">
          {scheduler.cron}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-xs text-slate-500">
        <p><span className="font-semibold text-slate-700">Frecuencia: </span>{text(scheduler.description)}</p>
        <p><span className="font-semibold text-slate-700">Audiencia: </span>{text(scheduler.audience)}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3">
        {scheduler.channels.map((channel) => {
          const active = channelStatus[channel]?.enabled ?? false;
          const meta = CHANNEL_META[channel];
          return (
            <span
              key={channel}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${active ? 'border-lime-200 bg-lime-50 text-lime-700' : 'border-slate-200 bg-slate-100 text-slate-400 line-through'}`}
            >
              {meta?.icon}
              {meta?.label ?? channel}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function guessErrorSuggestion(isOverdue: boolean, hasDone: boolean): string | null {
  if (isOverdue && !hasDone) return 'Este paso no se ejecutó cuando correspondía. Podría ser un fallo del scheduler o un lock de concurrencia. Usá el botón de reintento manual.';
  return null;
}

function IncidentModal({ incident, onClose, onRefresh }: { incident: IncidentInfo; onClose: () => void; onRefresh: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);

  const eventState = incident.match.events[incident.eventKey] as EventState & { scheduledAt: string | null };
  const suggestion = guessErrorSuggestion(eventState.overdue, eventState.done);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      const result = await request<RetryResult>('/admin/automation/retry', {
        method: 'POST',
        body: JSON.stringify({ matchId: incident.match.id, step: incident.step }),
      });
      setRetryResult(result);
      if (result.ok) setTimeout(() => { onRefresh(); }, 1500);
    } catch (err: unknown) {
      setRetryResult({ ok: false, runId: null, summary: err instanceof Error ? err.message : 'Error desconocido' });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-500" />
              <p className="text-sm font-black text-slate-900">Paso sin ejecutar</p>
              <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-700">{incident.label}</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{incident.match.homeTeam} vs {incident.match.awayTeam}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Detalle del evento</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <p><span className="text-slate-400">Programado: </span>{eventState.scheduledAt ? fmtFull(eventState.scheduledAt) : '—'}</p>
              <p><span className="text-slate-400">Enviados: </span>{eventState.sentCount}</p>
              <p><span className="text-slate-400">Partido: </span>{incident.match.status}</p>
              <p><span className="text-slate-400">Ejecutado: </span>{eventState.done ? 'Sí' : 'No'}</p>
            </div>
          </div>

          {suggestion && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Diagnóstico</p>
              <p className="text-xs text-amber-800">{suggestion}</p>
            </div>
          )}

          {retryResult && (
            <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${retryResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {retryResult.ok ? '✓' : '✗'} {retryResult.summary}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Cerrar</button>
          {!retryResult?.ok && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              <RotateCcw size={12} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Reintentando...' : 'Reintentar manualmente'}
            </button>
          )}
          {retryResult?.ok && (
            <button onClick={() => { onClose(); onRefresh(); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">
              <CheckCircle2 size={12} /> Actualizar panel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAutomation() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [matrix, setMatrix] = useState<TodayMatrix | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tab, setTab] = useState<TabId>('matrix');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [historyType, setHistoryType] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [incident, setIncident] = useState<IncidentInfo | null>(null);

  const loadBase = async () => {
    setLoading(true);
    try {
      const [statusResponse, matrixResponse] = await Promise.all([
        request<AutomationStatus>('/admin/automation/status'),
        request<TodayMatrix>('/admin/automation/today-matrix'),
      ]);
      setStatus(statusResponse);
      setMatrix(matrixResponse);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (type: string, page: number) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (type) params.set('type', type);
      const response = await request<HistoryResponse>(`/admin/automation/history?${params.toString()}`);
      setHistory(response);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (tab === 'history') void loadHistory(historyType, historyPage);
  }, [tab, historyType, historyPage]);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'matrix', label: 'Matriz del día' },
    { id: 'history', label: 'Historial 24h' },
    { id: 'schedulers', label: 'Tipos / schedulers' },
    { id: 'channels', label: 'Canales' },
  ];

  const timeFrames = [
    {
      icon: <Clock size={16} />,
      title: 'Día operativo de partidos',
      timezone: 'America/Bogota',
      description: 'La matriz diaria, la sincronización de partidos y la lógica de eventos trabajan sobre el día de Bogotá.',
      detail: 'Ventana operativa: 00:00–23:59 hora Bogotá',
      tone: 'sky' as const,
    },
    {
      icon: <RefreshCw size={16} />,
      title: 'Reset de cuota de requests',
      timezone: '00:00 UTC',
      description: 'La API reinicia su cuota exactamente a medianoche UTC. El presupuesto de requests debe leerse con ese corte.',
      detail: 'Equivale a 19:00 del día anterior en Bogotá',
      tone: 'amber' as const,
    },
  ];

  const filteredMatches = useMemo(() => {
    if (!matrix) return [];
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return matrix.matches;
    return matrix.matches.filter((match) =>
      match.homeTeam.toLowerCase().includes(q) ||
      match.awayTeam.toLowerCase().includes(q) ||
      (match.tournament ?? '').toLowerCase().includes(q),
    );
  }, [matrix, matrixSearch]);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    const q = historySearch.trim().toLowerCase();
    if (!q) return history.recent;
    return history.recent.filter((notification) =>
      notification.body.toLowerCase().includes(q) ||
      notification.title.toLowerCase().includes(q) ||
      notification.user.name.toLowerCase().includes(q) ||
      notification.user.email.toLowerCase().includes(q),
    );
  }, [history, historySearch]);

  const totalPages = history ? Math.ceil(history.total / history.limit) : 1;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      {incident && <IncidentModal incident={incident} onClose={() => setIncident(null)} onRefresh={loadBase} />}
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Procesos automáticos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revisa canales, tipos de notificación, matriz diaria e historial sin duplicar el panel de sync independiente.
            La operación de partidos sigue America/Bogota y la cuota de requests corta a las 00:00 UTC.
          </p>
        </div>
        <button
          onClick={loadBase}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black tracking-tight text-slate-900">Ventanas de tiempo que usa la automatización</p>
            <p className="mt-1 text-xs text-slate-500">
              Importante: una cosa es el día operativo de los partidos y otra distinta es el reset de cuota de la API.
            </p>
          </div>
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Bogotá ≠ UTC
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {timeFrames.map((frame) => (
            <TimeFrameCard key={frame.title} {...frame} />
          ))}
        </div>
      </div>

      {status && (
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { label: 'Notif. 24h', value: status.stats.notifLast24h, icon: <Bell size={15} /> },
            { label: 'Dispositivos push', value: status.stats.pushSubscribers, icon: <Smartphone size={15} /> },
            { label: 'Usuarios con teléfono', value: status.stats.usersWithPhone, icon: <Phone size={15} /> },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">{item.icon}</div>
              <div>
                <p className="text-xl font-black text-slate-900">{item.value.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${tab === item.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-700'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {matrix ? (
                <>
                  <span className="font-semibold text-slate-800">
                    {new Date(`${matrix.date}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  {' · '}{matrix.matches.length} partido{matrix.matches.length !== 1 ? 's' : ''}
                </>
              ) : 'Cargando matriz...'}
            </div>
            <div className="relative w-full sm:w-56">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={matrixSearch}
                onChange={(event) => setMatrixSearch(event.target.value)}
                placeholder="Buscar equipo o torneo..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
              {matrixSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setMatrixSearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {filteredMatches.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ gridTemplateColumns: 'minmax(0,1.2fr) auto 1fr 1fr 1fr 1.2rem' }}>
                <span>Partido</span>
                <span className="px-3">Hora</span>
                <span className="text-center">Recordatorio</span>
                <span className="text-center">Cierre</span>
                <span className="text-center">Resultado</span>
                <span />
              </div>
              <div className="divide-y divide-slate-200">
                {filteredMatches.map((match) => (
                  <MatrixRow key={match.id} match={match} expanded={expandedMatch === match.id} onExpand={(id) => setExpandedMatch((current) => current === id ? null : id)} onIncident={setIncident} />
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              No hay partidos que coincidan con la búsqueda.
            </div>
          ) : null}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { value: '', label: 'Todos' },
                { value: 'MATCH_REMINDER', label: 'Recordatorios' },
                { value: 'PREDICTION_CLOSED', label: 'Cierres' },
                { value: 'RESULT_PUBLISHED', label: 'Resultados' },
              ].map((item) => (
                <button
                  key={item.value || 'all'}
                  onClick={() => { setHistoryType(item.value); setHistoryPage(1); }}
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${historyType === item.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 shadow-sm hover:bg-slate-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Buscar usuario o mensaje..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
              {historySearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setHistorySearch('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {historyLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <RefreshCw size={20} className="mx-auto animate-spin text-slate-400" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {filteredHistory.map((notification) => (
                  <HistoryRow key={notification.id} notification={notification} />
                ))}
              </div>
              {history && totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{history.total} registros · página {historyPage} de {totalPages}</span>
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>Anterior</button>
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50" disabled={historyPage >= totalPages} onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))}>Siguiente</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              No hay notificaciones para mostrar en este filtro.
            </div>
          )}
        </div>
      )}

      {tab === 'schedulers' && status && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {status.schedulers.map((scheduler) => (
            <SchedulerCard key={scheduler.id} scheduler={scheduler} channelStatus={status.channels} />
          ))}
        </div>
      )}

      {tab === 'channels' && status && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(status.channels).map(([id, info]) => (
              <ChannelCard key={id} id={id} info={info} />
            ))}
          </div>
          <PushTestPanel pushSubscribers={status.stats.pushSubscribers} pushEnabled={status.channels.push?.enabled ?? false} />
        </div>
      )}
      </div>
    </div>
  );
}
