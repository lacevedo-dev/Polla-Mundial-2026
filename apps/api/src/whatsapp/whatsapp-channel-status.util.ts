import { AutomationStep, WhatsappGroupJobType, WhatsappJobStatus } from '@prisma/client';

export type WaGroupChannelBreakdown = {
  waGroupSent?: number;
  waGroupEnqueued?: number;
  waGroupFailed?: number;
  waGroupExpected?: number;
  waGroupReason?: string | null;
  waGroupJobId?: string | null;
  waGroupLeagueId?: string | null;
};

export const AUTOMATION_STEP_TO_WA_JOB: Partial<Record<AutomationStep, WhatsappGroupJobType>> = {
  [AutomationStep.MATCH_REMINDER]: WhatsappGroupJobType.MATCH_REMINDER,
  [AutomationStep.PREDICTION_CLOSING]: WhatsappGroupJobType.PREDICTION_CLOSED,
  [AutomationStep.RESULT_NOTIFICATION]: WhatsappGroupJobType.RESULT_NOTIFICATION,
  [AutomationStep.PREDICTION_REPORT]: WhatsappGroupJobType.PREDICTION_REPORT,
  [AutomationStep.RESULT_REPORT]: WhatsappGroupJobType.RESULT_REPORT,
  [AutomationStep.ESCALATION_T45]: WhatsappGroupJobType.PRE_MATCH_ESCALATION,
  [AutomationStep.ESCALATION_T30]: WhatsappGroupJobType.PRE_MATCH_ESCALATION,
  [AutomationStep.ESCALATION_FINAL]: WhatsappGroupJobType.PRE_MATCH_ESCALATION,
  [AutomationStep.MATCH_START]: WhatsappGroupJobType.MATCH_START,
  [AutomationStep.HALFTIME]: WhatsappGroupJobType.HALFTIME,
  [AutomationStep.SECOND_HALF_START]: WhatsappGroupJobType.SECOND_HALF_START,
  [AutomationStep.MATCH_LIVE_END]: WhatsappGroupJobType.MATCH_LIVE_END,
  [AutomationStep.GOAL_IMPACT]: WhatsappGroupJobType.GOAL_IMPACT,
};

type WaJobRow = {
  id: string;
  status: WhatsappJobStatus;
  lastError: string | null;
  leagueId: string;
  sentAt: Date | null;
  updatedAt: Date;
};

export function buildWaGroupChannelBreakdown(params: {
  step: AutomationStep;
  stepStatus: string;
  matchId: string;
  relevantLeagues: Array<{ id: string; name: string; whatsappGroupId: string | null }>;
  jobsByDedupeKey: Map<string, WaJobRow>;
  waConnected: boolean;
  stepFinishedAt?: string | null;
  existing?: WaGroupChannelBreakdown | null;
}): WaGroupChannelBreakdown | null {
  const jobType = AUTOMATION_STEP_TO_WA_JOB[params.step];
  if (!jobType) return params.existing ?? null;

  const executedStatuses = new Set([
    'SUCCESS',
    'WARNING',
    'FAILED',
    'OVERDUE',
    'MANUAL',
    'RUNNING',
  ]);
  if (!executedStatuses.has(params.stepStatus)) {
    return params.existing ?? null;
  }

  const leaguesWithGroup = params.relevantLeagues.filter((l) => l.whatsappGroupId);
  if (leaguesWithGroup.length === 0) {
    return {
      ...(params.existing ?? {}),
      waGroupExpected: 0,
      waGroupSent: 0,
      waGroupEnqueued: 0,
      waGroupFailed: 0,
      waGroupReason: null,
    };
  }

  let sent = 0;
  let enqueued = 0;
  let failed = 0;
  const reasons: string[] = [];
  let firstFailedJobId: string | null = null;
  let firstFailedLeagueId: string | null = null;

  const finishedMs = params.stepFinishedAt ? new Date(params.stepFinishedAt).getTime() : null;
  const stalePending =
    finishedMs !== null && Date.now() - finishedMs > 10 * 60 * 1000;

  for (const league of leaguesWithGroup) {
    const dedupeKey = `${jobType}:${params.matchId}:${league.id}`;
    const job = params.jobsByDedupeKey.get(dedupeKey);

    if (!job) {
      failed++;
      reasons.push(`${league.name}: no se encoló el mensaje al grupo`);
      firstFailedLeagueId ??= league.id;
      continue;
    }

    switch (job.status) {
      case WhatsappJobStatus.SENT:
        sent++;
        break;
      case WhatsappJobStatus.FAILED:
        failed++;
        reasons.push(job.lastError?.trim() || `${league.name}: envío fallido`);
        firstFailedJobId ??= job.id;
        firstFailedLeagueId ??= league.id;
        break;
      case WhatsappJobStatus.PENDING:
      case WhatsappJobStatus.SENDING:
        if (!params.waConnected) {
          failed++;
          reasons.push('WhatsApp Web desconectado — el mensaje quedó pendiente');
          firstFailedJobId ??= job.id;
          firstFailedLeagueId ??= league.id;
        } else if (stalePending) {
          failed++;
          reasons.push('Pendiente demasiado tiempo sin enviarse al grupo');
          firstFailedJobId ??= job.id;
          firstFailedLeagueId ??= league.id;
        } else {
          enqueued++;
        }
        break;
      default:
        failed++;
        reasons.push(`${league.name}: estado de job desconocido`);
        break;
    }
  }

  return {
    ...(params.existing ?? {}),
    waGroupExpected: leaguesWithGroup.length,
    waGroupSent: sent,
    waGroupEnqueued: enqueued,
    waGroupFailed: failed,
    waGroupReason: reasons[0] ?? null,
    waGroupJobId: firstFailedJobId,
    waGroupLeagueId: firstFailedLeagueId,
  };
}
