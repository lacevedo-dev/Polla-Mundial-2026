import { Injectable, Logger } from '@nestjs/common';
import {
  AutomationStep,
  NotificationType,
  Prisma,
  WhatsappJobStatus,
  WhatsappPersonalSource,
  WhatsappPersonalVia,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { TwilioService } from './twilio.service';

export type WhatsappPersonalSendVia = 'whatsapp_web' | 'twilio';

export type WhatsappPersonalSendContext = {
  userId?: string;
  userName?: string;
  source: WhatsappPersonalSource;
  automationStep?: AutomationStep;
  notificationType?: NotificationType;
  leagueId?: string;
  matchId?: string;
};

export type WhatsappPersonalLogFilters = {
  limit?: number;
  status?: WhatsappJobStatus;
  source?: WhatsappPersonalSource;
  via?: WhatsappPersonalVia;
};

@Injectable()
export class WhatsappPersonalService {
  private readonly logger = new Logger(WhatsappPersonalService.name);

  constructor(
    private readonly waWeb: WhatsappWebService,
    private readonly twilio: TwilioService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * WhatsApp personal: primero sesión WhatsApp Web (WA Grupo), luego Twilio.
   * Persiste un log en BD cuando se proporciona contexto (recomendado en todos los call sites).
   */
  async send(
    countryCode: string | null | undefined,
    phone: string,
    message: string,
    userName?: string,
    context?: WhatsappPersonalSendContext,
  ): Promise<{ sent: boolean; via?: WhatsappPersonalSendVia; logId?: string }> {
    const normalizedCountry = countryCode?.trim() || '+57';
    const resolvedName = userName ?? context?.userName ?? null;
    let lastError: string | null = null;
    let via: WhatsappPersonalSendVia | undefined;
    let sent = false;

    if (this.waWeb.isConnected()) {
      try {
        await this.waWeb.sendTextToNumber(normalizedCountry, phone, message);
        sent = true;
        via = 'whatsapp_web';
      } catch (err) {
        lastError = String(err);
        const label = resolvedName ?? phone;
        this.logger.warn(
          `WA Web personal a ${label} falló (${lastError}); intentando Twilio si está disponible`,
        );
      }
    }

    if (!sent && this.twilio.isEnabled()) {
      const fullPhone = `${normalizedCountry}${phone}`;
      const twilioSent = await this.twilio.sendWhatsApp(fullPhone, message);
      if (twilioSent) {
        sent = true;
        via = 'twilio';
        lastError = null;
      } else if (!lastError) {
        lastError = 'Twilio no pudo enviar el mensaje';
      }
    } else if (!sent && !lastError) {
      lastError = 'WhatsApp Web desconectado y Twilio no disponible';
    }

    if (context) {
      const log = await this.prisma.whatsappPersonalLog.create({
        data: {
          status: sent ? WhatsappJobStatus.SENT : WhatsappJobStatus.FAILED,
          source: context.source,
          automationStep: context.automationStep ?? null,
          notificationType: context.notificationType ?? null,
          userId: context.userId ?? null,
          userName: resolvedName,
          countryCode: normalizedCountry,
          phone,
          message,
          via: via
            ? via === 'whatsapp_web'
              ? WhatsappPersonalVia.WHATSAPP_WEB
              : WhatsappPersonalVia.TWILIO
            : null,
          lastError: sent ? null : lastError,
          leagueId: context.leagueId ?? null,
          matchId: context.matchId ?? null,
          sentAt: sent ? new Date() : null,
        },
      });
      return sent ? { sent: true, via, logId: log.id } : { sent: false, logId: log.id };
    }

    return sent ? { sent: true, via } : { sent: false };
  }

  async getRecentLogs(filters: WhatsappPersonalLogFilters = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
    const where: Prisma.WhatsappPersonalLogWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.via) where.via = filters.via;

    return this.prisma.whatsappPersonalLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, username: true } },
        league: { select: { name: true, code: true } },
      },
    });
  }

  async deleteLog(logId: string): Promise<void> {
    await this.prisma.whatsappPersonalLog.delete({ where: { id: logId } });
  }
}
