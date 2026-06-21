import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, WhatsappPersonalSource } from '@prisma/client';
import { EmailQueueService } from '../email/email-queue.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from './notifications.service';
import { WhatsappPersonalService } from './whatsapp-personal.service';

@Injectable()
export class PaymentReminderNotifier {
  private readonly logger = new Logger(PaymentReminderNotifier.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushNotificationsService,
    private readonly waPersonal: WhatsappPersonalService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async deliver(params: {
    userId: string;
    userName: string;
    phone: string | null;
    countryCode: string | null;
    title: string;
    body: string;
    data: Record<string, unknown>;
    leagueId: string;
    dedupeSuffix: string;
    trigger?: string;
  }): Promise<{ pushSent: number; whatsappSent: boolean; emailQueued: boolean }> {
    const pushResult = await this.push.sendToUser(params.userId, {
      title: params.title,
      body: params.body,
      data: params.data,
    });

    let whatsappSent = false;
    let whatsappVia: string | null = null;
    if (params.phone) {
      const wa = await this.waPersonal.send(
        params.countryCode,
        params.phone,
        `${params.title}\n${params.body}`,
        params.userName,
        {
          userId: params.userId,
          userName: params.userName,
          source: WhatsappPersonalSource.PAYMENT_REMINDER,
          leagueId: params.leagueId,
          notificationType: NotificationType.PAYMENT_CONFIRMED,
        },
      );
      whatsappSent = wa.sent;
      whatsappVia = wa.via ?? null;
    }

    const emailQueued = await this.emailQueue.enqueueForUser(params.userId, {
      type: 'PAYMENT_REMINDER',
      priority: 'MEDIUM',
      required: false,
      dedupeKey: `payment-reminder:${params.leagueId}:${params.userId}:${params.dedupeSuffix}`,
      subject: params.title,
      html: params.body.replace(/\n/g, '<br/>'),
      text: params.body,
      leagueId: params.leagueId,
    });

    await this.notifications.createInAppNotification({
      userId: params.userId,
      type: NotificationType.PAYMENT_CONFIRMED,
      title: params.title,
      body: params.body,
      data: {
        ...params.data,
        _trigger: params.trigger ?? null,
        _pushSent: pushResult.sent,
        _pushDevices: pushResult.devices,
        _whatsapp: whatsappSent,
        _whatsappVia: whatsappVia,
        _emailQueued: emailQueued,
      },
    });

    this.logger.log(
      `[payment_reminder] ${params.title} -> user:${params.userId} | push:${pushResult.sent}/${pushResult.devices} wa:${whatsappSent}${whatsappVia ? `(${whatsappVia})` : ''} email:${emailQueued}${params.trigger ? ` | ${params.trigger}` : ''}`,
    );

    return {
      pushSent: pushResult.sent,
      whatsappSent,
      emailQueued,
    };
  }
}
