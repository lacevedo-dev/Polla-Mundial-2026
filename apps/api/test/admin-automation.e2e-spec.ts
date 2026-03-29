jest.mock('./../src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigService } from '@nestjs/config';
import { AdminAutomationController } from './../src/admin/admin-automation.controller';
import { AutomationObservabilityService } from './../src/automation-observability/automation-observability.service';
import { JwtAuthGuard } from './../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from './../src/auth/guards/roles.guard';
import { EmailBacklogAuditService } from './../src/email/email-backlog-audit.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { PushNotificationsService } from './../src/push-notifications/push-notifications.service';

class MockAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      userId: 'superadmin-1',
      systemRole: 'SUPERADMIN',
    };
    return true;
  }
}

describe('Admin automation (e2e)', () => {
  let app: INestApplication<App>;

  const prismaServiceMock = {
    pushSubscription: { count: jest.fn().mockResolvedValue(0) },
    notification: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockResolvedValue(0) },
  };

  const configServiceMock = {
    get: jest.fn().mockReturnValue(null),
  };

  const pushServiceMock = {
    sendTestToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0, devices: 0 }),
  };

  const emailBacklogAuditMock = {
    getAutomationStatus: jest.fn().mockResolvedValue({
      queue: {},
      latestRun: null,
      recentFailures: 0,
    }),
  };

  const observabilityMock = {
    getDailyOperations: jest.fn().mockResolvedValue({
      date: '2026-03-29',
      generatedAt: '2026-03-29T12:00:00.000Z',
      matches: [
        {
          id: 'match-1',
          trackingScope: 'TODAY',
          homeTeam: 'Colombia',
          awayTeam: 'Argentina',
          matchDate: '2026-03-29T20:00:00.000Z',
          status: 'SCHEDULED',
          tournament: 'Friendlies',
          overallStatus: 'FAILED',
          sync: {
            status: 'SUCCESS',
            lastStartedAt: '2026-03-29T18:00:00.000Z',
            lastFinishedAt: '2026-03-29T18:00:12.000Z',
            durationMs: 12000,
            summary: 'Sync OK',
            errorMessage: null,
            recentLogs: [],
          },
          steps: [],
        },
      ],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminAutomationController],
      providers: [
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: PushNotificationsService, useValue: pushServiceMock },
        { provide: EmailBacklogAuditService, useValue: emailBacklogAuditMock },
        { provide: AutomationObservabilityService, useValue: observabilityMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockAdminGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAdminGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the daily operations matrix with exact times for observability', async () => {
    await request(app.getHttpServer())
      .get('/admin/automation/operations?date=2026-03-29T00:00:00.000Z')
      .expect(200)
      .expect((response) => {
        expect(response.body.date).toBe('2026-03-29');
        expect(response.body.matches).toHaveLength(1);
        expect(response.body.matches[0]).toEqual(
          expect.objectContaining({
            id: 'match-1',
            overallStatus: 'FAILED',
          }),
        );
      });

    expect(observabilityMock.getDailyOperations).toHaveBeenCalledWith('2026-03-29T00:00:00.000Z');
  });

  it('rejects invalid date filters before hitting the observability service', async () => {
    await request(app.getHttpServer())
      .get('/admin/automation/operations?date=maniana')
      .expect(400);

    expect(observabilityMock.getDailyOperations).not.toHaveBeenCalledWith('maniana');
  });
});
