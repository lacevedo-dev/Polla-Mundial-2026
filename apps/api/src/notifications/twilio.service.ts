import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: any = null;
  private whatsappFrom: string;
  private smsFrom: string;
  private enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.whatsappFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886';
    this.smsFrom = this.config.get<string>('TWILIO_SMS_FROM') ?? '';
    this.enabled = !!(sid && token);

    if (this.enabled) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.client = require('twilio')(sid, token);
        this.logger.log('Twilio client initialized');
      } catch (e: any) {
        this.logger.warn(`Twilio not available (package not installed): ${e.message}`);
        this.enabled = false;
      }
    } else {
      this.logger.debug('Twilio credentials not configured — WhatsApp/SMS notifications disabled');
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<boolean> {
    if (!this.enabled || !to) return false;
    try {
      await this.client.messages.create({
        from: this.whatsappFrom,
        to: `whatsapp:${to}`,
        body: message,
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`[Twilio WhatsApp] Error: ${e.message}`);
      return false;
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.enabled || !this.smsFrom || !to) return false;
    try {
      await this.client.messages.create({
        from: this.smsFrom,
        to,
        body: message,
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`[Twilio SMS] Error: ${e.message}`);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
