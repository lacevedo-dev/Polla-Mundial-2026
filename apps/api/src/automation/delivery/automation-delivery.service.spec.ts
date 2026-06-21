import { AutomationStep, NotificationType } from '@prisma/client';
import { AutomationDeliveryService } from './automation-delivery.service';

describe('AutomationDeliveryService', () => {
  const stepConfig = {
    isSchedulerChannelEnabled: jest.fn(),
  };
  const push = { sendToUser: jest.fn() };
  const notifications = { createInAppNotification: jest.fn() };
  const waPersonal = { send: jest.fn() };
  const prisma = { user: { findFirst: jest.fn() } };

  let service: AutomationDeliveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AutomationDeliveryService(
      prisma as any,
      stepConfig as any,
      push as any,
      notifications as any,
      waPersonal as any,
    );
    push.sendToUser.mockResolvedValue({ sent: 1, failed: 0, devices: 1 });
    notifications.createInAppNotification.mockResolvedValue(undefined);
  });

  it('no envía WA personal si el catálogo del paso no incluye whatsapp', async () => {
    stepConfig.isSchedulerChannelEnabled.mockImplementation(
      async (_sched: string, channel: string) =>
        channel === 'push' || channel === 'inApp',
    );

    const result = await service.deliverToUser({
      userId: 'u1',
      type: NotificationType.LEAGUE_UPDATE,
      title: 'Inicio',
      body: 'Partido en vivo',
      data: { matchId: 'm1' },
      step: AutomationStep.MATCH_START,
    });

    expect(waPersonal.send).not.toHaveBeenCalled();
    expect(result.whatsappSent).toBe(false);
    expect(result.pushSent).toBe(1);
    expect(result.inAppSent).toBe(1);
  });

  it('envía WA personal solo si el paso lo permite y hay teléfono', async () => {
    stepConfig.isSchedulerChannelEnabled.mockImplementation(
      async (_sched: string, channel: string) => channel !== 'push',
    );
    prisma.user.findFirst.mockResolvedValue({
      phone: '3001234567',
      countryCode: '+57',
    });
    waPersonal.send.mockResolvedValue({ sent: true, via: 'whatsapp_web' });

    const result = await service.deliverToUser({
      userId: 'u1',
      type: NotificationType.RESULT_PUBLISHED,
      title: 'Resultado',
      body: 'Ganaste puntos',
      data: { matchId: 'm1' },
      step: AutomationStep.RESULT_NOTIFICATION,
    });

    expect(waPersonal.send).toHaveBeenCalledWith(
      '+57',
      '3001234567',
      'Resultado\nGanaste puntos',
      undefined,
      expect.objectContaining({
        userId: 'u1',
        source: 'AUTOMATION',
        automationStep: AutomationStep.RESULT_NOTIFICATION,
        notificationType: NotificationType.RESULT_PUBLISHED,
        matchId: 'm1',
      }),
    );
    expect(result.whatsappSent).toBe(true);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
