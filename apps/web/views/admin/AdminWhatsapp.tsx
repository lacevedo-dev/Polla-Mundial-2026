import React from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle2,
  Filter,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  useAdminWhatsappStore,
  type WhatsappGroup,
  type WhatsappGroupJob,
  type WhatsappPersonalLog,
} from '../../stores/admin.whatsapp.store';

type LogTab = 'group' | 'personal' | 'all';
type SortDir = 'desc' | 'asc';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DISABLED: { label: 'Deshabilitado', className: 'bg-slate-100 text-slate-500' },
  INITIALIZING: { label: 'Iniciando…', className: 'bg-amber-100 text-amber-700' },
  QR_READY: { label: 'Escanear QR', className: 'bg-violet-100 text-violet-700' },
  CONNECTED: { label: 'Conectado', className: 'bg-emerald-100 text-emerald-700' },
  DISCONNECTED: { label: 'Desconectado', className: 'bg-rose-100 text-rose-700' },
  AUTH_FAILURE: { label: 'Error de auth', className: 'bg-rose-100 text-rose-700' },
};

const JOB_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  SENDING: { label: 'Enviando', className: 'bg-sky-100 text-sky-700' },
  SENT: { label: 'Enviado', className: 'bg-emerald-100 text-emerald-700' },
  FAILED: { label: 'Fallido', className: 'bg-rose-100 text-rose-700' },
};

const JOB_TYPE_LABEL: Record<string, string> = {
  RESULT_REPORT: 'Reporte resultados',
  PREDICTION_REPORT: 'Reporte pronósticos',
  MATCH_REMINDER: 'Recordatorio partido',
  PREDICTION_CLOSED: 'Cierre predicciones',
  RESULT_NOTIFICATION: 'Resultado final',
  GOAL_SCORED: 'Gol en vivo',
  GOAL_STICKER: 'Sticker goleador',
  PRE_MATCH_ESCALATION: 'Escalación pre-partido',
  MATCH_START: 'Inicio partido',
  HALFTIME: 'Medio tiempo',
  SECOND_HALF_START: 'Segundo tiempo',
  MATCH_LIVE_END: 'Fin en vivo',
  GOAL_IMPACT: 'Impacto de gol',
  RED_CARD: 'Tarjeta roja',
  YELLOW_CARD: 'Tarjeta amarilla',
  SUBSTITUTION: 'Sustitución',
  GOAL_ANNULLED: 'Gol anulado',
  PAYMENT_REMINDER: 'Recordatorio pago',
};

const PERSONAL_SOURCE_LABEL: Record<string, string> = {
  AUTOMATION: 'Automatización',
  PAYMENT_REMINDER: 'Recordatorio pago',
  LEAGUE_BROADCAST: 'Envío manual liga',
};

const VIA_LABEL: Record<string, string> = {
  WHATSAPP_WEB: 'WA Web',
  TWILIO: 'Twilio',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const maskPhone = (countryCode: string, phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return `${countryCode} ${phone}`;
  return `${countryCode} •••• ${digits.slice(-4)}`;
};

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const matchesSearch = (terms: string[], query: string) => {
  if (!query.trim()) return true;
  const q = normalize(query);
  return terms.some((term) => normalize(term).includes(q));
};

const StatPill: React.FC<{ label: string; value: number; tone?: 'default' | 'ok' | 'warn' | 'bad' }> = ({
  label,
  value,
  tone = 'default',
}) => {
  const tones = {
    default: 'border-slate-200 bg-white text-slate-700',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    bad: 'border-rose-200 bg-rose-50 text-rose-800',
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-lg font-black leading-tight">{value.toLocaleString('es-CO')}</p>
    </div>
  );
};

const AdminWhatsapp: React.FC = () => {
  const {
    status,
    session,
    qrDataUrl,
    groups,
    jobs,
    personalLogs,
    isLoading,
    error,
    fetchStatus,
    fetchQr,
    disconnect,
    reinitialize,
    fetchGroups,
    fetchJobs,
    fetchPersonalLogs,
    retryJob,
    deleteJob,
    deletePersonalLog,
  } = useAdminWhatsappStore();

  const [groupFilter, setGroupFilter] = React.useState('');
  const [qrPolling, setQrPolling] = React.useState(false);
  const [logTab, setLogTab] = React.useState<LogTab>('group');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState('');
  const [viaFilter, setViaFilter] = React.useState('');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchStatus();
    void fetchJobs();
    void fetchPersonalLogs();
  }, [fetchStatus, fetchJobs, fetchPersonalLogs]);

  React.useEffect(() => {
    if (status === 'QR_READY') {
      void fetchQr();
      setQrPolling(true);
    } else {
      setQrPolling(false);
    }
  }, [status, fetchQr]);

  React.useEffect(() => {
    const shouldPoll = qrPolling || status === 'INITIALIZING' || status === 'DISCONNECTED';
    if (!shouldPoll) return;
    const id = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(id);
  }, [qrPolling, status, fetchStatus]);

  const badge = STATUS_LABEL[status ?? 'DISCONNECTED'] ?? STATUS_LABEL.DISCONNECTED;

  const filteredGroups: WhatsappGroup[] = groupFilter
    ? groups.filter((g) => matchesSearch([g.name, g.id], groupFilter))
    : groups;

  const filteredJobs = React.useMemo(() => {
    let list = [...jobs];
    if (statusFilter) list = list.filter((j) => j.status === statusFilter);
    if (typeFilter) list = list.filter((j) => j.type === typeFilter);
    if (search.trim()) {
      list = list.filter((j) =>
        matchesSearch(
          [
            j.groupId,
            j.matchId,
            j.caption,
            j.lastError ?? '',
            j.league?.name ?? '',
            j.league?.code ?? '',
            JOB_TYPE_LABEL[j.type] ?? j.type,
          ],
          search,
        ),
      );
    }
    list.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'desc' ? -diff : diff;
    });
    return list;
  }, [jobs, statusFilter, typeFilter, search, sortDir]);

  const filteredPersonal = React.useMemo(() => {
    let list = [...personalLogs];
    if (statusFilter) list = list.filter((l) => l.status === statusFilter);
    if (sourceFilter) list = list.filter((l) => l.source === sourceFilter);
    if (viaFilter) list = list.filter((l) => l.via === viaFilter);
    if (search.trim()) {
      list = list.filter((l) =>
        matchesSearch(
          [
            l.phone,
            l.userName ?? '',
            l.user?.name ?? '',
            l.user?.username ?? '',
            l.message,
            l.lastError ?? '',
            l.league?.name ?? '',
            l.league?.code ?? '',
            PERSONAL_SOURCE_LABEL[l.source] ?? l.source,
            l.automationStep ?? '',
          ],
          search,
        ),
      );
    }
    list.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'desc' ? -diff : diff;
    });
    return list;
  }, [personalLogs, statusFilter, sourceFilter, viaFilter, search, sortDir]);

  type UnifiedEntry =
    | { kind: 'group'; id: string; createdAt: string; job: WhatsappGroupJob }
    | { kind: 'personal'; id: string; createdAt: string; log: WhatsappPersonalLog };

  const unifiedEntries = React.useMemo(() => {
    const entries: UnifiedEntry[] = [
      ...filteredJobs.map((job) => ({ kind: 'group' as const, id: job.id, createdAt: job.createdAt, job })),
      ...filteredPersonal.map((log) => ({ kind: 'personal' as const, id: log.id, createdAt: log.createdAt, log })),
    ];
    entries.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'desc' ? -diff : diff;
    });
    return entries;
  }, [filteredJobs, filteredPersonal, sortDir]);

  const activeListCount =
    logTab === 'group' ? filteredJobs.length : logTab === 'personal' ? filteredPersonal.length : unifiedEntries.length;

  const stats = React.useMemo(() => {
    const source =
      logTab === 'personal' ? filteredPersonal : logTab === 'group' ? filteredJobs : [...filteredJobs, ...filteredPersonal];
    const sent = source.filter((item) => item.status === 'SENT').length;
    const failed = source.filter((item) => item.status === 'FAILED').length;
    const pending = source.filter((item) => item.status === 'PENDING' || item.status === 'SENDING').length;
    return { total: source.length, sent, failed, pending };
  }, [logTab, filteredJobs, filteredPersonal]);

  const hasActiveFilters = Boolean(search || statusFilter || typeFilter || sourceFilter || viaFilter);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setSourceFilter('');
    setViaFilter('');
  };

  const reloadLogs = () => {
    void fetchJobs();
    void fetchPersonalLogs();
  };

  const renderGroupRow = (job: WhatsappGroupJob, compact?: boolean) => {
    const jbadge = JOB_STATUS_LABEL[job.status] ?? JOB_STATUS_LABEL.PENDING;
    const isExpanded = expandedId === job.id;

    return (
      <div key={job.id} className={compact ? '' : 'px-4 py-3'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${jbadge.className}`}>
                {jbadge.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700">
                <Users size={10} /> Grupo
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {JOB_TYPE_LABEL[job.type] ?? job.type}
              </span>
              {job.league && (
                <span className="text-[11px] font-bold text-slate-700">
                  {job.league.name} ({job.league.code})
                </span>
              )}
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{job.groupId}</p>
            {job.lastError && !isExpanded && (
              <p className="mt-1 line-clamp-1 text-[11px] text-rose-600">{job.lastError}</p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              {job.sentAt ? `Enviado: ${formatDate(job.sentAt)} · ` : ''}
              Creado: {formatDate(job.createdAt)} · Intentos: {job.attemptCount}
            </p>
            {isExpanded && (
              <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600">
                {job.lastError && <p className="mb-2 text-rose-600">{job.lastError}</p>}
                <p className="whitespace-pre-wrap break-words">{job.caption || 'Sin caption'}</p>
                <p className="mt-2 font-mono text-[10px] text-slate-400">Partido: {job.matchId}</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : job.id)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              {isExpanded ? 'Ocultar' : 'Ver'}
            </button>
            {job.status === 'FAILED' && (
              <button
                type="button"
                onClick={async () => {
                  await retryJob(job.id);
                  reloadLogs();
                }}
                className="flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
              >
                <RefreshCw size={11} /> Reintentar
              </button>
            )}
            {job.status === 'SENT' && <CheckCircle2 size={16} className="text-emerald-500" />}
            <button
              type="button"
              onClick={async () => {
                await deleteJob(job.id);
                reloadLogs();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPersonalRow = (log: WhatsappPersonalLog, compact?: boolean) => {
    const lbadge = JOB_STATUS_LABEL[log.status] ?? JOB_STATUS_LABEL.FAILED;
    const isExpanded = expandedId === log.id;
    const recipient = log.userName ?? log.user?.name ?? 'Usuario';

    return (
      <div key={log.id} className={compact ? '' : 'px-4 py-3'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${lbadge.className}`}>
                {lbadge.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase text-sky-700">
                <User size={10} /> Personal
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {PERSONAL_SOURCE_LABEL[log.source] ?? log.source}
              </span>
              {log.via && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {VIA_LABEL[log.via] ?? log.via}
                </span>
              )}
              {log.league && (
                <span className="text-[11px] font-bold text-slate-700">
                  {log.league.name} ({log.league.code})
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-bold text-slate-800">{recipient}</p>
            <p className="font-mono text-[11px] text-slate-400">{maskPhone(log.countryCode, log.phone)}</p>
            {!isExpanded && (
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{log.message}</p>
            )}
            {log.lastError && !isExpanded && (
              <p className="mt-1 line-clamp-1 text-[11px] text-rose-600">{log.lastError}</p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              {log.sentAt ? `Enviado: ${formatDate(log.sentAt)} · ` : ''}
              Creado: {formatDate(log.createdAt)}
            </p>
            {isExpanded && (
              <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600">
                {log.lastError && <p className="mb-2 text-rose-600">{log.lastError}</p>}
                <p className="whitespace-pre-wrap break-words">{log.message}</p>
                {log.automationStep && (
                  <p className="mt-2 text-[10px] text-slate-400">Paso: {log.automationStep}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              {isExpanded ? 'Ocultar' : 'Ver'}
            </button>
            {log.status === 'SENT' && <CheckCircle2 size={16} className="text-emerald-500" />}
            <button
              type="button"
              onClick={async () => {
                await deletePersonalLog(log.id);
                reloadLogs();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-brand text-xl font-black uppercase tracking-tight text-slate-900 sm:text-2xl">
            WhatsApp
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Sesión, grupos y historial de envíos (grupo y personal)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchStatus()}
          className="flex items-center gap-1.5 self-start rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw size={13} /> Actualizar sesión
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <X size={14} /> {error}
        </div>
      )}

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado de la sesión</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              {status === 'CONNECTED' ? (
                <Wifi size={18} className="text-emerald-500" />
              ) : (
                <WifiOff size={18} className="text-slate-400" />
              )}
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${badge.className}`}>{badge.label}</span>
            </div>

            <p className="text-xs text-slate-500">
              {status === 'DISABLED'
                ? 'Activa WHATSAPP_WEB_ENABLED=true en las variables de entorno para habilitar esta función.'
                : status === 'QR_READY'
                  ? session?.sessionExists
                    ? 'Hay datos de sesión en disco pero WhatsApp pide un nuevo escaneo.'
                    : 'Escanea el código QR con tu teléfono → WhatsApp → Dispositivos vinculados.'
                  : status === 'CONNECTED'
                    ? 'Sesión activa. Los envíos a grupos y números personales usan esta conexión (con fallback Twilio si aplica).'
                    : status === 'INITIALIZING'
                      ? 'Iniciando cliente WhatsApp Web…'
                      : session?.lastDisconnectReason === 'LOGOUT'
                        ? 'WhatsApp cerró la sesión desde el teléfono. Escanea el QR de nuevo.'
                        : 'Sesión desconectada. Usa Reconectar para restaurar la sesión guardada.'}
            </p>

            {session && (
              <div className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600">
                <p>
                  <span className="font-bold text-slate-500">Ruta sesión:</span>{' '}
                  <code className="font-mono text-[10px]">{session.sessionPath}</code>
                </p>
                <p>
                  <span className="font-bold text-slate-500">Sesión en disco:</span>{' '}
                  <span className={session.sessionExists ? 'font-bold text-emerald-700' : 'font-bold text-rose-600'}>
                    {session.sessionExists ? 'Sí (persistida)' : 'No — se pierde al reiniciar'}
                  </span>
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(status === 'DISCONNECTED' || status === 'AUTH_FAILURE') && (
                <button
                  type="button"
                  onClick={() => void reinitialize()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                  Reconectar
                </button>
              )}
              {status === 'CONNECTED' && (
                <>
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    <WifiOff size={13} /> Desconectar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void fetchGroups();
                    }}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                    Cargar grupos
                  </button>
                </>
              )}
            </div>
          </div>

          {status === 'QR_READY' && (
            <div className="mx-auto shrink-0 rounded-[1.25rem] border border-violet-200 bg-violet-50 p-4 text-center lg:mx-0">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR WhatsApp" className="mx-auto h-44 w-44 rounded-lg sm:h-48 sm:w-48" />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center sm:h-48 sm:w-48">
                  <Loader2 size={24} className="animate-spin text-violet-400" />
                </div>
              )}
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">
                Escanear con WhatsApp
              </p>
            </div>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Grupos disponibles ({groups.length})
            </p>
            <div className="relative w-full sm:max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar grupos…"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.slice(0, 18).map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <p className="truncate text-sm font-bold text-slate-800">{g.name}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{g.id}</p>
                <p className="mt-1 text-[11px] text-slate-500">{g.participants} participantes</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Historial de envíos
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activeListCount.toLocaleString('es-CO')} registros visibles
                {hasActiveFilters ? ' (filtrados)' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'group', label: 'Grupo', icon: Users },
                { id: 'personal', label: 'Personal', icon: User },
                { id: 'all', label: 'Todos', icon: MessageCircle },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setLogTab(id);
                    setExpandedId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    logTab === id
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
              <button
                type="button"
                onClick={reloadLogs}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={13} /> Recargar
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label="Total" value={stats.total} />
            <StatPill label="Enviados" value={stats.sent} tone="ok" />
            <StatPill label="Pendientes" value={stats.pending} tone="warn" />
            <StatPill label="Fallidos" value={stats.failed} tone="bad" />
          </div>
        </div>

        <div className="space-y-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por grupo, usuario, teléfono, liga, mensaje…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Estado: todos</option>
              <option value="SENT">Enviado</option>
              <option value="PENDING">Pendiente</option>
              <option value="SENDING">Enviando</option>
              <option value="FAILED">Fallido</option>
            </select>

            {(logTab === 'group' || logTab === 'all') && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Tipo grupo: todos</option>
                {Object.entries(JOB_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}

            {(logTab === 'personal' || logTab === 'all') && (
              <>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Origen personal: todos</option>
                  {Object.entries(PERSONAL_SOURCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={viaFilter}
                  onChange={(e) => setViaFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Canal: todos</option>
                  <option value="WHATSAPP_WEB">WA Web</option>
                  <option value="TWILIO">Twilio</option>
                </select>
              </>
            )}

            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {sortDir === 'desc' ? <ArrowDownAZ size={14} /> : <ArrowUpAZ size={14} />}
              {sortDir === 'desc' ? 'Más recientes' : 'Más antiguos'}
            </button>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Filter size={13} className="text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Filtros activos</span>
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-[11px] font-bold text-amber-700 hover:underline"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>

        {logTab === 'group' && filteredJobs.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">No hay publicaciones de grupo con estos filtros.</p>
        )}
        {logTab === 'personal' && filteredPersonal.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">
            No hay logs de WhatsApp personal todavía. Los nuevos envíos quedarán registrados aquí.
          </p>
        )}
        {logTab === 'all' && unifiedEntries.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">Sin registros con los filtros actuales.</p>
        )}

        {logTab === 'group' && filteredJobs.length > 0 && (
          <>
            <div className="md:hidden divide-y divide-slate-100 p-3">
              {filteredJobs.map((job) => renderGroupRow(job, true))}
            </div>
            <div className="hidden md:block divide-y divide-slate-100">
              {filteredJobs.map((job) => renderGroupRow(job))}
            </div>
          </>
        )}

        {logTab === 'personal' && filteredPersonal.length > 0 && (
          <>
            <div className="md:hidden divide-y divide-slate-100 p-3">
              {filteredPersonal.map((log) => renderPersonalRow(log, true))}
            </div>
            <div className="hidden md:block divide-y divide-slate-100">
              {filteredPersonal.map((log) => renderPersonalRow(log))}
            </div>
          </>
        )}

        {logTab === 'all' && unifiedEntries.length > 0 && (
          <>
            <div className="md:hidden divide-y divide-slate-100 p-3">
              {unifiedEntries.map((entry) =>
                entry.kind === 'group'
                  ? renderGroupRow(entry.job, true)
                  : renderPersonalRow(entry.log, true),
              )}
            </div>
            <div className="hidden md:block divide-y divide-slate-100">
              {unifiedEntries.map((entry) =>
                entry.kind === 'group'
                  ? renderGroupRow(entry.job)
                  : renderPersonalRow(entry.log),
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Notas</p>
        <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
          <li>
            <strong>Grupo:</strong> cola con reintentos automáticos (recordatorios, goles, reportes PDF/imagen).
          </li>
          <li>
            <strong>Personal:</strong> mensajes directos vía WA Web o Twilio; desde ahora quedan guardados en esta pantalla.
          </li>
          <li>Los envíos personales históricos anteriores a esta actualización no aparecen (solo los nuevos).</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminWhatsapp;
