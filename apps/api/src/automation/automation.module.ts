import { Module, forwardRef } from '@nestjs/common';
import { AutomationObservabilityModule } from '../automation-observability/automation-observability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PredictionReportModule } from '../prediction-report/prediction-report.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AutomationFeatureFlagsService } from './config/automation-feature-flags.service';
import { AutomationStepConfigService } from './config/automation-step-config.service';
import { AutomationTimingConfigService } from './config/automation-timing-config.service';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { GoalImpactAnalyzerService } from './live/goal-impact-analyzer.service';
import { GoalLiveNotificationService } from './live/goal-live-notification.service';
import { CardLiveNotificationService } from './live/card-live-notification.service';
import { LiveOrchestratorService } from './live/live-orchestrator.service';
import { PostMatchOrchestratorService } from './post-match/post-match-orchestrator.service';
import { PreMatchOrchestratorService } from './pre-match/pre-match-orchestrator.service';
import { AutomationRetryService } from './retry/automation-retry.service';
import { AutomationMessagePreviewService } from './preview/automation-message-preview.service';

@Module({
  imports: [
    PrismaModule,
    AutomationObservabilityModule,
    PredictionsModule,
    PredictionReportModule,
    forwardRef(() => NotificationsModule),
    PushNotificationsModule,
    WhatsappModule,
  ],
  providers: [
    AutomationFeatureFlagsService,
    AutomationStepConfigService,
    AutomationTimingConfigService,
    GoalImpactAnalyzerService,
    GoalLiveNotificationService,
    CardLiveNotificationService,
    LiveOrchestratorService,
    PostMatchOrchestratorService,
    PreMatchOrchestratorService,
    AutomationRetryService,
    AutomationMessagePreviewService,
  ],
  exports: [
    AutomationFeatureFlagsService,
    AutomationStepConfigService,
    AutomationTimingConfigService,
    GoalImpactAnalyzerService,
    GoalLiveNotificationService,
    CardLiveNotificationService,
    LiveOrchestratorService,
    PostMatchOrchestratorService,
    PreMatchOrchestratorService,
    AutomationRetryService,
    AutomationMessagePreviewService,
  ],
})
export class AutomationModule {}
