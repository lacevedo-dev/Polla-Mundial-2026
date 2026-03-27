import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class AdminAutomationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Estado de canales y configuración de schedulers */
  @Get('status')
  async getStatus() {
    const [pushCount, notifLast24h, userWithPhone] = await Promise.all([
      this.prisma.pushSubscription.count(),
      this.prisma.notification.count({
        where: { sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.user.count({ where: { phone: { not: null } } }),
    ]);

    const twilioSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const vapidKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const smtpHost = this.config.get<string>('EMAIL_HOST') ?? this.config.get<string>('SMTP_HOST') ?? this.config.get<string>('MAIL_HOST');

    const channels = {
      inApp: { enabled: true, description: 'Siempre activo' },
      push: {
        enabled: !!(vapidKey),
        description: vapidKey ? `${pushCount} dispositivos suscritos` : 'VAPID_PUBLIC_KEY no configurado',
        subscriberCount: pushCount,
      },
      whatsapp: {
        enabled: !!(twilioSid && twilioToken),
        description: (twilioSid && twilioToken)
          ? `Twilio activo — ${userWithPhone} usuarios con teléfono`
          : 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN no configurados',
        usersWithPhone: userWithPhone,
      },
      sms: {
        enabled: !!(twilioSid && twilioToken && this.config.get<string>('TWILIO_SMS_FROM')),
        description: this.config.get<string>('TWILIO_SMS_FROM')
          ? 'Twilio SMS activo'
          : 'TWILIO_SMS_FROM no configurado',
      },
      email: {
        enabled: !!(smtpHost),
        description: smtpHost ? `SMTP: ${smtpHost}` : 'SMTP no configurado',
      },
    };

    const schedulers = [
      {
        id: 'match_reminder',
        name: 'Recordatorio de partido',
        cron: '* * * * *',
        description: 'Cada minuto — partidos que empiezan en ~60 min',
        notifType: 'MATCH_REMINDER',
        icon: '⏰',
        audience: 'Todos los miembros activos de ligas con ese partido',
        channels: ['inApp', 'push', 'whatsapp'],
      },
      {
        id: 'prediction_closing',
        name: 'Cierre de predicciones',
        cron: '* * * * *',
        description: 'Cada minuto — predicciones que cierran en ≤5 min',
        notifType: 'PREDICTION_CLOSED',
        icon: '⚠️',
        audience: 'Miembros activos que aún no han pronosticado',
        channels: ['inApp', 'push', 'whatsapp'],
      },
      {
        id: 'match_result',
        name: 'Resultado de partido',
        cron: '* * * * *',
        description: 'Cada minuto — partidos finalizados sin notificación enviada',
        notifType: 'RESULT_PUBLISHED',
        icon: '✅',
        audience: 'Usuarios con predicción en el partido',
        channels: ['inApp', 'push', 'whatsapp'],
      },
    ];

    return {
      channels,
      schedulers,
      stats: {
        notifLast24h,
        pushSubscribers: pushCount,
        usersWithPhone: userWithPhone,
      },
    };
  }

  /** Historial reciente de notificaciones automáticas */
  @Get('history')
  async getHistory() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [byType, recent] = await Promise.all([
      this.prisma.notification.groupBy({
        by: ['type'],
        where: {
          sentAt: { gte: since },
          type: {
            in: [
              NotificationType.MATCH_REMINDER,
              NotificationType.PREDICTION_CLOSED,
              NotificationType.RESULT_PUBLISHED,
            ],
          },
        },
        _count: { id: true },
      }),
      this.prisma.notification.findMany({
        where: {
          sentAt: { gte: since },
          type: {
            in: [
              NotificationType.MATCH_REMINDER,
              NotificationType.PREDICTION_CLOSED,
              NotificationType.RESULT_PUBLISHED,
            ],
          },
        },
        orderBy: { sentAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          sentAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    const countByType: Record<string, number> = {};
    for (const row of byType) {
      countByType[row.type] = row._count.id;
    }

    return { countByType, recent };
  }
}
