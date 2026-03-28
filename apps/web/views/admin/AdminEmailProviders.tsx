import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  Edit3,
  ExternalLink,
  KeyRound,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import { request } from '../../api';
import {
  useAdminEmailProvidersStore,
  type AdminEmailProvider,
  type EmailProviderFormData,
} from '../../stores/admin.email-providers.store';

type ConfirmAction =
  | { type: 'activate' | 'deactivate' | 'delete'; account: AdminEmailProvider }
  | null;

interface AutomationEmailBacklogQueue {
  pendingCount: number;
  deferredCount: number;
  sendingCount: number;
  failedCount: number;
  droppedCount: number;
}

interface AutomationEmailBacklogRun {
  id: string;
  trigger: string;
  mode: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  inspectedCount: number;
  actionableCount: number;
  staleSendingCount: number;
  exhaustedRetryCount: number;
  transientWithinBudgetCount: number;
  sanitizedCount: number;
  deferredCount: number;
  failedCount: number;
  droppedCount: number;
  notActionedCount: number;
  errorCount: number;
  errorMessage: string | null;
}

interface AutomationEmailBacklogStatus {
  queue: AutomationEmailBacklogQueue;
  latestRun: AutomationEmailBacklogRun | null;
  recentFailures: number;
}

interface SharedLimits {
  dailyLimit: number;
  reservedHighPriority: number;
  maxRecipientsPerMessage: number;
  maxEmailSizeMb: number;
  maxAttachmentSizeMb: number;
  uniform: boolean;
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function formatNumber(value: number) {
  return value.toLocaleString('es-CO');
}

function getOperationalStatus(account: AdminEmailProvider) {
  if (!account.active) return { label: 'Inactiva', pill: 'bg-slate-100 text-slate-600' };
  const blockedUntil = account.blockedUntil ? new Date(account.blockedUntil) : null;
  if (blockedUntil && blockedUntil.getTime() > Date.now()) return { label: 'Bloqueada', pill: 'bg-rose-100 text-rose-700' };
  return { label: 'Activa', pill: 'bg-lime-100 text-lime-700' };
}

function validateForm(data: EmailProviderFormData, isEditing: boolean) {
  const errors: string[] = [];
  if (!data.key.trim()) errors.push('La clave es obligatoria.');
  if (!data.name.trim()) errors.push('El nombre es obligatorio.');
  if (!data.fromEmail.trim()) errors.push('El correo remitente es obligatorio.');
  if (!data.smtpHost.trim()) errors.push('El host SMTP es obligatorio.');
  if (data.smtpPort < 1 || data.smtpPort > 65535) errors.push('El puerto SMTP es inválido.');
  if (data.dailyLimit < data.reservedHighPriority) errors.push('La reserva HIGH no puede superar el límite diario.');
  if (data.maxRecipientsPerMessage > 100) errors.push('El máximo de destinatarios no puede superar 100.');
  if (data.maxEmailSizeMb > 35) errors.push('El tamaño máximo del correo no puede superar 35 MB.');
  if (data.maxAttachmentSizeMb > 25) errors.push('Los adjuntos no pueden superar 25 MB.');
  if (!isEditing && !data.smtpPass?.trim()) errors.push('La contraseña SMTP es obligatoria al crear la cuenta.');
  return errors;
}

const DEFAULT_FORM: EmailProviderFormData = {
  key: '',
  name: '',
  fromEmail: '',
  fromName: '',
  smtpHost: '',
  smtpPort: 587,
  secure: false,
  smtpUser: '',
  smtpPass: '',
  dailyLimit: 100,
  reservedHighPriority: 60,
  maxRecipientsPerMessage: 100,
  maxEmailSizeMb: 35,
  maxAttachmentSizeMb: 25,
  active: true,
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-3 text-slate-500">
      {icon}
      <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
    </div>
    <p className="mt-3 text-2xl font-black text-slate-900 tabular-nums">{value}</p>
  </div>
);
const EmailProviderFormDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AdminEmailProvider | null;
}> = ({ open, onOpenChange, account }) => {
  const isEditing = Boolean(account);
  const { createAccount, updateAccount, isSaving } = useAdminEmailProvidersStore();
  const [form, setForm] = React.useState<EmailProviderFormData>(DEFAULT_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        key: account.key,
        name: account.name,
        fromEmail: account.fromEmail,
        fromName: account.fromName ?? '',
        smtpHost: account.smtpHost,
        smtpPort: account.smtpPort,
        secure: account.secure,
        smtpUser: account.smtpUser ?? '',
        smtpPass: '',
        dailyLimit: account.dailyLimit,
        reservedHighPriority: account.reservedHighPriority,
        maxRecipientsPerMessage: account.maxRecipientsPerMessage,
        maxEmailSizeMb: account.maxEmailSizeMb,
        maxAttachmentSizeMb: account.maxAttachmentSizeMb,
        active: account.active,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setFormError(null);
  }, [open, account]);

  const updateField = <K extends keyof EmailProviderFormData>(field: K, value: EmailProviderFormData[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    const errors = validateForm(form, isEditing);
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }

    const payload: Partial<EmailProviderFormData> = {
      ...form,
      key: form.key.trim(),
      name: form.name.trim(),
      fromEmail: form.fromEmail.trim(),
      fromName: form.fromName?.trim() || undefined,
      smtpHost: form.smtpHost.trim(),
      smtpUser: form.smtpUser?.trim() || undefined,
      smtpPass: form.smtpPass?.trim() || undefined,
    };

    if (isEditing && !payload.smtpPass) delete payload.smtpPass;

    try {
      if (account) await updateAccount(account.id, payload);
      else await createAccount(payload as EmailProviderFormData);
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar la cuenta SMTP');
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-black text-slate-900">
                {isEditing ? 'Editar cuenta SMTP' : 'Nueva cuenta SMTP'}
              </DialogPrimitive.Title>
              <p className="mt-1 text-sm text-slate-500">
                {isEditing
                  ? 'Actualiza parámetros compartidos, credenciales y estado operativo.'
                  : 'Configura una nueva cuenta para la rotación de correos y la automatización.'}
              </p>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {formError && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4">
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Identidad</p>
                <div className="grid gap-3">
                  <input value={form.key} onChange={(e) => updateField('key', e.target.value)} placeholder="key única" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Nombre interno" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input value={form.fromEmail} onChange={(e) => updateField('fromEmail', e.target.value)} placeholder="notificacion@dominio.com" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input value={form.fromName ?? ''} onChange={(e) => updateField('fromName', e.target.value)} placeholder="Nombre del remitente" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">SMTP</p>
                <div className="grid gap-3">
                  <input value={form.smtpHost} onChange={(e) => updateField('smtpHost', e.target.value)} placeholder="smtp.hostinger.com" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="number" min={1} max={65535} value={form.smtpPort} onChange={(e) => updateField('smtpPort', Number(e.target.value) || 0)} placeholder="587" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><input type="checkbox" checked={form.secure} onChange={(e) => updateField('secure', e.target.checked)} />Conexión segura</label>
                  </div>
                  <input value={form.smtpUser ?? ''} onChange={(e) => updateField('smtpUser', e.target.value)} placeholder="Usuario SMTP" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="password" value={form.smtpPass ?? ''} onChange={(e) => updateField('smtpPass', e.target.value)} placeholder={isEditing ? 'Dejar vacío para conservar' : 'Contraseña SMTP'} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  {isEditing && <p className="text-xs text-slate-500">{account?.hasPassword ? 'La cuenta ya tiene contraseña configurada.' : 'La cuenta aún no tiene contraseña cargada.'}</p>}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Parámetros compartidos</p>
                    <h3 className="mt-1 text-base font-black text-slate-900">Límites globales de la rotación</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Unificados</span>
                </div>
                <p className="mb-3 text-sm text-slate-500">Estos valores se muestran una sola vez porque se aplican igual a todos los proveedores activos.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="number" min={1} value={form.dailyLimit} onChange={(e) => updateField('dailyLimit', Number(e.target.value) || 0)} placeholder="100" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="number" min={0} value={form.reservedHighPriority} onChange={(e) => updateField('reservedHighPriority', Number(e.target.value) || 0)} placeholder="60" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="number" min={1} max={100} value={form.maxRecipientsPerMessage} onChange={(e) => updateField('maxRecipientsPerMessage', Number(e.target.value) || 0)} placeholder="100" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="number" min={1} max={35} value={form.maxEmailSizeMb} onChange={(e) => updateField('maxEmailSizeMb', Number(e.target.value) || 0)} placeholder="35" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="number" min={1} max={25} value={form.maxAttachmentSizeMb} onChange={(e) => updateField('maxAttachmentSizeMb', Number(e.target.value) || 0)} placeholder="25" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 sm:col-span-2" />
                </div>
              </div>

              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={Boolean(form.active)} onChange={(e) => updateField('active', e.target.checked)} />
                  Cuenta activa para rotación y envío
                </label>
              </div>

              {account && (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-800">Último uso:</span> {formatDate(account.lastUsedAt)}</p>
                  <p><span className="font-semibold text-slate-800">Bloqueada hasta:</span> {formatDate(account.blockedUntil)}</p>
                  <p className="break-words"><span className="font-semibold text-slate-800">Último error:</span> {account.lastError || '—'}</p>
                </div>
              )}
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <DialogPrimitive.Close className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50">Cancelar</DialogPrimitive.Close>
            <button onClick={handleSave} disabled={isSaving} className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-500 disabled:opacity-60">{isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear cuenta'}</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
const ProviderActionMenu: React.FC<{
  account: AdminEmailProvider;
  onEdit: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}> = ({ account, onEdit, onActivate, onDeactivate, onDelete }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isBlocked = Boolean(account.blockedUntil && new Date(account.blockedUntil).getTime() > Date.now());
  const actions = [
    { label: 'Editar', icon: Edit3, onClick: onEdit, className: 'text-amber-700 hover:bg-amber-50' },
    account.active
      ? { label: 'Desactivar', icon: Ban, onClick: onDeactivate, className: 'text-slate-700 hover:bg-slate-100' }
      : { label: 'Activar', icon: CheckCircle2, onClick: onActivate, className: 'text-lime-700 hover:bg-lime-50' },
    { label: 'Eliminar', icon: Trash2, onClick: onDelete, className: 'text-rose-700 hover:bg-rose-50' },
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((current) => !current)} className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label={`Acciones para ${account.name}`}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
          {isBlocked && <div className="mb-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Bloqueada temporalmente</div>}
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${action.className}`}
            >
              <action.icon size={15} />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SharedLimitsPanel: React.FC<{ accounts: AdminEmailProvider[] }> = ({ accounts }) => {
  const reference = React.useMemo<SharedLimits | null>(() => {
    if (accounts.length === 0) return null;
    const first = accounts[0];
    const uniform = accounts.every(
      (account) =>
        account.dailyLimit === first.dailyLimit &&
        account.reservedHighPriority === first.reservedHighPriority &&
        account.maxRecipientsPerMessage === first.maxRecipientsPerMessage &&
        account.maxEmailSizeMb === first.maxEmailSizeMb &&
        account.maxAttachmentSizeMb === first.maxAttachmentSizeMb,
    );
    return {
      dailyLimit: first.dailyLimit,
      reservedHighPriority: first.reservedHighPriority,
      maxRecipientsPerMessage: first.maxRecipientsPerMessage,
      maxEmailSizeMb: first.maxEmailSizeMb,
      maxAttachmentSizeMb: first.maxAttachmentSizeMb,
      uniform,
    };
  }, [accounts]);

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            <Server size={12} />
            Configuración global
          </p>
          <h2 className="mt-1 text-base font-black text-slate-900">Límites compartidos</h2>
          <p className="mt-1 text-sm text-slate-500">Se muestran una sola vez porque la rotación usa los mismos límites para todos los proveedores.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${reference?.uniform ? 'bg-lime-100 text-lime-700' : 'bg-amber-100 text-amber-700'}`}>
          {reference ? (reference.uniform ? 'Uniformes' : 'Revisar') : 'Sin datos'}
        </span>
      </div>

      {!reference ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Crea una cuenta SMTP para visualizar aquí los límites globales de la rotación.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {[
            { label: 'Diario', value: reference.dailyLimit },
            { label: 'Reserva HIGH', value: reference.reservedHighPriority },
            { label: 'Destinatarios', value: reference.maxRecipientsPerMessage },
            { label: 'Correo', value: `${reference.maxEmailSizeMb} MB` },
            { label: 'Adjuntos', value: `${reference.maxAttachmentSizeMb} MB` },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const AutomationStatusPanel: React.FC<{
  status: AutomationEmailBacklogStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}> = ({ status, loading, error, onRefresh }) => {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Automatización de notificaciones</p>
          <h2 className="mt-1 text-base font-black text-slate-900">Correo centralizado + auditoría</h2>
          <p className="mt-1 text-sm text-slate-500">La cola SMTP, los errores y la última corrida viven en Automatización; aquí ves un resumen y saltas al panel completo.</p>
        </div>
        <button onClick={onRefresh} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <Link to="/admin/automation" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700">
        Ver Automatización
        <ExternalLink size={15} />
      </Link>

      {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {loading && !status ? (
        <div className="mt-4 space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : status ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pendientes', value: status.queue.pendingCount },
              { label: 'En espera', value: status.queue.deferredCount },
              { label: 'Enviando', value: status.queue.sendingCount },
              { label: 'Fallidas', value: status.queue.failedCount },
              { label: 'Descartadas', value: status.queue.droppedCount },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{formatNumber(item.value)}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {status.latestRun ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-900">Última corrida</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{status.latestRun.status}</span>
                </div>
                <p className="mt-2">Inició {formatDate(status.latestRun.startedAt)}</p>
                <p className="mt-1">Sanitizadas: {status.latestRun.sanitizedCount} · Errores: {status.latestRun.errorCount}</p>
                <p className="mt-1">Fallas 24h: {formatNumber(status.recentFailures)}</p>
                {status.latestRun.errorMessage && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{status.latestRun.errorMessage}</p>}
              </>
            ) : (
              <p>No hay corridas registradas todavía.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Sin estado de automatización todavía.
        </div>
      )}
    </section>
  );
};

const AdminEmailProviders: React.FC = () => {
  const {
    accounts,
    filters,
    isLoading,
    isSaving,
    error,
    fetchAccounts,
    activateAccount,
    deactivateAccount,
    deleteAccount,
    setFilters,
    clearError,
  } = useAdminEmailProvidersStore();

  const [searchInput, setSearchInput] = React.useState(filters.search);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<AdminEmailProvider | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null);
  const [automationStatus, setAutomationStatus] = React.useState<AutomationEmailBacklogStatus | null>(null);
  const [automationLoading, setAutomationLoading] = React.useState(false);
  const [automationError, setAutomationError] = React.useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput, 350);

  const loadAutomationStatus = React.useCallback(async () => {
    setAutomationLoading(true);
    setAutomationError(null);
    try {
      const status = await request<AutomationEmailBacklogStatus>('/admin/automation/email-backlog/status');
      setAutomationStatus(status);
    } catch (error) {
      setAutomationError(error instanceof Error ? error.message : 'No se pudo cargar el estado de automatización');
    } finally {
      setAutomationLoading(false);
    }
  }, []);

  const refreshAll = React.useCallback(async () => {
    await Promise.all([fetchAccounts(), loadAutomationStatus()]);
  }, [fetchAccounts, loadAutomationStatus]);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  React.useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts, filters.active, filters.search]);

  React.useEffect(() => {
    void loadAutomationStatus();
  }, [loadAutomationStatus]);

  const sharedLimits = React.useMemo<SharedLimits | null>(() => {
    if (accounts.length === 0) return null;
    const first = accounts[0];
    const uniform = accounts.every(
      (account) =>
        account.dailyLimit === first.dailyLimit &&
        account.reservedHighPriority === first.reservedHighPriority &&
        account.maxRecipientsPerMessage === first.maxRecipientsPerMessage &&
        account.maxEmailSizeMb === first.maxEmailSizeMb &&
        account.maxAttachmentSizeMb === first.maxAttachmentSizeMb,
    );

    return {
      dailyLimit: first.dailyLimit,
      reservedHighPriority: first.reservedHighPriority,
      maxRecipientsPerMessage: first.maxRecipientsPerMessage,
      maxEmailSizeMb: first.maxEmailSizeMb,
      maxAttachmentSizeMb: first.maxAttachmentSizeMb,
      uniform,
    };
  }, [accounts]);

  const summary = React.useMemo(() => {
    const now = Date.now();
    const activeCount = accounts.filter((account) => account.active).length;
    const blockedCount = accounts.filter((account) => Boolean(account.blockedUntil && new Date(account.blockedUntil).getTime() > now)).length;
    const withPasswordCount = accounts.filter((account) => account.hasPassword).length;
    const withErrorsCount = accounts.filter((account) => Boolean(account.lastError || account.usageToday?.lastError)).length;
    const usageToday = accounts.reduce((total, account) => total + (account.usageToday?.sentCount ?? 0), 0);
    const totalLimit = sharedLimits?.uniform ? sharedLimits.dailyLimit * Math.max(accounts.length, 1) : accounts.reduce((total, account) => total + account.dailyLimit, 0);
    const remainingQuota = Math.max(totalLimit - usageToday, 0);

    return {
      activeCount,
      blockedCount,
      withPasswordCount,
      withErrorsCount,
      usageToday,
      totalLimit,
      remainingQuota,
    };
  }, [accounts, sharedLimits]);

  const filteredAccounts = React.useMemo(() => {
    const activeFilter = filters.active;
    const normalizedSearch = filters.search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'true'
            ? account.active
            : !account.active;
      const matchesSearch = normalizedSearch
        ? [account.key, account.name, account.fromEmail, account.smtpHost, account.smtpUser ?? '']
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        : true;
      return matchesActive && matchesSearch;
    });
  }, [accounts, filters.active, filters.search]);

  const openCreateDialog = () => {
    clearError();
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const openEditDialog = (account: AdminEmailProvider) => {
    clearError();
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingAccount(null);
  };

  const openConfirm = (type: NonNullable<ConfirmAction>['type'], account: AdminEmailProvider) => {
    clearError();
    setConfirmAction({ type, account });
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    try {
      if (confirmAction.type === 'activate') {
        await activateAccount(confirmAction.account.id);
      } else if (confirmAction.type === 'deactivate') {
        await deactivateAccount(confirmAction.account.id);
      } else {
        await deleteAccount(confirmAction.account.id);
      }
      setConfirmAction(null);
      await refreshAll();
    } catch {
      // El store expone el error. Mantenemos el diálogo abierto para que el usuario lo vea.
    }
  };

  const limitReference = sharedLimits?.uniform ? sharedLimits.dailyLimit : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Administración</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">SMTP / Correo</span>
          </div>
          <div className="max-w-3xl">
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Proveedores de correo</h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Gestioná las cuentas SMTP, sus límites compartidos y el estado operacional del sistema de envío/recepción.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <Link
            to="/admin/automation"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Automatización
            <ArrowRight size={16} />
          </Link>
          <button
            onClick={() => void refreshAll()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={16} className={isLoading || automationLoading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={openCreateDialog}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-amber-500"
          >
            <Plus size={16} />
            Nueva cuenta
          </button>
        </div>
      </div>

      {(error || automationError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{error || automationError}</p>
            <button onClick={() => { clearError(); setAutomationError(null); }} className="self-start rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-100">
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cuentas activas" value={formatNumber(summary.activeCount)} icon={<ShieldCheck size={18} />} />
        <StatCard label="Bloqueadas" value={formatNumber(summary.blockedCount)} icon={<Ban size={18} />} />
        <StatCard label="Con contraseña" value={formatNumber(summary.withPasswordCount)} icon={<KeyRound size={18} />} />
        <StatCard label="Errores detectados" value={formatNumber(summary.withErrorsCount)} icon={<AlertTriangle size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por nombre, clave, correo o host"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</span>
                <div className="relative">
                  <select
                    value={filters.active ?? 'all'}
                    onChange={(event) => setFilters({ active: event.target.value as 'all' | 'true' | 'false' })}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                  >
                    <option value="all">Todas</option>
                    <option value="true">Activas</option>
                    <option value="false">Inactivas</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">{formatNumber(filteredAccounts.length)} cuentas visibles</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Uso hoy: {formatNumber(summary.usageToday)}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Restan: {formatNumber(summary.remainingQuota)}</span>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="space-y-3 p-5">
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Mail size={22} />
                </div>
                <div className="max-w-md space-y-2">
                  <h2 className="text-lg font-black text-slate-900">No hay cuentas SMTP visibles</h2>
                  <p className="text-sm text-slate-500">
                    Probá ajustando el filtro o creá una nueva cuenta para empezar a centralizar el envío de correos.
                  </p>
                </div>
                <button onClick={openCreateDialog} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 transition-colors hover:bg-amber-500">
                  <Plus size={16} />
                  Nueva cuenta
                </button>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/80">
                      <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-5 py-4">Cuenta</th>
                        <th className="px-5 py-4">Estado</th>
                        <th className="px-5 py-4">Uso / errores</th>
                        <th className="px-5 py-4">Último uso</th>
                        <th className="px-5 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAccounts.map((account) => {
                        const operational = getOperationalStatus(account);
                        const usageToday = account.usageToday?.sentCount ?? 0;
                        const dailyLimit = limitReference ?? account.dailyLimit;
                        const remaining = Math.max(dailyLimit - usageToday, 0);
                        const errorText = account.usageToday?.lastError || account.lastError || 'Sin errores recientes';
                        const isBlocked = Boolean(account.blockedUntil && new Date(account.blockedUntil).getTime() > Date.now());

                        return (
                          <tr key={account.id} className="align-top transition hover:bg-slate-50/80">
                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-slate-900">{account.name}</p>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{account.key}</span>
                                </div>
                                <p className="text-sm text-slate-500">{account.fromEmail}</p>
                                <p className="text-xs text-slate-400">{account.smtpHost}:{account.smtpPort} · {account.secure ? 'TLS/SSL' : 'Sin SSL'}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="space-y-2">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${operational.pill}`}>{operational.label}</span>
                                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  <span className={`rounded-full px-2.5 py-1 ${account.active ? 'bg-lime-100 text-lime-700' : 'bg-slate-100 text-slate-600'}`}>{account.active ? 'Activa' : 'Inactiva'}</span>
                                  {isBlocked && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">Bloqueada</span>}
                                  {account.hasPassword && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">Con clave</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex items-center justify-between gap-3">
                                  <span>Uso hoy</span>
                                  <span className="font-bold text-slate-900 tabular-nums">{formatNumber(usageToday)} / {formatNumber(dailyLimit)}</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-amber-400"
                                    style={{ width: `${Math.min((usageToday / Math.max(dailyLimit, 1)) * 100, 100)}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="text-slate-400">Restan {formatNumber(remaining)}</span>
                                  <span className="truncate text-rose-600" title={errorText}>{errorText}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-500">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-700">{formatDate(account.lastUsedAt)}</p>
                                <p className="text-xs">Bloqueada hasta {formatDate(account.blockedUntil)}</p>
                                <p className="text-xs">Actualizada {formatDate(account.updatedAt)}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-start justify-end gap-2">
                                <button onClick={() => openEditDialog(account)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label={`Editar ${account.name}`}>
                                  <Edit3 size={16} />
                                </button>
                                <ProviderActionMenu
                                  account={account}
                                  onEdit={() => openEditDialog(account)}
                                  onActivate={() => openConfirm('activate', account)}
                                  onDeactivate={() => openConfirm('deactivate', account)}
                                  onDelete={() => openConfirm('delete', account)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredAccounts.map((account) => {
                    const operational = getOperationalStatus(account);
                    const usageToday = account.usageToday?.sentCount ?? 0;
                    const dailyLimit = limitReference ?? account.dailyLimit;
                    const remaining = Math.max(dailyLimit - usageToday, 0);
                    const errorText = account.usageToday?.lastError || account.lastError || 'Sin errores recientes';
                    const isBlocked = Boolean(account.blockedUntil && new Date(account.blockedUntil).getTime() > Date.now());

                    return (
                      <article key={account.id} className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-base font-black text-slate-900">{account.name}</h2>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{account.key}</span>
                            </div>
                            <p className="truncate text-sm text-slate-500">{account.fromEmail}</p>
                            <p className="text-xs text-slate-400">{account.smtpHost}</p>
                          </div>
                          <button onClick={() => openEditDialog(account)} className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label={`Editar ${account.name}`}>
                            <Edit3 size={16} />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${operational.pill}`}>{operational.label}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${account.active ? 'bg-lime-100 text-lime-700' : 'bg-slate-100 text-slate-600'}`}>{account.active ? 'Activa' : 'Inactiva'}</span>
                          {isBlocked && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">Bloqueada</span>}
                          {account.hasPassword && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Con clave</span>}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Uso hoy</p>
                            <p className="mt-1 text-lg font-black text-slate-900 tabular-nums">{formatNumber(usageToday)} / {formatNumber(dailyLimit)}</p>
                            <p className="mt-1 text-xs text-slate-500">Restan {formatNumber(remaining)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Último error</p>
                            <p className="mt-1 line-clamp-3 text-sm text-slate-700">{errorText}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Último uso</p>
                            <p className="mt-1 font-semibold text-slate-700">{formatDate(account.lastUsedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bloqueada hasta</p>
                            <p className="mt-1 font-semibold text-slate-700">{formatDate(account.blockedUntil)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            onClick={() => openConfirm(account.active ? 'deactivate' : 'activate', account)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {account.active ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                            {account.active ? 'Desactivar' : 'Activar'}
                          </button>
                          <ProviderActionMenu
                            account={account}
                            onEdit={() => openEditDialog(account)}
                            onActivate={() => openConfirm('activate', account)}
                            onDeactivate={() => openConfirm('deactivate', account)}
                            onDelete={() => openConfirm('delete', account)}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <SharedLimitsPanel accounts={accounts} />

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Enlace operativo</p>
                <h2 className="mt-1 text-base font-black text-slate-900">Uso / errores centralizado</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Este bloque resume el estado del sistema de envío/recepción y te lleva directo a Automatización de Notificaciones.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                {automationStatus?.latestRun?.status ?? '—'}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado de cola</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pendientes</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(automationStatus?.queue.pendingCount ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fallidas</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(automationStatus?.queue.failedCount ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Enviando</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(automationStatus?.queue.sendingCount ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Descartadas</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatNumber(automationStatus?.queue.droppedCount ?? 0)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Última corrida</p>
                {automationStatus?.latestRun ? (
                  <div className="mt-3 space-y-2">
                    <p className="font-semibold text-slate-900">{automationStatus.latestRun.trigger} · {automationStatus.latestRun.mode}</p>
                    <p>Inició {formatDate(automationStatus.latestRun.startedAt)}</p>
                    <p>Sanitizadas: {formatNumber(automationStatus.latestRun.sanitizedCount)}</p>
                    <p>Errores: {formatNumber(automationStatus.latestRun.errorCount)} · Fallas 24h: {formatNumber(automationStatus.recentFailures)}</p>
                    <StatusBadge status={automationStatus.latestRun.status} size="md" />
                    {automationStatus.latestRun.errorMessage && <p className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">{automationStatus.latestRun.errorMessage}</p>}
                  </div>
                ) : (
                  <p className="mt-3 text-slate-500">Todavía no hay corridas registradas.</p>
                )}
              </div>
            </div>

            <Link
              to="/admin/automation"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700"
            >
              Ir a Automatización
              <ExternalLink size={15} />
            </Link>
          </section>

          {sharedLimits && !sharedLimits.uniform && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Los límites no son uniformes en todas las cuentas. La vista prioriza el bloque global, pero los valores por cuenta siguen disponibles en cada fila.
            </div>
          )}
        </div>
      </div>

      <EmailProviderFormDialog
        open={dialogOpen}
        onOpenChange={closeDialog}
        account={editingAccount}
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={
          confirmAction?.type === 'delete'
            ? 'Eliminar cuenta SMTP'
            : confirmAction?.type === 'activate'
              ? 'Activar cuenta SMTP'
              : 'Desactivar cuenta SMTP'
        }
        description={
          confirmAction?.type === 'delete'
            ? `Vas a eliminar ${confirmAction.account.name}. La cuenta quedará deshabilitada y archivada.`
            : confirmAction?.type === 'activate'
              ? `Vas a activar ${confirmAction.account.name} para que vuelva a rotar en el sistema.`
              : `Vas a desactivar ${confirmAction.account.name} para sacarla de la rotación.`
        }
        confirmLabel={
          confirmAction?.type === 'delete'
            ? 'Eliminar'
            : confirmAction?.type === 'activate'
              ? 'Activar'
              : 'Desactivar'
        }
        variant={confirmAction?.type === 'delete' ? 'danger' : 'warning'}
        isLoading={isSaving}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
};

export default AdminEmailProviders;
