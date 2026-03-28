import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Mail, Plus, Search, MoreVertical, Edit3, Trash2, CheckCircle2, Ban, AlertTriangle, KeyRound, Server, ShieldCheck, X, ChevronDown } from 'lucide-react';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAdminEmailProvidersStore, type AdminEmailProvider, type EmailProviderFormData } from '../../stores/admin.email-providers.store';

type ConfirmAction = { type: 'activate' | 'deactivate' | 'delete'; account: AdminEmailProvider } | null;

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
  key: '', name: '', fromEmail: '', fromName: '', smtpHost: '', smtpPort: 587, secure: false, smtpUser: '', smtpPass: '', dailyLimit: 100, reservedHighPriority: 60, maxRecipientsPerMessage: 100, maxEmailSizeMb: 35, maxAttachmentSizeMb: 25, active: true,
};

const EmailProviderFormDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; account?: AdminEmailProvider | null; }> = ({ open, onOpenChange, account }) => {
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

  const updateField = <K extends keyof EmailProviderFormData>(field: K, value: EmailProviderFormData[K]) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    const errors = validateForm(form, isEditing);
    if (errors.length > 0) { setFormError(errors[0]); return; }
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
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-[1.75rem] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-black text-slate-900">{isEditing ? 'Editar cuenta SMTP' : 'Nueva cuenta SMTP'}</DialogPrimitive.Title>
              <p className="mt-1 text-sm text-slate-500">{isEditing ? 'Actualiza límites, credenciales y estado operativo.' : 'Configura una nueva cuenta de correo para rotación y envío priorizado.'}</p>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"><X size={18} /></DialogPrimitive.Close>
          </div>
          {formError && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>}
          <div className="grid gap-6 md:grid-cols-2">
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
                  <div className="grid grid-cols-2 gap-3">
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
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Límites</p>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" min={1} value={form.dailyLimit} onChange={(e) => updateField('dailyLimit', Number(e.target.value) || 0)} placeholder="100" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="number" min={0} value={form.reservedHighPriority} onChange={(e) => updateField('reservedHighPriority', Number(e.target.value) || 0)} placeholder="60" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" min={1} max={100} value={form.maxRecipientsPerMessage} onChange={(e) => updateField('maxRecipientsPerMessage', Number(e.target.value) || 0)} placeholder="100" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="number" min={1} max={35} value={form.maxEmailSizeMb} onChange={(e) => updateField('maxEmailSizeMb', Number(e.target.value) || 0)} placeholder="35" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input type="number" min={1} max={25} value={form.maxAttachmentSizeMb} onChange={(e) => updateField('maxAttachmentSizeMb', Number(e.target.value) || 0)} placeholder="25" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => updateField('active', e.target.checked)} />Cuenta activa para rotación y envío</label>
              </div>
              {account && <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p><span className="font-semibold text-slate-800">Último uso:</span> {formatDate(account.lastUsedAt)}</p><p><span className="font-semibold text-slate-800">Bloqueada hasta:</span> {formatDate(account.blockedUntil)}</p><p className="break-words"><span className="font-semibold text-slate-800">Último error:</span> {account.lastError || '—'}</p></div>}
            </section>
          </div>
          <div className="mt-6 flex gap-3">
            <DialogPrimitive.Close className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50">Cancelar</DialogPrimitive.Close>
            <button onClick={handleSave} disabled={isSaving} className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-500 disabled:opacity-60">{isSaving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear cuenta'}</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const ProviderActionMenu: React.FC<{ account: AdminEmailProvider; onEdit: () => void; onActivate: () => void; onDeactivate: () => void; onDelete: () => void; }> = ({ account, onEdit, onActivate, onDeactivate, onDelete }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const isBlocked = Boolean(account.blockedUntil && new Date(account.blockedUntil).getTime() > Date.now());
  const actions = [
    { label: 'Editar', icon: Edit3, onClick: onEdit, className: 'text-amber-700 hover:bg-amber-50' },
    account.active ? { label: 'Desactivar', icon: Ban, onClick: onDeactivate, className: 'text-slate-700 hover:bg-slate-100' } : { label: 'Activar', icon: CheckCircle2, onClick: onActivate, className: 'text-lime-700 hover:bg-lime-50' },
    { label: 'Eliminar', icon: Trash2, onClick: onDelete, className: 'text-rose-700 hover:bg-rose-50' },
  ];
  return <div ref={ref} className="relative"><button onClick={() => setOpen((current) => !current)} className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label={`Acciones para ${account.name}`}><MoreVertical size={16} /></button>{open && <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">{isBlocked && <div className="mb-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Bloqueada temporalmente</div>}{actions.map((action) => <button key={action.label} onClick={() => { action.onClick(); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${action.className}`}><action.icon size={15} />{action.label}</button>)}</div>}</div>;
};

const AdminEmailProviders: React.FC = () => {
  const { accounts, filters, isLoading, isSaving, error, fetchAccounts, activateAccount, deactivateAccount, deleteAccount, setFilters, clearError } = useAdminEmailProvidersStore();
  const [searchInput, setSearchInput] = React.useState(filters.search);
  const [editingAccount, setEditingAccount] = React.useState<AdminEmailProvider | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null);
  const debouncedSearch = useDebounce(searchInput, 350);
  React.useEffect(() => { setFilters({ search: debouncedSearch }); }, [debouncedSearch, setFilters]);
  React.useEffect(() => { fetchAccounts(); }, [filters, fetchAccounts]);

  const summary = React.useMemo(() => {
    const active = accounts.filter((account) => account.active).length;
    const blocked = accounts.filter((account) => account.blockedUntil && new Date(account.blockedUntil).getTime() > Date.now()).length;
    const withPassword = accounts.filter((account) => account.hasPassword).length;
    const usageToday = accounts.reduce((sum, account) => sum + (account.usageToday?.sentCount ?? 0), 0);
    const remainingQuota = accounts.reduce((sum, account) => sum + Math.max(account.dailyLimit - (account.usageToday?.sentCount ?? 0), 0), 0);
    return { active, blocked, withPassword, usageToday, remainingQuota };
  }, [accounts]);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'activate') await activateAccount(confirmAction.account.id);
    else if (confirmAction.type === 'deactivate') await deactivateAccount(confirmAction.account.id);
    else await deleteAccount(confirmAction.account.id);
    setConfirmAction(null);
  };

  const confirmTitle = confirmAction?.type === 'delete' ? 'Eliminar cuenta SMTP' : confirmAction?.type === 'deactivate' ? 'Desactivar cuenta SMTP' : 'Activar cuenta SMTP';
  const confirmDescription = confirmAction ? confirmAction.type === 'delete' ? `La cuenta ${confirmAction.account.name} dejará de estar disponible en el administrador.` : confirmAction.type === 'deactivate' ? `La cuenta ${confirmAction.account.name} saldrá de la rotación hasta que vuelvas a activarla.` : `La cuenta ${confirmAction.account.name} volverá a estar disponible para la rotación y el despacho de correos.` : '';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-brand text-xl font-black uppercase tracking-tight text-slate-900 sm:text-2xl">Proveedores SMTP</h1>
          <p className="mt-1 text-xs text-slate-400">Administra cuentas de correo, límites y estado operativo para la rotación de envíos.</p>
        </div>
        <button onClick={() => { setEditingAccount(null); setDialogOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-500"><Plus size={16} />Nueva cuenta</button>
      </div>

      {error && <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div><button onClick={clearError} className="text-rose-500 hover:text-rose-700"><X size={16} /></button></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><Mail size={16} /><span className="text-xs font-black uppercase tracking-[0.18em]">Activas</span></div><p className="mt-3 text-2xl font-black text-slate-900">{summary.active}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><Ban size={16} /><span className="text-xs font-black uppercase tracking-[0.18em]">Bloqueadas</span></div><p className="mt-3 text-2xl font-black text-slate-900">{summary.blocked}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><KeyRound size={16} /><span className="text-xs font-black uppercase tracking-[0.18em]">Con password</span></div><p className="mt-3 text-2xl font-black text-slate-900">{summary.withPassword}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><ShieldCheck size={16} /><span className="text-xs font-black uppercase tracking-[0.18em]">Uso hoy</span></div><p className="mt-3 text-2xl font-black text-slate-900">{summary.usageToday}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><Server size={16} /><span className="text-xs font-black uppercase tracking-[0.18em]">Cupo libre</span></div><p className="mt-3 text-2xl font-black text-slate-900">{summary.remainingQuota}</p></div>
      </div>

      <div className="space-y-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Buscar por nombre, key, correo o host…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />{searchInput && <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}</div>
        <div className="flex flex-wrap gap-2"><div className="relative min-w-[180px] flex-1"><select value={filters.active ?? 'all'} onChange={(e) => setFilters({ active: e.target.value as 'all' | 'true' | 'false' })} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="all">Todas las cuentas</option><option value="true">Solo activas</option><option value="false">Solo inactivas</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" /></div></div>
      </div>

      {isLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 rounded-2xl bg-slate-200 animate-pulse" />)}</div> : accounts.length === 0 ? <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm"><Mail size={32} className="mx-auto mb-3 text-slate-300" /><p className="font-bold text-slate-500">No hay cuentas SMTP registradas</p><p className="mt-1 text-sm text-slate-400">Crea la primera cuenta para empezar a operar la rotación de correos.</p></div> : <><div className="space-y-3 md:hidden">{accounts.map((account) => { const operational = getOperationalStatus(account); return <div key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-xl bg-slate-100 p-3 text-slate-600"><Mail size={18} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{account.name}</p><p className="truncate text-xs text-slate-500">{account.fromEmail}</p></div><ProviderActionMenu account={account} onEdit={() => { setEditingAccount(account); setDialogOpen(true); }} onActivate={() => setConfirmAction({ type: 'activate', account })} onDeactivate={() => setConfirmAction({ type: 'deactivate', account })} onDelete={() => setConfirmAction({ type: 'delete', account })} /></div><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={account.active ? 'ACTIVE' : 'INACTIVE'} /><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${operational.pill}`}>{operational.label}</span><span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">{account.hasPassword ? 'Credencial OK' : 'Sin password'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><p><span className="font-semibold text-slate-700">Uso hoy:</span> {account.usageToday?.sentCount ?? 0}/{account.dailyLimit}</p><p><span className="font-semibold text-slate-700">Reserva HIGH:</span> {account.reservedHighPriority}</p><p><span className="font-semibold text-slate-700">Host:</span> {account.smtpHost}:{account.smtpPort}</p><p><span className="font-semibold text-slate-700">Último uso:</span> {formatDate(account.lastUsedAt)}</p></div>{account.lastError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{account.lastError}</p>}</div></div></div>; })}</div><div className="hidden overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm md:block"><div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400"><tr><th className="px-4 py-3 font-black">Cuenta</th><th className="px-4 py-3 font-black">Estado</th><th className="px-4 py-3 font-black">Límites</th><th className="px-4 py-3 font-black">Uso / errores</th><th className="px-4 py-3 font-black">Último uso</th><th className="px-4 py-3 font-black text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{accounts.map((account) => { const operational = getOperationalStatus(account); return <tr key={account.id} className="align-top"><td className="px-4 py-4"><div className="min-w-[240px]"><p className="font-bold text-slate-900">{account.name}</p><p className="text-sm text-slate-500">{account.fromEmail}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{account.key}</span><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{account.smtpHost}:{account.smtpPort}</span><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{account.secure ? 'TLS/SSL' : 'STARTTLS/No secure'}</span></div></div></td><td className="px-4 py-4"><div className="space-y-2"><StatusBadge status={account.active ? 'ACTIVE' : 'INACTIVE'} /><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${operational.pill}`}>{operational.label}</span><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{account.hasPassword ? 'Password configurada' : 'Sin password'}</span></div></td><td className="px-4 py-4 text-sm text-slate-600"><div className="space-y-1"><p><span className="font-semibold text-slate-800">Diario:</span> {account.dailyLimit}</p><p><span className="font-semibold text-slate-800">Reserva HIGH:</span> {account.reservedHighPriority}</p><p><span className="font-semibold text-slate-800">Destinatarios:</span> {account.maxRecipientsPerMessage}</p><p><span className="font-semibold text-slate-800">Correo:</span> {account.maxEmailSizeMb} MB</p><p><span className="font-semibold text-slate-800">Adjuntos:</span> {account.maxAttachmentSizeMb} MB</p></div></td><td className="px-4 py-4 text-sm text-slate-600"><div className="space-y-2"><p><span className="font-semibold text-slate-800">Uso hoy:</span> {account.usageToday?.sentCount ?? 0}/{account.dailyLimit}</p><p><span className="font-semibold text-slate-800">Blocked until:</span> {formatDate(account.blockedUntil)}</p><p className="max-w-xs break-words"><span className="font-semibold text-slate-800">Último error:</span> {account.lastError || '—'}</p></div></td><td className="px-4 py-4 text-sm text-slate-600"><div className="space-y-1"><p>{formatDate(account.lastUsedAt)}</p><p className="text-xs text-slate-400">Actualizada {formatDate(account.updatedAt)}</p></div></td><td className="px-4 py-4 text-right"><ProviderActionMenu account={account} onEdit={() => { setEditingAccount(account); setDialogOpen(true); }} onActivate={() => setConfirmAction({ type: 'activate', account })} onDeactivate={() => setConfirmAction({ type: 'deactivate', account })} onDelete={() => setConfirmAction({ type: 'delete', account })} /></td></tr>; })}</tbody></table></div></div></>}

      <EmailProviderFormDialog open={dialogOpen} onOpenChange={setDialogOpen} account={editingAccount} />
      <ConfirmDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)} title={confirmTitle} description={confirmDescription} confirmLabel={confirmAction?.type === 'delete' ? 'Eliminar' : confirmAction?.type === 'deactivate' ? 'Desactivar' : 'Activar'} variant={confirmAction?.type === 'delete' ? 'danger' : 'warning'} isLoading={isSaving} onConfirm={handleConfirm} />
    </div>
  );
};

export default AdminEmailProviders;
