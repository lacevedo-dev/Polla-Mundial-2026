import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantMemberGuard } from './guards/tenant-member.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('corp')
@UseGuards(JwtAuthGuard, TenantMemberGuard)
export class CorpPortalController {
    constructor(private readonly prisma: PrismaService) {}

    @Get('dashboard')
    async getDashboard(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;
        const tenantRole: string = req.tenantRole;

        const [myLeagues, totalMembers, upcomingMatches] = await Promise.all([
            this.prisma.leagueMember.findMany({
                where: {
                    userId,
                    league: { tenantId },
                    status: 'ACTIVE',
                },
                include: {
                    league: {
                        select: {
                            id: true,
                            name: true,
                            _count: { select: { members: { where: { status: 'ACTIVE' } } } },
                        },
                    },
                },
                take: 10,
            }),
            this.prisma.tenantMember.count({
                where: { tenantId, status: 'ACTIVE' },
            }),
            this.prisma.match.findMany({
                where: {
                    matchDate: { gt: new Date() },
                    leagueMatches: { some: { league: { tenantId } } },
                },
                select: { id: true },
                take: 50,
            }),
        ]);

        const upcomingMatchIds = upcomingMatches.map((m) => m.id);
        const predictionsPending = upcomingMatchIds.length
            ? await this.prisma.match.count({
                  where: {
                      id: { in: upcomingMatchIds },
                      predictions: { none: { userId } },
                  },
              })
            : 0;

        const myLeagueIds = myLeagues.map((m) => m.leagueId);

        const pointsPerLeague = myLeagueIds.length
            ? await this.prisma.prediction.groupBy({
                  by: ['leagueId'],
                  where: { userId, leagueId: { in: myLeagueIds } },
                  _sum: { points: true },
              })
            : [];

        const pointsMap = new Map(pointsPerLeague.map((p) => [p.leagueId, p._sum.points ?? 0]));

        const allLeaguePoints = [...pointsMap.values()];
        const totalPoints = allLeaguePoints.reduce((a, b) => a + b, 0);

        const allMemberPoints = await this.prisma.prediction.groupBy({
            by: ['userId'],
            where: {
                league: { tenantId },
                userId: { not: userId },
            },
            _sum: { points: true },
        });
        const rank = allMemberPoints.filter((m) => (m._sum.points ?? 0) > totalPoints).length + 1;

        return {
            myLeagues: myLeagues.map((m) => ({
                id: m.league.id,
                name: m.league.name,
                participantsCount: m.league._count.members,
                myPoints: pointsMap.get(m.leagueId) ?? 0,
            })),
            globalRank: rank,
            totalMembers,
            predictionsPending,
            tenantRole,
        };
    }

    @Get('leagues')
    async getLeagues(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const leagues = await this.prisma.league.findMany({
            where: { tenantId },
            include: {
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
                members: {
                    where: { userId, status: 'ACTIVE' },
                    select: { id: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return leagues.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            isPublic: l.privacy === 'PUBLIC',
            participantsCount: l._count.members,
            isMember: l.members.length > 0,
        }));
    }

    @Get('ranking')
    async getRanking(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const members = await this.prisma.tenantMember.findMany({
            where: { tenantId, status: 'ACTIVE' },
            include: {
                user: { select: { id: true, name: true, username: true, avatar: true } },
            },
        });

        const userIds = members.map((m) => m.userId);

        const scores = await this.prisma.prediction.groupBy({
            by: ['userId'],
            where: {
                userId: { in: userIds },
                league: { tenantId },
            },
            _sum: { points: true },
        });

        const scoreMap = new Map(scores.map((s) => [s.userId, s._sum.points ?? 0]));

        const ranking = members
            .map((m) => ({
                userId: m.userId,
                name: m.user.name,
                username: m.user.username,
                avatar: m.user.avatar,
                totalPoints: scoreMap.get(m.userId) ?? 0,
                isMe: m.userId === userId,
            }))
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .map((u, i) => ({ ...u, rank: i + 1 }));

        return ranking;
    }

    @Get('members')
    async getMembers(@Req() req: any) {
        const tenantId: string = req.tenantId;
        const tenantRole: string = req.tenantRole;

        if (!['OWNER', 'ADMIN'].includes(tenantRole)) {
            return [];
        }

        const members = await this.prisma.tenantMember.findMany({
            where: { tenantId, status: 'ACTIVE' },
            include: {
                user: { select: { id: true, name: true, email: true, username: true, avatar: true } },
            },
            orderBy: { invitedAt: 'asc' },
        });

        return members.map((m) => ({
            id: m.id,
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            username: m.user.username,
            avatar: m.user.avatar,
            role: m.role,
            joinedAt: m.joinedAt ?? m.invitedAt,
        }));
    }
}
