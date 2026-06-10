import { Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '@corp-api/prisma/prisma.service';

function parseData(data: string | null): { matchId?: string; leagueId?: string } {
    if (!data) return {};
    try {
        return JSON.parse(data) as { matchId?: string; leagueId?: string };
    } catch {
        return {};
    }
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    async getMyNotifications(
        @CurrentUser() user: { id: string },
        @Query('limit') limitParam?: string,
        @Query('tenantSlug') tenantSlug?: string,
    ) {
        const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? '20', 10)));

        let tenantLeagueIds: string[] | undefined;
        if (tenantSlug) {
            const tenant = await this.prisma.corporateTenant.findUnique({
                where: { slug: tenantSlug },
                select: { id: true },
            });
            if (tenant) {
                const memberships = await this.prisma.leagueMember.findMany({
                    where: {
                        userId: user.id,
                        league: { tenantId: tenant.id },
                    },
                    select: { leagueId: true },
                });
                tenantLeagueIds = memberships.map(m => m.leagueId);
            }
        }

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

        const seen = new Set<string>();
        const deduplicated: typeof raw = [];

        for (const n of raw) {
            const { matchId, leagueId } = parseData(n.data);

            if (tenantLeagueIds !== undefined && leagueId && !tenantLeagueIds.includes(leagueId)) {
                continue;
            }

            const key = matchId ? `${n.type}:${matchId}` : `${n.type}:${n.sentAt.toISOString().slice(0, 13)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduplicated.push(n);
            if (deduplicated.length >= limit) break;
        }

        const leagueIds = [...new Set(
            deduplicated.map(n => parseData(n.data).leagueId).filter(Boolean) as string[],
        )];

        const leagues = leagueIds.length
            ? await this.prisma.league.findMany({
                where: { id: { in: leagueIds } },
                select: { id: true, name: true },
            })
            : [];

        const leagueMap = new Map(leagues.map(l => [l.id, l.name]));
        const unreadCount = deduplicated.filter(n => !n.read).length;

        return {
            notifications: deduplicated.map(n => {
                const { leagueId, matchId } = parseData(n.data);
                return {
                    ...n,
                    leagueId:   leagueId ?? null,
                    leagueName: leagueId ? (leagueMap.get(leagueId) ?? null) : null,
                    matchId:    matchId ?? null,
                };
            }),
            unreadCount,
            totalInDb: raw.length,
        };
    }

    @Patch(':id/read')
    async markRead(
        @CurrentUser() user: { id: string },
        @Param('id') id: string,
    ) {
        const notif = await this.prisma.notification.findFirst({
            where: { id, userId: user.id },
            select: { type: true, data: true },
        });

        if (!notif) return { ok: false };

        const { matchId } = parseData(notif.data);

        if (matchId) {
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

    @Patch('read-all')
    async markAllRead(@CurrentUser() user: { id: string }) {
        const { count } = await this.prisma.notification.updateMany({
            where: { userId: user.id, read: false },
            data: { read: true },
        });
        return { ok: true, count };
    }

    @Delete()
    async clearAll(@CurrentUser() user: { id: string }) {
        const { count } = await this.prisma.notification.deleteMany({
            where: { userId: user.id },
        });
        return { ok: true, deleted: count };
    }
}
