import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Notificaciones recientes del usuario autenticado */
  @Get()
  async getMyNotifications(
    @CurrentUser() user: { id: string },
    @Query('limit') limitParam?: string,
  ) {
    const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? '20', 10)));

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { sentAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          read: true,
          channel: true,
          sentAt: true,
        },
      }),
      this.prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  /** Marcar una notificación como leída */
  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
    return { ok: true };
  }

  /** Marcar todas como leídas */
  @Patch('read-all')
  async markAllRead(@CurrentUser() user: { id: string }) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return { ok: true, count };
  }
}
