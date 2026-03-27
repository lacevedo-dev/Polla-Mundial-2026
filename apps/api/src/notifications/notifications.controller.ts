import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Extrae el matchId del campo JSON `data` de una notificación.
 * data = JSON.stringify({ matchId, leagueId, ... })
 */
function extractMatchId(data: string | null): string | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return typeof parsed.matchId === 'string' ? parsed.matchId : null;
  } catch {
    return null;
  }
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Notificaciones recientes deduplicadas por tipo + partido.
   * Como un mismo partido puede generar una notificación por cada liga a la que
   * pertenece el usuario, se muestra solo la más reciente de cada combinación
   * type+matchId para evitar mostrar la misma notificación N veces.
   */
  @Get()
  async getMyNotifications(
    @CurrentUser() user: { id: string },
    @Query('limit') limitParam?: string,
  ) {
    const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? '20', 10)));

    // Traemos más de los necesarios para poder deduplicar correctamente
    const raw = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: 'desc' },
      take: 500,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        read: true,
        channel: true,
        sentAt: true,
        data: true,
      },
    });

    // Deduplicar: una sola notificación por (type + matchId).
    // Si no hay matchId (otros tipos), deduplicar por type solo en ventana de 1h.
    const seen = new Set<string>();
    const deduplicated: typeof raw = [];

    for (const n of raw) {
      const matchId = extractMatchId(n.data);
      const key = matchId ? `${n.type}:${matchId}` : `${n.type}:${n.sentAt.toISOString().slice(0, 13)}`; // hour bucket
      if (seen.has(key)) continue;
      seen.add(key);
      deduplicated.push(n);
      if (deduplicated.length >= limit) break;
    }

    // Contar no leídas también en base a las deduplicadas
    const unreadCount = deduplicated.filter(n => !n.read).length;

    return {
      notifications: deduplicated,
      unreadCount,
      // total real en DB (para contexto)
      totalInDb: raw.length,
    };
  }

  /**
   * Marcar como leídas TODAS las notificaciones del mismo tipo+partido.
   * Así un toque limpia todas las duplicadas del mismo evento.
   */
  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    // Buscar la notificación para obtener su type y matchId
    const notif = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { type: true, data: true },
    });

    if (!notif) return { ok: false };

    const matchId = extractMatchId(notif.data);

    if (matchId) {
      // Marcar todas las notificaciones del mismo tipo+partido como leídas
      await this.prisma.notification.updateMany({
        where: {
          userId: user.id,
          type: notif.type,
          data: { contains: matchId },
        },
        data: { read: true },
      });
    } else {
      await this.prisma.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
      });
    }

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
