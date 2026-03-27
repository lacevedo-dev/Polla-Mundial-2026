import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Phone,
  RefreshCw,
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

function EventCell({ ev }: { ev: EventState & { scheduledAt: string | null } }) {
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
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600">
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

function MatrixRow({ match, expanded, onExpand }: { match: MatrixMatch; expanded: boolean; onExpand: (id: string) => void }) {
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

        <div className="flex justify-center"><EventCell ev={match.events.reminder} /></div>
        <div className="flex justify-center"><EventCell ev={match.events.closing} /></div>
        <div className="flex justify-center"><EventCell ev={match.events.result} /></div>
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

function PushTestPanel() {
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Validar notificaciones push</p>
          <p className="text-xs text-slate-500">Envía una notificación de prueba a tu dispositivo para verificar que VAPID está configurado correctamente.</p>
        </div>
        <button
          onClick={handleTest}
          disabled={loading}
          className="shrink-0 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
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
  if (devices === 0) return <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-400">Sin dispositivos</span>;
  if (sent && sent > 0) return <span className="inline-flex items-center gap-1 rounded-full border border-lime-200 bg-lime-50 px-2 py-0.5 text-[10px] font-black text-lime-700"><CheckCircle2 size={10} /> Push {sent}/{devices}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700"><XCircle size={10} /> Push falló {failed}/{devices}</span>;
}

function HistoryRow({ notification: n }: { notification: NotifRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="cursor-pointer border-b border-slate-200 last:border-0 hover:bg-slate-50" onClick={() => setExpanded((v) => !v)}>
      <div className="grid items-start gap-x-3 px-4 py-3" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto' }}>
        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${TYPE_BADGES[n.type] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>
          {TYPE_LABELS[n.type] ?? n.type}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{n.body}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{n.user.name} — {n.user.email}</p>
          {n.trigger && <p className="mt-0.5 truncate text-[10px] text-slate-400 italic">↳ {n.trigger}</p>}
        </div>
        <PushBadge sent={n.pushSent} failed={n.pushFailed} devices={n.pushDevices} />
        <span className="whitespace-nowrap text-xs text-slate-500">{fmtFull(n.sentAt)}</span>
      </div>
      {expanded && (
        <div className="space-y-1 bg-slate-50 px-4 pb-3 pt-2 text-xs text-slate-600">
          <p><span className="font-semibold text-slate-500">Título: </span>{n.title}</p>
          {n.trigger && <p><span className="font-semibold text-slate-500">Motivo: </span>{n.trigger}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <PushBadge sent={n.pushSent} failed={n.pushFailed} devices={n.pushDevices} />
            {n.whatsapp !== null && (
              n.whatsapp
                ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700"><CheckCircle2 size={10} /> WhatsApp</span>
                : <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-400">Sin WhatsApp</span>
            )}
          </div>
          {n.matchId && <p><span className="text-slate-500">Partido: </span><span className="font-mono text-slate-700">{n.matchId}</span></p>}
          {n.leagueId && <p><span className="text-slate-500">Liga: </span><span className="font-mono text-slate-700">{n.leagueId}</span></p>}
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
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{info.description}</p>
    </div>
  );
}

function SchedulerCard({ scheduler, channelStatus }: { scheduler: SchedulerDef; channelStatus: AutomationStatus['channels'] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{scheduler.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{scheduler.name}</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${TYPE_BADGES[scheduler.notifType] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>
              {TYPE_LABELS[scheduler.notifType] ?? scheduler.notifType}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-700"><Activity size={12} /> Activo</span>
      </div>

      <div className="mt-3 space-y-2 text-xs text-slate-500">
        <p><span className="font-semibold text-slate-700">Frecuencia: </span>{scheduler.description}</p>
        <p><span className="font-semibold text-slate-700">Audiencia: </span>{scheduler.audience}</p>
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Procesos automáticos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revisa canales, tipos de notificación, matriz diaria e historial sin duplicar el panel de sync independiente.
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
                  <MatrixRow key={match.id} match={match} expanded={expandedMatch === match.id} onExpand={(id) => setExpandedMatch((current) => current === id ? null : id)} />
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
          {/* Botón de prueba de push */}
          <PushTestPanel />
        </div>
      )}
    </div>
  );
}