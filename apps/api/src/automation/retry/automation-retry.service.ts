import { BadRequestException, Injectable } from '@nestjs/common';
import { AutomationStep } from '@prisma/client';
import { NotificationScheduler, type MatchReminderRetrySummary } from '../../notifications/notification.scheduler';
import { PredictionReportScheduler } from '../../prediction-report/prediction-report.scheduler';
import { WhatsappGroupService } from '../../whatsapp/whatsapp-group.service';
import { AUTOMATION_STEP_TO_WA_JOB } from '../../whatsapp/whatsapp-channel-status.util';
import {
  automationStepToLiveEvent,
  WA_GROUP_RETRY_STEPS,
} from '../config/automation-step-scheduler.util';
import { LiveOrchestratorService } from '../live/live-orchestrator.service';
import { PostMatchOrchestratorService } from '../post-match/post-match-orchestrator.service';
import { PreMatchOrchestratorService } from '../pre-match/pre-match-orchestrator.service';

@Injectable()
export class AutomationRetryService {
  constructor(
    private readonly notificationScheduler: NotificationScheduler,
    private readonly predictionReportScheduler: PredictionReportScheduler,
    private readonly preMatchOrchestrator: PreMatchOrchestratorService,
    private readonly liveOrchestrator: LiveOrchestratorService,
    private readonly postMatchOrchestrator: PostMatchOrchestratorService,
    private readonly waGroup: WhatsappGroupService,
  ) {}

  isWaGroupRetryStep(step: AutomationStep): boolean {
    return WA_GROUP_RETRY_STEPS.includes(step);
  }

  async retryMatchReminder(
    matchId: string,
    leagueId?: string,
  ): Promise<MatchReminderRetrySummary> {
    return this.notificationScheduler.retryReminderForMatch(matchId, leagueId);
  }

  async retryStep(params: {
    step: AutomationStep;
    matchId: string;
    leagueId?: string;
  }): Promise<void> {
    const { step, matchId, leagueId } = params;

    switch (step) {
      case AutomationStep.MATCH_REMINDER:
        await this.notificationScheduler.retryReminderForMatch(matchId, leagueId);
        return;
      case AutomationStep.PREDICTION_CLOSING:
        await this.notificationScheduler.retryClosingForMatch(matchId, leagueId);
        return;
      case AutomationStep.ESCALATION_T45:
      case AutomationStep.ESCALATION_T30:
      case AutomationStep.ESCALATION_FINAL:
        await this.preMatchOrchestrator.retryEscalation({
          matchId,
          step,
          leagueId,
        });
        return;
      case AutomationStep.MATCH_START:
      case AutomationStep.HALFTIME:
      case AutomationStep.SECOND_HALF_START:
      case AutomationStep.MATCH_LIVE_END:
        if (!automationStepToLiveEvent(step)) {
          throw new BadRequestException(`Step en vivo no soportado: ${step}`);
        }
        await this.liveOrchestrator.retryLiveStep(matchId, step, leagueId);
        return;
      case AutomationStep.RESULT_NOTIFICATION:
        await this.postMatchOrchestrator.retryResultNotification(
          matchId,
          leagueId,
        );
        return;
      case AutomationStep.PREDICTION_REPORT:
        await this.predictionReportScheduler.retryPredictionReportForMatch(
          matchId,
          leagueId,
        );
        return;
      case AutomationStep.RESULT_REPORT:
        await this.predictionReportScheduler.retryResultReportForMatch(
          matchId,
          leagueId,
        );
        return;
      case AutomationStep.GOAL_IMPACT:
        throw new BadRequestException(
          'GOAL_IMPACT solo admite reintento por canal WA Grupo (retry-channel).',
        );
      default:
        throw new BadRequestException(`Step no soportado para reintento: ${step}`);
    }
  }

  async retryWaGroupChannel(params: {
    step: AutomationStep;
    matchId: string;
    leagueId: string;
  }): Promise<{ ok: boolean; message: string; jobId?: string }> {
    if (!this.isWaGroupRetryStep(params.step)) {
      throw new BadRequestException(
        `El step ${params.step} no tiene envío a WA Grupo.`,
      );
    }

    const jobType = AUTOMATION_STEP_TO_WA_JOB[params.step];
    if (!jobType) {
      throw new BadRequestException(
        `No hay tipo de job WA mapeado para ${params.step}.`,
      );
    }

    return this.waGroup.retryStepDelivery(
      params.matchId,
      params.leagueId,
      jobType,
      {
        automationStep: params.step,
        forceResend: true,
      },
    );
  }
}
