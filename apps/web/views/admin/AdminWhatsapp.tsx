import React from 'react';
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import { useAdminWhatsappStore, type WhatsappGroup } from '../../stores/admin.whatsapp.store';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DISABLED:      { label: 'Deshabilitado', className: 'bg-slate-100 text-slate-500' },
  INITIALIZING:  { label: 'Iniciando…',    className: 'bg-amber-100 text-amber-700' },
  QR_READY:      { label: 'Escanear QR',   className: 'bg-violet-100 text-violet-700' },
  CONNECTED:     { label: 'Conectado',     className: 'bg-emerald-100 text-emerald-700' },
  DISCONNECTED:  { label: 'Desconectado',  className: 'bg-rose-100 text-rose-700' },
  AUTH_FAILURE:  { label: 'Error de auth', className: 'bg-rose-100 text-rose-700' },
};

const JOB_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING:  { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  SENDING:  { label: 'Enviando',  className: 'bg-sky-100 text-sky-700' },
  SENT:     { label: 'Enviado',   className: 'bg-emerald-100 text-emerald-700' },
  FAILED:   { label: 'Fallido',   className: 'bg-rose-100 text-rose-700' },
};

const JOB_TYPE_LABEL: Record<string, string> = {
  RESULT_REPORT: 'Reporte resultado',
  PREDICTION_REPORT: 'Reporte pronósticos',
  MATCH_REMINDER: 'Recordatorio 1h',
  PREDICTION_CLOSED: 'Cierre predicciones',
  RESULT_NOTIFICATION: 'Resultado final',
  GOAL_SCORED: 'Gol en vivo',
};

const formatDate = (d: string) =>
  new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const AdminWhatsapp: React.FC = () => {
  const {
    status, qrDataUrl, groups, jobs, isLoading, error,
    fetchStatus, fetchQr, disconnect, fetchGroups, fetchJobs,
    retryJob, deleteJob,
  } = useAdminWhatsappStore();

  const [groupFilter, setGroupFilter] = React.useState('');
  const [qrPolling, setQrPolling] = React.useState(false);

  React.useEffect(() => {
    void fetchStatus();
    void fetchJobs();
  }, [fetchStatus, fetchJobs]);

  React.useEffect(() => {
    if (status === 'QR_READY') {
      void fetchQr();
      setQrPolling(true);
    } else {
      setQrPolling(false);
    }
  }, [status, fetchQr]);

  // Poll status every 5s while QR or initializing
  React.useEffect(() => {
    if (!qrPolling && status !== 'INITIALIZING') return;
    const id = setInterval(() => { void fetchStatus(); }, 5000);
    return () => clearInterval(id);
  }, [qrPolling, status, fetchStatus]);

  const badge = STATUS_LABEL[status ?? 'DISCONNECTED'] ?? STATUS_LABEL.DISCONNECTED;

  const filteredGroups: WhatsappGroup[] = groupFilter
    ? groups.filter((g) => g.name.toLowerCase().includes(groupFilter.toLowerCase()))
    : groups;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-brand text-xl font-black uppercase tracking-tight text-slate-900">WhatsApp</h1>
          <p className="mt-0.5 text-xs text-slate-400">Publicación automática de reportes en grupos de WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void fetchStatus()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <X size={14} /> {error}
        </div>
      )}

      {/* Estado de sesión */}
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado de la sesión</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              {status === 'CONNECTED'
                ? <Wifi size={18} className="text-emerald-500" />
                : <WifiOff size={18} className="text-slate-400" />}
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${badge.className}`}>{badge.label}</span>
            </div>

            <p className="text-xs text-slate-500">
              {status === 'DISABLED'
                ? 'Activa WHATSAPP_WEB_ENABLED=true en las variables de entorno para habilitar esta función.'
                : status === 'QR_READY'
                  ? 'Escanea el código QR con tu teléfono → WhatsApp → Dispositivos vinculados → Vincular dispositivo.'
                  : status === 'CONNECTED'
                    ? 'Sesión activa. Los reportes se publicarán automáticamente en los grupos configurados.'
                    : status === 'INITIALIZING'
                      ? 'Iniciando cliente WhatsApp Web, espera unos segundos…'
                      : 'La sesión está desconectada. Recarga la página o reinicia el servicio para volver a conectar.'}
            </p>

            <div className="flex gap-2">
              {status === 'CONNECTED' && (
                <button
                  onClick={() => void disconnect()}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  <WifiOff size={13} /> Desconectar
                </button>
              )}
              {status === 'CONNECTED' && (
                <button
                  onClick={() => { void fetchGroups(); }}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                >
                  {isLoading ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                  Cargar grupos
                </button>
              )}
            </div>
          </div>

          {/* QR Code */}
          {status === 'QR_READY' && qrDataUrl && (
            <div className="shrink-0 rounded-[1.25rem] border border-violet-200 bg-violet-50 p-4 text-center">
              <img src={qrDataUrl} alt="QR WhatsApp" className="mx-auto h-48 w-48 rounded-lg" />
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-600">Escanear con WhatsApp</p>
            </div>
          )}
          {status === 'QR_READY' && !qrDataUrl && (
            <div className="shrink-0 flex h-48 w-48 items-center justify-center rounded-[1.25rem] border border-violet-200 bg-violet-50">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          )}
        </div>
      </div>

      {/* Lista de grupos */}
      {groups.length > 0 && (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Grupos disponibles ({groups.length})
            </p>
            <input
              type="text"
              placeholder="Filtrar grupos…"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="divide-y divide-slate-100">
            {filteredGroups.slice(0, 20).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-bold text-slate-800">{g.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">{g.id}</p>
                </div>
                <span className="text-xs text-slate-500">{g.participants} participantes</span>
              </div>
            ))}
            {filteredGroups.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">Sin resultados</p>
            )}
          </div>
          <p className="mt-3 text-[10px] text-slate-400">
            Copia el ID del grupo y asígnalo a cada liga desde <strong>Admin → Ligas → Detalle de liga</strong>.
          </p>
        </div>
      )}

      {/* Jobs recientes */}
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Publicaciones recientes
          </p>
          <button
            onClick={() => void fetchJobs()}
            className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800"
          >
            <RefreshCw size={12} /> Recargar
          </button>
        </div>

        {jobs.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No hay publicaciones registradas todavía.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const jbadge = JOB_STATUS_LABEL[job.status] ?? JOB_STATUS_LABEL.PENDING;
              return (
                <div key={job.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${jbadge.className}`}>
                        {jbadge.label}
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
                    <p className="mt-1 text-[11px] font-mono text-slate-400">{job.groupId}</p>
                    {job.lastError && (
                      <p className="mt-1 text-[11px] text-rose-600 line-clamp-2">{job.lastError}</p>
                    )}
                    {job.sentAt && (
                      <p className="mt-1 text-[11px] text-slate-400">Enviado: {formatDate(job.sentAt)}</p>
                    )}
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Creado: {formatDate(job.createdAt)} · Intentos: {job.attemptCount}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {job.status === 'FAILED' && (
                      <button
                        onClick={async () => { await retryJob(job.id); void fetchJobs(); }}
                        className="flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                        title="Reintentar"
                      >
                        <RefreshCw size={11} /> Reintentar
                      </button>
                    )}
                    {job.status === 'SENT' && (
                      <CheckCircle2 size={16} className="mt-1 text-emerald-500" />
                    )}
                    <button
                      onClick={async () => { await deleteJob(job.id); void fetchJobs(); }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Configuración inicial</p>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>Agrega <code className="rounded bg-white px-1 py-0.5 text-xs border border-slate-200">WHATSAPP_WEB_ENABLED=true</code> y <code className="rounded bg-white px-1 py-0.5 text-xs border border-slate-200">WHATSAPP_SESSION_PATH=/data/wwebjs</code> en las variables de entorno de Dokploy.</li>
          <li>Reinicia el contenedor. En esta pantalla aparecerá un código QR.</li>
          <li>Escanéalo desde WhatsApp en tu teléfono → <strong>Dispositivos vinculados → Vincular dispositivo</strong>.</li>
          <li>Una vez conectado, pulsa <strong>Cargar grupos</strong> y copia el ID del grupo de cada polla.</li>
          <li>Asigna cada grupo a su liga correspondiente desde el panel de admin de liga o usando el botón de WhatsApp en la lista de partidos.</li>
          <li>A partir de ese momento el sistema publicará automáticamente en el grupo: recordatorio 1h, cierre de predicciones, goles en vivo, resultado final, reporte de pronósticos (imagen + PDF) y reporte de resultados (imagen + PDF).</li>
          <li>Activa también <strong>Consultas de Eventos (goles/tarjetas)</strong> en Football Sync → Configuración para mejorar la precisión de los goles en vivo cuando hay varios en un mismo sync.</li>
        </ol>
      </div>
    </div>
  );
};

export default AdminWhatsapp;
