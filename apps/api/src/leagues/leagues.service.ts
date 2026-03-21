import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpdateLeagueDto } from './dto/update-league.dto';
import { MemberRole, MemberStatus, LeagueStatus, ScoringType, InviteStatus, Plan } from '@prisma/client';
import { randomBytes } from 'crypto';
import { ParticipationService } from '../participation/participation.service';

@Injectable()
export class LeaguesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly participationService: ParticipationService,
    ) { }

    private static readonly DEFAULT_SCORING_RULES = [
        { ruleType: ScoringType.EXACT_SCORE, points: 5, description: 'Marcador exacto' },
        { ruleType: ScoringType.CORRECT_DIFF, points: 3, description: 'Misma diferencia de goles' },
        { ruleType: ScoringType.CORRECT_WINNER, points: 2, description: 'Solo ganador/empate' },
    ] as const;

    private generateUniqueCode(): string {
        return randomBytes(3).toString('hex').toUpperCase();
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

        const { stageFees: sfInput, distributions: distInput, ...leagueScalars } = createLeagueDto;

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

            return league;
        } catch (error) {
            throw new BadRequestException('Error al crear la liga. Comprueba los parámetros ingresados.');
        }
    }

    async findAllByUserId(userId: string) {
        return this.prisma.league.findMany({
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
            },
        });

        if (!league) {
            throw new NotFoundException('La liga solicitada no existe');
        }

        const isMember = league.members.some((m) => m.userId === userId);
        if (!isMember) {
            throw new BadRequestException('No tienes acceso a esta liga');
        }

        return league;
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
            throw new BadRequestException('No tienes permisos para editar esta liga');
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
            throw new BadRequestException('No tienes permisos para eliminar miembros');
        }
        await this.prisma.leagueMember.delete({
            where: { userId_leagueId: { userId: targetUserId, leagueId } },
        });
        return { ok: true };
    }
}
