
import React, { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Siren,
  Sparkles,
  TimerReset,
} from 'lucide-react';
import { useFootballSyncStore } from '../../stores/football-sync.store';
import type { FootballMatchLinkCandidate } from '../../types/football-sync';

type DashboardTab = 'overview' | 'actions' | 'activity';
type ActionState = 'force' | 'toggle' | 'backfill' | null;
type LinkModalState = { matchId: string; title: string };

const tabs: Array<{ id: DashboardTab; label: string; description: string }> = [
  { id: 'overview', label: 'Resumen', description: 'Estado general, checklist y bloqueos' },
  { id: 'actions', label: 'Acciones', description: 'Flujo completo y accesos rápidos' },
  { id: 'activity', label: 'Actividad', description: 'Últimos eventos y alertas activas' },
];

const confidenceStyles: Record<FootballMatchLinkCandidate['confidence'], string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-slate-200 bg-slate-50 text-slate-600',
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Sin registro';
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

const formatRelativeCountdown = (seconds: number) => {
  if (seconds <= 0) return 'Disponible ahora';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

const compactNumber = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
const DASHBOARD_REFRESH_INTERVAL_MS = 30_000;

const FootballSyncDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    dashboard,
    config,
    isLoading,
    error,
    fetchDashboard,
    fetchConfig,
    forceSync,
    pauseSync,
    resumeSync,
    backfillTeams,
    fetchLinkCandidates,
    linkMatch,
    syncMatch,
  } = useFootballSyncStore();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModalState | null>(null);
  const [candidateState, setCandidateState] = useState({
    isLoading: false,
    isSubmitting: false,
    candidates: [] as FootballMatchLinkCandidate[],
    selectedExternalId: '',
    manualExternalId: '',
    error: null as string | null,
  });

  useEffect(() => {
    fetchDashboard();
    fetchConfig();

    const intervalId = window.setInterval(() => {
      fetchDashboard();
      fetchConfig();
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [fetchDashboard, fetchConfig]);

  const autoSyncEnabled = config?.autoSyncEnabled ?? dashboard?.readiness.autoSyncEnabled ?? false;
  const requestsPercentage = dashboard?.todayStats.requestsPercentage ?? 0;

  const readinessItems = useMemo(() => {
    if (!dashboard) return [];

    return [
      {
        label: 'API key configurada',
        description: dashboard.readiness.apiKeyConfigured
          ? 'El backend puede consultar API-Football.'
          : 'Configura API_FOOTBALL_KEY para habilitar la sincronización.',
        ok: dashboard.readiness.apiKeyConfigured,
      },
      {
        label: 'Sistema habilitado',
        description: dashboard.status.isEnabled
          ? 'El módulo está activo y puede ejecutar procesos.'
          : 'El módulo está deshabilitado globalmente.',
        ok: dashboard.status.isEnabled,
      },
      {
        label: 'Sincronización automática',
        description: autoSyncEnabled
          ? 'El scheduler puede ejecutar sincronizaciones programadas.'
          : 'La sincronización automática está pausada.',
        ok: autoSyncEnabled,
      },
      {
        label: 'Partidos vinculados hoy',
        description:
          dashboard.readiness.todayMatchesTotal > 0
            ? `${dashboard.readiness.linkedMatchesToday} de ${dashboard.readiness.todayMatchesTotal} partidos ya tienen externalId.`
            : 'No hay partidos locales programados para hoy.',
        ok: dashboard.readiness.todayMatchesTotal === 0 || dashboard.readiness.unlinkedMatchesToday === 0,
      },
      {
        label: 'Requests disponibles',
        description: `${dashboard.readiness.requestsRemaining} disponibles de ${dashboard.todayStats.requestsLimit}.`,
        ok: dashboard.readiness.requestsRemaining > 0,
      },
    ];
  }, [autoSyncEnabled, dashboard]);

  const metricCards = useMemo(() => {
    if (!dashboard) return [];

    return [
      {
        label: 'Estado',
        value: dashboard.status.isEnabled ? 'Activo' : 'Pausado',
        helper: dashboard.status.isEmergencyMode ? 'Modo emergencia' : 'Operación normal',
      },
      {
        label: 'Requests hoy',
        value: `${compactNumber(dashboard.todayStats.requestsUsed)} / ${compactNumber(dashboard.todayStats.requestsLimit)}`,
        helper: `${Math.round(requestsPercentage)}% consumido`,
      },
      {
        label: 'Partidos actualizados',
        value: compactNumber(dashboard.todayStats.matchesSynced),
        helper: `${dashboard.todayStats.successfulSyncs} sync OK · ${dashboard.todayStats.failedSyncs} con fallo`,
      },
      {
        label: 'Próximo intento',
        value: formatRelativeCountdown(dashboard.status.nextSyncIn),
        helper: `Último sync: ${formatDateTime(dashboard.status.lastSyncAt)}`,
      },
    ];
  }, [dashboard, requestsPercentage]);
  const runDashboardAction = async (action: ActionState, callback: () => Promise<void>, successMessage: string) => {
    try {
      setActionState(action);
      setActionFeedback(null);
      await callback();
      setActionFeedback({ type: 'success', message: successMessage });
      await Promise.all([fetchDashboard(), fetchConfig()]);
    } catch (actionError: any) {
      setActionFeedback({ type: 'error', message: actionError?.message || 'No se pudo completar la acción.' });
    } finally {
      setActionState(null);
    }
  };

  const resetLinkFlow = () => {
    setLinkModal(null);
    setCandidateState({
      isLoading: false,
      isSubmitting: false,
      candidates: [],
      selectedExternalId: '',
      manualExternalId: '',
      error: null,
    });
  };

  const openLinkFlow = async (match: { id: string; homeTeam: string; awayTeam: string }) => {
    setLinkModal({ matchId: match.id, title: `${match.homeTeam} vs ${match.awayTeam}` });
    setCandidateState({
      isLoading: true,
      isSubmitting: false,
      candidates: [],
      selectedExternalId: '',
      manualExternalId: '',
      error: null,
    });

    try {
      const candidates = await fetchLinkCandidates(match.id);
      setCandidateState({
        isLoading: false,
        isSubmitting: false,
        candidates,
        selectedExternalId: candidates[0]?.fixtureId ?? '',
        manualExternalId: '',
        error: null,
      });
    } catch (lookupError: any) {
      setCandidateState({
        isLoading: false,
        isSubmitting: false,
        candidates: [],
        selectedExternalId: '',
        manualExternalId: '',
        error: lookupError?.message || 'No se pudieron cargar los candidatos.',
      });
    }
  };

  const handleLinkAndSync = async () => {
    if (!linkModal) return;

    const externalId = candidateState.manualExternalId.trim() || candidateState.selectedExternalId;
    if (!externalId) {
      setCandidateState((current) => ({ ...current, error: 'Selecciona un fixture o ingresa un fixture ID manual.' }));
      return;
    }

    try {
      setCandidateState((current) => ({ ...current, isSubmitting: true, error: null }));
      await linkMatch(linkModal.matchId, externalId);

      try {
        await syncMatch(linkModal.matchId);
        setActionFeedback({ type: 'success', message: `Partido vinculado y sincronizado con fixture ${externalId}.` });
      } catch (syncError: any) {
        setActionFeedback({
          type: 'error',
          message: syncError?.message || `El partido quedó vinculado al fixture ${externalId}, pero la sincronización inicial falló.`,
        });
      }

      await Promise.all([fetchDashboard(), fetchConfig()]);
      resetLinkFlow();
    } catch (linkError: any) {
      setCandidateState((current) => ({
        ...current,
        isSubmitting: false,
        error: linkError?.message || 'No se pudo vincular el partido seleccionado.',
      }));
    }
  };

  if (isLoading && !dashboard) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="h-28 rounded-[1.75rem] bg-slate-200/70" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 pb-6 sm:space-y-5 lg:space-y-6">
        <header className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-lime-600">Football Sync</p>
                <h1 className="font-brand text-2xl font-black uppercase tracking-tight text-slate-950 sm:text-3xl">
                  Centro operativo API-Football
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                  Este módulo consulta API-Football, sincroniza marcadores, detecta partidos en vivo, actualiza resultados locales y recalcula
                  puntos cuando un partido termina.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metricCards.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-lg font-black leading-tight text-slate-950 sm:text-xl">{metric.value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{metric.helper}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto sm:grid-cols-2 xl:min-w-[280px]">
              <button
                type="button"
                onClick={() => runDashboardAction('force', forceSync, 'Se ejecutó una sincronización manual.')}
                disabled={actionState !== null}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionState === 'force' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync ahora
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/football-sync/config')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" />
                Configurar
              </button>
            </div>
          </div>

          {(error || actionFeedback) && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${actionFeedback?.type === 'error' || error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error || actionFeedback?.message}
            </div>
          )}
        </header>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
          <div role="tablist" aria-label="Secciones de Football Sync" className="grid grid-cols-3 gap-2">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`football-sync-tab-${tab.id}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`football-sync-panel-${tab.id}`}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl px-3 py-3 text-left transition sm:px-4 ${selected ? 'bg-slate-950 text-white shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  <span className="block text-sm font-black">{tab.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${selected ? 'text-slate-200' : 'text-slate-500'}`}>{tab.description}</span>
                </button>
              );
            })}
          </div>
        </section>
        {dashboard && (
          <>
            {activeTab === 'overview' && (
              <section id="football-sync-panel-overview" role="tabpanel" aria-labelledby="football-sync-tab-overview" className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-lime-600" />
                    <div>
                      <h2 className="text-lg font-black text-slate-950">Qué hace este módulo</h2>
                      <p className="text-sm text-slate-500">Explica claramente qué puede ejecutar hoy y qué está bloqueando la operación.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-800">Sincronización inteligente</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Consulta fixtures del día, detecta cambios y actualiza resultados solo cuando hay eventos relevantes o ventanas programadas.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-800">Recalculo automático</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Cuando el partido finaliza, el sistema actualiza el marcador local y recalcula los puntos de las predicciones relacionadas.</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-slate-900" />
                      <div>
                        <h3 className="text-base font-black text-slate-950">Checklist operativo</h3>
                        <p className="text-sm text-slate-500">Verifica en segundos si el módulo está listo para operar.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {readinessItems.map((item) => (
                        <div key={item.label} className={`rounded-2xl border px-4 py-3 ${item.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                          <div className="flex items-start gap-3">
                            {item.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />}
                            <div>
                              <p className="text-sm font-bold text-slate-900">{item.label}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <aside className="space-y-4">
                  <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center gap-3">
                      <Siren className="h-5 w-5 text-rose-600" />
                      <div>
                        <h2 className="text-lg font-black text-slate-950">Bloqueos operativos</h2>
                        <p className="text-sm text-slate-500">Motivos por los que el sync puede no ejecutar nada.</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {dashboard.readiness.blockers.length > 0 ? dashboard.readiness.blockers.map((blocker) => (
                        <div key={blocker} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{blocker}</div>
                      )) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">No hay bloqueos activos. El módulo está listo para sincronizar.</div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center gap-3">
                      <Clock3 className="h-5 w-5 text-blue-600" />
                      <div>
                        <h2 className="text-lg font-black text-slate-950">Cobertura de hoy</h2>
                        <p className="text-sm text-slate-500">Cuántos partidos pueden sincronizarse realmente.</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                          <span>Partidos vinculados</span>
                          <span>{dashboard.readiness.linkedMatchesToday} / {dashboard.readiness.todayMatchesTotal}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-lime-500 transition-all" style={{ width: `${dashboard.readiness.todayMatchesTotal > 0 ? (dashboard.readiness.linkedMatchesToday / dashboard.readiness.todayMatchesTotal) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Sin vincular</dt>
                          <dd className="mt-1 text-xl font-black text-slate-950">{dashboard.readiness.unlinkedMatchesToday}</dd>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <dt className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Requests restantes</dt>
                          <dd className="mt-1 text-xl font-black text-slate-950">{dashboard.readiness.requestsRemaining}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                </aside>
              </section>
            )}

            {activeTab === 'actions' && (
              <section id="football-sync-panel-actions" role="tabpanel" aria-labelledby="football-sync-tab-actions" className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">Acciones rápidas</h2>
                      <p className="text-sm text-slate-500">Define límites, activa o pausa el módulo y ejecuta tareas de preparación sin salir de esta pantalla.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Flujo completo</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => runDashboardAction('force', forceSync, 'Se lanzó una sincronización manual.')} disabled={actionState !== null} className="rounded-2xl border border-lime-200 bg-lime-50 p-4 text-left transition hover:bg-lime-100 disabled:opacity-60">
                      <div className="flex items-center gap-3">
                        {actionState === 'force' ? <Loader2 className="h-5 w-5 animate-spin text-lime-700" /> : <RefreshCw className="h-5 w-5 text-lime-700" />}
                        <div>
                          <p className="text-sm font-black text-slate-950">Ejecutar sync ahora</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Fuerza una verificación inmediata del plan, partidos del día y estado actual.</p>
                        </div>
                      </div>
                    </button>

                    <button type="button" onClick={() => runDashboardAction('toggle', autoSyncEnabled ? pauseSync : resumeSync, autoSyncEnabled ? 'La sincronización automática quedó pausada.' : 'La sincronización automática quedó reanudada.')} disabled={actionState !== null} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:bg-amber-100 disabled:opacity-60">
                      <div className="flex items-center gap-3">
                        {actionState === 'toggle' ? <Loader2 className="h-5 w-5 animate-spin text-amber-700" /> : autoSyncEnabled ? <Pause className="h-5 w-5 text-amber-700" /> : <Play className="h-5 w-5 text-amber-700" />}
                        <div>
                          <p className="text-sm font-black text-slate-950">{autoSyncEnabled ? 'Pausar auto sync' : 'Reanudar auto sync'}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{autoSyncEnabled ? 'Detiene los procesos automáticos sin deshabilitar el módulo completo.' : 'Vuelve a permitir que el scheduler ejecute sincronizaciones programadas.'}</p>
                        </div>
                      </div>
                    </button>
                    <button type="button" onClick={() => runDashboardAction('backfill', backfillTeams, 'Se ejecutó el backfill del catálogo de equipos.')} disabled={actionState !== null} className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-left transition hover:bg-cyan-100 disabled:opacity-60">
                      <div className="flex items-center gap-3">
                        {actionState === 'backfill' ? <Loader2 className="h-5 w-5 animate-spin text-cyan-700" /> : <TimerReset className="h-5 w-5 text-cyan-700" />}
                        <div>
                          <p className="text-sm font-black text-slate-950">Backfill de equipos</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Crea o actualiza el catálogo local para facilitar el vínculo entre partidos y fixtures.</p>
                        </div>
                      </div>
                    </button>

                    <button type="button" onClick={() => navigate('/admin/football-sync/config')} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100">
                      <div className="flex items-center gap-3">
                        <Settings2 className="h-5 w-5 text-slate-700" />
                        <div>
                          <p className="text-sm font-black text-slate-950">Configuración avanzada</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Ajusta límites diarios, intervalos, alertas y reglas del scheduler.</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </article>

                <div className="space-y-4">
                  <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center gap-3">
                      <Link2 className="h-5 w-5 text-violet-600" />
                      <div>
                        <h2 className="text-lg font-black text-slate-950">Partidos pendientes por vincular</h2>
                        <p className="text-sm text-slate-500">Desde aquí puedes buscar fixture, vincularlo y lanzar la primera sincronización.</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {dashboard.readiness.unlinkedMatchesPreview.length > 0 ? dashboard.readiness.unlinkedMatchesPreview.map((match) => (
                        <div key={match.id} className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-slate-950">{match.homeTeam} vs {match.awayTeam}</p>
                              <p className="mt-1 text-sm text-slate-600">{formatDateTime(match.matchDate)} · ID local: {match.id}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => openLinkFlow(match)} className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100">
                                <Search className="h-3.5 w-3.5" />
                                Buscar fixture
                              </button>
                              <button type="button" onClick={() => navigate('/admin/matches')} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
                                Ir a partidos
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">No hay partidos pendientes por vincular para hoy.</div>
                      )}
                    </div>
                  </article>

                  <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <h2 className="text-lg font-black text-slate-950">Accesos rápidos</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: 'Historial', description: 'Revisa ejecuciones anteriores y resultados del sync.', path: '/admin/football-sync/history' },
                        { label: 'Alertas', description: 'Abre errores, warnings y eventos por resolver.', path: '/admin/football-sync/alerts' },
                        { label: 'Estadísticas', description: 'Consulta frecuencia, rendimiento y consumo acumulado.', path: '/admin/football-sync/stats' },
                        { label: 'Requests API', description: 'Ver cada llamada a API-Football con parámetros y respuesta completa.', path: '/admin/football-sync/api-logs' },
                        { label: 'Configuración', description: 'Modifica intervalos, límites y notificaciones.', path: '/admin/football-sync/config' },
                        { label: 'Auto-Adaptable', description: 'Configura agrupación, caché, deduplicación y modo automático.', path: '/admin/football-sync/settings' },
                      ].map((item) => (
                        <button key={item.label} type="button" onClick={() => navigate(item.path)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100">
                          <p className="text-sm font-black text-slate-950">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            )}

            {activeTab === 'activity' && (
              <section id="football-sync-panel-activity" role="tabpanel" aria-labelledby="football-sync-tab-activity" className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">Últimas sincronizaciones</h2>
                      <p className="text-sm text-slate-500">Actividad reciente registrada en el backend.</p>
                    </div>
                    <button type="button" onClick={() => navigate('/admin/football-sync/history')} className="text-sm font-bold text-lime-700 hover:text-lime-800">Ver historial</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dashboard.recentLogs.length > 0 ? dashboard.recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-950">{log.message}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : log.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{log.status}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{log.type} · {formatDateTime(log.createdAt)}</p>
                        <p className="mt-2 text-xs text-slate-500">Requests: {log.requestsUsed} · Partidos: {log.matchesUpdated}</p>
                      </div>
                    )) : <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Aún no hay logs recientes para mostrar.</div>}
                  </div>
                </article>
                <article className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">Alertas activas</h2>
                      <p className="text-sm text-slate-500">Eventos que requieren revisión operativa.</p>
                    </div>
                    <button type="button" onClick={() => navigate('/admin/football-sync/alerts')} className="text-sm font-bold text-lime-700 hover:text-lime-800">Ver alertas</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dashboard.activeAlerts.length > 0 ? dashboard.activeAlerts.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-950">{alert.message}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">{alert.severity}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{formatDateTime(alert.createdAt)}</p>
                      </div>
                    )) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">No hay alertas activas en este momento.</div>}
                  </div>
                </article>
              </section>
            )}
          </>
        )}
      </div>

      <DialogPrimitive.Root open={!!linkModal} onOpenChange={(open) => !open && resetLinkFlow()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.75rem] bg-white p-4 shadow-2xl sm:p-6">
            <DialogPrimitive.Title className="text-xl font-black text-slate-950">Vincular partido con API-Football</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-slate-500">
              {linkModal ? `Busca un fixture candidato para ${linkModal.title} y ejecuta el vínculo completo.` : 'Busca un fixture candidato.'}
            </DialogPrimitive.Description>

            <div className="mt-5 space-y-4">
              {candidateState.error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{candidateState.error}</div>}

              {candidateState.isLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Consultando fixtures candidatos en API-Football...
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Fixtures candidatos</h3>
                    <div className="mt-3 space-y-3">
                      {candidateState.candidates.length > 0 ? candidateState.candidates.map((candidate) => (
                        <label key={candidate.fixtureId} className={`block cursor-pointer rounded-2xl border p-4 transition ${candidateState.selectedExternalId === candidate.fixtureId ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                          <input
                            type="radio"
                            name="fixture-candidate"
                            className="sr-only"
                            checked={candidateState.selectedExternalId === candidate.fixtureId}
                            onChange={() => setCandidateState((current) => ({ ...current, selectedExternalId: candidate.fixtureId, manualExternalId: '', error: null }))}
                          />
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black">{candidate.homeTeam} vs {candidate.awayTeam}</p>
                              <p className={`mt-1 text-sm ${candidateState.selectedExternalId === candidate.fixtureId ? 'text-slate-200' : 'text-slate-600'}`}>
                                {formatDateTime(candidate.kickoff)} · {candidate.leagueName}{candidate.round ? ` · ${candidate.round}` : ''}
                              </p>
                              <p className={`mt-1 text-xs ${candidateState.selectedExternalId === candidate.fixtureId ? 'text-slate-300' : 'text-slate-500'}`}>
                                Fixture ID: {candidate.fixtureId}{candidate.venue ? ` · ${candidate.venue}` : ''}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {candidate.reasons.map((reason) => (
                                  <span key={`${candidate.fixtureId}-${reason}`} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${candidateState.selectedExternalId === candidate.fixtureId ? 'bg-white/10 text-white' : 'bg-white text-slate-600'}`}>
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${candidateState.selectedExternalId === candidate.fixtureId ? 'border-white/20 bg-white/10 text-white' : confidenceStyles[candidate.confidence]}`}>
                              {candidate.confidence}
                            </span>
                          </div>
                        </label>
                      )) : <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">No encontramos candidatos claros para este partido. Puedes ingresar el fixture ID manualmente.</div>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="text-sm font-black text-slate-900">Fixture ID manual</label>
                    <p className="mt-1 text-sm text-slate-500">Úsalo si ya conoces el fixture ID correcto y quieres completar el vínculo igual.</p>
                    <input
                      value={candidateState.manualExternalId}
                      onChange={(event) => setCandidateState((current) => ({ ...current, manualExternalId: event.target.value, selectedExternalId: '', error: null }))}
                      placeholder="Ej: 123456"
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-200"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={resetLinkFlow} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={handleLinkAndSync} disabled={candidateState.isLoading || candidateState.isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-60">
                {candidateState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Vincular y sincronizar
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

export default FootballSyncDashboard;
