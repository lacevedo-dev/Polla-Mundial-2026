import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronDown, Edit3, Link2, Loader2, Plus, RefreshCw, Search, Trash2, Unlink2 } from 'lucide-react';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import AdminPagination from '../../components/admin/AdminPagination';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAdminMatchesStore } from '../../stores/admin.matches.store';
import type { AdminMatchLinkAudit, AdminMatchSyncLog } from '../../stores/admin.matches.store';
import type { FootballMatchLinkCandidate } from '../../types/football-sync';

const PHASES = ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER', 'SEMI', 'THIRD_PLACE', 'FINAL'];
const STATUSES_MATCH = ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'];
const LINKED_FILTERS = [
  { value: '', label: 'Todos los vinculos' },
  { value: 'true', label: 'Solo vinculados' },
  { value: 'false', label: 'Solo sin vinculo' },
];
const RISK_FILTERS = [
  { value: '', label: 'Todos los riesgos' },
  { value: 'healthy', label: 'Operativos' },
  { value: 'failing', label: 'Con fallos' },
  { value: 'blocked', label: 'Bloqueados' },
];
const LINK_SOURCE_FILTERS = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'manual', label: 'Manual' },
  { value: 'suggested', label: 'Sugerido' },
];

const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const formatDateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Sin sync';

const getSyncBadge = (status?: string | null) => {
  switch (status) {
    case 'SUCCESS':
      return { label: 'Sync OK', className: 'bg-emerald-100 text-emerald-700' };
    case 'PARTIAL':
      return { label: 'Parcial', className: 'bg-amber-100 text-amber-700' };
    case 'FAILED':
      return { label: 'Falló', className: 'bg-rose-100 text-rose-700' };
    case 'SKIPPED':
      return { label: 'Omitido', className: 'bg-slate-100 text-slate-600' };
    default:
      return { label: 'Pendiente', className: 'bg-slate-100 text-slate-600' };
  }
};

const getRiskBadge = (match: any) => {
  if (!match.externalId) return { label: 'Bloqueado', className: 'bg-amber-100 text-amber-700' };
  if (match.lastSyncStatus === 'FAILED') return { label: 'Con fallo', className: 'bg-rose-100 text-rose-700' };
  if (match.lastSyncStatus === 'SUCCESS') return { label: 'Operativo', className: 'bg-emerald-100 text-emerald-700' };
  return { label: 'Pendiente', className: 'bg-slate-100 text-slate-600' };
};

const summaryCardClassName = (active: boolean, tone: 'emerald' | 'rose' | 'amber' | 'slate') => {
  const tones = {
    emerald: active ? 'border-emerald-400 ring-2 ring-emerald-200 bg-emerald-50/70' : 'hover:border-emerald-300 focus:ring-emerald-300',
    rose: active ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/70' : 'hover:border-rose-300 focus:ring-rose-300',
    amber: active ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/70' : 'hover:border-amber-300 focus:ring-amber-300',
    slate: active ? 'border-slate-400 ring-2 ring-slate-200 bg-slate-50/80' : 'hover:border-slate-300 focus:ring-slate-300',
  };
  return `rounded-[1.5rem] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none ${tones[tone]}`;
};

const ScoreDialog: React.FC<{ match: any; open: boolean; onOpenChange: (v: boolean) => void; }> = ({ match, open, onOpenChange }) => {
  const { updateScore, isSaving } = useAdminMatchesStore();
  const [home, setHome] = React.useState(match?.homeScore ?? 0);
  const [away, setAway] = React.useState(match?.awayScore ?? 0);

  React.useEffect(() => {
    if (match) {
      setHome(match.homeScore ?? 0);
      setAway(match.awayScore ?? 0);
    }
  }, [match]);

  const handleSave = async () => {
    await updateScore(match.id, Number(home), Number(away));
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[1.75rem] bg-white p-6 shadow-2xl">
          <DialogPrimitive.Title className="mb-1 text-lg font-black text-slate-900">Actualizar resultado</DialogPrimitive.Title>
          <p className="mb-5 text-sm text-slate-500">{match?.homeTeam?.name} vs {match?.awayTeam?.name}</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{match?.homeTeam?.name}</label>
              <input type="number" min="0" value={home} onChange={(e) => setHome(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <span className="mt-4 text-2xl font-black text-slate-300">-</span>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{match?.awayTeam?.name}</label>
              <input type="number" min="0" value={away} onChange={(e) => setAway(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => onOpenChange(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={isSaving} className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-amber-500 disabled:opacity-60">{isSaving ? 'Guardando...' : 'Guardar resultado'}</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const LinkDialog: React.FC<{ match: any; open: boolean; onOpenChange: (v: boolean) => void; }> = ({ match, open, onOpenChange }) => {
  const { updateMatch, syncMatch, fetchLinkCandidates, fetchMatchHistory, isSaving } = useAdminMatchesStore();
  const [externalId, setExternalId] = React.useState(match?.externalId ?? '');
  const [candidates, setCandidates] = React.useState<FootballMatchLinkCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [syncHistory, setSyncHistory] = React.useState<AdminMatchSyncLog[]>([]);
  const [linkAudit, setLinkAudit] = React.useState<AdminMatchLinkAudit[]>([]);

  React.useEffect(() => {
    setExternalId(match?.externalId ?? '');
    setCandidates([]);
    setSelectedCandidate('');
    setLocalError(null);
    setSyncHistory([]);
    setLinkAudit([]);
  }, [match]);

  React.useEffect(() => {
    if (!open || !match?.id) return;

    let mounted = true;
    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const history = await fetchMatchHistory(match.id);
        if (!mounted) return;
        setSyncHistory(history.syncLogs);
        setLinkAudit(history.linkAudit);
      } catch (error: any) {
        if (mounted) setLocalError(error?.message || 'No se pudo cargar el historial');
      } finally {
        if (mounted) setIsLoadingHistory(false);
      }
    };

    loadHistory();
    return () => {
      mounted = false;
    };
  }, [open, match?.id, fetchMatchHistory]);

  const handleSearchCandidates = async () => {
    try {
      setIsSearching(true);
      setLocalError(null);
      const result = await fetchLinkCandidates(match.id);
      setCandidates(result);
      setSelectedCandidate(result[0]?.fixtureId ?? '');
      if (result[0]?.fixtureId) setExternalId(result[0].fixtureId);
    } catch (error: any) {
      setLocalError(error?.message || 'No se pudieron cargar candidatos');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    await updateMatch(match.id, { externalId, linkSource: selectedCandidate === externalId ? 'suggested' : 'manual' });
    onOpenChange(false);
  };

  const handleUnlink = async () => {
    await updateMatch(match.id, { externalId: '' });
    onOpenChange(false);
  };

  const handleSync = async () => {
    if (!match?.externalId && !externalId.trim()) return;
    if (!match?.externalId && externalId.trim()) {
      await updateMatch(match.id, { externalId, linkSource: selectedCandidate === externalId ? 'suggested' : 'manual' });
    }
    await syncMatch(match.id);
    onOpenChange(false);
  };

  const syncBadge = getSyncBadge(match?.lastSyncStatus);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
          <DialogPrimitive.Title className="mb-1 text-lg font-black text-slate-900">Vinculo API-Football</DialogPrimitive.Title>
          <p className="mb-5 text-sm text-slate-500">{match?.homeTeam?.name} vs {match?.awayTeam?.name}</p>

          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fixture / External ID</label>
          <input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="Ej: 123456" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {match?.externalId ? `Actualmente vinculado a ${match.externalId}` : 'Este partido aun no tiene un vinculo configurado.'}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Buscar candidatos</p>
                <p className="text-xs text-slate-500">Consulta API-Football y sugiere fixtures probables para este partido.</p>
              </div>
              <button onClick={handleSearchCandidates} disabled={isSaving || isSearching} className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60">
                {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Buscar
              </button>
            </div>

            {localError && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{localError}</div>}

            {candidates.length > 0 && (
              <div className="mt-3 space-y-2">
                {candidates.slice(0, 4).map((candidate) => (
                  <label key={candidate.fixtureId} className={`block cursor-pointer rounded-xl border p-3 transition ${selectedCandidate === candidate.fixtureId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <input type="radio" className="sr-only" checked={selectedCandidate === candidate.fixtureId} onChange={() => { setSelectedCandidate(candidate.fixtureId); setExternalId(candidate.fixtureId); }} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{candidate.homeTeam} vs {candidate.awayTeam}</p>
                        <p className={`mt-1 text-xs ${selectedCandidate === candidate.fixtureId ? 'text-slate-200' : 'text-slate-500'}`}>{formatDateTime(candidate.kickoff)} · {candidate.leagueName}</p>
                        <p className={`mt-1 text-[11px] ${selectedCandidate === candidate.fixtureId ? 'text-slate-300' : 'text-slate-500'}`}>Fixture ID: {candidate.fixtureId}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${selectedCandidate === candidate.fixtureId ? 'bg-white/10 text-white' : candidate.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : candidate.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{candidate.confidence}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ultimo sync</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${syncBadge.className}`}>{syncBadge.label}</span>
                <span className="text-xs text-slate-500">{formatDateTime(match?.lastSyncAt)}</span>
              </div>
              {match?.lastSyncTriggeredBy && <p className="mt-2 text-xs text-slate-500">Origen: {match.lastSyncTriggeredBy}</p>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Riesgo operativo</p>
              <p className="mt-2 text-xs text-slate-600">{match?.externalId ? 'El partido ya puede sincronizarse manual o automaticamente.' : 'Sin vinculo activo: este partido no podra sincronizarse hasta asociar un fixture.'}</p>
              {match?.lastSyncError && <p className="mt-2 text-xs font-medium text-rose-600">Ultimo error: {match.lastSyncError}</p>}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Historial de sync</p>
                {isLoadingHistory && <span className="text-[11px] text-slate-400">Cargando...</span>}
              </div>
              <div className="mt-3 space-y-2">
                {syncHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay eventos recientes de sincronización.</p>
                ) : (
                  syncHistory.map((entry) => {
                    const badge = getSyncBadge(entry.status);
                    return (
                      <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${badge.className}`}>{badge.label}</span>
                          <span className="text-[11px] font-bold uppercase text-slate-500">{entry.type}</span>
                          <span className="text-[11px] text-slate-400">{formatDateTime(entry.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-700">{entry.message}</p>
                        {entry.error && <p className="mt-1 text-xs text-rose-600">{entry.error}</p>}
                        {entry.triggeredBy && <p className="mt-1 text-[11px] text-slate-500">Origen: {entry.triggeredBy}</p>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Trazabilidad del vínculo</p>
              <div className="mt-3 space-y-2">
                {linkAudit.length === 0 ? (
                  <p className="text-xs text-slate-500">No hay cambios manuales auditados todavía.</p>
                ) : (
                  linkAudit.map((audit) => (
                    <div key={audit.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase text-violet-700">
                          {audit.action === 'MATCH_EXTERNAL_LINK_REMOVED' ? 'Desvinculado' : 'Vinculado'}
                        </span>
                        {audit.detailData?.linkSource && audit.action !== 'MATCH_EXTERNAL_LINK_REMOVED' && (
                          <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-white">
                            {audit.detailData.linkSource === 'suggested' ? 'Sugerido' : 'Manual'}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{formatDateTime(audit.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-700">
                        {audit.user?.name || 'Usuario'} {audit.action === 'MATCH_EXTERNAL_LINK_REMOVED' ? 'quitó' : 'actualizó'} el vínculo
                      </p>
                      {audit.user?.email && <p className="mt-1 text-[11px] text-slate-500">{audit.user.email}</p>}
                      {audit.detailData?.externalId && (
                        <p className="mt-1 text-[11px] text-slate-500">Fixture: {audit.detailData.externalId}</p>
                      )}
                      {audit.detailData && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-bold text-slate-500">Ver detalle</summary>
                          <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
                            {audit.detailData.previousExternalId && <p>ID anterior: {audit.detailData.previousExternalId}</p>}
                            {audit.detailData.externalId && <p>ID actual: {audit.detailData.externalId}</p>}
                            {audit.detailData.linkSource && <p>Origen: {audit.detailData.linkSource}</p>}
                          </div>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button onClick={handleSave} disabled={isSaving} className="rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-amber-500 disabled:opacity-60">Guardar</button>
            <button onClick={handleSync} disabled={isSaving || (!match?.externalId && !externalId.trim())} className="rounded-xl border border-lime-300 py-2.5 text-sm font-bold text-lime-700 transition-all hover:bg-lime-50 disabled:opacity-60">Sync ahora</button>
            <button onClick={handleUnlink} disabled={isSaving || !match?.externalId} className="rounded-xl border border-rose-200 py-2.5 text-sm font-bold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-60">Desvincular</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const CreateMatchDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void; }> = ({ open, onOpenChange }) => {
  const { teams, createMatch, isSaving } = useAdminMatchesStore();
  const [form, setForm] = React.useState({ homeTeamId: '', awayTeamId: '', phase: 'GROUP', matchDate: '', venue: '', group: '' });

  const handleCreate = async () => {
    await createMatch(form as any);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
          <DialogPrimitive.Title className="mb-5 text-lg font-black text-slate-900">Crear partido</DialogPrimitive.Title>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Equipo local</label>
                <select value={form.homeTeamId} onChange={(e) => setForm({ ...form, homeTeamId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">Seleccionar...</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Equipo visitante</label>
                <select value={form.awayTeamId} onChange={(e) => setForm({ ...form, awayTeamId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">Seleccionar...</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fase</label>
                <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Grupo</label>
                <input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Ej: A" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fecha y hora</label>
              <input type="datetime-local" value={form.matchDate} onChange={(e) => setForm({ ...form, matchDate: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estadio / sede</label>
              <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Ej: Estadio Azteca" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => onOpenChange(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50">Cancelar</button>
            <button onClick={handleCreate} disabled={isSaving || !form.homeTeamId || !form.awayTeamId || !form.matchDate} className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-amber-500 disabled:opacity-60">{isSaving ? 'Creando...' : 'Crear partido'}</button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const AdminMatches: React.FC = () => {
  const { matches, total, summary, filters, isLoading, isSaving, fetchMatches, fetchTeams, deleteMatch, setFilters, syncMatch } = useAdminMatchesStore();
  const [scoreMatch, setScoreMatch] = React.useState<any>(null);
  const [linkMatch, setLinkMatch] = React.useState<any>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    fetchMatches();
    fetchTeams();
  }, [filters, fetchMatches, fetchTeams]);

  const applyQuickFilter = React.useCallback((risk?: 'blocked' | 'failing' | 'healthy', linkSource?: 'manual' | 'suggested') => {
    setFilters({ risk, linkSource, page: 1 });
  }, [setFilters]);

  const hasActiveFilters = Boolean(filters.phase || filters.status || filters.linked || filters.risk || filters.linkSource);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-brand text-2xl font-black uppercase tracking-tight text-slate-900">Partidos</h1>
          <p className="mt-1 text-sm text-slate-500">{total.toLocaleString()} partidos</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-amber-500 sm:w-auto">
          <Plus size={16} /> Nuevo partido
        </button>
      </div>

      <section aria-label="Resumen operativo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" aria-pressed={filters.risk === 'healthy'} onClick={() => applyQuickFilter('healthy')} className={summaryCardClassName(filters.risk === 'healthy', 'emerald')}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Operativos</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{summary.healthy}</p>
          <p className="mt-1 text-xs text-slate-500">Con vínculo y sync exitoso</p>
        </button>
        <button type="button" aria-pressed={filters.risk === 'failing'} onClick={() => applyQuickFilter('failing')} className={summaryCardClassName(filters.risk === 'failing', 'rose')}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Con fallos</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{summary.failing}</p>
          <p className="mt-1 text-xs text-slate-500">Necesitan revisión</p>
        </button>
        <button type="button" aria-pressed={filters.risk === 'blocked'} onClick={() => applyQuickFilter('blocked')} className={summaryCardClassName(filters.risk === 'blocked', 'amber')}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Bloqueados</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{summary.blocked}</p>
          <p className="mt-1 text-xs text-slate-500">Sin vínculo activo</p>
        </button>
        <button type="button" aria-pressed={!filters.risk && !filters.linkSource} onClick={() => setFilters({ risk: undefined, linkSource: undefined, page: 1 })} className={summaryCardClassName(!filters.risk && !filters.linkSource, 'slate')}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pendientes</p>
          <p className="mt-2 text-2xl font-black text-slate-700">{summary.pending}</p>
          <p className="mt-1 text-xs text-slate-500">Aún sin estado claro</p>
        </button>
      </section>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Filtros activos</span>
          {filters.phase && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">Fase: {filters.phase}</span>}
          {filters.status && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">Estado: {filters.status}</span>}
          {filters.linked && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{filters.linked === 'true' ? 'Vinculados' : 'Sin vínculo'}</span>}
          {filters.risk && <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">Riesgo: {filters.risk}</span>}
          {filters.linkSource && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">Origen: {filters.linkSource}</span>}
          <button
            type="button"
            onClick={() => setFilters({ page: 1, phase: undefined, status: undefined, linked: undefined, risk: undefined, linkSource: undefined })}
            className="ml-auto rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <select value={filters.phase ?? ''} onChange={(e) => setFilters({ phase: e.target.value || undefined, page: 1 })} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Todas las fases</option>
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select value={filters.status ?? ''} onChange={(e) => setFilters({ status: e.target.value || undefined, page: 1 })} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Todos los estados</option>
            {STATUSES_MATCH.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select value={filters.linked ?? ''} onChange={(e) => setFilters({ linked: (e.target.value as 'true' | 'false' | '') || undefined, page: 1 })} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {LINKED_FILTERS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select value={filters.risk ?? ''} onChange={(e) => setFilters({ risk: (e.target.value as 'blocked' | 'failing' | 'healthy' | '') || undefined, page: 1 })} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {RISK_FILTERS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="relative">
          <select value={filters.linkSource ?? ''} onChange={(e) => setFilters({ linkSource: (e.target.value as 'manual' | 'suggested' | '') || undefined, page: 1 })} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            {LINK_SOURCE_FILTERS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {isLoading ? null : matches.length === 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 md:hidden">
          No se encontraron partidos
        </div>
      ) : (
      <div className="grid gap-3 md:hidden">
        {matches.map((match) => {
          const syncBadge = getSyncBadge(match.lastSyncStatus);
          const riskBadge = getRiskBadge(match);
          return (
            <article key={`${match.id}-mobile`} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{match.homeTeam.name} <span className="font-normal text-slate-400">vs</span> {match.awayTeam.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(match.matchDate)} · {match.phase}</p>
                </div>
                <StatusBadge status={match.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${riskBadge.className}`}>{riskBadge.label}</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${syncBadge.className}`}>{syncBadge.label}</span>
                {match.externalId ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">Vinculado</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">Sin vinculo</span>
                )}
                {match.currentLinkSource && (
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                    {match.currentLinkSource === 'suggested' ? 'Sugerido' : 'Manual'}
                  </span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-black uppercase tracking-[0.14em] text-slate-400">Resultado</dt>
                  <dd className="mt-1 font-bold text-slate-800">{match.homeScore != null ? `${match.homeScore} - ${match.awayScore}` : '- - -'}</dd>
                </div>
                <div>
                  <dt className="font-black uppercase tracking-[0.14em] text-slate-400">Sync</dt>
                  <dd className="mt-1 text-slate-600">{formatDateTime(match.lastSyncAt)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-black uppercase tracking-[0.14em] text-slate-400">Fixture</dt>
                  <dd className="mt-1 font-mono text-slate-600">{match.externalId || 'Pendiente de vincular'}</dd>
                </div>
                {(match.lastSyncError || match.lastSyncMessage) && (
                  <div className="col-span-2">
                    <dt className="font-black uppercase tracking-[0.14em] text-slate-400">Contexto</dt>
                    <dd className={`mt-1 ${match.lastSyncError ? 'text-rose-600' : 'text-slate-600'}`}>{match.lastSyncError || match.lastSyncMessage}</dd>
                  </div>
                )}
              </dl>
              <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Más contexto
                </summary>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p><span className="font-black text-slate-800">Syncs:</span> {match.syncCount ? `${match.syncCount}` : '0'}</p>
                  <p><span className="font-black text-slate-800">Origen:</span> {match.lastSyncTriggeredBy || 'Sin dato'}</p>
                  <p><span className="font-black text-slate-800">Riesgo:</span> {riskBadge.label}</p>
                  <p><span className="font-black text-slate-800">Tipo de vínculo:</span> {match.currentLinkSource === 'suggested' ? 'Sugerido' : match.currentLinkSource === 'manual' ? 'Manual' : 'Sin dato'}</p>
                </div>
              </details>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <button onClick={() => setLinkMatch(match)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700" aria-label={`Gestionar vínculo de ${match.homeTeam.name} vs ${match.awayTeam.name}`}><Link2 size={14} className="mx-auto" /></button>
                <button onClick={() => syncMatch(match.id)} disabled={isSaving || !match.externalId} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 disabled:opacity-40" aria-label={`Sincronizar ${match.homeTeam.name} vs ${match.awayTeam.name}`}><RefreshCw size={14} className="mx-auto" /></button>
                <button onClick={() => setScoreMatch(match)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700" aria-label={`Editar resultado de ${match.homeTeam.name} vs ${match.awayTeam.name}`}><Edit3 size={14} className="mx-auto" /></button>
                <button onClick={() => setConfirmDelete({ id: match.id, name: `${match.homeTeam.name} vs ${match.awayTeam.name}` })} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold text-rose-600" aria-label={`Eliminar ${match.homeTeam.name} vs ${match.awayTeam.name}`}><Trash2 size={14} className="mx-auto" /></button>
              </div>
            </article>
          );
        })}
      </div>
      )}

      <div className="hidden overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm md:block">
        <div className="grid grid-cols-[2fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 md:grid-cols-[2fr_1fr_1fr_1.2fr_auto]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Partido</p>
          <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 md:block">Resultado</p>
          <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 md:block">Estado</p>
          <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 md:block">Vinculo API</p>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Acciones</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>
        ) : matches.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No se encontraron partidos</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {matches.map((match) => {
              const syncBadge = getSyncBadge(match.lastSyncStatus);
              const riskBadge = getRiskBadge(match);
              return (
                <div key={match.id} className="grid grid-cols-[2fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 md:grid-cols-[2fr_1fr_1fr_1.2fr_auto]">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{match.homeTeam.name} <span className="font-normal text-slate-400">vs</span> {match.awayTeam.name}</p>
                    <p className="text-xs text-slate-400">{formatDate(match.matchDate)} - {match.phase}</p>
                  </div>
                  <p className="hidden text-sm font-black text-slate-700 md:block">{match.homeScore != null ? `${match.homeScore} - ${match.awayScore}` : '- - -'}</p>
                  <div className="hidden md:block"><StatusBadge status={match.status} /></div>
                  <div className="hidden md:block">
                    {match.externalId ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><Link2 size={12} /> Vinculado</span>
                        <p className="text-xs font-mono text-slate-500">{match.externalId}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${riskBadge.className}`}>{riskBadge.label}</span>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${syncBadge.className}`}>{syncBadge.label}</span>
                          {match.currentLinkSource && (
                            <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-white">
                              {match.currentLinkSource === 'suggested' ? 'Sugerido' : 'Manual'}
                            </span>
                          )}
                          <p className="text-[11px] text-slate-400">{match.syncCount ? `${match.syncCount} syncs` : 'Sin syncs'}</p>
                        </div>
                        <p className="text-[11px] text-slate-400">{formatDateTime(match.lastSyncAt)}</p>
                        {match.lastSyncError ? (
                          <p className="line-clamp-2 text-[11px] text-rose-600">{match.lastSyncError}</p>
                        ) : match.lastSyncMessage ? (
                          <p className="line-clamp-2 text-[11px] text-slate-400">{match.lastSyncMessage}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700"><Unlink2 size={12} /> Sin vinculo</span>
                        <p className="text-[11px] text-slate-400">Pendiente de asociar fixture</p>
                        <p className="text-[11px] text-slate-400">Riesgo: no se sincroniza hasta vincularse</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setLinkMatch(match)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-violet-50 hover:text-violet-600" title={match.externalId ? 'Gestionar vinculo' : 'Vincular'}><Link2 size={14} /></button>
                    <button onClick={() => syncMatch(match.id)} disabled={isSaving || !match.externalId} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-lime-50 hover:text-lime-600 disabled:opacity-40" title="Sincronizar ahora"><RefreshCw size={14} /></button>
                    <button onClick={() => setScoreMatch(match)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600" title="Editar resultado"><Edit3 size={14} /></button>
                    <button onClick={() => setConfirmDelete({ id: match.id, name: `${match.homeTeam.name} vs ${match.awayTeam.name}` })} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdminPagination page={filters.page} limit={filters.limit} total={total} onPageChange={(p) => setFilters({ page: p })} />

      <ScoreDialog match={scoreMatch} open={!!scoreMatch} onOpenChange={(v) => { if (!v) setScoreMatch(null); }} />
      <LinkDialog match={linkMatch} open={!!linkMatch} onOpenChange={(v) => { if (!v) setLinkMatch(null); }} />
      <CreateMatchDialog open={showCreate} onOpenChange={setShowCreate} />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}
        title="Eliminar partido"
        description={`¿Eliminar "${confirmDelete?.name}"? Se eliminaran tambien todos sus pronosticos.`}
        confirmLabel="Eliminar"
        isLoading={isSaving}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteMatch(confirmDelete.id);
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
};

export default AdminMatches;
