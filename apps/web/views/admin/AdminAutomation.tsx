import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ApiError, request } from '../../api';

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

interface FeatureFlagState {
  enabled: boolean;
  source: 'env' | 'db' | 'default';
  locked: boolean;
}

interface StepCatalogEntry {
  key: string;
  phase: 'PRE_MATCH' | 'LIVE' | 'POST_MATCH';
  label: string;
  shortLabel: string;
  description: string;
  schedulerId: string | null;
  channels: string[];
  requiresFlag?: 'preMatchV2' | 'livePhaseV2' | 'postMatchV2';
  defaultEnabled: boolean;
  enabled: boolean;
  flagActive: boolean;
  operational: boolean;
}

interface AutomationStatus {
  channels: Record<string, ChannelInfo>;
  schedulers: SchedulerDef[];
  channelOverrides: Record<string, Record<string, boolean>>;
  stats: { notifLast24h: number; pushSubscribers: number; usersWithPhone: number };
  featureFlags?: {
    preMatchV2: FeatureFlagState;
    livePhaseV2: FeatureFlagState;
    postMatchV2: FeatureFlagState;
  };
  stepCatalog?: StepCatalogEntry[];
  timingHints?: {
    defaultCloseMinutes: number;
    finalEscalationMinutesBeforeKickoff: number;
    predictionReportMinutesAfterClose: number;
    predictionReportMinutesBefore: number;
    timezone: string;
  };
}

interface MessagePreview {
  step: string;
  channel: string;
  source: 'job' | 'generated' | 'unavailable';
  dedupeKey: string | null;
  jobStatus: string | null;
  jobId: string | null;
  title: string | null;
  body: string;
}

type StepState =
  | 'NOT_APPLICABLE' | 'SCHEDULED' | 'RUNNING' | 'SUCCESS'
  | 'WARNING' | 'FAILED' | 'SKIPPED' | 'OVERDUE' | 'MANUAL';

interface StepLeague {
  leagueId: string;
  leagueName: string;
  leagueCode: string;
  status: StepState;
  scheduledAt?: string;
  startedAt?: string;
  finishedAt?: string;
  deliveredCount: number | null;
  failedCount: number | null;
  audienceCount: number | null;
  warningCount: number | null;
  errorMessage?: string | null;
}

interface ChannelBreakdown {
  pushSent?: number;
  pushFailed?: number;
  pushDevices?: number;
  whatsappSentCount?: number;
  emailQueued?: number;
  emailFailed?: number;
  inAppSent?: number;
  waGroupEnqueued?: number;
  waGroupSent?: number;
  waGroupFailed?: number;
  waGroupExpected?: number;
  waGroupReason?: string | null;
  waGroupJobId?: string | null;
  waGroupLeagueId?: string | null;
}

interface OperationsStep {
  key: string;
  label: string;
  status: StepState;
  scheduledAt?: string | null;
  lastStartedAt?: string | null;
  lastFinishedAt?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  trigger: string;
  leagues: StepLeague[];
  latestDetails?: { channelBreakdown?: ChannelBreakdown } | null;
}

interface OperationsSync {
  status: StepState;
  lastStartedAt?: string | null;
  lastFinishedAt?: string | null;
  durationMs?: number | null;
  recentLogs: Array<{
    id: string;
    type: string;
    status: string;
    message: string;
    error: string | null;
  }>;
}

interface OperationsMatch {
  id: string;
  trackingScope?: 'TODAY' | 'CARRY_OVER';
  homeTeam: string;
  awayTeam: string;
  homeTeamCode?: string | null;
  awayTeamCode?: string | null;
  displayName?: string;
  matchDateLabel?: string;
  carryOverReason?: string | null;
  matchDate: string;
  status: string;
  tournament: string | null;
  automationExcludedLeagues?: Array<{ id: string; code: string; name: string; status: string }>;
  overallStatus: StepState;
  sync: OperationsSync;
  steps: OperationsStep[];
}

interface DailyOperations {
  date: string;
  matches: OperationsMatch[];
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

type TabId = 'matrix' | 'history' | 'schedulers' | 'config' | 'channels';

interface IncidentInfo {
  match: OperationsMatch;
  step: OperationsStep;
  label: string;
  channel?: string;
  channelReason?: string | null;
  leagueId?: string | null;
}

interface RetryResult {
  ok: boolean;
  runId: string | null;
  summary: string;
  delivery?: {
    pushSent?: number;
    pushFailed?: number;
    pushDevices?: number;
    waGroupSent?: number;
    waGroupFailed?: number;
    inAppSent?: number;
    whatsappSent?: number;
    emailQueued?: number;
    audienceCount?: number;
  };
}

const TYPE_LABELS: Record<string, string> = {
  MATCH_REMINDER: 'Recordatorio 1h',
  PREDICTION_CLOSED: 'Cierre predicciones',
  RESULT_PUBLISHED: 'Resultado publicado',
  GOAL_SCORED: 'Gol en vivo',
};

const TYPE_BADGES: Record<string, string> = {
  MATCH_REMINDER: 'border-sky-200 bg-sky-50 text-sky-700',
  PREDICTION_CLOSED: 'border-amber-200 bg-amber-50 text-amber-700',
  RESULT_PUBLISHED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  GOAL_SCORED: 'border-rose-200 bg-rose-50 text-rose-700',
};

const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  inApp: { label: 'In-App', icon: <Bell size={14} /> },
  push: { label: 'Push', icon: <Smartphone size={14} /> },
  whatsapp: { label: 'WA Personal', icon: <MessageSquare size={14} /> },
  waGroup: { label: 'WA Grupo', icon: <MessageSquare size={14} className="text-emerald-600" /> },
  sms: { label: 'SMS', icon: <Phone size={14} /> },
  email: { label: 'Email', icon: <Send size={14} /> },
};

const CONFIG_CHANNEL_KEYS = ['push', 'inApp', 'waGroup', 'email', 'whatsapp'] as const;

/** WA personal = opt-in (OFF hasta activación explícita en Admin). Resto = opt-out. */
function isChannelEffectivelyActive(
  channel: string,
  sysEnabled: boolean,
  stepEnabled: boolean,
  overrideVal: boolean | undefined,
): boolean {
  if (!stepEnabled || !sysEnabled) return false;
  if (channel === 'whatsapp') {
    return overrideVal === true;
  }
  return overrideVal !== false;
}

const PHASE_META = [
  { id: 'pre', phase: 'PRE_MATCH' as const, label: 'Pre-partido', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'live', phase: 'LIVE' as const, label: 'En vivo', className: 'bg-rose-50 text-rose-800 border-rose-200' },
  { id: 'post', phase: 'POST_MATCH' as const, label: 'Post-partido', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
] as const;

const EXPANDED_PHASE_GROUPS = PHASE_META.map(({ id, phase, label }) => ({ id, phase, label }));

/** Catálogo local por si el API aún no expone stepCatalog (deploy pendiente). */
const FALLBACK_STEP_CATALOG: StepCatalogEntry[] = [
  { key: 'MATCH_REMINDER', phase: 'PRE_MATCH', label: 'Recordatorio T-60', shortLabel: 'T-60', description: '', schedulerId: 'match_reminder', channels: ['push', 'inApp', 'email', 'waGroup'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'ESCALATION_T45', phase: 'PRE_MATCH', label: 'Escalada T-45', shortLabel: 'T-45', description: '', schedulerId: 'pre_match_escalation', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'preMatchV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'ESCALATION_T30', phase: 'PRE_MATCH', label: 'Escalada T-30', shortLabel: 'T-30', description: '', schedulerId: 'pre_match_escalation', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'preMatchV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'ESCALATION_FINAL', phase: 'PRE_MATCH', label: 'Escalada T-20', shortLabel: 'T-20', description: '', schedulerId: 'pre_match_escalation', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'preMatchV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'PREDICTION_CLOSING', phase: 'PRE_MATCH', label: 'Cierre predicciones', shortLabel: 'Cierre', description: '', schedulerId: 'prediction_closing', channels: ['push', 'inApp', 'waGroup', 'email'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'MATCH_START', phase: 'LIVE', label: 'Inicio partido', shortLabel: 'Inicio', description: '', schedulerId: 'live_match_start', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'livePhaseV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'HALFTIME', phase: 'LIVE', label: 'Medio tiempo', shortLabel: 'HT', description: '', schedulerId: 'live_halftime', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'livePhaseV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'SECOND_HALF_START', phase: 'LIVE', label: '2.ª parte', shortLabel: '2H', description: '', schedulerId: 'live_second_half', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'livePhaseV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'MATCH_LIVE_END', phase: 'LIVE', label: 'Fin partido (live)', shortLabel: 'Fin', description: '', schedulerId: 'live_match_end', channels: ['push', 'inApp', 'waGroup'], requiresFlag: 'livePhaseV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'GOAL_SCORED', phase: 'LIVE', label: 'Gol en vivo', shortLabel: 'Gol', description: '', schedulerId: 'live_goal', channels: ['push', 'inApp', 'waGroup'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'GOAL_IMPACT', phase: 'LIVE', label: 'Impacto gol (WA)', shortLabel: 'Imp.G', description: '', schedulerId: 'live_goal_impact', channels: ['waGroup'], requiresFlag: 'livePhaseV2', defaultEnabled: true, enabled: true, flagActive: false, operational: false },
  { key: 'YELLOW_CARD', phase: 'LIVE', label: 'Tarjeta amarilla', shortLabel: 'TA', description: '', schedulerId: 'live_yellow_card', channels: ['waGroup'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'RED_CARD', phase: 'LIVE', label: 'Tarjeta roja', shortLabel: 'TR', description: '', schedulerId: 'live_red_card', channels: ['waGroup'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'SUBSTITUTION', phase: 'LIVE', label: 'Cambio', shortLabel: 'Camb.', description: '', schedulerId: 'live_substitution', channels: ['waGroup'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'RESULT_NOTIFICATION', phase: 'POST_MATCH', label: 'Resultado personal', shortLabel: 'Result.', description: 'WA personal opt-in', schedulerId: 'match_result', channels: ['push', 'inApp', 'whatsapp', 'waGroup'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'PREDICTION_REPORT', phase: 'POST_MATCH', label: 'Reporte predicciones', shortLabel: 'P.Rep', description: '', schedulerId: 'prediction_report', channels: ['push', 'inApp', 'waGroup', 'email'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
  { key: 'RESULT_REPORT', phase: 'POST_MATCH', label: 'Reporte resultados', shortLabel: 'Rep.F', description: '', schedulerId: 'result_report', channels: ['push', 'inApp', 'waGroup', 'email'], defaultEnabled: true, enabled: true, flagActive: true, operational: true },
];

function resolveStepCatalog(status: AutomationStatus | null): StepCatalogEntry[] {
  const fromApi = status?.stepCatalog;
  if (fromApi && fromApi.length > 0) return fromApi;

  const flags = status?.featureFlags;
  return FALLBACK_STEP_CATALOG.map((step) => {
    const flagActive = !step.requiresFlag || flags?.[step.requiresFlag]?.enabled === true;
    return { ...step, flagActive, operational: step.enabled && flagActive };
  });
}

function buildMatrixGridColumns(stepCount: number): string {
  return `minmax(0,1.55fr) auto auto auto repeat(${Math.max(stepCount, 1)}, minmax(3.25rem, 1fr)) 1.2rem`;
}

function getVisibleSteps(catalog: StepCatalogEntry[]): StepCatalogEntry[] {
  const enabled = catalog.filter((step) => step.enabled);
  return enabled.length > 0 ? enabled : catalog;
}

function findStepForMatch(match: OperationsMatch, stepKey: string, catalogEntry: StepCatalogEntry): OperationsStep {
  const existing = match.steps.find((s) => s.key === stepKey);
  if (existing) return existing;
  return {
    key: stepKey,
    label: catalogEntry.label,
    status: 'NOT_APPLICABLE',
    trigger: 'SCHEDULER',
    leagues: [],
    latestDetails: null,
  };
}

function stepCanRetry(step: OperationsStep, stepChannels: string[]): boolean {
  const breakdown = step.latestDetails?.channelBreakdown;
  return (
    step.status === 'FAILED' ||
    step.status === 'OVERDUE' ||
    step.status === 'WARNING' ||
    step.status === 'MANUAL' ||
    (step.status === 'SUCCESS' && stepChannels.some((ch) => channelHasFailure(ch, breakdown, step)))
  );
}

function getStepChannels(catalog: StepCatalogEntry[] | undefined, stepKey: string): string[] {
  return catalog?.find((step) => step.key === stepKey)?.channels ?? [];
}

function buildPhaseColumnSpans(steps: StepCatalogEntry[]): Array<{ id: string; label: string; className: string; fromCol: number; toCol: number }> {
  let col = 5;
  return PHASE_META.map((phase) => {
    const count = steps.filter((step) => step.phase === phase.phase).length;
    const fromCol = col;
    col += count;
    return { id: phase.id, label: phase.label, className: phase.className, fromCol, toCol: fromCol + count };
  }).filter((phase) => phase.toCol > phase.fromCol);
}

function resolveEscalationFinalShortLabel(timing?: AutomationStatus['timingHints']): string {
  if (!timing) return 'T-f';
  return `T-${timing.finalEscalationMinutesBeforeKickoff}`;
}

function resolveStepShortLabel(step: StepCatalogEntry, timing?: AutomationStatus['timingHints']): string {
  if (step.key === 'ESCALATION_FINAL') return resolveEscalationFinalShortLabel(timing);
  return step.shortLabel;
}

function formatMatchTitle(match: OperationsMatch): string {
  if (match.displayName?.trim()) return match.displayName.trim();
  const home = match.homeTeam?.trim() || match.homeTeamCode?.trim() || 'Local';
  const away = match.awayTeam?.trim() || match.awayTeamCode?.trim() || 'Visitante';
  return `${home} vs ${away}`;
}

function formatMatchSubtitle(match: OperationsMatch): string {
  const parts: string[] = [];
  if (match.tournament) parts.push(match.tournament);
  if (match.trackingScope === 'CARRY_OVER') {
    if (match.matchDateLabel) parts.push(`Fecha partido: ${match.matchDateLabel}`);
    if (match.carryOverReason) parts.push(match.carryOverReason);
  }
  return parts.join(' · ');
}

// Cuántos se enviaron/fallaron por canal, extraído de latestDetails.channelBreakdown
function getChannelCounters(
  ch: string,
  breakdown: ChannelBreakdown | undefined,
): { sent: number; failed: number; pending: number } | null {
  if (!breakdown) return null;
  switch (ch) {
    case 'push':
      return { sent: breakdown.pushSent ?? 0, failed: breakdown.pushFailed ?? 0, pending: 0 };
    case 'whatsapp':
      return { sent: breakdown.whatsappSentCount ?? 0, failed: 0, pending: 0 };
    case 'waGroup': {
      const sent = breakdown.waGroupSent ?? 0;
      const failed = breakdown.waGroupFailed ?? 0;
      const pending = breakdown.waGroupEnqueued ?? 0;
      return { sent, failed, pending };
    }
    case 'email':
      return { sent: breakdown.emailQueued ?? 0, failed: breakdown.emailFailed ?? 0, pending: 0 };
    case 'inApp':
      return { sent: breakdown.inAppSent ?? 0, failed: 0, pending: 0 };
    default:
      return null;
  }
}

function getChannelReason(ch: string, breakdown: ChannelBreakdown | undefined): string | null {
  if (!breakdown) return null;
  if (ch === 'waGroup' && breakdown.waGroupReason) return breakdown.waGroupReason;
  if (ch === 'push' && (breakdown.pushFailed ?? 0) > 0) {
    return `Fallaron ${breakdown.pushFailed} notificación(es) push`;
  }
  if (ch === 'email' && (breakdown.emailFailed ?? 0) > 0) {
    return `Fallaron ${breakdown.emailFailed} correo(s)`;
  }
  return null;
}

function channelHasFailure(
  ch: string,
  breakdown: ChannelBreakdown | undefined,
  step: OperationsStep,
): boolean {
  const counters = getChannelCounters(ch, breakdown);
  if (counters && counters.failed > 0) return true;
  const reason = getChannelReason(ch, breakdown);
  if (reason && ['SUCCESS', 'WARNING', 'FAILED', 'OVERDUE', 'MANUAL'].includes(step.status)) {
    return true;
  }
  if (
    ch === 'waGroup' &&
    breakdown &&
    (breakdown.waGroupExpected ?? 0) > 0 &&
    (breakdown.waGroupSent ?? 0) === 0 &&
    (breakdown.waGroupEnqueued ?? 0) === 0 &&
    ['SUCCESS', 'WARNING', 'FAILED', 'OVERDUE', 'MANUAL'].includes(step.status)
  ) {
    return true;
  }
  return false;
}

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

function StatusDot({ state, size = 10 }: { state: StepState; size?: number }) {
  const colors: Record<StepState, string> = {
    SUCCESS: '#22c55e',
    MANUAL: '#22c55e',
    WARNING: '#f59e0b',
    SCHEDULED: '#94a3b8',
    RUNNING: '#3b82f6',
    FAILED: '#ef4444',
    OVERDUE: '#ef4444',
    SKIPPED: '#94a3b8',
    NOT_APPLICABLE: '#e2e8f0',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: colors[state] ?? '#e2e8f0',
        flexShrink: 0,
      }}
    />
  );
}

const STEP_STATE_COLOR: Record<StepState, string> = {
  SUCCESS:        'text-emerald-500',
  MANUAL:         'text-emerald-500',
  WARNING:        'text-amber-400',
  RUNNING:        'text-blue-400',
  SCHEDULED:      'text-slate-300',
  SKIPPED:        'text-slate-300',
  NOT_APPLICABLE: 'text-slate-200',
  FAILED:         'text-red-500',
  OVERDUE:        'text-red-500',
};

// Componente de Tooltip para mostrar información detallada del canal
function ChannelTooltip({
  channel,
  counters,
  step,
  reason,
  children,
}: {
  channel: string;
  counters: { sent: number; failed: number; pending?: number } | null;
  step: OperationsStep;
  reason?: string | null;
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [touchTimeout, setTouchTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const meta = CHANNEL_META[channel];

  if (!counters && step.status === 'NOT_APPLICABLE') {
    return <>{children}</>;
  }

  const total = counters ? counters.sent + counters.failed : 0;
  const successRate = total > 0 ? ((counters!.sent / total) * 100).toFixed(0) : '0';

  const handleTouchStart = () => {
    const timeout = setTimeout(() => {
      setShowTooltip(true);
    }, 300);
    setTouchTimeout(timeout);
  };

  const handleTouchEnd = () => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      setTouchTimeout(null);
    }
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
      {showTooltip && (
        <div className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2.5 shadow-2xl min-w-[200px] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-slate-700/50 p-1.5">
                <span className="text-white">{meta?.icon}</span>
              </div>
              <p className="text-xs font-black text-white tracking-wide">{meta?.label || channel}</p>
            </div>
            <div className="space-y-1.5 text-[11px]">
              {counters ? (
                <>
                  <div className="flex items-center justify-between gap-3 py-0.5">
                    <span className="text-slate-400 font-medium">Total:</span>
                    <span className="font-bold text-white tabular-nums">{total}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-0.5">
                    <span className="text-slate-400 font-medium">Enviados:</span>
                    <span className="font-bold text-emerald-400 tabular-nums">✓ {counters.sent}</span>
                  </div>
                  {counters.failed > 0 && (
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <span className="text-slate-400 font-medium">Fallidos:</span>
                      <span className="font-bold text-red-400 tabular-nums">✗ {counters.failed}</span>
                    </div>
                  )}
                  {(counters.pending ?? 0) > 0 && counters.failed === 0 && (
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <span className="text-slate-400 font-medium">Pendientes:</span>
                      <span className="font-bold text-amber-400 tabular-nums">⏳ {counters.pending}</span>
                    </div>
                  )}
                  {reason && (
                    <p className="pt-1.5 mt-1.5 border-t border-slate-700/60 text-red-300 leading-snug">
                      {reason}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-slate-700/60">
                    <span className="text-slate-400 font-medium">Tasa éxito:</span>
                    <span className={`font-black tabular-nums ${parseInt(successRate) >= 90 ? 'text-emerald-400' : parseInt(successRate) >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                      {successRate}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 py-1">
                  {step.status === 'SCHEDULED' ? '⏰ Programado' : '— Sin datos'}
                </p>
              )}
            </div>
            {channel === 'email' && counters && (counters.sent > 0 || counters.failed > 0) && (
              <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                <p className="text-[10px] text-amber-400">💡 Click: Ver todos los logs</p>
                {counters.failed > 0 && (
                  <p className="text-[10px] text-red-400">⇧ Shift+Click: Solo fallidos</p>
                )}
              </div>
            )}
            {channel === 'email' && (!counters || (counters.sent === 0 && counters.failed === 0)) && (
              <p className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                {step.status === 'SCHEDULED' ? 'Programado - Sin envíos aún' : 'Sin datos de envío'}
              </p>
            )}
            {channel === 'push' && (
              <p className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                Notificaciones push
              </p>
            )}
            {channel === 'waGroup' && (
              <p className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                Click para ver detalle y reenviar manualmente
              </p>
            )}
            {channel === 'inApp' && (
              <p className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                Notificaciones in-app
              </p>
            )}
          </div>
          {/* Flecha del tooltip */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}

function StepCell({
  step,
  onIncident,
  match,
  stepChannels,
}: {
  step: OperationsStep;
  onIncident?: (info: IncidentInfo) => void;
  match: OperationsMatch;
  stepChannels: string[];
}) {
  const navigate = useNavigate();
  const breakdown = step.latestDetails?.channelBreakdown;
  const channels = stepChannels;
  const canRetry = stepCanRetry(step, channels);
  const openStepDetail = onIncident
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onIncident({
          match,
          step,
          label: step.label,
          leagueId: step.leagues[0]?.leagueId ?? null,
        });
      }
    : undefined;

  // Mapeo de step keys a EmailJobType
  const stepKeyToEmailType: Record<string, string> = {
    'MATCH_REMINDER': 'MATCH_REMINDER',
    'PREDICTION_CLOSING': 'PREDICTION_CLOSED',
    'RESULT_NOTIFICATION': 'RESULT_PUBLISHED',
    'PREDICTION_REPORT': 'RESULT_PUBLISHED',
    'RESULT_REPORT': 'RESULT_PUBLISHED',
  };

  const handleChannelClick = (e: React.MouseEvent, channel: string) => {
    e.stopPropagation();

    if (channel === 'email') {
      const emailType = stepKeyToEmailType[step.key];
      if (emailType) {
        const params = new URLSearchParams({ type: emailType });
        if (match.id) params.set('matchId', match.id);

        const counters = getChannelCounters(channel, breakdown);
        if (counters && counters.failed > 0 && e.shiftKey) {
          params.set('status', 'FAILED');
        }

        navigate(`/admin/email-logs?${params.toString()}`);
      }
      return;
    }

    if (
      channel === 'waGroup' &&
      onIncident &&
      channelHasFailure(channel, breakdown, step)
    ) {
      onIncident({
        match,
        step,
        label: `${step.label} · WA Grupo`,
        channel: 'waGroup',
        channelReason: getChannelReason(channel, breakdown),
        leagueId: breakdown?.waGroupLeagueId ?? step.leagues[0]?.leagueId ?? null,
      });
    }
  };

  return (
    <div
      className={`flex flex-col items-center gap-1 ${onIncident ? 'cursor-pointer hover:opacity-90' : ''}`}
      onClick={openStepDetail}
      title={onIncident ? 'Click: ver mensaje, probar o reenviar' : undefined}
    >
      <StatusDot state={step.status} />

      {channels.length > 0 && (
        <div className="flex flex-col items-center gap-0.5">
          {channels.map((ch) => {
            const counters = getChannelCounters(ch, breakdown);
            const reason = getChannelReason(ch, breakdown);
            const failed = channelHasFailure(ch, breakdown, step);
            const hasData = counters && (counters.sent > 0 || counters.failed > 0);
            const iconColor = failed
              ? 'text-red-500'
              : hasData
                ? 'text-emerald-500'
                : STEP_STATE_COLOR[step.status] ?? 'text-slate-300';

            const isClickable = ch === 'email' || (ch === 'waGroup' && failed);

            return (
              <ChannelTooltip key={ch} channel={ch} counters={counters} step={step} reason={reason}>
                <div
                  className={`flex items-center gap-0.5 ${isClickable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
                  onClick={isClickable ? (e) => handleChannelClick(e, ch) : undefined}
                  role={isClickable ? 'button' : undefined}
                  aria-label={isClickable ? `Ver logs de ${CHANNEL_META[ch]?.label}` : undefined}
                >
                  <span className={`leading-none ${iconColor}`}>
                    {CHANNEL_META[ch]?.icon}
                  </span>
                  {counters && hasData && (
                    <span className="text-[9px] font-semibold leading-none">
                      {counters.sent > 0 && (
                        <span className="text-emerald-600">✓{counters.sent}</span>
                      )}
                      {counters.failed > 0 && (
                        <span className="text-red-500 ml-0.5">✗{counters.failed}</span>
                      )}
                    </span>
                  )}
                </div>
              </ChannelTooltip>
            );
          })}
        </div>
      )}

      {step.lastStartedAt && (
        <span className="text-[10px] text-slate-500">{fmtTime(step.lastStartedAt)}</span>
      )}
    </div>
  );
}

function MatrixRow({
  match,
  expanded,
  onExpand,
  onIncident,
  visibleSteps,
  gridColumns,
  stepCatalog,
}: {
  match: OperationsMatch;
  expanded: boolean;
  onExpand: (id: string) => void;
  onIncident?: (info: IncidentInfo) => void;
  visibleSteps: StepCatalogEntry[];
  gridColumns: string;
  stepCatalog: StepCatalogEntry[];
}) {
  const orderedSteps = visibleSteps.map((catalogStep) =>
    findStepForMatch(match, catalogStep.key, catalogStep),
  );
  const matchTitle = formatMatchTitle(match);
  const matchSubtitle = formatMatchSubtitle(match);

  return (
    <>
      <div
        className="grid cursor-pointer items-center px-4 py-3 transition-colors hover:bg-slate-50"
        style={{ gridTemplateColumns: gridColumns }}
        onClick={() => onExpand(match.id)}
      >
        <div className="min-w-0 pr-2">
          <p className="truncate text-sm font-semibold text-slate-900" title={matchTitle}>
            {matchTitle}
          </p>
          {matchSubtitle && (
            <p className="truncate text-[10px] text-slate-500" title={matchSubtitle}>
              {matchSubtitle}
            </p>
          )}
          {(match.automationExcludedLeagues?.length ?? 0) > 0 && (
            <p className="truncate text-[10px] font-semibold text-amber-700" title={match.automationExcludedLeagues!.map((l) => `${l.code} (${l.status})`).join(', ')}>
              Polla en {match.automationExcludedLeagues!.map((l) => l.status).join('/')} — sin automatización
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 px-3">
          <span className="text-sm font-bold text-slate-700" title={match.matchDateLabel ?? undefined}>
            {fmtTime(match.matchDate)}
          </span>
          {match.trackingScope === 'CARRY_OVER' && match.matchDateLabel && (
            <span className="text-[9px] font-semibold text-violet-600">{match.matchDateLabel}</span>
          )}
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS_BADGES[match.status] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            {STATUS_LABELS[match.status] ?? match.status}
          </span>
        </div>

        {/* Estado global */}
        <div className="flex justify-center px-2">
          <StatusDot state={match.overallStatus} size={12} />
        </div>

        {/* Sync */}
        <div className="flex justify-center px-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-1">
            <StatusDot state={match.sync.status} />
            {match.sync.lastStartedAt && (
              <span className="text-[10px] text-slate-500">{fmtTime(match.sync.lastStartedAt)}</span>
            )}
          </div>
        </div>

        {/* Steps */}
        {orderedSteps.map((step) => (
          <div key={step.key} className="flex justify-center" onClick={(e) => e.stopPropagation()}>
            <StepCell
              step={step}
              onIncident={onIncident}
              match={match}
              stepChannels={getStepChannels(stepCatalog, step.key)}
            />
          </div>
        ))}

        <div className="flex justify-end text-slate-400">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 pb-4">
          <div className="space-y-4 pt-3">
            {(match.automationExcludedLeagues?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold">Automatización desactivada para esta polla</p>
                <p className="mt-1">
                  Los recordatorios (T-60, T-30, WA grupo, etc.) solo corren en pollas con estado{' '}
                  <strong>ACTIVE</strong>. Cambia el estado en Admin → Pollas:
                </p>
                <ul className="mt-2 list-disc pl-4 space-y-0.5">
                  {match.automationExcludedLeagues!.map((league) => (
                    <li key={league.id}>
                      <span className="font-mono font-semibold">{league.code}</span> — {league.name} ({league.status})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Bloque Sync */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Sync partido</p>
              <div className="flex items-center gap-2 mb-2">
                <StatusDot state={match.sync.status} />
                <span className="text-xs font-semibold text-slate-700">{match.sync.status}</span>
                {match.sync.durationMs && (
                  <span className="text-[10px] text-slate-500">{(match.sync.durationMs / 1000).toFixed(1)}s</span>
                )}
              </div>
              {match.sync.recentLogs.length > 0 && (
                <div className="space-y-1">
                  {match.sync.recentLogs.map((log) => (
                    <div key={log.id} className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="font-mono">[{log.type}]</span>
                      <span>{log.message}</span>
                      {log.error && <span className="text-red-600">— {log.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pasos por fase */}
            {EXPANDED_PHASE_GROUPS.map((phase) => {
              const phaseCatalogSteps = visibleSteps.filter((entry) => entry.phase === phase.phase);
              if (phaseCatalogSteps.length === 0) return null;
              const phaseSteps = phaseCatalogSteps.map((entry) =>
                findStepForMatch(match, entry.key, entry),
              );
              return (
                <div key={phase.id}>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{phase.label}</p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {phaseSteps.map((step) => {
                      const channels = getStepChannels(stepCatalog, step.key);
                      const retryable = stepCanRetry(step, channels);
                      return (
                      <div key={step.key} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusDot state={step.status} />
                          <p className="text-xs font-black text-slate-800">{step.label}</p>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                          {step.scheduledAt && <p><span className="text-slate-400">Programado: </span>{fmtFull(step.scheduledAt)}</p>}
                          {step.lastStartedAt && <p><span className="text-slate-400">Inicio: </span>{fmtFull(step.lastStartedAt)}</p>}
                          {step.lastFinishedAt && <p><span className="text-slate-400">Fin: </span>{fmtFull(step.lastFinishedAt)}</p>}
                          {step.errorMessage && step.leagues.length === 0 && (
                            <p className="text-red-600 font-semibold">{step.errorMessage}</p>
                          )}
                        </div>
                        {step.leagues.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                            {step.leagues.map((league) => (
                              <div key={league.leagueId} className="rounded-lg bg-slate-50 px-2 py-1.5">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <StatusDot state={league.status} size={8} />
                                  <span className="text-[10px] font-semibold text-slate-700 truncate">{league.leagueName}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                                  {league.deliveredCount !== null && <span>✓ {league.deliveredCount}</span>}
                                  {league.failedCount !== null && league.failedCount > 0 && <span className="text-red-600">✗ {league.failedCount}</span>}
                                  {league.audienceCount !== null && <span>👥 {league.audienceCount}</span>}
                                </div>
                                {league.errorMessage && (
                                  <p className="text-[10px] text-red-600 mt-0.5">{league.errorMessage}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {onIncident && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onIncident({
                                  match,
                                  step,
                                  label: step.label,
                                  leagueId: step.leagues[0]?.leagueId ?? null,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 transition hover:bg-white hover:text-slate-900"
                            >
                              <MessageSquare size={10} />
                              Probar / ver mensaje
                            </button>
                            {retryable && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onIncident({
                                    match,
                                    step,
                                    label: `${step.label} · reenvío`,
                                    leagueId: step.leagues[0]?.leagueId ?? null,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-800 transition hover:bg-amber-100"
                              >
                                <RotateCcw size={10} />
                                Reenviar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );})}
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

function AutomationTimingPanel({
  timingHints,
  onSaved,
}: {
  timingHints?: AutomationStatus['timingHints'];
  onSaved: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = React.useState(
    timingHints?.predictionReportMinutesAfterClose ?? 1,
  );
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    if (timingHints) {
      setMinutes(timingHints.predictionReportMinutesAfterClose);
    }
  }, [timingHints?.predictionReportMinutesAfterClose]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const result = await request<{
        predictionReportMinutesAfterClose: number;
      }>(
        '/admin/automation/timing-settings',
        {
          method: 'PUT',
          body: JSON.stringify({ predictionReportMinutesAfterClose: minutes }),
        },
      );
      onSaved(result.predictionReportMinutesAfterClose);
      setMsg({ ok: true, text: 'Ajuste guardado correctamente' });
    } catch (e: unknown) {
      const text = e instanceof ApiError ? e.message : 'Error al guardar el ajuste';
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={14} className="text-sky-500" />
        <p className="text-sm font-semibold text-slate-900">Timing del reporte de predicciones</p>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-600">
        Minutos después del cierre de pronósticos en que se publica el reporte (email + PDF/imagen al WA Grupo).
        Con cierre típico a <strong>T-15</strong> y valor <strong>1</strong>, el envío ocurre en <strong>T-14</strong>
        (un minuto después del cierre). El cron revisa cada minuto; si hubo retraso, hay catch-up hasta el kickoff.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
            Minutos después del cierre
          </label>
          <input
            type="number"
            min={0}
            max={30}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 1)))}
            className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar timing'}
        </button>
      </div>
      {msg && (
        <p className={`mt-3 text-xs font-medium ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function StepConfigMatrix({
  stepCatalog,
  channelStatus,
  channelOverrides,
  timingHints,
  onToggleChannel,
  onToggleStep,
}: {
  stepCatalog: StepCatalogEntry[];
  channelStatus: AutomationStatus['channels'];
  channelOverrides: Record<string, Record<string, boolean>>;
  timingHints?: AutomationStatus['timingHints'];
  onToggleChannel: (schedulerId: string, channel: string, enabled: boolean) => void;
  onToggleStep: (stepKey: string, enabled: boolean) => Promise<void>;
}) {
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggleChannel = async (step: StepCatalogEntry, channel: string, currentlyActive: boolean) => {
    if (!step.schedulerId) return;
    const key = `${step.key}:${channel}`;
    setToggling(key);
    try {
      await onToggleChannel(step.schedulerId, channel, !currentlyActive);
    } finally {
      setToggling(null);
    }
  };

  const handleToggleStep = async (step: StepCatalogEntry) => {
    setToggling(`step:${step.key}`);
    try {
      await onToggleStep(step.key, !step.enabled);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Pasos y canales de automatización</p>
        <p className="mt-1 text-xs text-slate-500">
          Activa o desactiva cada paso de forma independiente. WA Personal está <strong>OFF por defecto</strong> — debes encenderlo explícitamente por paso para evitar mensajes masivos a teléfonos.
        </p>
      </div>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <th className="px-4 py-3 text-left">Paso</th>
            <th className="px-3 py-3 text-center">Activo</th>
            {CONFIG_CHANNEL_KEYS.map((ch) => (
              <th key={ch} className="px-3 py-3 text-center">{CHANNEL_META[ch]?.label ?? ch}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stepCatalog.map((step) => {
            const rowMuted = !step.enabled;
            return (
              <tr key={step.key} className={rowMuted ? 'bg-slate-50/80 opacity-80' : 'hover:bg-slate-50/80'}>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  <span>
                    {step.key === 'ESCALATION_FINAL'
                      ? `Escalada ${resolveEscalationFinalShortLabel(timingHints)}`
                      : step.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{step.description}</span>
                  {step.schedulerId && (
                    <span className="mt-0.5 block font-mono text-[10px] font-normal text-slate-400">{step.schedulerId}</span>
                  )}
                  {step.requiresFlag && !step.flagActive && (
                    <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">
                      Requiere flag v2
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    disabled={toggling === `step:${step.key}`}
                    onClick={() => handleToggleStep(step)}
                    className={`inline-flex h-7 min-w-12 items-center justify-center rounded-full border px-2 text-[10px] font-black uppercase transition ${
                      step.enabled
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-500'
                    }`}
                  >
                    {toggling === `step:${step.key}` ? '…' : step.enabled ? 'ON' : 'OFF'}
                  </button>
                </td>
                {CONFIG_CHANNEL_KEYS.map((ch) => {
                  const applies = step.channels.includes(ch);
                  if (!applies) {
                    return <td key={ch} className="px-3 py-3 text-center text-slate-300">—</td>;
                  }
                  const sysEnabled = channelStatus[ch]?.enabled ?? false;
                  const overrideVal = step.schedulerId ? channelOverrides[step.schedulerId]?.[ch] : undefined;
                  const effectivelyActive = isChannelEffectivelyActive(
                    ch,
                    sysEnabled,
                    step.enabled,
                    overrideVal,
                  );
                  const isTogglable = ch !== 'inApp' && !!step.schedulerId && sysEnabled && step.enabled;
                  const toggleKey = `${step.key}:${ch}`;
                  return (
                    <td key={ch} className="px-3 py-3 text-center">
                      <button
                        type="button"
                        disabled={!isTogglable || toggling === toggleKey}
                        onClick={() => isTogglable && handleToggleChannel(step, ch, effectivelyActive)}
                        className={`inline-flex h-7 min-w-12 items-center justify-center rounded-full border px-2 text-[10px] font-black uppercase transition ${
                          effectivelyActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        } ${isTogglable ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-70'}`}
                        title={!step.enabled ? 'Activa el paso primero' : !sysEnabled ? (channelStatus[ch]?.description ?? 'Canal no configurado') : undefined}
                      >
                        {toggling === toggleKey ? '…' : effectivelyActive ? 'ON' : 'OFF'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SchedulerCard({
  scheduler,
  channelStatus,
  channelOverrides,
  onToggleChannel,
}: {
  scheduler: SchedulerDef;
  channelStatus: AutomationStatus['channels'];
  channelOverrides: Record<string, Record<string, boolean>>;
  onToggleChannel: (schedulerId: string, channel: string, enabled: boolean) => void;
}) {
  const [toggling, setToggling] = React.useState<string | null>(null);

  const handleToggle = async (channel: string, currentEnabled: boolean) => {
    setToggling(channel);
    try {
      await onToggleChannel(scheduler.id, channel, !currentEnabled);
    } finally {
      setToggling(null);
    }
  };

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

      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Canales</p>
        <div className="flex flex-wrap gap-1.5">
          {scheduler.channels.map((channel) => {
            const sysEnabled = channelStatus[channel]?.enabled ?? false;
            const overrideVal = channelOverrides[scheduler.id]?.[channel];
            const effectivelyActive = isChannelEffectivelyActive(
              channel,
              sysEnabled,
              true,
              overrideVal,
            );
            const meta = CHANNEL_META[channel];
            const isLoading = toggling === channel;

            const isTogglable = channel !== 'inApp';
            const sysReason = !sysEnabled ? (channelStatus[channel]?.description ?? 'No configurado') : null;

            let badgeClass: string;
            let titleText: string;
            if (!sysEnabled) {
              badgeClass = 'border-slate-200 bg-slate-100 text-slate-400 line-through cursor-not-allowed';
              titleText = `Sistema deshabilitado: ${sysReason}`;
            } else if (!effectivelyActive) {
              badgeClass = channel === 'whatsapp'
                ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-pointer hover:bg-slate-200'
                : 'border-amber-200 bg-amber-50 text-amber-600 line-through cursor-pointer hover:bg-amber-100';
              titleText = channel === 'whatsapp'
                ? 'OFF por defecto — click para activar WA personal'
                : 'Deshabilitado manualmente — click para activar';
            } else {
              badgeClass = `border-lime-200 bg-lime-50 text-lime-700 ${isTogglable ? 'cursor-pointer hover:bg-lime-100' : 'cursor-default'}`;
              titleText = isTogglable ? 'Activo — click para deshabilitar' : 'Siempre activo';
            }

            return (
              <button
                key={channel}
                type="button"
                disabled={!isTogglable || !sysEnabled || isLoading}
                title={titleText}
                onClick={isTogglable && sysEnabled ? () => handleToggle(channel, effectivelyActive) : undefined}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed ${badgeClass} ${isLoading ? 'opacity-50' : ''}`}
              >
                {isLoading ? <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" /> : meta?.icon}
                {meta?.label ?? channel}
              </button>
            );
          })}
        </div>
        {scheduler.channels.some((ch) => channelOverrides[scheduler.id]?.[ch] === false) && (
          <p className="mt-2 text-[10px] text-amber-600">
            ⚠ Algunos canales están deshabilitados manualmente para este scheduler.
          </p>
        )}
      </div>
    </div>
  );
}

const PREVIEW_CHANNEL_ORDER = ['push', 'inApp', 'email', 'waGroup'] as const;
type PreviewChannel = (typeof PREVIEW_CHANNEL_ORDER)[number];

function resolvePreviewChannels(stepChannels: string[]): PreviewChannel[] {
  return PREVIEW_CHANNEL_ORDER.filter((ch) => stepChannels.includes(ch));
}

function resolveDefaultPreviewChannel(stepChannels: string[]): PreviewChannel {
  return resolvePreviewChannels(stepChannels)[0] ?? 'push';
}

const OUTDATED_AUTOMATION_API_HINT =
  'El API en producción está desactualizado (anterior a automation v2). Redeploy de apps/api desde main y aplicar migraciones 20260616_automation_pre_match_steps y 20260617_automation_live_steps.';

function isOutdatedAutomationApiRetryError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 400) return false;
  return err.message.includes('step debe ser uno de:') && !err.message.includes('HALFTIME');
}

function IncidentModal({
  incident,
  onClose,
  onRefresh,
  stepCatalog,
}: {
  incident: IncidentInfo;
  onClose: () => void;
  onRefresh: () => void;
  stepCatalog?: StepCatalogEntry[];
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);
  const step = incident.step;
  const [preview, setPreview] = useState<MessagePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewApiMissing, setPreviewApiMissing] = useState(false);
  const stepChannels = getStepChannels(stepCatalog, step.key);
  const availablePreviewChannels = useMemo(
    () => resolvePreviewChannels(stepChannels),
    [stepChannels],
  );
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>(() =>
    resolveDefaultPreviewChannel(stepChannels),
  );
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(
    incident.leagueId ?? incident.step.leagues[0]?.leagueId ?? null,
  );

  const breakdown = step.latestDetails?.channelBreakdown;
  const isProblemStep =
    step.status === 'FAILED' ||
    step.status === 'OVERDUE' ||
    step.status === 'WARNING' ||
    step.status === 'MANUAL' ||
    (step.status === 'SUCCESS' &&
      stepChannels.some((ch) => channelHasFailure(ch, breakdown, step)));
  const isChannelRetry = incident.channel === 'waGroup' && !!selectedLeagueId;
  const previewLeagueRequired = ['ESCALATION_T45', 'ESCALATION_T30', 'ESCALATION_FINAL'].includes(step.key);

  useEffect(() => {
    setPreviewChannel(resolveDefaultPreviewChannel(stepChannels));
    setPreviewError(null);
    setPreviewApiMissing(false);
  }, [incident.match.id, step.key, stepChannels.join('|')]);

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      if (previewApiMissing) return;
      if (previewLeagueRequired && !selectedLeagueId) {
        setPreview(null);
        setPreviewError(null);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const params = new URLSearchParams({
          matchId: incident.match.id,
          step: step.key,
          channel: previewChannel,
        });
        if (selectedLeagueId) params.set('leagueId', selectedLeagueId);
        const data = await request<MessagePreview>(`/admin/automation/message-preview?${params.toString()}`);
        if (!cancelled) {
          setPreview(data);
          setPreviewError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          if (err instanceof ApiError && err.status === 404) {
            setPreviewApiMissing(true);
            setPreviewError(
              `Vista previa no disponible: el API no expone /admin/automation/message-preview. ${OUTDATED_AUTOMATION_API_HINT}`,
            );
          } else if (err instanceof ApiError && isOutdatedAutomationApiRetryError(err)) {
            setPreviewError(OUTDATED_AUTOMATION_API_HINT);
          } else if (err instanceof ApiError) {
            setPreviewError(err.message);
          } else {
            setPreviewError('No se pudo cargar la vista previa.');
          }
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    void loadPreview();
    return () => { cancelled = true; };
  }, [incident.match.id, step.key, selectedLeagueId, previewChannel, previewLeagueRequired, previewApiMissing]);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      const result = isChannelRetry
        ? await request<RetryResult>('/admin/automation/retry-channel', {
            method: 'POST',
            body: JSON.stringify({
              matchId: incident.match.id,
              step: step.key,
              leagueId: incident.leagueId ?? selectedLeagueId,
              channel: 'waGroup',
            }),
          })
        : await request<RetryResult>('/admin/automation/retry', {
            method: 'POST',
            body: JSON.stringify({
              matchId: incident.match.id,
              step: step.key,
              leagueId: selectedLeagueId ?? incident.leagueId ?? undefined,
            }),
          });
      setRetryResult(result);
      if (result.ok) setTimeout(() => { onRefresh(); }, 1500);
    } catch (err: unknown) {
      const summary = isOutdatedAutomationApiRetryError(err)
        ? OUTDATED_AUTOMATION_API_HINT
        : err instanceof Error
          ? err.message
          : 'Error desconocido';
      setRetryResult({ ok: false, runId: null, summary });
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
              <p className="text-sm font-black text-slate-900">
                {incident.channel
                  ? 'Canal con problema'
                  : isProblemStep
                    ? 'Paso con problema'
                    : 'Vista previa del mensaje'}
              </p>
              <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-700">{incident.label}</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{incident.match.homeTeam} vs {incident.match.awayTeam}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Detalle del paso</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
              <p><span className="text-slate-400">Programado: </span>{step.scheduledAt ? fmtFull(step.scheduledAt) : step.key === 'GOAL_IMPACT' ? 'Tras cada gol (en vivo)' : '—'}</p>
              <p><span className="text-slate-400">Estado: </span>{step.status}</p>
              {step.summary && step.key === 'GOAL_IMPACT' && !step.lastStartedAt && (
                <p className="col-span-2 text-slate-500">{step.summary}</p>
              )}
              <p><span className="text-slate-400">Partido: </span>{incident.match.status}</p>
              {step.lastStartedAt && <p><span className="text-slate-400">Inicio: </span>{fmtFull(step.lastStartedAt)}</p>}
            </div>
            {step.errorMessage && (
              <p className="mt-2 text-red-600 font-semibold">{step.errorMessage}</p>
            )}
            {(incident.channelReason || breakdown?.waGroupReason) && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-red-700 font-semibold">
                {incident.channelReason || breakdown?.waGroupReason}
              </p>
            )}
            {(incident.match.automationExcludedLeagues?.length ?? 0) > 0 && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-900 font-semibold">
                La automatización no corre mientras la polla esté en{' '}
                {incident.match.automationExcludedLeagues!.map((l) => l.status).join(' / ')}.
                Pásala a <strong>ACTIVE</strong> en Admin → Pollas (
                {incident.match.automationExcludedLeagues!.map((l) => l.code).join(', ')}).
              </p>
            )}
          </div>

          {step.leagues.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ligas</p>
              {step.leagues.length > 1 && (
                <select
                  value={selectedLeagueId ?? ''}
                  onChange={(e) => setSelectedLeagueId(e.target.value || null)}
                  className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
                >
                  {step.leagues.map((league) => (
                    <option key={league.leagueId} value={league.leagueId}>
                      {league.leagueName} ({league.leagueCode})
                    </option>
                  ))}
                </select>
              )}
              <div className="space-y-2">
                {step.leagues.map((league) => (
                  <div key={league.leagueId} className={`rounded-lg border p-2 ${selectedLeagueId === league.leagueId ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot state={league.status} size={8} />
                      <span className="text-xs font-semibold text-slate-800">{league.leagueName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{league.leagueCode}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                      {league.deliveredCount !== null && <span>Entregados: <strong className="text-emerald-700">{league.deliveredCount}</strong></span>}
                      {league.failedCount !== null && league.failedCount > 0 && <span>Fallidos: <strong className="text-red-600">{league.failedCount}</strong></span>}
                      {league.audienceCount !== null && <span>Audiencia: <strong>{league.audienceCount}</strong></span>}
                    </div>
                    {league.errorMessage && (
                      <p className="mt-1 text-[10px] text-red-600">{league.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(stepChannels.length > 0 || preview) && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prueba del servicio (vista previa)</p>
                <div className="flex gap-1">
                  {availablePreviewChannels.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setPreviewChannel(ch)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${previewChannel === ch ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {CHANNEL_META[ch]?.label ?? ch}
                      </button>
                    ))}
                </div>
              </div>
              {previewLoading ? (
                <p className="text-xs text-slate-400">Generando vista previa…</p>
              ) : previewError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">{previewError}</p>
              ) : preview ? (
                <>
                  <div className="mb-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono">
                      {preview.source === 'job' ? 'Job WA' : preview.source === 'generated' ? 'Generado' : preview.source === 'unavailable' ? 'No disponible' : 'N/D'}
                    </span>
                    {preview.jobStatus && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono">job: {preview.jobStatus}</span>
                    )}
                    {preview.dedupeKey && (
                      <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 font-mono max-w-full" title={preview.dedupeKey}>
                        {preview.dedupeKey}
                      </span>
                    )}
                  </div>
                  {preview.title && (
                    <p className="mb-1 text-xs font-semibold text-slate-800">{preview.title}</p>
                  )}
                  <pre className={`max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed ${preview.source === 'unavailable' ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>
                    {preview.body}
                  </pre>
                </>
              ) : (
                <p className="text-xs text-slate-400">No hay vista previa disponible.</p>
              )}
            </div>
          )}

          {breakdown && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Canales</p>
              <div className="flex flex-wrap gap-2">
                {stepChannels.map((ch) => {
                  const counters = getChannelCounters(ch, breakdown);
                  const failed = channelHasFailure(ch, breakdown, step);
                  return (
                    <div
                      key={ch}
                      className={`rounded-lg border px-2 py-1 text-[10px] ${failed ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                    >
                      {CHANNEL_META[ch]?.label ?? ch}
                      {counters && (
                        <span className="ml-1 font-semibold">
                          {counters.sent > 0 && `✓${counters.sent}`}
                          {counters.failed > 0 && ` ✗${counters.failed}`}
                          {counters.pending > 0 && ` ⏳${counters.pending}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {retryResult && (
            <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${retryResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {retryResult.ok ? '✓' : '✗'} {retryResult.summary}
              {retryResult.delivery && (
                <p className="mt-1.5 text-[10px] opacity-90">
                  Push {retryResult.delivery.pushSent ?? 0}/{retryResult.delivery.pushDevices ?? 0}
                  {' · '}WA grupo {retryResult.delivery.waGroupSent ?? 0}
                  {(retryResult.delivery.waGroupFailed ?? 0) > 0 && ` (fallos ${retryResult.delivery.waGroupFailed})`}
                  {' · '}In-app {retryResult.delivery.inAppSent ?? 0}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Cerrar</button>
          {!retryResult?.ok && (
            <button
              onClick={handleRetry}
              disabled={retrying || (isChannelRetry && !selectedLeagueId) || (previewLeagueRequired && !selectedLeagueId && !isChannelRetry)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              <RotateCcw size={12} className={retrying ? 'animate-spin' : ''} />
              {retrying
                ? 'Reintentando...'
                : isChannelRetry
                  ? 'Reenviar a WA Grupo'
                  : 'Reintentar manualmente'}
            </button>
          )}
          {retryResult?.ok && (
            <>
              <button
                onClick={() => { setRetryResult(null); }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={12} /> Reintentar otra vez
              </button>
              <button onClick={() => { onClose(); onRefresh(); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">
                <CheckCircle2 size={12} /> Actualizar panel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureFlagsPanel({
  featureFlags,
  onToggle,
}: {
  featureFlags: NonNullable<AutomationStatus['featureFlags']>;
  onToggle: (flag: keyof NonNullable<AutomationStatus['featureFlags']>, enabled: boolean) => Promise<void>;
}) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items: Array<{
    key: keyof NonNullable<AutomationStatus['featureFlags']>;
    label: string;
    hint: string;
  }> = [
    { key: 'preMatchV2', label: 'Pre-partido v2', hint: 'T-60, escaladas T-45/T-30/T-final, WA con nombres' },
    { key: 'livePhaseV2', label: 'En vivo v2', hint: 'Inicio, HT, 2.ª parte, fin live, impacto gol WA' },
    { key: 'postMatchV2', label: 'Post-partido v2', hint: 'Resultado personal + WA con top del partido' },
  ];

  const handleToggle = async (key: keyof NonNullable<AutomationStatus['featureFlags']>, enabled: boolean) => {
    setToggling(key);
    setError(null);
    try {
      await onToggle(key, enabled);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el flag.');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black tracking-tight text-slate-900">Feature flags v2</p>
          <p className="mt-1 text-xs text-slate-500">
            Activa por fases. Orden recomendado: pre → en vivo → post. Si hay variable de entorno, el toggle queda bloqueado.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const state = featureFlags[item.key];
          const isOn = state.enabled;
          return (
            <div
              key={item.key}
              className={`rounded-xl border p-3 ${isOn ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{item.hint}</p>
                </div>
                <button
                  type="button"
                  disabled={state.locked || toggling === item.key}
                  onClick={() => handleToggle(item.key, !isOn)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isOn
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                  title={
                    state.locked
                      ? `Fijado por entorno (${state.source})`
                      : `Fuente: ${state.source}`
                  }
                >
                  {toggling === item.key ? '…' : isOn ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                {state.locked ? '🔒 Env' : state.source === 'db' ? 'BD' : 'Default OFF'}
              </p>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}

export default function AdminAutomation() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [matrix, setMatrix] = useState<DailyOperations | null>(null);
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

  const handleToggleFeatureFlag = async (
    flag: keyof NonNullable<AutomationStatus['featureFlags']>,
    enabled: boolean,
  ) => {
    const result = await request<{ ok: boolean; featureFlags: NonNullable<AutomationStatus['featureFlags']> }>(
      '/admin/automation/feature-flags',
      { method: 'PUT', body: JSON.stringify({ flag, enabled }) },
    );
    if (result.ok) {
      setStatus((prev) => prev ? { ...prev, featureFlags: result.featureFlags } : prev);
    }
  };

  const handleToggleStep = async (stepKey: string, enabled: boolean) => {
    const result = await request<{ ok: boolean; stepCatalog: StepCatalogEntry[] }>(
      '/admin/automation/step-overrides',
      { method: 'PUT', body: JSON.stringify({ step: stepKey, enabled }) },
    );
    if (result.ok) {
      setStatus((prev) => prev ? { ...prev, stepCatalog: result.stepCatalog } : prev);
    }
  };

  const handleToggleChannel = async (schedulerId: string, channel: string, enabled: boolean) => {
    try {
      const result = await request<{ ok: boolean; overrides: Record<string, Record<string, boolean>> }>(
        '/admin/automation/channel-overrides',
        { method: 'PUT', body: JSON.stringify({ schedulerId, channel, enabled }) },
      );
      if (result.ok) {
        setStatus((prev) => prev ? { ...prev, channelOverrides: result.overrides } : prev);
      }
    } catch (e) {
      console.error('Error al actualizar override de canal', e);
    }
  };

  const handleSaveTimingSettings = (minutes: number) => {
    setStatus((prev) =>
      prev && prev.timingHints
        ? {
            ...prev,
            timingHints: {
              ...prev.timingHints,
              predictionReportMinutesAfterClose: minutes,
              predictionReportMinutesBefore: Math.max(1, 15 - minutes),
            },
          }
        : prev,
    );
  };

  const loadBase = async () => {
    setLoading(true);
    try {
      const [statusResponse, matrixResponse] = await Promise.all([
        request<AutomationStatus>('/admin/automation/status'),
        request<DailyOperations>('/admin/automation/operations'),
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
    { id: 'config', label: 'Config pasos' },
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

  const resolvedStepCatalog = useMemo(() => resolveStepCatalog(status), [status]);
  const visibleSteps = useMemo(() => getVisibleSteps(resolvedStepCatalog), [resolvedStepCatalog]);
  const usingFallbackCatalog = !status?.stepCatalog?.length;
  const matrixGridColumns = useMemo(
    () => buildMatrixGridColumns(visibleSteps.length),
    [visibleSteps.length],
  );
  const matrixPhaseSpans = useMemo(
    () => buildPhaseColumnSpans(visibleSteps),
    [visibleSteps],
  );

  const filteredMatches = useMemo(() => {
    if (!matrix) return [];
    const q = matrixSearch.trim().toLowerCase();
    if (!q) return matrix.matches;
    return matrix.matches.filter((match) => {
      const title = formatMatchTitle(match).toLowerCase();
      return (
        title.includes(q) ||
        match.homeTeam.toLowerCase().includes(q) ||
        match.awayTeam.toLowerCase().includes(q) ||
        (match.tournament ?? '').toLowerCase().includes(q) ||
        (match.carryOverReason ?? '').toLowerCase().includes(q)
      );
    });
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
      {incident && (
        <IncidentModal
          incident={incident}
          onClose={() => setIncident(null)}
          onRefresh={loadBase}
          stepCatalog={resolvedStepCatalog}
        />
      )}
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Procesos automáticos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revisa canales, tipos de notificación, matriz diaria e historial sin duplicar el panel de sincronización independiente.
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

      {status?.featureFlags && (
        <FeatureFlagsPanel featureFlags={status.featureFlags} onToggle={handleToggleFeatureFlag} />
      )}

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
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Cada columna es un paso de automatización. Click en la celda → <strong>probar mensaje</strong> o <strong>reenviar</strong> si hubo error.
                Desplaza horizontalmente si no ves todas las fases.
              </p>
              {usingFallbackCatalog && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Mostrando catálogo de pasos por defecto — redeploy del API para sincronizar toggles de Config pasos.
                </p>
              )}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div
                className="grid border-b border-slate-100 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                style={{ gridTemplateColumns: matrixGridColumns }}
              >
                <span style={{ gridColumn: '1 / 5' }} />
                {matrixPhaseSpans.map((phase) => (
                  <span
                    key={phase.id}
                    style={{ gridColumn: `${phase.fromCol} / ${phase.toCol}` }}
                    className={`rounded-md border px-2 py-1 text-center ${phase.className}`}
                  >
                    {phase.label}
                  </span>
                ))}
                <span />
              </div>
              <div className="grid border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ gridTemplateColumns: matrixGridColumns }}>
                <span>Partido</span>
                <span className="px-3">Hora</span>
                <span className="text-center px-2">Estado</span>
                <span className="text-center px-2">Sync</span>
                {visibleSteps.map((step) => (
                  <span key={step.key} className="text-center" title={step.label}>
                    {resolveStepShortLabel(step, status?.timingHints)}
                  </span>
                ))}
                <span />
              </div>
              <div className="divide-y divide-slate-200">
                {filteredMatches.map((match) => (
                  <MatrixRow
                    key={match.id}
                    match={match}
                    expanded={expandedMatch === match.id}
                    onExpand={(id) => setExpandedMatch((current) => current === id ? null : id)}
                    onIncident={setIncident}
                    visibleSteps={visibleSteps}
                    gridColumns={matrixGridColumns}
                    stepCatalog={resolvedStepCatalog}
                  />
                ))}
              </div>
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
            <SchedulerCard
              key={scheduler.id}
              scheduler={scheduler}
              channelStatus={status.channels}
              channelOverrides={status.channelOverrides ?? {}}
              onToggleChannel={handleToggleChannel}
            />
          ))}
        </div>
      )}

      {tab === 'config' && status && (
        <div className="space-y-4">
          <AutomationTimingPanel
            timingHints={status.timingHints}
            onSaved={handleSaveTimingSettings}
          />
          <StepConfigMatrix
            stepCatalog={resolvedStepCatalog}
            channelStatus={status.channels}
            channelOverrides={status.channelOverrides ?? {}}
            timingHints={status.timingHints}
            onToggleChannel={handleToggleChannel}
            onToggleStep={handleToggleStep}
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Reglas de timing (referencia)</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Última escalada = <strong>cierre + 5 min</strong> antes del kickoff.
              {status.timingHints && (
                <>
                  {' '}Con cierre default {status.timingHints.defaultCloseMinutes} min → columna{' '}
                  <strong>{resolveEscalationFinalShortLabel(status.timingHints)}</strong>.
                  {' '}Reporte de predicciones: <strong>{status.timingHints.predictionReportMinutesAfterClose} min después del cierre</strong>
                  {' '}(≈ T-{status.timingHints.predictionReportMinutesBefore} con cierre default).
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Todas las horas mostradas al participante usan <strong>America/Bogota</strong> (formato 24h).
            </p>
          </div>
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
