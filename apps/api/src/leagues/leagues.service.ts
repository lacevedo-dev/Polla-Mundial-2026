import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { MemberRole, MemberStatus, LeagueStatus, ScoringType, InviteStatus, Phase, Plan, WhatsappPersonalSource } from '@prisma/client';
import { randomBytes } from 'crypto';
import { ParticipationService } from '../participation/participation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TwilioService } from '../notifications/twilio.service';
import { WhatsappPersonalService } from '../notifications/whatsapp-personal.service';
import { EmailQueueService } from '../email/email-queue.service';
import { WhatsappGroupService } from '../whatsapp/whatsapp-group.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

const PAYMENT_REMINDER_CHANNELS = ['email', 'whatsapp_group', 'whatsapp_personal', 'sms', 'push'] as const;
type PaymentReminderChannel = typeof PAYMENT_REMINDER_CHANNELS[number];

@Injectable()
export class LeaguesService {
    private readonly logger = new Logger(LeaguesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly participationService: ParticipationService,
        private readonly notifications: NotificationsService,
        private readonly twilio: TwilioService,
        private readonly emailQueue: EmailQueueService,
        private readonly waGroup: WhatsappGroupService,
        private readonly waPersonal: WhatsappPersonalService,
        private readonly push: PushNotificationsService,
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

    private normalizeLeagueName(name: string): string {
        return name.trim().replace(/\s+/g, ' ');
    }

    private async assertUniqueLeagueName(name: string, excludeLeagueId?: string) {
        const normalizedName = this.normalizeLeagueName(name);
        const duplicated = await this.prisma.league.findFirst({
            where: {
                name: normalizedName,
                ...(excludeLeagueId ? { id: { not: excludeLeagueId } } : {}),
            },
            select: { id: true, name: true },
        });

        if (duplicated) {
            throw new BadRequestException('Ya existe una polla con ese nombre. Usa un nombre diferente.');
        }

        return normalizedName;
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

        // Run all three queries in parallel — each aggregates in the DB, no raw rows loaded
        const [activeMembers, pointsPerUserLeague, phaseBonuses] = await Promise.all([
            this.prisma.leagueMember.findMany({
                where: {
                    leagueId: { in: leagueIds },
                    status: MemberStatus.ACTIVE,
                },
                select: { leagueId: true, userId: true },
            }),

            // groupBy aggregates SUM(points) per (leagueId, userId) in the DB — no raw prediction rows
            this.prisma.prediction.groupBy({
                by: ['leagueId', 'userId'],
                where: {
                    leagueId: { in: leagueIds },
                    points: { not: null },
                },
                _sum: { points: true },
            }),

            this.prisma.phaseBonus.findMany({
                where: { leagueId: { in: leagueIds } },
                select: { leagueId: true, userId: true, points: true, phase: true },
            }),
        ]);

        // Build prediction points map: leagueId -> userId -> sumPoints
        // NOTE: Number() cast is required — Prisma _sum with MySQL/MariaDB adapter may return
        // a Decimal object instead of a plain number, which breaks arithmetic below.
        const predPointsByLeague = new Map<string, Map<string, number>>();
        for (const row of pointsPerUserLeague) {
            const byUser = predPointsByLeague.get(row.leagueId) ?? new Map<string, number>();
            byUser.set(row.userId, Number(row._sum.points ?? 0));
            predPointsByLeague.set(row.leagueId, byUser);
        }

        // Build phase bonus map: leagueId -> userId -> { total, hasChampion }
        const bonusByLeague = new Map<string, Map<string, { total: number; hasChampion: boolean }>>();
        for (const bonus of phaseBonuses) {
            const leagueBonus = bonusByLeague.get(bonus.leagueId) ?? new Map();
            const current = leagueBonus.get(bonus.userId) ?? { total: 0, hasChampion: false };
            current.total += bonus.points;
            if (bonus.phase === Phase.FINAL) current.hasChampion = true;
            leagueBonus.set(bonus.userId, current);
            bonusByLeague.set(bonus.leagueId, leagueBonus);
        }

        // Build active-members map: leagueId -> userId[]
        const activeMembersByLeague = new Map<string, string[]>();
        for (const member of activeMembers) {
            const members = activeMembersByLeague.get(member.leagueId) ?? [];
            members.push(member.userId);
            activeMembersByLeague.set(member.leagueId, members);
        }

        // Compute rankings per league — sort by total points then tiebreakers
        const rankingByLeague = new Map<string, Map<string, { rank: number; points: number }>>();

        for (const leagueId of leagueIds) {
            const leagueMembers = activeMembersByLeague.get(leagueId) ?? [];
            const rows = leagueMembers
                .map((userId) => {
                    const predPoints = predPointsByLeague.get(leagueId)?.get(userId) ?? 0;
                    const bonus = bonusByLeague.get(leagueId)?.get(userId) ?? { total: 0, hasChampion: false };
                    return {
                        userId,
                        points: predPoints + bonus.total,
                        hasChampion: bonus.hasChampion,
                    };
                })
                .sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.hasChampion !== a.hasChampion) return b.hasChampion ? 1 : -1;
                    return 0;
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
    const user = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { systemRole: true } });
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
        const normalizedLeagueName = await this.assertUniqueLeagueName(createLeagueDto.name);
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
            const creator = await this.prisma.user.findFirst({ where: { id: userId, status: 'ACTIVE' }, select: { plan: true } });
            leaguePlan = creator?.plan ?? Plan.FREE;
        }

        const { stageFees: sfInput, distributions: distInput, primaryTournamentId, ...leagueScalars } = createLeagueDto;

        try {
            const league = await this.prisma.league.create({
                data: {
                    ...leagueScalars,
                    name: normalizedLeagueName,
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
                 distributions: true,
             },
             orderBy: { createdAt: 'desc' },
         });

         let rankingByLeague: Map<string, Map<string, { rank: number; points: number }>>;
         try {
             rankingByLeague = await this.buildLeagueRankingMap(leagues.map((league) => league.id));
         } catch (err) {
             this.logger.error('buildLeagueRankingMap failed — returning leagues without ranking', err?.stack ?? err);
             rankingByLeague = new Map();
         }

         return leagues.map((league) => {
             const ranking = rankingByLeague.get(league.id)?.get(userId);
             return {
                 ...league,
                 // rank and points at top level — matches what toLeagueContextListItem adapter reads
                 rank: ranking?.rank ?? null,
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
        const user = await this.prisma.user.findFirst({
            where: { id: userId, status: 'ACTIVE' },
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
                league: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        description: true,
                        privacy: true,
                        includeBaseFee: true,
                        baseFee: true,
                        currency: true,
                        plan: true,
                        maxParticipants: true,
                        closePredictionMinutes: true,
                        primaryTournament: { select: { id: true, name: true, season: true } },
                        _count: { select: { members: { where: { status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING_PAYMENT] } } } } },
                    },
                },
                inviter: { select: { id: true, name: true, username: true } },
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

        const requiresPayment =
            league.includeBaseFee &&
            (league.baseFee ?? 0) > 0;

        const newMember = await this.prisma.leagueMember.create({
            data: {
                userId,
                leagueId: league.id,
                role: MemberRole.PLAYER,
                status: requiresPayment
                    ? MemberStatus.PENDING_PAYMENT
                    : league.privacy === 'PUBLIC'
                        ? MemberStatus.ACTIVE
                        : MemberStatus.PENDING,
            },
        });

        if (requiresPayment) {
            await this.participationService.createPrincipalObligationForInvitation({
                userId,
                leagueId: league.id,
            });
        }

        return {
            message: newMember.status === MemberStatus.ACTIVE
                ? 'Te has unido exitosamente a la liga'
                : newMember.status === MemberStatus.PENDING_PAYMENT
                ? 'Tu cupo fue reservado. Solo falta pagar la polla general para activarte.'
                : 'Solicitud de unión enviada. Espera aprobación del administrador.',
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

        if (typeof scalarFields.name === 'string') {
            scalarFields.name = await this.assertUniqueLeagueName(scalarFields.name, leagueId);
        }

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
        const member = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId } },
            select: { role: true },
        });
        if (member?.role === MemberRole.ADMIN) {
            return;
        }

        const isSuperAdmin = await this.prisma.user.findFirst({
            where: { id: userId, status: 'ACTIVE', systemRole: 'SUPERADMIN' },
            select: { id: true },
        });
        if (!isSuperAdmin) {
            throw new ForbiddenException('Solo el administrador de la polla puede gestionar los pagos');
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

    async getInfoByCode(code: string) {
        const league = await this.prisma.league.findUnique({
            where: { code: code.toUpperCase() },
            select: {
                id: true,
                name: true,
                description: true,
                _count: {
                    select: { members: { where: { status: MemberStatus.ACTIVE } } },
                },
                members: {
                    where: { role: MemberRole.ADMIN },
                    select: {
                        user: { select: { name: true } },
                    },
                    take: 1,
                },
            },
        });

        if (!league) {
            throw new NotFoundException('Código de liga inválido o liga no encontrada');
        }

        const adminMember = league.members[0];

        return {
            id: league.id,
            name: league.name,
            description: league.description,
            memberCount: league._count.members,
            adminName: adminMember?.user?.name ?? null,
        };
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

    async sendPaymentReminders(
        requestingUserId: string,
        leagueId: string,
        body: {
            recipients: Array<{ userId: string; channels: string[] }>;
            messages: Record<string, string>;
        },
    ) {
        await this.assertLeagueAdmin(requestingUserId, leagueId);

        if (!body.recipients?.length) {
            throw new BadRequestException('Selecciona al menos un usuario');
        }

        const league = await this.prisma.league.findUnique({
            where: { id: leagueId },
            select: { name: true },
        });
        if (!league) throw new NotFoundException('Liga no encontrada');

        const userIds = [...new Set(body.recipients.map((r) => r.userId))];
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds }, status: 'ACTIVE' },
            select: { id: true, name: true, email: true, phone: true, countryCode: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        const obligations = await this.prisma.participationObligation.findMany({
            where: { leagueId, userId: { in: userIds }, status: 'PENDING_PAYMENT' },
            select: { userId: true, totalAmount: true, currency: true },
        });

        const pendingByUser = new Map<string, number>();
        let currency = 'COP';
        for (const o of obligations) {
            pendingByUser.set(o.userId, (pendingByUser.get(o.userId) ?? 0) + o.totalAmount);
            currency = o.currency;
        }

        const fmtCurrency = (amount: number) =>
            new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);

        const resolveMsg = (template: string, name: string, debt: number) =>
            template
                .replace(/\{nombre\}/g, name)
                .replace(/\{liga\}/g, league.name)
                .replace(/\{deuda\}/g, fmtCurrency(debt));

        const results: Record<string, boolean | number | string> = {};
        const errors: string[] = [];
        const todayKey = new Date().toISOString().slice(0, 10);

        const groupRecipients = body.recipients.filter((r) =>
            r.channels.includes('whatsapp_group'),
        );
        if (groupRecipients.length > 0 && body.messages.whatsapp_group?.trim()) {
            const lines = groupRecipients.map((r) => {
                const user = userMap.get(r.userId);
                const debt = pendingByUser.get(r.userId) ?? 0;
                return `• ${user?.name ?? 'Participante'}: ${fmtCurrency(debt)}`;
            });
            const header = resolveMsg(body.messages.whatsapp_group, '', 0)
                .replace(/\{nombre\}/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            const caption = [header, ...lines].filter(Boolean).join('\n');
            const dedupeKey = `PAYMENT_REMINDER:${leagueId}:${Date.now()}:${randomBytes(4).toString('hex')}`;

            try {
                const queued = await this.waGroup.enqueuePaymentReminder(leagueId, caption, dedupeKey);
                results.whatsapp_group = queued;
                if (!queued) {
                    errors.push('WhatsApp grupo: la polla no tiene grupo configurado o el canal está deshabilitado');
                }
            } catch (err) {
                errors.push(`WhatsApp grupo: ${String(err)}`);
            }
        }

        for (const recipient of body.recipients) {
            const user = userMap.get(recipient.userId);
            if (!user) {
                errors.push(`Usuario ${recipient.userId}: no encontrado o inactivo`);
                continue;
            }

            const debt = pendingByUser.get(recipient.userId) ?? 0;
            const channels = recipient.channels.filter((c): c is PaymentReminderChannel =>
                PAYMENT_REMINDER_CHANNELS.includes(c as PaymentReminderChannel),
            );

            for (const channel of channels) {
                if (channel === 'whatsapp_group') continue;

                const template =
                    body.messages[channel] ??
                    (channel === 'whatsapp_personal' ? body.messages.whatsapp_group : undefined);
                if (!template?.trim()) continue;

                const message = resolveMsg(template, user.name, debt);

                try {
                    if (channel === 'email') {
                        if (!user.email) {
                            errors.push(`${user.name}: sin email registrado`);
                            continue;
                        }
                        const lines = message.split('\n');
                        let subject = `Recordatorio de pago — ${league.name}`;
                        let textBody = message;
                        if (lines[0]?.toLowerCase().startsWith('asunto:')) {
                            subject = lines[0].replace(/^asunto:\s*/i, '').trim();
                            textBody = lines.slice(1).join('\n').trim();
                        }
                        const queued = await this.emailQueue.enqueueEmail({
                            type: 'PAYMENT_REMINDER',
                            priority: 'MEDIUM',
                            required: false,
                            recipientEmail: user.email,
                            subject,
                            html: textBody.replace(/\n/g, '<br/>'),
                            text: textBody,
                            dedupeKey: `payment-reminder:${leagueId}:${user.id}:${todayKey}`,
                            leagueId,
                        });
                        results[`email:${user.id}`] = queued;
                        if (!queued) {
                            errors.push(`${user.name}: email no encolado (duplicado o bloqueado)`);
                        }
                    } else if (channel === 'whatsapp_personal') {
                        if (!user.phone) {
                            errors.push(`${user.name}: sin teléfono para WhatsApp personal`);
                            continue;
                        }
                        const { sent, via } = await this.waPersonal.send(
                            user.countryCode,
                            user.phone,
                            message,
                            user.name,
                            {
                                userId: user.id,
                                userName: user.name,
                                source: WhatsappPersonalSource.LEAGUE_BROADCAST,
                                leagueId,
                            },
                        );
                        results[`whatsapp_personal:${user.id}`] = sent;
                        if (sent && via) {
                            results[`whatsapp_personal_via:${user.id}`] = via;
                        }
                        if (!sent) {
                            errors.push(
                                `${user.name}: no se pudo enviar WA personal (WhatsApp Web desconectado y Twilio no disponible)`,
                            );
                        }
                    } else if (channel === 'sms') {
                        if (!user.phone) {
                            errors.push(`${user.name}: sin teléfono para SMS`);
                            continue;
                        }
                        if (!this.twilio.isEnabled()) {
                            errors.push('SMS: Twilio no está configurado');
                            continue;
                        }
                        const fullPhone = `${user.countryCode ?? '+57'}${user.phone}`;
                        const sent = await this.twilio.sendSMS(fullPhone, message);
                        results[`sms:${user.id}`] = sent;
                        if (!sent) {
                            errors.push(`${user.name}: falló SMS`);
                        }
                    } else if (channel === 'push') {
                        const title = 'Recordatorio de pago';
                        await this.push.sendToUser(user.id, {
                            title,
                            body: message,
                            data: { leagueId, type: 'payment_reminder' },
                        });
                        await this.notifications.createInAppNotification({
                            userId: user.id,
                            type: 'PAYMENT_CONFIRMED',
                            title,
                            body: message,
                            data: { leagueId, kind: 'payment_reminder' },
                        });
                        results[`push:${user.id}`] = true;
                    }
                } catch (err) {
                    errors.push(`${user.name} (${channel}): ${String(err)}`);
                }
            }
        }

        this.logger.log(
            `Payment reminders for league ${leagueId}: ${Object.keys(results).length} deliveries, ${errors.length} issues`,
        );

        return {
            ok: errors.length === 0,
            deliveries: results,
            errors,
        };
    }
}
