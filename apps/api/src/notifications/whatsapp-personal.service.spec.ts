import { WhatsappPersonalService } from './whatsapp-personal.service';

describe('WhatsappPersonalService', () => {
  const waWeb = {
    isConnected: jest.fn(),
    sendTextToNumber: jest.fn(),
  };
  const twilio = {
    isEnabled: jest.fn(),
    sendWhatsApp: jest.fn(),
  };
  const prisma = {
    whatsappPersonalLog: {
      create: jest.fn(),
    },
  };

  const createService = () =>
    new WhatsappPersonalService(waWeb as any, twilio as any, prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.whatsappPersonalLog.create.mockResolvedValue({ id: 'log-1' });
  });

  it('usa WhatsApp Web cuando está conectado', async () => {
    waWeb.isConnected.mockReturnValue(true);
    waWeb.sendTextToNumber.mockResolvedValue(undefined);

    const service = createService();
    const result = await service.send('+57', '3001234567', 'Hola', 'Luis');

    expect(result).toEqual({ sent: true, via: 'whatsapp_web' });
    expect(waWeb.sendTextToNumber).toHaveBeenCalledWith('+57', '3001234567', 'Hola');
    expect(twilio.sendWhatsApp).not.toHaveBeenCalled();
    expect(prisma.whatsappPersonalLog.create).not.toHaveBeenCalled();
  });

  it('hace fallback a Twilio si WhatsApp Web falla', async () => {
    waWeb.isConnected.mockReturnValue(true);
    waWeb.sendTextToNumber.mockRejectedValue(new Error('not registered'));
    twilio.isEnabled.mockReturnValue(true);
    twilio.sendWhatsApp.mockResolvedValue(true);

    const service = createService();
    const result = await service.send('+57', '3001234567', 'Hola', 'Luis');

    expect(result).toEqual({ sent: true, via: 'twilio' });
    expect(twilio.sendWhatsApp).toHaveBeenCalledWith('+573001234567', 'Hola');
  });

  it('persiste log cuando hay contexto', async () => {
    waWeb.isConnected.mockReturnValue(true);
    waWeb.sendTextToNumber.mockResolvedValue(undefined);

    const service = createService();
    const result = await service.send('+57', '3001234567', 'Hola', 'Luis', {
      userId: 'u1',
      source: 'AUTOMATION',
    } as any);

    expect(result).toEqual({ sent: true, via: 'whatsapp_web', logId: 'log-1' });
    expect(prisma.whatsappPersonalLog.create).toHaveBeenCalled();
  });
});
