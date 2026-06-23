import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
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

export interface WhatsappSessionInfo {
  sessionPath: string;
  sessionExists: boolean;
  reconnectAttempts: number;
  lastDisconnectReason: string | null;
}

const RECONNECT_DELAY_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 12;
const PRODUCTION_SESSION_PATH = '/data/wwebjs_auth';
const DEFAULT_WA_WEB_HTML_URL =
  'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html';
const LOCAL_AUTH_CLIENT_ID = 'polla-wa-session';

/** Normaliza teléfono de usuario a chatId whatsapp-web.js (`573001234567@c.us`). */
export function normalizePhoneToWhatsAppChatId(
  countryCode: string | null | undefined,
  phone: string,
): string | null {
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phoneDigits) return null;

  const ccDigits = (countryCode ?? '+57').replace(/\D/g, '');
  const fullDigits = phoneDigits.startsWith(ccDigits)
    ? phoneDigits
    : `${ccDigits}${phoneDigits}`;

  return `${fullDigits}@c.us`;
}

@Injectable()
export class WhatsappWebService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappWebService.name);
  private readonly enabled: boolean;
  private readonly sessionPath: string;

  private client: any = null;
  private status: WhatsappStatus = 'INITIALIZING';
  private qrDataUrl: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private initializing = false;
  private lastDisconnectReason: string | null = null;
  private awaitingQrScan = false;
  private qrLoggedForCurrentInit = false;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('WHATSAPP_WEB_ENABLED') === 'true';
    const configuredPath = this.config.get<string>('WHATSAPP_SESSION_PATH')?.trim();
    this.sessionPath =
      configuredPath ||
      (process.env.NODE_ENV === 'production'
        ? PRODUCTION_SESSION_PATH
        : path.join(process.cwd(), '.wwebjs_auth'));
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.status = 'DISABLED';
      this.logger.debug('WhatsApp Web disabled (WHATSAPP_WEB_ENABLED != true)');
      return;
    }

    this.ensureSessionDirectory();
    this.logger.log(
      `WhatsApp Web session path: ${this.sessionPath} (persisted=${this.hasPersistedSession()})`,
    );
    await this.initClient();
  }

  async onModuleDestroy(): Promise<void> {
    this.clearReconnectTimer();
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // ignore
      }
    }
  }

  private ensureSessionDirectory(): void {
    try {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    } catch (e: any) {
      this.logger.error(`No se pudo crear el directorio de sesión ${this.sessionPath}: ${e.message}`);
    }
  }

  private hasPersistedSession(): boolean {
    try {
      if (!fs.existsSync(this.sessionPath)) return false;
      const entries = fs.readdirSync(this.sessionPath);
      return entries.length > 0;
    } catch {
      return false;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async initClient(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
      (this as any)._MessageMedia = MessageMedia;

      const executablePath = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');

      const webVersionUrl =
        this.config.get<string>('WHATSAPP_WEB_VERSION_URL')?.trim() ||
        DEFAULT_WA_WEB_HTML_URL;

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: LOCAL_AUTH_CLIENT_ID,
          dataPath: this.sessionPath,
        }),
        // Evita desconexiones por cambios de versión de WhatsApp Web
        webVersionCache: {
          type: 'remote',
          remotePath: webVersionUrl,
        },
        puppeteer: {
          headless: true,
          executablePath: executablePath ?? undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
          ],
        },
      });

      this.qrLoggedForCurrentInit = false;

      this.client.on('qr', (qr: string) => {
        this.status = 'QR_READY';
        this.awaitingQrScan = true;
        this.qrDataUrl = null;
        this.generateQrDataUrl(qr).catch(() => null);
        if (!this.qrLoggedForCurrentInit) {
          this.qrLoggedForCurrentInit = true;
          const persisted = this.hasPersistedSession();
          this.logger.warn(
            persisted
              ? 'WhatsApp Web requiere escanear QR (sesión en disco inválida o expirada) — Admin → WhatsApp'
              : 'WhatsApp Web QR listo — escanea desde Admin → WhatsApp',
          );
        } else {
          this.logger.debug('WhatsApp Web QR refreshed');
        }
      });

      this.client.on('ready', () => {
        this.status = 'CONNECTED';
        this.awaitingQrScan = false;
        this.qrDataUrl = null;
        this.reconnectAttempts = 0;
        this.lastDisconnectReason = null;
        this.logger.log('WhatsApp Web session connected');
      });

      this.client.on('authenticated', () => {
        this.awaitingQrScan = false;
        this.logger.log(
          `WhatsApp Web authenticated — sesión guardada en ${this.sessionPath}`,
        );
      });

      this.client.on('auth_failure', (msg: string) => {
        this.status = 'AUTH_FAILURE';
        this.awaitingQrScan = true;
        this.clearReconnectTimer();
        this.logger.error(
          `WhatsApp Web auth failure: ${msg} — escanea QR de nuevo en Admin → WhatsApp`,
        );
      });

      this.client.on('disconnected', (reason: string) => {
        this.status = 'DISCONNECTED';
        this.lastDisconnectReason = reason;
        this.logger.warn(`WhatsApp Web disconnected: ${reason}`);

        // LOGOUT = desvinculado desde el teléfono; requiere escanear QR de nuevo
        if (reason === 'LOGOUT') {
          this.awaitingQrScan = true;
          this.clearReconnectTimer();
          return;
        }

        this.scheduleReconnect();
      });

      this.status = 'INITIALIZING';
      await this.client.initialize();
    } catch (e: any) {
      this.status = 'DISCONNECTED';
      this.logger.error(`WhatsApp Web init failed: ${e.message}`);
      this.scheduleReconnect();
    } finally {
      this.initializing = false;
    }
  }

  private scheduleReconnect(): void {
    if (this.awaitingQrScan) {
      this.logger.debug(
        'WhatsApp Web: omitiendo reconexión automática — esperando escaneo de QR',
      );
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.logger.warn(
        `WhatsApp Web: máximo de reconexiones alcanzado (${MAX_RECONNECT_ATTEMPTS}). Usa "Reconectar" en el panel.`,
      );
      return;
    }

    this.clearReconnectTimer();

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      5 * 60 * 1000,
    );
    this.reconnectAttempts++;
    this.logger.log(
      `WhatsApp Web: reintentando conexión en ${delay / 1000}s (intento ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reinitialize();
    }, delay);
  }

  /**
   * Si hay sesión persistida pero el cliente cayó, intenta restaurar sin bloquear el dispatcher.
   */
  async tryRestoreSessionIfNeeded(): Promise<void> {
    if (!this.enabled || this.initializing || this.isConnected()) return;
    if (this.awaitingQrScan || this.reconnectTimer) return;
    if (!this.hasPersistedSession()) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    const status = this.getStatus();
    if (status === 'AUTH_FAILURE' || status === 'QR_READY') return;

    this.logger.log(
      'WhatsApp Web: sesión en disco detectada — intentando restaurar conexión...',
    );
    await this.reinitialize();
  }

  /** Reinicializa el cliente reutilizando la sesión guardada en disco. */
  async reinitialize(): Promise<void> {
    if (!this.enabled || this.initializing) return;
    this.logger.log('WhatsApp Web: reinicializando cliente...');

    this.clearReconnectTimer();

    if (this.client) {
      try {
        // destroy() cierra Chromium pero LocalAuth conserva los archivos en sessionPath
        await this.client.destroy();
      } catch {
        // ignore
      }
      this.client = null;
    }

    this.status = 'INITIALIZING';
    await this.initClient();
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

  getSessionInfo(): WhatsappSessionInfo {
    return {
      sessionPath: this.sessionPath,
      sessionExists: this.hasPersistedSession(),
      reconnectAttempts: this.reconnectAttempts,
      lastDisconnectReason: this.lastDisconnectReason,
    };
  }

  isConnected(): boolean {
    return this.status === 'CONNECTED';
  }

  getQrDataUrl(): string | null {
    return this.qrDataUrl;
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS;

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

  /**
   * Envía texto a un número personal usando la sesión WhatsApp Web (misma cuenta que WA Grupo).
   */
  async sendTextToNumber(
    countryCode: string | null | undefined,
    phone: string,
    text: string,
  ): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('WhatsApp Web is not connected');
    }

    const chatId = normalizePhoneToWhatsAppChatId(countryCode, phone);
    if (!chatId) {
      throw new Error('Número de teléfono inválido');
    }

    const digits = chatId.replace('@c.us', '');
    let targetId = chatId;

    try {
      if (typeof this.client.getNumberId === 'function') {
        const numberId = await this.client.getNumberId(digits);
        if (numberId?._serialized) {
          targetId = numberId._serialized;
        }
      }
      await this.client.sendMessage(targetId, text);
      this.logger.log(`WhatsApp Web personal message sent to ${digits}`);
    } catch (e: any) {
      this.logger.error(`sendTextToNumber error (${digits}): ${e.message}`);
      throw e;
    }
  }

  async sendImageToGroup(
    groupId: string,
    caption: string,
    imageBuffer: Buffer,
    filename = 'sticker.png',
    mimeType = 'image/png',
  ): Promise<void> {
    if (!this.isConnected() || !this.client) {
      throw new Error('WhatsApp Web is not connected');
    }

    const MessageMedia = (this as any)._MessageMedia;
    if (!MessageMedia) {
      throw new Error('whatsapp-web.js MessageMedia not loaded');
    }

    try {
      const imageMedia = new MessageMedia(
        mimeType,
        imageBuffer.toString('base64'),
        filename,
      );
      await this.client.sendMessage(groupId, imageMedia, { caption });
    } catch (e: any) {
      this.logger.error(`sendImageToGroup error (${groupId}): ${e.message}`);
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
      const imageMedia = new MessageMedia(
        'image/png',
        params.imageBuffer.toString('base64'),
        'reporte.png',
      );
      await this.client.sendMessage(params.groupId, imageMedia, { caption: params.caption });

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
