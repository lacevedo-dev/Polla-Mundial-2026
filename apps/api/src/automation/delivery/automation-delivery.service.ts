import { Injectable, Logger } from '@nestjs/common';
import type { AutomationStep } from '@prisma/client';
import { PushNotificationsService } from '../../push-notifications/push-notifications.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappPersonalService } from '../../notifications/whatsapp-personal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { USER_STATUS } from '../../users/user-status.constants';
import { getSchedulerIdForStep } from '../config/automation-step-scheduler.util';
import { AutomationStepConfigService } from '../config/automation-step-config.service';
import type { AutomationStepChannelId } from '../config/automation-step-catalog';
import type {
  AutomationChannelFlags,
  AutomationUserContact,
  AutomationUserDeliveryParams,
  AutomationUserDeliveryResult,
} from './automation-delivery.types';

@Injectable()
export class AutomationDeliveryService {
  private readonly logger = new Logger(AutomationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stepConfig: AutomationStepConfigService,
    private readonly push: PushNotificationsService,
    private readonly notifications: NotificationsService,
    private readonly waPersonal: WhatsappPersonalService,
  ) {}

  async resolveChannelFlags(step: AutomationStep): Promise<AutomationChannelFlags> {
    const schedulerId = getSchedulerIdForStep(step);
    if (!schedulerId) {
      return { push: true, inApp: true, whatsapp: false };
    }

    const [push, inApp, whatsapp] = await Promise.all([
      this.stepConfig.isSchedulerChannelEnabled(schedulerId, 'push', step),
      this.stepConfig.isSchedulerChannelEnabled(schedulerId, 'inApp', step),
      this.stepConfig.isSchedulerChannelEnabled(schedulerId, 'whatsapp', step),
    ]);

    return { push, inApp, whatsapp };
  }

  async fetchActiveUserContacts(
    userIds: string[],
  ): Promise<Map<string, AutomationUserContact>> {
    if (userIds.length === 0) return new Map();

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, status: USER_STATUS.ACTIVE },
      select: { id: true, phone: true, countryCode: true },
    });

    return new Map(
      users.map((user) => [
        user.id,
        { phone: user.phone, countryCode: user.countryCode },
      ]),
    );
  }

  /**
   * Único punto de entrega usuario (push / in-app / WA personal).
   * Respeta catálogo de pasos + overrides de Admin → Automatización.
   */
  async deliverToUser(
    params: AutomationUserDeliveryParams,
  ): Promise<AutomationUserDeliveryResult> {
    const schedulerId = getSchedulerIdForStep(params.step);
    if (!schedulerId) {
      this.logger.warn(
        `deliverToUser: paso ${params.step} sin schedulerId — omitido`,
      );
      return {
        pushSent: 0,
        pushFailed: 0,
        pushDevices: 0,
        whatsappSent: false,
        inAppSent: 0,
        skipped: true,
      };
    }

    const channels = await this.resolveChannelFlags(params.step);
    return this.deliverToUserWithChannels(params, schedulerId, channels);
  }

  private async deliverToUserWithChannels(
    params: AutomationUserDeliveryParams,
    schedulerId: string,
    channels: AutomationChannelFlags,
  ): Promise<AutomationUserDeliveryResult> {
    const contact = await this.resolveContact(
      params.userId,
      params.userContact,
      channels.whatsapp,
    );

    const pushResult = channels.push
      ? await this.push.sendToUser(params.userId, {
          title: params.title,
          body: params.body,
          data: params.data,
          tag: params.pushTag,
          requireInteraction: params.pushRequireInteraction,
        })
      : { sent: 0, failed: 0, devices: 0 };

    let whatsappSent = false;
    if (channels.whatsapp && contact?.phone) {
      const waMessage = `${params.title}\n${params.body}`;
      const wa = await this.waPersonal.send(
        contact.countryCode,
        contact.phone,
        waMessage,
      );
      whatsappSent = wa.sent;
    }

    const enrichedData: Record<string, unknown> = {
      ...params.data,
      _trigger: params.trigger ?? null,
      _step: params.step,
      _schedulerId: schedulerId,
      _pushSent: pushResult.sent,
      _pushFailed: pushResult.failed,
      _pushDevices: pushResult.devices,
      _whatsapp: whatsappSent,
    };

    let inAppSent = 0;
    if (channels.inApp) {
      await this.notifications.createInAppNotification({
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: enrichedData,
      });
      inAppSent = 1;
    }

    this.logger.log(
      `[${params.type}] ${params.title} -> user:${params.userId} step:${params.step} | push:${pushResult.sent}/${pushResult.devices} inApp:${inAppSent} wa:${whatsappSent}${params.trigger ? ` | trigger:"${params.trigger}"` : ''}`,
    );

    return {
      pushSent: pushResult.sent,
      pushFailed: pushResult.failed,
      pushDevices: pushResult.devices,
      whatsappSent,
      inAppSent,
      skipped: !channels.push && inAppSent === 0 && !whatsappSent,
    };
  }

  private async resolveContact(
    userId: string,
    userContact: AutomationUserContact | null | undefined,
    whatsappEnabled: boolean,
  ): Promise<AutomationUserContact | null> {
    if (userContact !== undefined) {
      return userContact;
    }
    if (!whatsappEnabled) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: { id: userId, status: USER_STATUS.ACTIVE },
      select: { phone: true, countryCode: true },
    });
  }

  /** Atajo para comprobar un canal concreto desde otros servicios (p. ej. WA Grupo). */
  async isChannelEnabled(
    step: AutomationStep,
    channel: AutomationStepChannelId,
  ): Promise<boolean> {
    const schedulerId = getSchedulerIdForStep(step);
    if (!schedulerId) return false;
    return this.stepConfig.isSchedulerChannelEnabled(schedulerId, channel, step);
  }
}
