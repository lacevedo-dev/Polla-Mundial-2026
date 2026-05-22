import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
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

    @Get('leagues/:id')
    async getLeagueDetail(@Req() req: any, @Param('id') leagueId: string) {
        const tenantId: string = req.tenantId;
        const userId: string = req.user.userId;

        const league = await this.prisma.league.findFirst({
            where: { id: leagueId, tenantId },
            include: {
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
                scoringRules: { select: { type: true, points: true, label: true }, orderBy: { points: 'desc' } },
            },
        });

        if (!league) return null;

        const [upcomingMatches, recentPredictions, memberPoints] = await Promise.all([
            this.prisma.leagueMatch.findMany({
                where: { leagueId },
                include: {
                    match: {
                        select: {
                            id: true,
                            matchDate: true,
                            status: true,
                            homeScore: true,
                            awayScore: true,
                            venue: true,
                            phase: true,
                            homeTeam: { select: { id: true, name: true, shortName: true, logo: true } },
                            awayTeam: { select: { id: true, name: true, shortName: true, logo: true } },
                            predictions: {
                                where: { userId, leagueId },
                                select: { homeScore: true, awayScore: true, points: true },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: { match: { matchDate: 'asc' } },
                take: 10,
            }),
            this.prisma.prediction.findMany({
                where: { userId, leagueId },
                orderBy: { submittedAt: 'desc' },
                take: 5,
                include: {
                    match: {
                        select: {
                            matchDate: true,
                            status: true,
                            homeScore: true,
                            awayScore: true,
                            homeTeam: { select: { name: true, shortName: true, logo: true } },
                            awayTeam: { select: { name: true, shortName: true, logo: true } },
                        },
                    },
                },
            }),
            this.prisma.prediction.groupBy({
                by: ['userId'],
                where: { leagueId },
                _sum: { points: true },
                orderBy: { _sum: { points: 'desc' } },
                take: 5,
            }),
        ]);

        const userIdsList = memberPoints.map((p) => p.userId);
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIdsList } },
            select: { id: true, name: true, username: true, avatar: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        const myPoints = memberPoints.find((p) => p.userId === userId)?._sum.points ?? 0;
        const myRank = memberPoints.filter((p) => (p._sum.points ?? 0) > myPoints).length + 1;

        return {
            id: league.id,
            name: league.name,
            description: league.description,
            status: league.status,
            participantsCount: league._count.members,
            maxParticipants: league.maxParticipants,
            closePredictionMinutes: league.closePredictionMinutes,
            myPoints,
            myRank,
            scoringRules: league.scoringRules,
            upcomingMatches: upcomingMatches.map((lm) => ({
                id: lm.match.id,
                matchDate: lm.match.matchDate,
                status: lm.match.status,
                homeScore: lm.match.homeScore,
                awayScore: lm.match.awayScore,
                venue: lm.match.venue,
                phase: lm.match.phase,
                homeTeam: lm.match.homeTeam,
                awayTeam: lm.match.awayTeam,
                myPrediction: lm.match.predictions[0] ?? null,
            })),
            recentPredictions: recentPredictions.map((p) => ({
                matchDate: p.match.matchDate,
                status: p.match.status,
                homeScore: p.match.homeScore,
                awayScore: p.match.awayScore,
                homeTeam: p.match.homeTeam,
                awayTeam: p.match.awayTeam,
                myHome: p.homeScore,
                myAway: p.awayScore,
                points: p.points,
            })),
            topRanking: memberPoints.map((p, i) => ({
                rank: i + 1,
                userId: p.userId,
                name: userMap.get(p.userId)?.name ?? '—',
                username: userMap.get(p.userId)?.username ?? '',
                avatar: userMap.get(p.userId)?.avatar ?? null,
                totalPoints: p._sum.points ?? 0,
                isMe: p.userId === userId,
            })),
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

        const myLeagueIds = leagues.filter((l) => l.members.length > 0).map((l) => l.id);
        const pointsPerLeague = myLeagueIds.length
            ? await this.prisma.prediction.groupBy({
                  by: ['leagueId'],
                  where: { userId, leagueId: { in: myLeagueIds } },
                  _sum: { points: true },
              })
            : [];
        const pointsMap = new Map(pointsPerLeague.map((p) => [p.leagueId, p._sum.points ?? 0]));

        return leagues.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            isPublic: l.privacy === 'PUBLIC',
            participantsCount: l._count.members,
            isMember: l.members.length > 0,
            myPoints: pointsMap.get(l.id) ?? 0,
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
