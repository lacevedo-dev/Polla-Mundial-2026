import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly vapidPublicKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY', '');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY', '');
    const email = this.config.get<string>('VAPID_EMAIL', 'mailto:admin@polla2026.com');

    this.vapidPublicKey = publicKey;

    if (publicKey && privateKey) {
      try {
        webpush.setVapidDetails(email, publicKey, privateKey);
        this.logger.log('Web Push VAPID configured');
      } catch (err: any) {
        this.logger.warn(`VAPID keys invalid — push notifications disabled: ${err.message}`);
        this.vapidPublicKey = '';
      }
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  async saveSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ): Promise<void> {
    try {
      // Remove all previous subscriptions for this user (clean re-subscribe)
      await this.prisma.pushSubscription.deleteMany({ where: { userId } });

      await this.prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          // userAgent is VARCHAR(512) — truncate to avoid MySQL data-too-long error
          userAgent: userAgent ? userAgent.substring(0, 511) : undefined,
        },
      });
      this.logger.log(`Push subscription saved for user ${userId}`);
    } catch (err: any) {
      this.logger.error(`saveSubscription failed for user ${userId}: ${err.message}`);
      throw err;
    }
  }

  async removeSubscription(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number; devices: number }> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    const devices = subscriptions.length;
    if (devices === 0) return { sent: 0, failed: 0, devices: 0 };

    const results = await Promise.allSettled(
      subscriptions.map((sub) => this.sendOne(sub, payload)),
    );

    let sent = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) sent++;
      else failed++;
    }
    return { sent, failed, devices };
  }

  async sendTestToUser(userId: string): Promise<{ sent: number; failed: number; devices: number }> {
    return this.sendToUser(userId, {
      title: '🔔 Notificaciones activas',
      body: 'Las notificaciones push están funcionando correctamente en este dispositivo.',
      tag: 'test-push',
      requireInteraction: false,
    });
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    await Promise.allSettled(
      subscriptions.map((sub) => this.sendOne(sub, payload)),
    );
  }

  async sendToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
    const subscriptions = await this.prisma.pushSubscription.findMany();
    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const ok = await this.sendOne(sub, payload);
        if (ok) sent++; else failed++;
      }),
    );

    return { sent, failed };
  }

  /** Send to all active members of a league */
  async sendToLeague(leagueId: string, payload: PushPayload): Promise<void> {
    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);
    if (userIds.length > 0) await this.sendToUsers(userIds, payload);
  }

  private async sendOne(
    sub: { endpoint: string; p256dh: string; auth: string; id: string },
    payload: PushPayload,
  ): Promise<boolean> {
    if (!this.vapidPublicKey) return false;

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 86400 },
      );
      return true;
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired — clean it up
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        this.logger.warn(`Push failed for ${sub.id}: ${error.message}`);
      }
      return false;
    }
  }
}
