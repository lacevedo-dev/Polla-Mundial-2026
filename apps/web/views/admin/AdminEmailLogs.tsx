import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Search,
  X,
  XCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { request } from '../../api';

type EmailJobStatus = 'PENDING' | 'DEFERRED' | 'SENT' | 'FAILED' | 'DROPPED';
type EmailJobType =
  | 'VERIFICATION'
  | 'PASSWORD_RESET'
  | 'WELCOME'
  | 'MATCH_REMINDER'
  | 'PREDICTION_CLOSED'
  | 'RESULT_PUBLISHED';

interface EmailLog {
  id: string;
  type: EmailJobType;
  status: EmailJobStatus;
  recipientEmail: string;
  subject: string;
  matchId: string | null;
  leagueId: string | null;
  scheduledAt: string;
  sentAt: string | null;
  lastAttemptAt: string | null;
  attemptCount: number;
  lastError: string | null;
  providerKey: string | null;
  leagueName: string | null;
  leagueCode: string | null;
  matchHomeTeam: string | null;
  matchAwayTeam: string | null;
  blacklistInfo: {
    isBlacklisted: boolean;
    reason: string | null;
    failureCount: number | null;
  } | null;
}

interface LeagueStats {
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  total: number;
  sent: number;
  failed: number;
}

interface EmailLogsResponse {
  logs: EmailLog[];
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    dropped: number;
    byLeague: LeagueStats[];
    byType: Array<{ type: EmailJobType; count: number }>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const TYPE_LABELS: Record<EmailJobType, string> = {
  VERIFICATION: 'Verificación',
  PASSWORD_RESET: 'Restablecer contraseña',
  WELCOME: 'Bienvenida',
  MATCH_REMINDER: 'Recordatorio 1h',
  PREDICTION_CLOSED: 'Cierre predicciones',
  RESULT_PUBLISHED: 'Resultado publicado',
};

const TYPE_BADGES: Record<EmailJobType, string> = {
  VERIFICATION: 'border-purple-200 bg-purple-50 text-purple-700',
  PASSWORD_RESET: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  WELCOME: 'border-pink-200 bg-pink-50 text-pink-700',
  MATCH_REMINDER: 'border-sky-200 bg-sky-50 text-sky-700',
  PREDICTION_CLOSED: 'border-amber-200 bg-amber-50 text-amber-700',
  RESULT_PUBLISHED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const STATUS_LABELS: Record<EmailJobStatus, string> = {
  PENDING: 'Pendiente',
  DEFERRED: 'Diferido',
  SENT: 'Enviado',
  FAILED: 'Fallido',
  DROPPED: 'Descartado',
};

const STATUS_ICONS: Record<EmailJobStatus, React.ReactNode> = {
  PENDING: <Clock size={14} className="text-slate-400" />,
  DEFERRED: <Clock size={14} className="text-amber-500" />,
  SENT: <CheckCircle2 size={14} className="text-emerald-500" />,
  FAILED: <XCircle size={14} className="text-red-500" />,
  DROPPED: <Ban size={14} className="text-slate-500" />,
};

const BLACKLIST_REASON_LABELS: Record<string, string> = {
  BOUNCE: 'Rebote (email inválido)',
  INVALID_ADDRESS: 'Dirección inválida',
  SPAM_COMPLAINT: 'Queja de spam',
  MANUAL: 'Bloqueado manualmente',
  REPEATED_FAILURE: 'Fallos repetidos',
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function EmailLogRow({ log, onClick }: { log: EmailLog; onClick: () => void }) {
  const statusColor =
    log.status === 'SENT'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : log.status === 'FAILED' || log.status === 'DROPPED'
        ? 'border-red-200 bg-red-50 text-red-700'
        : log.status === 'DEFERRED'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <div
      className="cursor-pointer border-b border-slate-200 px-4 py-3 transition hover:bg-slate-50 last:border-0"
      onClick={onClick}
    >
      <div className="grid items-start gap-x-3 gap-y-2" style={{ gridTemplateColumns: 'auto 1fr auto auto' }}>
        <div className="mt-0.5">{STATUS_ICONS[log.status]}</div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${TYPE_BADGES[log.type]}`}
            >
              {TYPE_LABELS[log.type]}
            </span>
            {log.leagueName && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {log.leagueCode || log.leagueName}
              </span>
            )}
            {log.blacklistInfo?.isBlacklisted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                <Ban size={10} /> Bloqueado
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-medium text-slate-800">{log.subject}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {log.recipientEmail}
            {log.matchHomeTeam && log.matchAwayTeam && (
              <> · {log.matchHomeTeam} vs {log.matchAwayTeam}</>
            )}
          </p>
        </div>

        <span
          className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${statusColor}`}
        >
          {STATUS_LABELS[log.status]}
        </span>

        <span className="whitespace-nowrap text-xs text-slate-500">
          {log.sentAt ? fmtTime(log.sentAt) : fmtTime(log.scheduledAt)}
        </span>
      </div>
    </div>
  );
}

function EmailLogDetail({ log, onClose }: { log: EmailLog; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Mail size={16} className="shrink-0 text-slate-400" />
              <p className="text-sm font-black text-slate-900">Detalle del email</p>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${TYPE_BADGES[log.type]}`}
              >
                {TYPE_LABELS[log.type]}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{log.recipientEmail}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {log.blacklistInfo?.isBlacklisted && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-red-900">Email bloqueado</p>
                  <p className="mt-1 text-xs text-red-700">
                    {log.blacklistInfo.reason
                      ? BLACKLIST_REASON_LABELS[log.blacklistInfo.reason] ||
                        log.blacklistInfo.reason
                      : 'Motivo desconocido'}
                  </p>
                  {log.blacklistInfo.failureCount && (
                    <p className="mt-1 text-[10px] text-red-600">
                      Fallos registrados: {log.blacklistInfo.failureCount}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Información general
            </p>
            <div className="grid gap-2 text-xs md:grid-cols-2">
              <div>
                <span className="text-slate-500">Estado:</span>
                <div className="mt-0.5 flex items-center gap-2">
                  {STATUS_ICONS[log.status]}
                  <span className="font-semibold text-slate-800">{STATUS_LABELS[log.status]}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500">Programado:</span>
                <p className="mt-0.5 font-semibold text-slate-800">{fmtDateTime(log.scheduledAt)}</p>
              </div>
              {log.sentAt && (
                <div>
                  <span className="text-slate-500">Enviado:</span>
                  <p className="mt-0.5 font-semibold text-slate-800">{fmtDateTime(log.sentAt)}</p>
                </div>
              )}
              {log.lastAttemptAt && (
                <div>
                  <span className="text-slate-500">Último intento:</span>
                  <p className="mt-0.5 font-semibold text-slate-800">{fmtDateTime(log.lastAttemptAt)}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500">Intentos:</span>
                <p className="mt-0.5 font-semibold text-slate-800">{log.attemptCount}</p>
              </div>
              {log.providerKey && (
                <div>
                  <span className="text-slate-500">Proveedor:</span>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-700">{log.providerKey}</p>
                </div>
              )}
            </div>
          </div>

          {log.leagueName && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Polla
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{log.leagueName}</span>
                {log.leagueCode && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    {log.leagueCode}
                  </span>
                )}
              </div>
              {log.matchHomeTeam && log.matchAwayTeam && (
                <p className="mt-1 text-xs text-slate-500">
                  {log.matchHomeTeam} vs {log.matchAwayTeam}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Asunto</p>
            <p className="text-sm text-slate-800">{log.subject}</p>
          </div>

          {log.lastError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-red-400">
                Error
              </p>
              <p className="font-mono text-xs text-red-700">{log.lastError}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function LeagueGroup({ league, logs, onLogClick }: {
  league: LeagueStats;
  logs: EmailLog[];
  onLogClick: (log: EmailLog) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const successRate = league.total > 0 ? ((league.sent / league.total) * 100).toFixed(1) : '0';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          <div>
            <p className="text-sm font-black text-slate-900">{league.leagueName}</p>
            <p className="text-[10px] font-mono text-slate-500">{league.leagueCode}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black text-slate-600">
            Total: {league.total}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
            <CheckCircle2 size={10} /> {league.sent}
          </span>
          {league.failed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">
              <XCircle size={10} /> {league.failed}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600">
            {successRate}% éxito
          </span>
        </div>
      </div>

      {expanded && (
        <div>
          {logs.map((log) => (
            <EmailLogRow key={log.id} log={log} onClick={() => onLogClick(log)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminEmailLogs() {
  const [data, setData] = useState<EmailLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Filtros
  const [typeFilter, setTypeFilter] = useState<EmailJobType | ''>('');
  const [statusFilter, setStatusFilter] = useState<EmailJobStatus | ''>('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [groupByLeague, setGroupByLeague] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '100' });
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (leagueFilter) params.set('leagueId', leagueFilter);

      const response = await request<EmailLogsResponse>(`/admin/email-logs?${params.toString()}`);
      setData(response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [page, typeFilter, statusFilter, leagueFilter]);

  const filteredLogs = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.logs;
    return data.logs.filter(
      (log) =>
        log.recipientEmail.toLowerCase().includes(q) ||
        log.subject.toLowerCase().includes(q) ||
        (log.leagueName || '').toLowerCase().includes(q) ||
        (log.matchHomeTeam || '').toLowerCase().includes(q) ||
        (log.matchAwayTeam || '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const groupedByLeague = useMemo(() => {
    const groups = new Map<string, EmailLog[]>();

    filteredLogs.forEach((log) => {
      if (log.leagueId) {
        const existing = groups.get(log.leagueId) || [];
        groups.set(log.leagueId, [...existing, log]);
      } else {
        const existing = groups.get('_no_league') || [];
        groups.set('_no_league', [...existing, log]);
      }
    });

    return groups;
  }, [filteredLogs]);

  const automationTypes: EmailJobType[] = ['MATCH_REMINDER', 'PREDICTION_CLOSED', 'RESULT_PUBLISHED'];
  const systemTypes: EmailJobType[] = ['VERIFICATION', 'PASSWORD_RESET', 'WELCOME'];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      {selectedLog && <EmailLogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />}

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Logs de Email</h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitorea el estado de todos los emails enviados por el sistema, agrupados por polla
            </p>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {data && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total', value: data.stats.total, icon: <Mail size={15} />, color: 'slate' },
              { label: 'Enviados', value: data.stats.sent, icon: <CheckCircle2 size={15} />, color: 'emerald' },
              { label: 'Fallidos', value: data.stats.failed, icon: <XCircle size={15} />, color: 'red' },
              { label: 'Pendientes', value: data.stats.pending, icon: <Clock size={15} />, color: 'amber' },
              { label: 'Descartados', value: data.stats.dropped, icon: <Ban size={15} />, color: 'slate' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className={`rounded-lg bg-${stat.color}-50 p-2 text-${stat.color}-600`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">{stat.value.toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setGroupByLeague(!groupByLeague)}
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest transition ${
                groupByLeague
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 shadow-sm hover:bg-slate-100'
              }`}
            >
              {groupByLeague ? 'Agrupado por Polla' : 'Vista lista'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Estado
              </p>
              <div className="flex flex-wrap gap-1">
                {(['', 'SENT', 'FAILED', 'PENDING', 'DROPPED'] as const).map((status) => (
                  <button
                    key={status || 'all'}
                    onClick={() => {
                      setStatusFilter(status);
                      setPage(1);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest transition ${
                      statusFilter === status
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 shadow-sm hover:bg-slate-100'
                    }`}
                  >
                    {status ? STATUS_LABELS[status] : 'Todos'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Automatizaciones
              </p>
              <div className="flex flex-wrap gap-1">
                {automationTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTypeFilter(type);
                      setPage(1);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest transition ${
                      typeFilter === type
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 shadow-sm hover:bg-slate-100'
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Sistema
              </p>
              <div className="flex flex-wrap gap-1">
                {systemTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTypeFilter(type);
                      setPage(1);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest transition ${
                      typeFilter === type
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-500 shadow-sm hover:bg-slate-100'
                    }`}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {typeFilter && (
              <button
                onClick={() => {
                  setTypeFilter('');
                  setPage(1);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-200"
              >
                <X size={12} /> Limpiar tipo
              </button>
            )}
          </div>

          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email, asunto, equipo o polla..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-slate-400"
              aria-label="Buscar logs de email"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <RefreshCw size={20} className="mx-auto animate-spin text-slate-400" />
          </div>
        ) : filteredLogs.length > 0 ? (
          <>
            {groupByLeague ? (
              <div className="space-y-4">
                {data.stats.byLeague
                  .filter((league) => {
                    const logs = groupedByLeague.get(league.leagueId) || [];
                    return logs.length > 0;
                  })
                  .map((league) => {
                    const logs = groupedByLeague.get(league.leagueId) || [];
                    return (
                      <LeagueGroup
                        key={league.leagueId}
                        league={league}
                        logs={logs}
                        onLogClick={setSelectedLog}
                      />
                    );
                  })}

                {groupedByLeague.has('_no_league') && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-black text-slate-900">Sin polla asociada</p>
                      <p className="text-[10px] text-slate-500">Emails del sistema</p>
                    </div>
                    <div>
                      {(groupedByLeague.get('_no_league') || []).map((log) => (
                        <EmailLogRow key={log.id} log={log} onClick={() => setSelectedLog(log)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {filteredLogs.map((log) => (
                  <EmailLogRow key={log.id} log={log} onClick={() => setSelectedLog(log)} />
                ))}
              </div>
            )}

            {data && data.pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>
                  {data.pagination.total} registros · página {page} de {data.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            No se encontraron logs con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}
