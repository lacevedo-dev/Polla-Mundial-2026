import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export type WhatsappStatus = 'DISABLED' | 'INITIALIZING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED' | 'AUTH_FAILURE';

export interface WhatsappGroup {
  id: string;
  name: string;
  participants: number;
}

export interface SendToGroupParams {
  groupId: string;
  caption: string;
  imageBuffer: Buffer;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

@Injectable()
export class WhatsappWebService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappWebService.name);
  private readonly enabled: boolean;
  private readonly sessionPath: string;

  private client: any = null;
  private status: WhatsappStatus = 'INITIALIZING';
  private qrDataUrl: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('WHATSAPP_WEB_ENABLED') === 'true';
    this.sessionPath = this.config.get<string>('WHATSAPP_SESSION_PATH') ?? path.join(process.cwd(), '.wwebjs_auth');
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.status = 'DISABLED';
      this.logger.debug('WhatsApp Web disabled (WHATSAPP_WEB_ENABLED != true)');
      return;
    }
    await this.initClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // ignore
      }
    }
  }

  private async initClient(): Promise<void> {
    try {
      // Dynamic require — optional dependency, fails gracefully
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
      (this as any)._MessageMedia = MessageMedia;

      const executablePath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');

      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: this.sessionPath }),
        puppeteer: {
          headless: true,
          executablePath: executablePath ?? undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      this.client.on('qr', (qr: string) => {
        this.status = 'QR_READY';
        this.qrDataUrl = null;
        this.generateQrDataUrl(qr).catch(() => null);
        this.logger.log('WhatsApp Web QR ready — scan from admin panel');
      });

      this.client.on('ready', () => {
        this.status = 'CONNECTED';
        this.qrDataUrl = null;
        this.logger.log('WhatsApp Web session connected');
      });

      this.client.on('auth_failure', (msg: string) => {
        this.status = 'AUTH_FAILURE';
        this.logger.error(`WhatsApp Web auth failure: ${msg}`);
      });

      this.client.on('disconnected', (reason: string) => {
        this.status = 'DISCONNECTED';
        this.logger.warn(`WhatsApp Web disconnected: ${reason}`);
      });

      this.status = 'INITIALIZING';
      await this.client.initialize();
    } catch (e: any) {
      this.status = 'DISCONNECTED';
      this.logger.error(`WhatsApp Web init failed: ${e.message}`);
    }
  }

  private async generateQrDataUrl(qr: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const qrcode = require('qrcode');
      this.qrDataUrl = await qrcode.toDataURL(qr);
    } catch {
      this.qrDataUrl = null;
    }
  }

  getStatus(): WhatsappStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'CONNECTED';
  }

  getQrDataUrl(): string | null {
    return this.qrDataUrl;
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.logout();
      this.status = 'DISCONNECTED';
    } catch (e: any) {
      this.logger.warn(`WhatsApp Web logout error: ${e.message}`);
    }
  }

  async listGroups(): Promise<WhatsappGroup[]> {
    if (!this.isConnected() || !this.client) {
      throw new Error('WhatsApp Web is not connected');
    }
    try {
      const chats = await this.client.getChats();
      return (chats as any[])
        .filter((c) => c.isGroup)
        .map((c) => ({
          id: c.id._serialized,
          name: c.name as string,
          participants: (c.participants as any[])?.length ?? 0,
        }));
    } catch (e: any) {
      this.logger.error(`listGroups error: ${e.message}`);
      throw e;
    }
  }

  async sendTextToGroup(groupId: string, text: string): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('WhatsApp Web is not connected');
    }
    try {
      await this.client.sendMessage(groupId, text);
    } catch (e: any) {
      this.logger.error(`sendTextToGroup error (${groupId}): ${e.message}`);
      throw e;
    }
  }

  async sendToGroup(params: SendToGroupParams): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('WhatsApp Web is not connected');
    }

    const MessageMedia = (this as any)._MessageMedia;
    if (!MessageMedia) {
      throw new Error('whatsapp-web.js MessageMedia not loaded');
    }

    try {
      // Send image with caption
      const imageMedia = new MessageMedia(
        'image/png',
        params.imageBuffer.toString('base64'),
        'reporte.png',
      );
      await this.client.sendMessage(params.groupId, imageMedia, { caption: params.caption });

      // Send PDF as document
      const pdfMedia = new MessageMedia(
        'application/pdf',
        params.pdfBuffer.toString('base64'),
        params.pdfFilename,
      );
      await this.client.sendMessage(params.groupId, pdfMedia);
    } catch (e: any) {
      this.logger.error(`sendToGroup error (${params.groupId}): ${e.message}`);
      throw e;
    }
  }
}
