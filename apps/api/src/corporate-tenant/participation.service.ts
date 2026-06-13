import { Injectable } from '@nestjs/common';
import { Prisma, TenantRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OVERVIEW_CACHE_TTL_MS = 120_000;
const MEMBER_SEARCH_MIN_LEN = 2;

export type ParticipationMemberFilter =
    | 'all'
    | 'enrolled'
    | 'with_predictions'
    | 'without_predictions'
    | 'pending';

@Injectable()
export class ParticipationService {
    private readonly overviewCache = new Map<
        string,
        { expiresAt: number; data: Awaited<ReturnType<ParticipationService['buildOverview']>> }
    >();

    constructor(private readonly prisma: PrismaService) {}

    invalidateOverviewCache(tenantId: string) {
        for (const key of this.overviewCache.keys()) {
            if (key.startsWith(`${tenantId}:`)) this.overviewCache.delete(key);
        }
    }

    private isMatchOpen(matchDate: Date, closeMinutes: number, now: Date): boolean {
        const closingTime = new Date(matchDate.getTime() - closeMinutes * 60_000);
        return now < closingTime;
    }

    async getOverview(tenantId: string, leagueId?: string) {
        const cacheKey = `${tenantId}:${leagueId ?? 'all'}`;
        const cached = this.overviewCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.data;

        const data = await this.buildOverview(tenantId, leagueId);
        this.overviewCache.set(cacheKey, { expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS, data });
        return data;
    }

    private async buildOverview(tenantId: string, leagueId?: string) {
        const now = new Date();

        const leagues = await this.prisma.league.findMany({
            where: {
                tenantId,
                status: 'ACTIVE',
                ...(leagueId ? { id: leagueId } : {}),
            },
            select: { id: true, name: true, closePredictionMinutes: true },
        });
        const leagueIds = leagues.map((l) => l.id);
        const closeMinutesMap = new Map(leagues.map((l) => [l.id, l.closePredictionMinutes]));

        const totalMembers = await this.prisma.tenantMember.count({
            where: { tenantId, status: 'ACTIVE' },
        });

        if (leagueIds.length === 0) {
            return {
                summary: {
                    totalMembers,
                    enrolledMembers: 0,
                    membersWithPredictions: 0,
                    neverPredicted: 0,
                    notEnrolled: totalMembers,
                    upcomingOpenMatches: 0,
                    upcomingCoverageRate: 0,
                    participationRate: 0,
                },
                leagues: [],
                upcomingMatches: [],
                generatedAt: now.toISOString(),
            };
        }

        const [
            enrolledByLeague,
            enrolledUsers,
            predictedPairs,
            leagueMatches,
        ] = await Promise.all([
            this.prisma.leagueMember.groupBy({
                by: ['leagueId'],
                where: { leagueId: { in: leagueIds }, status: 'ACTIVE' },
                _count: { userId: true },
            }),
            this.prisma.leagueMember.findMany({
                where: { leagueId: { in: leagueIds }, status: 'ACTIVE' },
                distinct: ['userId'],
                select: { userId: true },
            }),
            this.prisma.prediction.findMany({
                where: { leagueId: { in: leagueIds } },
                distinct: ['userId', 'leagueId'],
                select: { userId: true, leagueId: true },
            }),
            this.prisma.leagueMatch.findMany({
                where: {
                    leagueId: { in: leagueIds },
                    active: true,
                    match: { matchDate: { gt: now } },
                },
                select: {
                    leagueId: true,
                    matchId: true,
                    match: {
                        select: {
                            matchDate: true,
                            homeTeam: { select: { name: true, shortCode: true } },
                            awayTeam: { select: { name: true, shortCode: true } },
                        },
                    },
                },
            }),
        ]);

        const enrolledPerLeague = new Map(enrolledByLeague.map((e) => [e.leagueId, e._count.userId]));
        const predictedPerLeague = new Map<string, number>();
        const predictedUserSet = new Set<string>();
        for (const p of predictedPairs) {
            predictedUserSet.add(p.userId);
            predictedPerLeague.set(p.leagueId, (predictedPerLeague.get(p.leagueId) ?? 0) + 1);
        }

        const openMatches = leagueMatches.filter((lm) =>
            this.isMatchOpen(lm.match.matchDate, closeMinutesMap.get(lm.leagueId) ?? 15, now),
        );

        const predCountRows =
            openMatches.length > 0
                ? await this.prisma.prediction.groupBy({
                      by: ['leagueId', 'matchId'],
                      where: {
                          OR: openMatches.map((m) => ({
                              leagueId: m.leagueId,
                              matchId: m.matchId,
                          })),
                      },
                      _count: { userId: true },
                  })
                : [];

        const predCountMap = new Map(
            predCountRows.map((r) => [`${r.leagueId}:${r.matchId}`, r._count.userId]),
        );

        const leagueNameMap = new Map(leagues.map((l) => [l.id, l.name]));

        let totalExpected = 0;
        let totalPredicted = 0;
        const upcomingMatches = openMatches
            .sort((a, b) => a.match.matchDate.getTime() - b.match.matchDate.getTime())
            .slice(0, 25)
            .map((lm) => {
                const enrolled = enrolledPerLeague.get(lm.leagueId) ?? 0;
                const predictions = predCountMap.get(`${lm.leagueId}:${lm.matchId}`) ?? 0;
                totalExpected += enrolled;
                totalPredicted += predictions;
                return {
                    matchId: lm.matchId,
                    leagueId: lm.leagueId,
                    leagueName: leagueNameMap.get(lm.leagueId) ?? '',
                    matchDate: lm.match.matchDate,
                    homeTeam: lm.match.homeTeam.shortCode ?? lm.match.homeTeam.name,
                    awayTeam: lm.match.awayTeam.shortCode ?? lm.match.awayTeam.name,
                    enrolledCount: enrolled,
                    predictionCount: predictions,
                    coverageRate: enrolled > 0 ? Math.round((predictions / enrolled) * 100) : 0,
                    pendingCount: Math.max(0, enrolled - predictions),
                };
            });

        const enrolledMembers = enrolledUsers.length;
        const membersWithPredictions = predictedUserSet.size;

        return {
            summary: {
                totalMembers,
                enrolledMembers,
                membersWithPredictions,
                neverPredicted: Math.max(0, enrolledMembers - membersWithPredictions),
                notEnrolled: Math.max(0, totalMembers - enrolledMembers),
                upcomingOpenMatches: openMatches.length,
                upcomingCoverageRate:
                    totalExpected > 0 ? Math.round((totalPredicted / totalExpected) * 100) : 0,
                participationRate:
                    enrolledMembers > 0
                        ? Math.round((membersWithPredictions / enrolledMembers) * 100)
                        : 0,
            },
            leagues: leagues.map((l) => {
                const enrolled = enrolledPerLeague.get(l.id) ?? 0;
                const predicted = predictedPerLeague.get(l.id) ?? 0;
                return {
                    id: l.id,
                    name: l.name,
                    enrolledCount: enrolled,
                    predictedCount: predicted,
                    participationRate: enrolled > 0 ? Math.round((predicted / enrolled) * 100) : 0,
                };
            }),
            upcomingMatches,
            generatedAt: now.toISOString(),
        };
    }

    async getMembersParticipation(
        tenantId: string,
        opts: {
            leagueId?: string;
            page?: number;
            limit?: number;
            search?: string;
            filter?: ParticipationMemberFilter;
            role?: TenantRole;
        },
    ) {
        const page = Math.max(1, opts.page ?? 1);
        const limit = Math.min(100, Math.max(10, opts.limit ?? 50));
        const search = opts.search?.trim() ?? '';
        const filter: ParticipationMemberFilter = opts.filter ?? 'all';
        const now = new Date();

        const leagues = await this.prisma.league.findMany({
            where: {
                tenantId,
                status: 'ACTIVE',
                ...(opts.leagueId ? { id: opts.leagueId } : {}),
            },
            select: { id: true, closePredictionMinutes: true },
        });
        const leagueIds = leagues.map((l) => l.id);
        const closeMinutesMap = new Map(leagues.map((l) => [l.id, l.closePredictionMinutes]));

        let filteredUserIds: string[] | undefined;
        if (filter !== 'all' && leagueIds.length > 0) {
            filteredUserIds = await this.resolveFilterUserIds(
                leagueIds,
                filter,
                closeMinutesMap,
                now,
            );
            if (filteredUserIds.length === 0) {
                return { data: [], total: 0, page, limit, hasMore: false };
            }
        }

        const memberWhere: Prisma.TenantMemberWhereInput = {
            tenantId,
            status: 'ACTIVE',
            ...(opts.role ? { role: opts.role } : {}),
            ...(filteredUserIds ? { userId: { in: filteredUserIds } } : {}),
            ...(search.length >= MEMBER_SEARCH_MIN_LEN
                ? {
                      user: {
                          OR: [
                              { name: { contains: search } },
                              { email: { contains: search } },
                              { documentNumber: { contains: search } },
                              { username: { contains: search } },
                          ],
                      },
                  }
                : {}),
        };

        const skip = (page - 1) * limit;
        const [members, total] = await Promise.all([
            this.prisma.tenantMember.findMany({
                where: memberWhere,
                select: {
                    userId: true,
                    role: true,
                    user: {
                        select: {
                            name: true,
                            email: true,
                            documentNumber: true,
                            username: true,
                            avatar: true,
                        },
                    },
                },
                orderBy: { user: { name: 'asc' } },
                skip,
                take: limit + 1,
            }),
            this.prisma.tenantMember.count({ where: memberWhere }),
        ]);

        const hasMore = members.length > limit;
        const pageMembers = hasMore ? members.slice(0, limit) : members;
        const userIds = pageMembers.map((m) => m.userId);

        const [enrollmentRows, predictionRows, enrollments] = await Promise.all([
            leagueIds.length > 0 && userIds.length > 0
                ? this.prisma.leagueMember.groupBy({
                      by: ['userId'],
                      where: {
                          userId: { in: userIds },
                          leagueId: { in: leagueIds },
                          status: 'ACTIVE',
                      },
                      _count: { leagueId: true },
                  })
                : [],
            leagueIds.length > 0 && userIds.length > 0
                ? this.prisma.prediction.groupBy({
                      by: ['userId'],
                      where: { userId: { in: userIds }, leagueId: { in: leagueIds } },
                      _count: { id: true },
                      _max: { submittedAt: true },
                  })
                : [],
            leagueIds.length > 0 && userIds.length > 0
                ? this.prisma.leagueMember.findMany({
                      where: {
                          userId: { in: userIds },
                          leagueId: { in: leagueIds },
                          status: 'ACTIVE',
                      },
                      select: { userId: true, leagueId: true },
                  })
                : [],
        ]);

        const enrollmentMap = new Map<string, number>(
            enrollmentRows.map((r): [string, number] => [r.userId, r._count.leagueId]),
        );
        const predictionMap = new Map<string, { count: number; lastAt: Date | null }>(
            predictionRows.map((r): [string, { count: number; lastAt: Date | null }] => [
                r.userId,
                { count: r._count.id, lastAt: r._max.submittedAt },
            ]),
        );

        const userLeagueMap = new Map<string, Set<string>>();
        for (const e of enrollments) {
            if (!userLeagueMap.has(e.userId)) userLeagueMap.set(e.userId, new Set());
            userLeagueMap.get(e.userId)!.add(e.leagueId);
        }

        const pendingMap = await this.computePendingForUsers(
            userIds,
            leagueIds,
            closeMinutesMap,
            userLeagueMap,
            now,
        );

        const data = pageMembers.map((m) => {
            const enrolledLeagues = enrollmentMap.get(m.userId) ?? 0;
            const pred = predictionMap.get(m.userId);
            const totalPredictions = pred?.count ?? 0;
            const pendingPredictions = pendingMap.get(m.userId) ?? 0;
            const lastPredictionAt = pred?.lastAt ?? null;

            let status: 'never' | 'inactive' | 'partial' | 'active' | 'not_enrolled';
            if (enrolledLeagues === 0) {
                status = 'not_enrolled';
            } else if (totalPredictions === 0) {
                status = 'never';
            } else if (pendingPredictions > 0) {
                status = 'partial';
            } else {
                status = 'active';
            }

            return {
                userId: m.userId,
                name: m.user.name,
                email: m.user.email,
                username: m.user.documentNumber ?? m.user.username,
                avatar: m.user.avatar,
                role: m.role,
                enrolledLeagues,
                totalPredictions,
                pendingPredictions,
                lastPredictionAt,
                status,
            };
        });

        return { data, total, page, limit, hasMore };
    }

    private async resolveFilterUserIds(
        leagueIds: string[],
        filter: ParticipationMemberFilter,
        closeMinutesMap: Map<string, number>,
        now: Date,
    ): Promise<string[]> {
        const enrolled = await this.prisma.leagueMember.findMany({
            where: { leagueId: { in: leagueIds }, status: 'ACTIVE' },
            distinct: ['userId'],
            select: { userId: true },
        });
        const enrolledIds = enrolled.map((e) => e.userId);

        if (filter === 'enrolled') return enrolledIds;

        const predicted = await this.prisma.prediction.findMany({
            where: { leagueId: { in: leagueIds } },
            distinct: ['userId'],
            select: { userId: true },
        });
        const predictedSet = new Set(predicted.map((p) => p.userId));

        if (filter === 'with_predictions') {
            return enrolledIds.filter((id) => predictedSet.has(id));
        }
        if (filter === 'without_predictions') {
            return enrolledIds.filter((id) => !predictedSet.has(id));
        }
        if (filter === 'pending') {
            const userLeagueMap = new Map<string, Set<string>>();
            const allEnrollments = await this.prisma.leagueMember.findMany({
                where: { leagueId: { in: leagueIds }, status: 'ACTIVE', userId: { in: enrolledIds } },
                select: { userId: true, leagueId: true },
            });
            for (const e of allEnrollments) {
                if (!userLeagueMap.has(e.userId)) userLeagueMap.set(e.userId, new Set());
                userLeagueMap.get(e.userId)!.add(e.leagueId);
            }
            const pendingMap = await this.computePendingForUsers(
                enrolledIds,
                leagueIds,
                closeMinutesMap,
                userLeagueMap,
                now,
            );
            return enrolledIds.filter((id) => (pendingMap.get(id) ?? 0) > 0);
        }

        return enrolledIds;
    }

    private async computePendingForUsers(
        userIds: string[],
        leagueIds: string[],
        closeMinutesMap: Map<string, number>,
        userLeagueMap: Map<string, Set<string>>,
        now: Date,
    ): Promise<Map<string, number>> {
        const pendingMap = new Map<string, number>();
        if (userIds.length === 0 || leagueIds.length === 0) return pendingMap;

        const leagueMatches = await this.prisma.leagueMatch.findMany({
            where: {
                leagueId: { in: leagueIds },
                active: true,
                match: { matchDate: { gt: now } },
            },
            select: {
                leagueId: true,
                matchId: true,
                match: { select: { matchDate: true } },
            },
        });

        const openMatches = leagueMatches.filter((lm) =>
            this.isMatchOpen(lm.match.matchDate, closeMinutesMap.get(lm.leagueId) ?? 15, now),
        );
        if (openMatches.length === 0) return pendingMap;

        const userPredictions = await this.prisma.prediction.findMany({
            where: {
                userId: { in: userIds },
                OR: openMatches.map((om) => ({ leagueId: om.leagueId, matchId: om.matchId })),
            },
            select: { userId: true, leagueId: true, matchId: true },
        });
        const predSet = new Set(
            userPredictions.map((p) => `${p.userId}:${p.leagueId}:${p.matchId}`),
        );

        for (const uid of userIds) {
            const userLeagues = userLeagueMap.get(uid);
            if (!userLeagues) continue;
            let pending = 0;
            for (const om of openMatches) {
                if (!userLeagues.has(om.leagueId)) continue;
                if (!predSet.has(`${uid}:${om.leagueId}:${om.matchId}`)) pending++;
            }
            if (pending > 0) pendingMap.set(uid, pending);
        }

        return pendingMap;
    }
}
