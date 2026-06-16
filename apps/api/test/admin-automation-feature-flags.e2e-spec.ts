jest.mock('./../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigService } from '@nestjs/config';
import { AdminAutomationController } from './../src/admin/admin-automation.controller';
import { AutomationFeatureFlagsService } from './../src/automation/config/automation-feature-flags.service';
import { AutomationMessagePreviewService } from './../src/automation/preview/automation-message-preview.service';
import { AutomationObservabilityService } from './../src/automation-observability/automation-observability.service';
import { AutomationRetryService } from './../src/automation/retry/automation-retry.service';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from './../src/auth/guards/roles.guard';
import { EmailBacklogAuditService } from './../src/email/email-backlog-audit.service';
import { NotificationScheduler } from './../src/notifications/notification.scheduler';
import { PredictionReportScheduler } from './../src/prediction-report/prediction-report.scheduler';
import { PrismaService } from './../src/prisma/prisma.service';
import { PushNotificationsService } from './../src/push-notifications/push-notifications.service';
import { WhatsappGroupService } from './../src/whatsapp/whatsapp-group.service';
import { WhatsappWebService } from './../src/whatsapp/whatsapp-web.service';

class MockAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { userId: 'superadmin-1', systemRole: 'SUPERADMIN' };
    return true;
  }
}

describe('Admin automation feature flags (e2e)', () => {
  let app: INestApplication<App>;

  const prismaServiceMock = {
    pushSubscription: { count: jest.fn().mockResolvedValue(0) },
    notification: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockResolvedValue(0) },
    league: { count: jest.fn().mockResolvedValue(0) },
    whatsappGroupJob: { count: jest.fn().mockResolvedValue(0) },
    systemConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  const configServiceMock = { get: jest.fn().mockReturnValue(null) };
  const pushServiceMock = { sendTestToUser: jest.fn() };
  const emailBacklogAuditMock = {
    getAutomationStatus: jest.fn().mockResolvedValue({
      queue: {},
      latestRun: null,
      recentFailures: 0,
    }),
  };
  const waWebMock = { getStatus: jest.fn().mockReturnValue({ connected: false }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.AUTOMATION_PRE_MATCH_V2;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminAutomationController],
      providers: [
        AutomationFeatureFlagsService,
        AutomationStepConfigService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: PushNotificationsService, useValue: pushServiceMock },
        { provide: EmailBacklogAuditService, useValue: emailBacklogAuditMock },
        { provide: AutomationObservabilityService, useValue: {} },
        { provide: NotificationScheduler, useValue: {} },
        { provide: PredictionReportScheduler, useValue: {} },
        { provide: WhatsappWebService, useValue: waWebMock },
        { provide: WhatsappGroupService, useValue: {} },
        { provide: AutomationRetryService, useValue: {} },
        { provide: AutomationMessagePreviewService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAdminGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAdminGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /status incluye featureFlags con metadata', async () => {
    await request(app.getHttpServer())
      .get('/admin/automation/status')
      .expect(200)
      .expect((response) => {
        expect(response.body.featureFlags.preMatchV2).toEqual({
          enabled: false,
          source: 'default',
          locked: false,
        });
      });
  });

  it('PUT /feature-flags persiste en SystemConfig', async () => {
    prismaServiceMock.systemConfig.findUnique.mockImplementation(
      ({ where }: { where: { key: string } }) => {
        if (where.key === 'automation:pre_match_v2') {
          return Promise.resolve({ value: 'true' });
        }
        return Promise.resolve(null);
      },
    );

    await request(app.getHttpServer())
      .put('/admin/automation/feature-flags')
      .send({ flag: 'preMatchV2', enabled: true })
      .expect(200)
      .expect((response) => {
        expect(response.body.ok).toBe(true);
        expect(response.body.featureFlags.preMatchV2.enabled).toBe(true);
      });

    expect(prismaServiceMock.systemConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'automation:pre_match_v2' },
        create: expect.objectContaining({ value: 'true' }),
      }),
    );
  });

  it('rechaza flag inválido', async () => {
    await request(app.getHttpServer())
      .put('/admin/automation/feature-flags')
      .send({ flag: 'invalid', enabled: true })
      .expect(400);
  });
});
