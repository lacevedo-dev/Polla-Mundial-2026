import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { MemberRole, MemberStatus, LeagueStatus, ScoringType, InviteStatus, Plan } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class LeaguesService {
    constructor(private readonly prisma: PrismaService) { }

    private static readonly DEFAULT_SCORING_RULES = [
        { ruleType: ScoringType.EXACT_SCORE, points: 5, description: 'Marcador exacto' },
        { ruleType: ScoringType.CORRECT_DIFF, points: 3, description: 'Misma diferencia de goles' },
        { ruleType: ScoringType.CORRECT_WINNER, points: 2, description: 'Solo ganador/empate' },
    ] as const;

    private generateUniqueCode(): string {
        return randomBytes(3).toString('hex').toUpperCase(); // Ej: F4A13B
    }

    async create(userId: string, createLeagueDto: CreateLeagueDto) {
        let code = this.generateUniqueCode();
        let isCodeUnique = false;

        // Verificar unicidad del código
        while (!isCodeUnique) {
            const existing = await this.prisma.league.findUnique({ where: { code } });
            if (!existing) {
                isCodeUnique = true;
            } else {
                code = this.generateUniqueCode();
            }
        }

        // Inherit plan from creator if not explicitly provided
        let leaguePlan = createLeagueDto.plan;
        if (!leaguePlan) {
            const creator = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
            leaguePlan = creator?.plan ?? Plan.FREE;
        }

        try {
            // Usar transición para asegurar integridad de creación de Liga + Miembro Admin
            const league = await this.prisma.league.create({
                data: {
                    ...createLeagueDto,
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
                    // Baseline de reglas por liga: requerido por spec para evitar ligas sin configuración de puntaje
                    scoringRules: {
                        createMany: {
                            data: [...LeaguesService.DEFAULT_SCORING_RULES],
                        },
                    },
                },
                include: {
                    members: true,
                    scoringRules: true,
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
                        status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] },
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

        // Verificar si el usuario es miembro de la liga
        const isMember = league.members.some((m) => m.userId === userId);
        if (!isMember) {
            throw new BadRequestException('No tienes acceso a esta liga');
        }

        return league;
    }

    async findPublicLeagues(userId: string) {
        const joinedIds = (
            await this.prisma.leagueMember.findMany({
                where: { userId, status: { in: [MemberStatus.ACTIVE, MemberStatus.PENDING] } },
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
                league: { select: { id: true, name: true, cover: true, privacy: true } },
                inviter: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async acceptInvitation(userId: string, invitationId: string) {
        const invitation = await this.prisma.invitation.findUnique({
            where: { id: invitationId },
            include: { league: { select: { id: true, code: true, maxParticipants: true, privacy: true, _count: { select: { members: { where: { status: MemberStatus.ACTIVE } } } } } } },
        });
        if (!invitation || invitation.status !== InviteStatus.SENT) {
            throw new NotFoundException('Invitación no encontrada o ya procesada');
        }

        const existing = await this.prisma.leagueMember.findUnique({
            where: { userId_leagueId: { userId, leagueId: invitation.leagueId } },
        });
        if (!existing) {
            if (invitation.league.maxParticipants && invitation.league._count.members >= invitation.league.maxParticipants) {
                throw new BadRequestException('La liga ya alcanzó su límite de participantes');
            }
            await this.prisma.leagueMember.create({
                data: { userId, leagueId: invitation.leagueId, role: MemberRole.PLAYER, status: MemberStatus.ACTIVE },
            });
        }

        await this.prisma.invitation.update({
            where: { id: invitationId },
            data: { status: InviteStatus.ACCEPTED },
        });

        return { ok: true, leagueId: invitation.leagueId };
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

        // Comprobar si ya es miembro
        const existingMember = await this.prisma.leagueMember.findUnique({
            where: {
                userId_leagueId: { userId, leagueId: league.id },
            },
        });

        if (existingMember) {
            throw new BadRequestException('Ya eres miembro (o tienes una solicitud pendiente) en esta liga');
        }

        // Únete a la liga
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
}
