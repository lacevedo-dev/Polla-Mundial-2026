import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { MemberRole, MemberStatus, LeagueStatus, ScoringType, InviteStatus, Phase, Plan } from '@prisma/client';
import { randomBytes } from 'crypto';
import { ParticipationService } from '../participation/participation.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeaguesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly participationService: ParticipationService,
        private readonly notifications: NotificationsService,
    ) { }

    private static readonly DEFAULT_SCORING_RULES = [
        { ruleType: ScoringType.EXACT_SCORE,       points: 5, description: 'Marcador exacto' },
        { ruleType: ScoringType.CORRECT_WINNER,    points: 2, description: 'Ganador / empate correcto' },
        { ruleType: ScoringType.TEAM_GOALS,        points: 1, description: 'Gol acertado (al menos un equipo)' },
        { ruleType: ScoringType.UNIQUE_PREDICTION, points: 5, description: 'Predicción única en la liga' },
        { ruleType: ScoringType.PHASE_BONUS_R32,   points: 0, description: 'Bono clasificados Fase 32' },
        { ruleType: ScoringType.PHASE_BONUS_R16,   points: 8, description: 'Bono clasificados Octavos' },
        { ruleType: ScoringType.PHASE_BONUS_QF,    points: 4, description: 'Bono clasificados Cuartos' },
        { ruleType: ScoringType.PHASE_BONUS_SF,    points: 2, description: 'Bono clasificados Semifinal' },
        { ruleType: ScoringType.PHASE_BONUS_FINAL, points: 5, description: 'Bono Campeón (Final)' },
    ] as const;

    private generateUniqueCode(): string {
        return randomBytes(3).toString('hex').toUpperCase();
    }

    private parsePointDetail(pointDetail: string | null) {
        if (!pointDetail) return null;
        try {
            return JSON.parse(pointDetail) as {
                type?: string;
                uniqueBonus?: number;
            };
        } catch {
            return null;
        }
    }

    private async buildLeagueRankingMap(leagueIds: string[]) {
        if (!leagueIds.length) {
            return new Map<string, Map<string, { rank: number; points: number }>>();
        }

        const activeMembers = await this.prisma.leagueMember.findMany({
            where: {
                leagueId: { in: leagueIds },
                status: MemberStatus.ACTIVE,
            },
            select: {
                leagueId: true,
                userId: true,
            },
        });

        const predictions = await this.prisma.prediction.findMany({
            where: {
                leagueId: { in: leagueIds },
                points: { not: null },
            },
            select: {
                leagueId: true,
                userId: true,
                points: true,
                pointDetail: true,
            },
        });

        const phaseBonuses = await this.prisma.phaseBonus.findMany({
            where: {
                leagueId: { in: leagueIds },
            },
            select: {
                leagueId: true,
                userId: true,
                points: true,
                phase: true,
            },
        });

        const userStatsByLeague = new Map<string, Map<string, {
            points: number;
            exactCount: number;
            winnerCount: number;
            goalCount: number;
            uniqueCount: number;
        }>>();

        for (const prediction of predictions) {
            const leagueStats = userStatsByLeague.get(prediction.leagueId) ?? new Map();
            const stats = leagueStats.get(prediction.userId) ?? {
                points: 0,
                exactCount: 0,
                winnerCount: 0,
                goalCount: 0,
                uniqueCount: 0,
            };

            stats.points += prediction.points ?? 0;

            const detail = this.parsePointDetail(prediction.pointDetail);
            if (detail?.type === 'EXACT_SCORE') stats.exactCount++;
            if (detail?.type === 'CORRECT_WINNER' || detail?.type === 'CORRECT_WINNER_GOAL') stats.winnerCount++;
            if (detail?.type === 'TEAM_GOALS' || detail?.type === 'CORRECT_WINNER_GOAL') stats.goalCount++;
            if ((detail?.uniqueBonus ?? 0) > 0) stats.uniqueCount++;

            leagueStats.set(prediction.userId, stats);
            userStatsByLeague.set(prediction.leagueId, leagueStats);
        }

        const bonusByLeague = new Map<string, Map<string, { total: number; hasChampion: boolean }>>();

        for (const bonus of phaseBonuses) {
            const leagueBonus = bonusByLeague.get(bonus.leagueId) ?? new Map();
            const current = leagueBonus.get(bonus.userId) ?? { total: 0, hasChampion: false };

            current.total += bonus.points;
            if (bonus.phase === Phase.FINAL) current.hasChampion = true;

            leagueBonus.set(bonus.userId, current);
            bonusByLeague.set(bonus.leagueId, leagueBonus);
        }

        const activeMembersByLeague = new Map<string, string[]>();
        for (const member of activeMembers) {
            const members = activeMembersByLeague.get(member.leagueId) ?? [];
            members.push(member.userId);
            activeMembersByLeague.set(member.leagueId, members);
        }

        const rankingByLeague = new Map<string, Map<string, { rank: number; points: number }>>();

        for (const leagueId of leagueIds) {
            const leagueMembers = activeMembersByLeague.get(leagueId) ?? [];
            const rows = leagueMembers
                .map((userId) => {
                    const stats = userStatsByLeague.get(leagueId)?.get(userId) ?? {
                        points: 0,
                        exactCount: 0,
                        winnerCount: 0,
                        goalCount: 0,
                        uniqueCount: 0,
                    };
                    const bonus = bonusByLeague.get(leagueId)?.get(userId) ?? { total: 0, hasChampion: false };

                    return {
                        userId,
                        points: stats.points + bonus.total,
                        hasChampion: bonus.hasChampion,
                        exactCount: stats.exactCount,
                        winnerCount: stats.winnerCount,
                        goalCount: stats.goalCount,
                        uniqueCount: stats.uniqueCount,
                    };
                })
                .sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.hasChampion !== a.hasChampion) return b.hasChampion ? 1 : -1;
                    if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
                    if (b.winnerCount !== a.winnerCount) return b.winnerCount - a.winnerCount;
                    if (b.goalCount !== a.goalCount) return b.goalCount - a.goalCount;
                    return b.uniqueCount - a.uniqueCount;
                });

            rankingByLeague.set(
                leagueId,
                new Map(rows.map((row, index) => [row.userId, { rank: index + 1, points: row.points }])),
            );
        }

        return rankingByLeague;
    }

    async listAvailableTournaments() {
        return this.prisma.tournament.findMany({
            orderBy: [{ active: 'desc' }, { season: 'desc' }, { name: 'asc' }],
            select: { id: true, name: true, country: true, season: true, logoUrl: true, active: true },
        });
    }

    private async isSuperAdmin(userId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } });
        return user?.systemRole === 'SUPERADMIN';
    }

    async setLeagueTournament(userId: string, leagueId: string, tournamentId: string | null): Promise<{ ok: boolean }> {
        const member = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId } },
        });
        if (!member || member.role !== MemberRole.ADMIN) {
            if (!await this.isSuperAdmin(userId)) {
                throw new ForbiddenException('Solo el administrador puede cambiar el torneo de la polla');
            }
        }

        if (tournamentId) {
            const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
            if (!tournament) throw new NotFoundException('Torneo no encontrado');

            await this.prisma.leagueTournament.upsert({
                where: { leagueId_tournamentId: { leagueId, tournamentId } },
                create: { leagueId, tournamentId },
                update: {},
            });
            await this.prisma.league.update({
                where: { id: leagueId },
                data: { primaryTournamentId: tournamentId },
            });
        } else {
            await this.prisma.league.update({
                where: { id: leagueId },
                data: { primaryTournamentId: null },
            });
        }

        return { ok: true };
    }

    async create(userId: string, createLeagueDto: CreateLeagueDto) {
        let code = this.generateUniqueCode();
        let isCodeUnique = false;

        while (!isCodeUnique) {
            const existing = await this.prisma.league.findUnique({ where: { code } });
            if (!existing) {
                isCodeUnique = true;
            } else {
                code = this.generateUniqueCode();
            }
        }

        let leaguePlan = createLeagueDto.plan;
        if (!leaguePlan) {
            const creator = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
            leaguePlan = creator?.plan ?? Plan.FREE;
        }

        const { stageFees: sfInput, distributions: distInput, primaryTournamentId, ...leagueScalars } = createLeagueDto;

        try {
            const league = await this.prisma.league.create({
                data: {
                    ...leagueScalars,
                    plan: leaguePlan,
                    code,
                    status: LeagueStatus.SETUP,
                    members: {
                        create: {
                            userId,
                            role: MemberRole.ADMIN,
                            status: MemberStatus.ACTIVE,
                        },
                    },
                    scoringRules: {
                        createMany: {
                            data: [...LeaguesService.DEFAULT_SCORING_RULES],
                        },
                    },
                    ...(sfInput?.length && {
                        stageFees: {
                            createMany: {
                                data: sfInput.map((sf) => ({
                                    type: sf.type as any,
                                    label: sf.label,
                                    amount: sf.amount,
                                    active: sf.active,
                                })),
                            },
                        },
                    }),
                    ...(distInput?.length && {
                        distributions: {
                            createMany: {
                                data: distInput.map((d) => ({
                                    category: d.category as any,
                                    position: d.position,
                                    label: d.label,
                                    percentage: d.percentage,
                                    active: d.active,
                                })),
                            },
                        },
                    }),
                },
                include: {
                    members: true,
                    scoringRules: true,
                    stageFees: true,
                    distributions: true,
                },
            });

            if (primaryTournamentId) {
                await this.prisma.leagueTournament.create({
                    data: { leagueId: league.id, tournamentId: primaryTournamentId },
                }).catch(() => { /* tournament not found — ignore */ });
                await this.prisma.league.update({
                    where: { id: league.id },
                    data: { primaryTournamentId },
                }).catch(() => { /* column may not exist in older DB — ignore */ });
            }

            return league;
        } catch (error) {
            throw new BadRequestException('Error al crear la liga. Comprueba los parámetros ingresados.');
        }
    }

    async findAllByUserId(userId: string) {
        const leagues = await this.prisma.league.findMany({
            where: {
                members: {
                    some: {
                        userId,
                        status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING, MemberStatus.PENDING_PAYMENT] },
                    },
                },
            },
            include: {
                _count: {
                    select: { members: true },
                },
                members: {
                    where: { userId },
                    select: { role: true, status: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const rankingByLeague = await this.buildLeagueRankingMap(leagues.map((league) => league.id));

        return leagues.map((league) => {
            const ranking = rankingByLeague.get(league.id)?.get(userId);
            return {
                ...league,
                rank: ranking?.rank,
                points: ranking?.points ?? 0,
            };
        });
    }

    async getLeagueDetails(userId: string, leagueId: string) {
        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                avatar: true,
                            },
                        },
                    },
                },
                distributions: true,
                stageFees: true,
                scoringRules: true,
                primaryTournament: { select: { id: true, name: true, season: true, logoUrl: true } },
            },
        });

        if (!league) {
            throw new NotFoundException('La liga solicitada no existe');
        }

        const isMember = league.members.some((m) => m.userId === userId);
        if (!isMember) {
            throw new BadRequestException('No tienes acceso a esta liga');
        }

        // Ensure the current user's member entry is first so the frontend
        // adapter (members[0].role) picks up the correct role for this user.
        const sortedMembers = [
            ...league.members.filter((m) => m.userId === userId),
            ...league.members.filter((m) => m.userId !== userId),
        ];

        return { ...league, members: sortedMembers };
    }

    async findPublicLeagues(userId: string) {
        const joinedIds = (
            await this.prisma.leagueMember.findMany({
                where: { userId, status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING, MemberStatus.PENDING_PAYMENT] } },
                select: { leagueId: true },
            })
        ).map((m) => m.leagueId);

        return this.prisma.league.findMany({
            where: {
                privacy: 'PUBLIC',
                status: { not: 'CANCELLED' as any },
                id: { notIn: joinedIds },
            },
            include: { _count: { select: { members: true } } },
            orderBy: { createdAt: 'desc' },
            take: 12,
        });
    }

    async findMyInvitations(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user) return [];

        return this.prisma.invitation.findMany({
            where: {
                recipient: user.email,
                status: InviteStatus.SENT,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            include: {
                league: { select: { id: true, name: true, privacy: true, includeBaseFee: true, baseFee: true } },
                inviter: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async acceptInvitation(userId: string, invitationId: string) {
        const invitation = await this.prisma.invitation.findUnique({
            where: { id: invitationId },
            include: {
                league: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        maxParticipants: true,
                        privacy: true,
                        includeBaseFee: true,
                        baseFee: true,
                        _count: { select: { members: { where: { status: MemberStatus.ACTIVE } } } },
                    },
                },
            },
        });
        if (!invitation || invitation.status !== InviteStatus.SENT) {
            throw new NotFoundException('Invitación no encontrada o ya procesada');
        }

        const requiresPayment = invitation.league.includeBaseFee && (invitation.league.baseFee ?? 0) > 0;
        const existing = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId: invitation.leagueId } },
        });

        if (!existing) {
            if (invitation.league.maxParticipants && invitation.league._count.members >= invitation.league.maxParticipants) {
                throw new BadRequestException('La liga ya alcanzó su límite de participantes');
            }
            await this.prisma.leagueMember.create({
                data: {
                    userId,
                    leagueId: invitation.leagueId,
                    role: MemberRole.PLAYER,
                    status: requiresPayment ? MemberStatus.PENDING_PAYMENT : MemberStatus.ACTIVE,
                },
            });
        } else if (requiresPayment && existing.status !== MemberStatus.ACTIVE) {
            await this.prisma.leagueMember.update({
                where: { userId_leagueId: { userId, leagueId: invitation.leagueId } },
                data: { status: MemberStatus.PENDING_PAYMENT },
            });
        }

        if (requiresPayment) {
            await this.participationService.createPrincipalObligationForInvitation({
                userId,
                leagueId: invitation.leagueId,
                deadlineAt: invitation.expiresAt,
            });
        }

        await this.prisma.invitation.update({
            where: { id: invitationId },
            data: { status: InviteStatus.ACCEPTED },
        });

        return {
            ok: true,
            leagueId: invitation.leagueId,
            status: requiresPayment ? MemberStatus.PENDING_PAYMENT : MemberStatus.ACTIVE,
        };
    }

    async declineInvitation(invitationId: string) {
        const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
        if (!invitation) throw new NotFoundException('Invitación no encontrada');

        await this.prisma.invitation.update({
            where: { id: invitationId },
            data: { status: InviteStatus.EXPIRED },
        });
        return { ok: true };
    }

    async joinLeagueByCode(userId: string, code: string) {
        const league = await this.prisma.league.findUnique({
            where: { code: code.toUpperCase() },
            include: {
                _count: {
                    select: { members: { where: { status: MemberStatus.ACTIVE } } },
                },
            },
        });

        if (!league) {
            throw new NotFoundException('Código de liga inválido o liga no encontrada');
        }

        if (league.maxParticipants && league._count.members >= league.maxParticipants) {
            throw new BadRequestException('La liga ya alcanzó su límite de participantes');
        }

        const existingMember = await this.prisma.leagueMember.findUnique({
            where: {
                userId_leagueId: { userId, leagueId: league.id },
            },
        });

        if (existingMember) {
            throw new BadRequestException('Ya eres miembro (o tienes una solicitud pendiente) en esta liga');
        }

        const newMember = await this.prisma.leagueMember.create({
            data: {
                userId,
                leagueId: league.id,
                role: MemberRole.PLAYER,
                status: league.privacy === 'PUBLIC' ? MemberStatus.ACTIVE : MemberStatus.PENDING,
            },
        });

        return {
            message: newMember.status === 'ACTIVE' ? 'Te has unido exitosamente a la liga' : 'Solicitud de unión enviada. Espera aprobación del administrador.',
            leagueId: league.id,
            status: newMember.status,
        };
    }

    async updateLeague(userId: string, leagueId: string, dto: UpdateLeagueDto) {
        const member = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId } },
        });
        if (!member || member.role !== MemberRole.ADMIN) {
            if (!await this.isSuperAdmin(userId)) {
                throw new BadRequestException('No tienes permisos para editar esta liga');
            }
        }

        const { stageFees: sfDto, distributions: distDto, ...scalarFields } = dto;

        if (Object.keys(scalarFields).length) {
            await this.prisma.league.update({ where: { id: leagueId }, data: scalarFields as any });
        }

        if (sfDto?.length) {
            for (const sf of sfDto) {
                await this.prisma.stageFee.upsert({
                    where: { leagueId_type_label: { leagueId, type: sf.type as any, label: sf.label } },
                    create: { leagueId, type: sf.type as any, label: sf.label, amount: sf.amount, active: sf.active },
                    update: { amount: sf.amount, active: sf.active },
                });
            }
        }

        if (distDto?.length) {
            for (const d of distDto) {
                await this.prisma.prizeDistribution.upsert({
                    where: { leagueId_category_position: { leagueId, category: d.category as any, position: d.position } },
                    create: { leagueId, category: d.category as any, position: d.position, label: d.label, percentage: d.percentage, active: d.active },
                    update: { percentage: d.percentage, label: d.label, active: d.active },
                });
            }
        }

        return this.prisma.league.findUnique({
            where: { id: leagueId },
            include: {
                _count: { select: { members: true } },
                members: { where: { userId }, select: { role: true, status: true } },
                stageFees: true,
                distributions: true,
            },
        });
    }

    async removeMember(adminUserId: string, leagueId: string, targetUserId: string) {
        if (adminUserId === targetUserId) {
            throw new BadRequestException('No puedes eliminarte a ti mismo de la liga');
        }
        const adminMember = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId: adminUserId, leagueId } },
        });
        if (!adminMember || adminMember.role !== MemberRole.ADMIN) {
            if (!await this.isSuperAdmin(adminUserId)) {
                throw new BadRequestException('No tienes permisos para eliminar miembros');
            }
        }
        await this.prisma.leagueMember.delete({
            where: { userId_leagueId: { userId: targetUserId, leagueId } },
        });
        return { ok: true };
    }

    /* ─── League Payment Obligations (admin endpoints) ─────────────────── */

    private async assertLeagueAdmin(userId: string, leagueId: string) {
        const [member] = await Promise.all([
            this.prisma.leagueMember.findUnique({
                where: { userId_leagueId: { userId, leagueId } },
            }),
        ]);
        if (!member || member.role !== MemberRole.ADMIN) {
            if (!await this.isSuperAdmin(userId)) {
                throw new ForbiddenException('Solo el administrador de la polla puede gestionar los pagos');
            }
        }
    }

    async getLeaguePaymentObligations(requestingUserId: string, leagueId: string) {
        await this.assertLeagueAdmin(requestingUserId, leagueId);

        const obligations = await this.prisma.participationObligation.findMany({
            where: { leagueId },
            include: {
                user: { select: { id: true, name: true, avatar: true } },
            },
            orderBy: [{ userId: 'asc' }, { category: 'asc' }, { createdAt: 'asc' }],
        });

        return obligations.map((o) => ({
            id: o.id,
            userId: o.userId,
            userName: o.user.name,
            userAvatar: o.user.avatar,
            category: o.category,
            referenceLabel: o.referenceLabel,
            unitAmount: o.unitAmount,
            multiplier: o.multiplier,
            totalAmount: o.totalAmount,
            currency: o.currency,
            status: o.status,
            deadlineAt: o.deadlineAt,
            paidAt: o.paidAt,
            createdAt: o.createdAt,
        }));
    }

    async confirmObligation(
        requestingUserId: string,
        leagueId: string,
        obligationId: string,
        data: { method: string; reference?: string; note?: string },
    ) {
        await this.assertLeagueAdmin(requestingUserId, leagueId);

        const obligation = await this.prisma.participationObligation.findFirst({
            where: { id: obligationId, leagueId },
        });
        if (!obligation) throw new NotFoundException('Obligación no encontrada');

        await this.prisma.participationObligation.update({
            where: { id: obligationId },
            data: { status: 'PAID', paidAt: new Date() },
        });

        await this.notifications.createInAppNotification({
            userId: obligation.userId,
            type: 'PAYMENT_CONFIRMED',
            title: '✅ Pago confirmado',
            body: `Tu pago de "${obligation.referenceLabel}" fue confirmado por el administrador vía ${data.method}.`,
            data: { leagueId, obligationId, method: data.method, reference: data.reference ?? '' },
        });

        return { confirmed: true };
    }

    async resetObligation(requestingUserId: string, leagueId: string, obligationId: string) {
        await this.assertLeagueAdmin(requestingUserId, leagueId);

        const obligation = await this.prisma.participationObligation.findFirst({
            where: { id: obligationId, leagueId },
        });
        if (!obligation) throw new NotFoundException('Obligación no encontrada');

        await this.prisma.participationObligation.update({
            where: { id: obligationId },
            data: { status: 'PENDING_PAYMENT', paidAt: null },
        });

        return { reset: true };
    }
}
