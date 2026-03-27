import React, { useEffect, useState } from 'react';
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
import AdminSyncPlan from './AdminSyncPlan';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface HistoryResponse {
  countByType: Record<string, number>;
  recent: NotifRecord[];
  total: number;
  page: number;
  limit: number;
}

type TabId = 'sync' | 'matrix' | 'history' | 'schedulers' | 'channels';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  MATCH_REMINDER: 'Recordatorio',
  PREDICTION_CLOSED: 'Cierre',
  RESULT_PUBLISHED: 'Resultado',
};

const TYPE_ICONS: Record<string, string> = {
  MATCH_REMINDER: '⏰',
  PREDICTION_CLOSED: '⚠️',
  RESULT_PUBLISHED: '✅',
};

const TYPE_COLORS: Record<string, string> = {
  MATCH_REMINDER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PREDICTION_CLOSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  RESULT_PUBLISHED: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
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

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'text-slate-400',
  LIVE: 'text-lime-400',
  FINISHED: 'text-slate-500',
  POSTPONED: 'text-amber-400',
  CANCELLED: 'text-red-400',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Bogota',
  });
}

// ─── Event Cell ──────────────────────────────────────────────────────────────

function EventCell({
  ev,
  scheduledAt,
}: {
  ev: EventState & { scheduledAt: string | null };
  scheduledAt?: string;
}) {
  const time = scheduledAt ?? ev.scheduledAt ?? null;

  if (ev.done) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/20 text-[10px] font-black uppercase tracking-widest">
          ✓ {ev.sentCount}
        </span>
        {ev.lastSentAt && (
          <span className="text-[10px] text-slate-500">{fmtTime(ev.lastSentAt)}</span>
        )}
      </div>
    );
  }

  if (ev.overdue) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-widest">
          Sin enviar
        </span>
        {time && <span className="text-[10px] text-slate-500">{fmtTime(time)}</span>}
      </div>
    );
  }

  if (!time) {
    return <span className="text-slate-600 text-sm">—</span>;
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-700 text-[10px] font-black uppercase tracking-widest">
        <Clock size={9} /> {fmtTime(time)}
      </span>
    </div>
  );
}

// ─── Matrix Row ───────────────────────────────────────────────────────────────

function MatrixRow({
  match,
  onExpand,
  expanded,
}: {
  match: MatrixMatch;
  onExpand: (id: string) => void;
  expanded: boolean;
}) {
  return (
    <>
      <div
        className="grid items-center px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
        style={{ gridTemplateColumns: '1fr auto 1fr 1fr 1fr 1.2rem' }}
        onClick={() => onExpand(match.id)}
      >
        {/* Partido */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">
            {match.homeTeam} vs {match.awayTeam}
          </p>
          {match.tournament && (
            <p className="text-[10px] text-slate-500 truncate">{match.tournament}</p>
          )}
        </div>

        {/* Hora + estado */}
        <div className="flex flex-col items-center gap-0.5 px-3">
          <span className="text-sm font-bold text-slate-300">{fmtTime(match.matchDate)}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[match.status] ?? 'text-slate-500'}`}>
            {STATUS_LABELS[match.status] ?? match.status}
          </span>
        </div>

        {/* ⏰ Recordatorio */}
        <div className="flex justify-center">
          <EventCell ev={match.events.reminder} />
        </div>

        {/* ⚠️ Cierre */}
        <div className="flex justify-center">
          <EventCell ev={match.events.closing} />
        </div>

        {/* ✅ Resultado */}
        <div className="flex justify-center">
          <EventCell ev={match.events.result} />
        </div>

        {/* Expand icon */}
        <div className="flex justify-end">
          {expanded ? (
            <ChevronDown size={14} className="text-slate-500" />
          ) : (
            <ChevronRight size={14} className="text-slate-600" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 bg-slate-900/60 border-t border-slate-800/50">
          <div className="grid grid-cols-3 gap-3 pt-3">
            {(
              [
                { key: 'reminder', label: 'Recordatorio', type: 'MATCH_REMINDER' },
                { key: 'closing', label: 'Cierre de predicciones', type: 'PREDICTION_CLOSED' },
                { key: 'result', label: 'Resultado', type: 'RESULT_PUBLISHED' },
              ] as const
            ).map(({ key, label, type }) => {
              const ev = match.events[key];
              return (
                <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 flex flex-col gap-1.5">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${TYPE_COLORS[type]?.split(' ')[1] ?? 'text-slate-400'}`}>
                    {TYPE_ICONS[type]} {label}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500">Programado: </span>
                    {ev.scheduledAt ? fmtFull(ev.scheduledAt) : '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500">Enviadas: </span>
                    <span className={ev.sentCount > 0 ? 'text-lime-400 font-bold' : 'text-slate-500'}>
                      {ev.sentCount} notificación{ev.sentCount !== 1 ? 'es' : ''}
                    </span>
                  </p>
                  {ev.lastSentAt && (
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-500">Último envío: </span>{fmtFull(ev.lastSentAt)}
                    </p>
                  )}
                  {ev.overdue && (
                    <p className="text-[10px] text-red-400 font-semibold">⚠ Pasó el momento y no se envió</p>
                  )}
                  {'closeMinutes' in ev && ev.closeMinutes !== undefined && (
                    <p className="text-[10px] text-slate-500">
                      Cierre configurado: {ev.closeMinutes} min antes
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── History Row ─────────────────────────────────────────────────────────────

function HistoryRow({ n }: { n: NotifRecord }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="border-b border-slate-800 last:border-0 cursor-pointer hover:bg-slate-800/30 transition-colors"
      onClick={() => setExpanded(v => !v)}
    >
      <div className="grid items-start px-4 py-3 gap-x-3"
        style={{ gridTemplateColumns: 'auto 1fr auto auto' }}>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest whitespace-nowrap mt-0.5 ${TYPE_COLORS[n.type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
          {TYPE_ICONS[n.type]} {TYPE_LABELS[n.type] ?? n.type}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-200 font-medium truncate">{n.body}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{n.user.name} — {n.user.email}</p>
        </div>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
          n.channel === 'PUSH' ? 'text-blue-400' : n.channel === 'IN_APP' ? 'text-slate-400' : 'text-purple-400'
        }`}>
          {n.channel}
        </span>
        <span className="text-xs text-slate-500 whitespace-nowrap">{fmtFull(n.sentAt)}</span>
      </div>
      {expanded && (
        <div className="px-4 pb-3 text-xs text-slate-400 space-y-1">
          <p><span className="text-slate-500">Título: </span>{n.title}</p>
          {n.data && (() => {
            try {
              const parsed = JSON.parse(n.data) as Record<string, string>;
              return (
                <>
                  {parsed.matchId && <p><span className="text-slate-500">Partido ID: </span><span className="font-mono text-slate-300">{parsed.matchId}</span></p>}
                  {parsed.leagueId && <p><span className="text-slate-500">Liga ID: </span><span className="font-mono text-slate-300">{parsed.leagueId}</span></p>}
                </>
              );
            } catch { return null; }
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

function ChannelCard({ id, info }: { id: string; info: ChannelInfo }) {
  const meta = CHANNEL_META[id];
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${info.enabled ? 'border-slate-700 bg-slate-800/60' : 'border-slate-800 bg-slate-900/40 opacity-60'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="text-slate-400">{meta?.icon}</span>
          {meta?.label ?? id}
        </div>
        {info.enabled
          ? <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-400"><CheckCircle2 size={12} /> Activo</span>
          : <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500"><XCircle size={12} /> Inactivo</span>
        }
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{info.description}</p>
    </div>
  );
}

// ─── Scheduler Card ───────────────────────────────────────────────────────────

function SchedulerCard({ s, channelStatus }: { s: SchedulerDef; channelStatus: AutomationStatus['channels'] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{s.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{s.name}</p>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${TYPE_COLORS[s.notifType]?.split(' ')[1] ?? 'text-amber-400'}`}>
              {TYPE_LABELS[s.notifType] ?? s.notifType}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-lime-400 shrink-0">
          <Activity size={12} /> Activo
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Clock size={12} className="shrink-0" />
        <span>{s.description}</span>
      </div>
      <p className="text-xs text-slate-400">
        <span className="font-semibold text-slate-300">Audiencia: </span>{s.audience}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-700">
        {s.channels.map(ch => {
          const chInfo = channelStatus[ch] as ChannelInfo | undefined;
          const meta = CHANNEL_META[ch];
          const active = chInfo?.enabled ?? false;
          return (
            <span
              key={ch}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest
                ${active ? 'bg-lime-500/10 text-lime-400 border-lime-500/20' : 'bg-slate-700/50 text-slate-500 border-slate-700 line-through'}`}
            >
              {meta?.icon}{meta?.label ?? ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function AdminAutomation() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [matrix, setMatrix] = useState<TodayMatrix | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('sync');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  // History filters
  const [historyType, setHistoryType] = useState<string>('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Matrix search
  const [matrixSearch, setMatrixSearch] = useState('');

  const loadBase = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        request<AutomationStatus>('/admin/automation/status'),
        request<TodayMatrix>('/admin/automation/today-matrix'),
      ]);
      setStatus(s);
      setMatrix(m);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (type: string, page: number) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (type) params.set('type', type);
      const h = await request<HistoryResponse>(`/admin/automation/history?${params.toString()}`);
      setHistory(h);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { void loadBase(); }, []);

  useEffect(() => {
    if (tab === 'history') void loadHistory(historyType, historyPage);
  }, [tab, historyType, historyPage]);

  const handleTypeFilter = (t: string) => {
    setHistoryType(t);
    setHistoryPage(1);
  };

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'sync', label: 'Sync y monitoreo' },
    { id: 'matrix', label: 'Matriz del día' },
    { id: 'history', label: 'Historial 24h' },
    { id: 'schedulers', label: 'Schedulers' },
    { id: 'channels', label: 'Canales' },
  ];

  const totalPages = history ? Math.ceil(history.total / history.limit) : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-100">Procesos Automáticos</h1>
          <p className="text-sm text-slate-400 mt-1">
            Schedulers, canales de notificación y seguimiento diario por partido
          </p>
        </div>
        <button
          onClick={loadBase}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Stats strip */}
      {status && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Notif. 24h', value: status.stats.notifLast24h, icon: <Bell size={15} /> },
            { label: 'Dispositivos Push', value: status.stats.pushSubscribers, icon: <Smartphone size={15} /> },
            { label: 'Usuarios con teléfono', value: status.stats.usersWithPhone, icon: <Phone size={15} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">{icon}</div>
              <div>
                <p className="text-xl font-black text-slate-100">{value.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-800">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors
              ${tab === t.id ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Sync y monitoreo ─────────────────────────────────────────── */}
      {tab === 'sync' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <AdminSyncPlan embedded />
        </div>
      )}

      {/* ─── Tab: Matriz del día ───────────────────────────────────────────── */}
      {tab === 'matrix' && (
        <div>
          {matrix && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <p className="text-xs text-slate-500 shrink-0">
                <span className="text-slate-300 font-semibold">
                  {new Date(matrix.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                {' — '}{matrix.matches.length} partido{matrix.matches.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Buscador */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar equipo..."
                    value={matrixSearch}
                    onChange={e => setMatrixSearch(e.target.value)}
                    className="pl-8 pr-8 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-44"
                  />
                  {matrixSearch && (
                    <button onClick={() => setMatrixSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="flex gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span className="flex items-center gap-1 text-lime-400">✓ Enviado</span>
                  <span className="flex items-center gap-1 text-slate-400"><Clock size={9} /> Pendiente</span>
                  <span className="flex items-center gap-1 text-red-400">Sin enviar</span>
                </div>
              </div>
            </div>
          )}

          {matrix && matrix.matches.length > 0 ? (() => {
            const q = matrixSearch.toLowerCase().trim();
            const filtered = q
              ? matrix.matches.filter(m =>
                  m.homeTeam.toLowerCase().includes(q) ||
                  m.awayTeam.toLowerCase().includes(q) ||
                  (m.tournament ?? '').toLowerCase().includes(q)
                )
              : matrix.matches;

            return filtered.length > 0 ? (
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <div
                  className="grid px-4 py-2 bg-slate-800/60 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-700"
                  style={{ gridTemplateColumns: '1fr auto 1fr 1fr 1fr 1.2rem' }}
                >
                  <span>Partido</span>
                  <span className="px-3">Hora</span>
                  <span className="text-center">⏰ Recordatorio</span>
                  <span className="text-center">⚠️ Cierre</span>
                  <span className="text-center">✅ Resultado</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-800/60">
                  {filtered.map(m => (
                    <MatrixRow
                      key={m.id}
                      match={m}
                      expanded={expandedMatch === m.id}
                      onExpand={id => setExpandedMatch(prev => prev === id ? null : id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 gap-2 text-slate-500">
                <Search size={22} className="opacity-30" />
                <p className="text-sm">Sin partidos que coincidan con "{matrixSearch}"</p>
              </div>
            );
          })() : (
            !loading && (
              <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
                <span className="text-4xl">📅</span>
                <p className="text-sm">No hay partidos programados para hoy</p>
              </div>
            )
          )}
        </div>
      )}

      {/* ─── Tab: Historial ───────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="flex flex-col gap-4">
          {/* Buscador + Chips */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Buscador de texto */}
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar usuario, mensaje..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {historySearch && (
                <button onClick={() => setHistorySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X size={12} />
                </button>
              )}
            </div>
            {/* Chips de tipo */}
            <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-1">Tipo:</span>
            {[
              { value: '', label: 'Todos' },
              { value: 'MATCH_REMINDER', label: '⏰ Recordatorio' },
              { value: 'PREDICTION_CLOSED', label: '⚠️ Cierre' },
              { value: 'RESULT_PUBLISHED', label: '✅ Resultado' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleTypeFilter(opt.value)}
                className={`px-3 py-1 rounded-full border text-xs font-bold transition-colors
                  ${historyType === opt.value
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
              >
                {opt.label}
                {history && opt.value && history.countByType[opt.value] !== undefined && (
                  <span className="ml-1.5 opacity-70">({history.countByType[opt.value]})</span>
                )}
                {history && !opt.value && (
                  <span className="ml-1.5 opacity-70">
                    ({Object.values(history.countByType).reduce((a, b) => a + b, 0)})
                  </span>
                )}
              </button>
            ))}
            </div>
          </div>

          {/* Lista */}
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-amber-400" />
            </div>
          ) : history && history.recent.length > 0 ? (() => {
            const q = historySearch.toLowerCase().trim();
            const filtered = q
              ? history.recent.filter(n =>
                  n.body.toLowerCase().includes(q) ||
                  n.title.toLowerCase().includes(q) ||
                  n.user.name.toLowerCase().includes(q) ||
                  n.user.email.toLowerCase().includes(q)
                )
              : history.recent;
            return (
            <>
              {q && (
                <p className="text-xs text-slate-500">
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "<span className="text-slate-300">{historySearch}</span>"
                </p>
              )}
              {filtered.length > 0 ? (
              <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
                {filtered.map(n => <HistoryRow key={n.id} n={n} />)}
              </div>
              ) : (
                <div className="flex flex-col items-center py-8 gap-2 text-slate-500">
                  <Search size={20} className="opacity-30" />
                  <p className="text-sm">Sin resultados para "{historySearch}"</p>
                </div>
              )}

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {history.total} total · página {historyPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="px-3 py-1 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-40 transition"
                    >
                      ← Anterior
                    </button>
                    <button
                      onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                      disabled={historyPage >= totalPages}
                      className="px-3 py-1 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-40 transition"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </>
          );
          })() : (
            <div className="flex flex-col items-center py-12 gap-2 text-slate-500">
              <Bell size={28} className="opacity-30" />
              <p className="text-sm">Sin notificaciones en las últimas 24h</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Schedulers ──────────────────────────────────────────────── */}
      {tab === 'schedulers' && status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status.schedulers.map(s => (
            <SchedulerCard key={s.id} s={s} channelStatus={status.channels} />
          ))}
        </div>
      )}

      {/* ─── Tab: Canales ─────────────────────────────────────────────────── */}
      {tab === 'channels' && status && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(status.channels).map(([id, info]) => (
            <ChannelCard key={id} id={id} info={info} />
          ))}
        </div>
      )}

      {/* Loading overlay inicial */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-400" />
        </div>
      )}
    </div>
  );
}
