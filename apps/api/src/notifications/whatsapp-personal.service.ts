import { Injectable, Logger } from '@nestjs/common';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { TwilioService } from './twilio.service';

export type WhatsappPersonalVia = 'whatsapp_web' | 'twilio';

@Injectable()
export class WhatsappPersonalService {
  private readonly logger = new Logger(WhatsappPersonalService.name);

  constructor(
    private readonly waWeb: WhatsappWebService,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * WhatsApp personal: primero sesión WhatsApp Web (WA Grupo), luego Twilio.
   */
  async send(
    countryCode: string | null | undefined,
    phone: string,
    message: string,
    userName?: string,
  ): Promise<{ sent: boolean; via?: WhatsappPersonalVia }> {
    if (this.waWeb.isConnected()) {
      try {
        await this.waWeb.sendTextToNumber(countryCode, phone, message);
        return { sent: true, via: 'whatsapp_web' };
      } catch (err) {
        const label = userName ?? phone;
        this.logger.warn(
          `WA Web personal a ${label} falló (${String(err)}); intentando Twilio si está disponible`,
        );
      }
    }

    if (this.twilio.isEnabled()) {
      const fullPhone = `${countryCode ?? '+57'}${phone}`;
      const sent = await this.twilio.sendWhatsApp(fullPhone, message);
      return sent ? { sent: true, via: 'twilio' } : { sent: false };
    }

    return { sent: false };
  }
}
