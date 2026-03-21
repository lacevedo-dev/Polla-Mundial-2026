import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberStatus,
  NotificationType,
  ParticipationCategory,
  ParticipationSource,
  ParticipationStatus,
  Phase,
  StageType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrepareParticipationCheckoutDto } from './dto/checkout.dto';
import {
  ParticipationCategoryDto,
  UpsertParticipationSelectionsDto,
} from './dto/selection.dto';
import { ParticipationSummaryDto } from './dto/summary.dto';

type ParticipationOption = {
  category: ParticipationCategory;
  categoryLabel: string;
  referenceId?: string;
  referenceLabel: string;
  unitAmount: number;
  currency: string;
  deadlineAt?: string;
  enabled: boolean;
  status?: 'UNSELECTED' | 'PENDING_PAYMENT' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  multiplier?: 1 | 2 | 3;
};

type OrderParticipationItem = {
  type: string;
  id: string;
  quantity: number;
  price?: number;
  name?: string;
  category?: string;
  leagueId?: string;
  obligationId?: string;
  referenceId?: string;
};

@Injectable()
export class ParticipationService {
  private static readonly VALID_MULTIPLIERS = [1, 2, 3] as const;
  private static readonly PHASE_LABELS: Record<Phase, string> = {
    GROUP: 'Grupos',
    ROUND_OF_32: 'Dieciseisavos',
    ROUND_OF_16: 'Octavos',
    QUARTER: 'Cuartos',
    SEMI: 'Semifinal',
    THIRD_PLACE: 'Tercer puesto',
    FINAL: 'Final',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getAvailableCategories(userId: string, leagueId: string, matchId?: string) {
    const context = await this.loadContext(userId, leagueId, matchId);
    const obligations = await this.prisma.participationObligation.findMany({
      where: {
        userId,
        leagueId,
        ...(matchId ? { OR: [{ matchId }, { matchId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.buildOptionsFromContext(context, obligations);
  }

  async upsertSelections(
    userId: string,
    dto: UpsertParticipationSelectionsDto,
  ): Promise<ParticipationSummaryDto> {
    const context = await this.loadContext(userId, dto.leagueId, dto.matchId);
    const options = this.buildOptionsFromContext(context);
    const optionMap = new Map(
      options.map((option) => [this.buildSelectionKey(option.category, option.referenceId), option]),
    );

    const pendingInScope = await this.prisma.participationObligation.findMany({
      where: {
        userId,
        leagueId: dto.leagueId,
        status: ParticipationStatus.PENDING_PAYMENT,
        ...(dto.matchId
          ? { OR: [{ matchId: dto.matchId }, { matchId: null }] }
          : { matchId: null }),
      },
    });

    const selectedKeys = new Set<string>();

    for (const selection of dto.selections) {
      if (
        !ParticipationService.VALID_MULTIPLIERS.includes(
          selection.multiplier as (typeof ParticipationService.VALID_MULTIPLIERS)[number],
        )
      ) {
        throw new BadRequestException('El multiplicador debe ser x1, x2 o x3');
      }

      const normalizedCategory = selection.category as ParticipationCategory;
      const selectionKey = this.buildSelectionKey(normalizedCategory, selection.referenceId);
      const option = optionMap.get(selectionKey);

      if (!option || !option.enabled) {
        throw new BadRequestException(
          `La categoría ${selection.category} no está disponible para este contexto`,
        );
      }

      selectedKeys.add(selectionKey);

      const existing = pendingInScope.find(
        (item) =>
          item.category === normalizedCategory &&
          (item.referenceId ?? undefined) === selection.referenceId,
      );

      const payload = {
        userId,
        leagueId: dto.leagueId,
        matchId: this.resolveMatchIdForCategory(normalizedCategory, dto.matchId),
        category: normalizedCategory,
        referenceId: selection.referenceId,
        referenceLabel: option.referenceLabel,
        source: ParticipationSource.PREDICTION,
        unitAmount: option.unitAmount,
        multiplier: selection.multiplier,
        totalAmount: option.unitAmount * selection.multiplier,
        currency: option.currency as any,
        deadlineAt: option.deadlineAt ? new Date(option.deadlineAt) : new Date(),
        status: ParticipationStatus.PENDING_PAYMENT,
        expiredAt: null,
        cancelledAt: null,
      };

      if (existing) {
        await this.prisma.participationObligation.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await this.prisma.participationObligation.create({ data: payload });
      }
    }

    for (const pending of pendingInScope) {
      const key = this.buildSelectionKey(pending.category, pending.referenceId ?? undefined);
      if (!selectedKeys.has(key)) {
        await this.prisma.participationObligation.update({
          where: { id: pending.id },
          data: {
            status: ParticipationStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      }
    }

    return this.getParticipationSummary(userId, dto.leagueId);
  }

  async getParticipationSummary(
    userId: string,
    leagueId: string,
  ): Promise<ParticipationSummaryDto> {
    await this.assertMembership(userId, leagueId);

    const obligations = await this.prisma.participationObligation.findMany({
      where: {
        userId,
        leagueId,
        status: {
          in: [
            ParticipationStatus.PENDING_PAYMENT,
            ParticipationStatus.PAID,
            ParticipationStatus.EXPIRED,
            ParticipationStatus.CANCELLED,
          ],
        },
      },
      orderBy: [{ status: 'asc' }, { deadlineAt: 'asc' }, { createdAt: 'desc' }],
    });

    const items = obligations.map((item) => ({
      id: item.id,
      category: item.category,
      categoryLabel: this.getCategoryLabel(item.category),
      referenceId: item.referenceId ?? undefined,
      referenceLabel: item.referenceLabel,
      status: item.status,
      unitAmount: item.unitAmount,
      multiplier: Math.min(Math.max(item.multiplier, 1), 3) as 1 | 2 | 3,
      subtotal: item.totalAmount,
      currency: item.currency,
      deadlineAt: item.deadlineAt.toISOString(),
    }));

    const totalPending = obligations
      .filter((item) => item.status === ParticipationStatus.PENDING_PAYMENT)
      .reduce((sum, item) => sum + item.totalAmount, 0);

    return {
      totalPending,
      currency: obligations[0]?.currency ?? 'COP',
      itemCount: obligations.length,
      hasPrincipalPending: obligations.some(
        (item) =>
          item.category === ParticipationCategory.PRINCIPAL &&
          item.status === ParticipationStatus.PENDING_PAYMENT,
      ),
      items,
    };
  }

  async prepareCheckout(userId: string, dto: PrepareParticipationCheckoutDto) {
    await this.assertMembership(userId, dto.leagueId);

    const obligations = await this.prisma.participationObligation.findMany({
      where: {
        id: { in: dto.obligationIds },
        userId,
        leagueId: dto.leagueId,
        status: ParticipationStatus.PENDING_PAYMENT,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (obligations.length !== dto.obligationIds.length) {
      throw new BadRequestException(
        'Una o más participaciones no existen o ya no están pendientes de pago',
      );
    }

    const items = obligations.map((obligation) => ({
      type: 'PARTICIPATION',
      id: obligation.referenceId ?? obligation.id,
      quantity: 1,
      price: obligation.totalAmount,
      name: `${this.getCategoryLabel(obligation.category)} · ${obligation.referenceLabel}`,
      category: obligation.category,
      leagueId: obligation.leagueId,
      obligationId: obligation.id,
      referenceId: obligation.referenceId ?? undefined,
    }));

    return {
      leagueId: dto.leagueId,
      currency: obligations[0]?.currency ?? 'COP',
      totalAmount: obligations.reduce((sum, item) => sum + item.totalAmount, 0),
      items,
    };
  }

  async createPrincipalObligationForInvitation(params: {
    userId: string;
    leagueId: string;
    deadlineAt?: Date | null;
  }) {
    const league = await this.prisma.league.findUnique({
      where: { id: params.leagueId },
      select: {
        id: true,
        name: true,
        includeBaseFee: true,
        baseFee: true,
        currency: true,
      },
    });

    if (!league) {
      throw new NotFoundException('La liga no existe');
    }

    if (!league.includeBaseFee || !league.baseFee || league.baseFee <= 0) {
      return null;
    }

    const deadlineAt =
      params.deadlineAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    const existing = await this.prisma.participationObligation.findFirst({
      where: {
        userId: params.userId,
        leagueId: params.leagueId,
        category: ParticipationCategory.PRINCIPAL,
        status: ParticipationStatus.PENDING_PAYMENT,
      },
    });

    const payload = {
      userId: params.userId,
      leagueId: params.leagueId,
      matchId: null,
      category: ParticipationCategory.PRINCIPAL,
      referenceId: params.leagueId,
      referenceLabel: league.name,
      source: ParticipationSource.INVITATION,
      unitAmount: league.baseFee,
      multiplier: 1,
      totalAmount: league.baseFee,
      currency: league.currency,
      deadlineAt,
      status: ParticipationStatus.PENDING_PAYMENT,
    };

    if (existing) {
      return this.prisma.participationObligation.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return this.prisma.participationObligation.create({ data: payload });
  }

  async activatePaidObligationsForOrder(orderId: string, paymentId?: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('La orden no existe');
    }

    const rawItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const items: OrderParticipationItem[] = Array.isArray(rawItems) ? rawItems : [];
    const participationItems = items.filter(
      (item) => item.type === 'PARTICIPATION' && item.obligationId,
    );

    if (!participationItems.length) {
      return { updated: 0, membershipsActivated: 0 };
    }

    const obligationIds = participationItems.map((item) => item.obligationId!) as string[];
    const obligations = await this.prisma.participationObligation.findMany({
      where: {
        id: { in: obligationIds },
        status: ParticipationStatus.PENDING_PAYMENT,
      },
    });

    if (!obligations.length) {
      return { updated: 0, membershipsActivated: 0 };
    }

    const now = new Date();
    await this.prisma.participationObligation.updateMany({
      where: {
        id: { in: obligations.map((item) => item.id) },
        status: ParticipationStatus.PENDING_PAYMENT,
      },
      data: {
        status: ParticipationStatus.PAID,
        orderId,
        paymentId: paymentId ?? undefined,
        paidAt: now,
      },
    });

    const principalObligations = obligations.filter(
      (item) => item.category === ParticipationCategory.PRINCIPAL,
    );

    for (const obligation of principalObligations) {
      await this.prisma.leagueMember.updateMany({
        where: {
          userId: obligation.userId,
          leagueId: obligation.leagueId,
          status: MemberStatus.PENDING_PAYMENT,
        },
        data: {
          status: MemberStatus.ACTIVE,
        },
      });
    }

    for (const obligation of obligations) {
      await this.notificationsService.createInAppNotification({
        userId: obligation.userId,
        type: NotificationType.PAYMENT_CONFIRMED,
        title: 'Pago confirmado',
        body: `Tu participación ${this.getCategoryLabel(obligation.category).toLowerCase()} ya quedó activa.`,
        data: {
          obligationId: obligation.id,
          leagueId: obligation.leagueId,
          category: obligation.category,
          orderId,
        },
      });
    }

    return {
      updated: obligations.length,
      membershipsActivated: principalObligations.length,
    };
  }

  private async loadContext(userId: string, leagueId: string, matchId?: string) {
    await this.assertMembership(userId, leagueId);

    const [league, match] = await Promise.all([
      this.prisma.league.findUnique({
        where: { id: leagueId },
        include: {
          stageFees: {
            where: { active: true },
            orderBy: [{ type: 'asc' }, { amount: 'asc' }],
          },
          distributions: {
            where: { active: true },
            orderBy: { position: 'asc' },
          },
        },
      }),
      matchId
        ? this.prisma.match.findUnique({
            where: { id: matchId },
            include: {
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
    ]);

    if (!league) {
      throw new NotFoundException('Liga no encontrada');
    }

    if (matchId && !match) {
      throw new NotFoundException('Partido no encontrado');
    }

    return { league, match };
  }

  private async assertMembership(userId: string, leagueId: string) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: { userId_leagueId: { userId, leagueId } },
    });

    if (
      !membership ||
      (membership.status !== MemberStatus.ACTIVE &&
        membership.status !== MemberStatus.PENDING_PAYMENT)
    ) {
      throw new ForbiddenException('No tienes una membresía válida para esta liga');
    }

    return membership;
  }

  private buildOptionsFromContext(context: any, obligations: any[] = []): ParticipationOption[] {
    const options: ParticipationOption[] = [];
    const { league, match } = context;

    if (league.includeBaseFee && league.baseFee && league.baseFee > 0) {
      options.push({
        category: ParticipationCategory.PRINCIPAL,
        categoryLabel: this.getCategoryLabel(ParticipationCategory.PRINCIPAL),
        referenceId: league.id,
        referenceLabel: league.name,
        unitAmount: league.baseFee,
        currency: league.currency,
        deadlineAt: match
          ? this.resolveDeadline(match.matchDate, league.closePredictionMinutes).toISOString()
          : undefined,
        enabled: true,
      });
    }

    if (league.includeStageFees && match) {
      const activeStageFees = Array.isArray(league.stageFees) ? league.stageFees : [];

      const matchFee = activeStageFees.find((fee: any) => fee.type === StageType.MATCH);
      if (matchFee) {
        options.push({
          category: ParticipationCategory.MATCH,
          categoryLabel: this.getCategoryLabel(ParticipationCategory.MATCH),
          referenceId: match.id,
          referenceLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          unitAmount: matchFee.amount,
          currency: league.currency,
          deadlineAt: this.resolveDeadline(match.matchDate, league.closePredictionMinutes).toISOString(),
          enabled: true,
        });
      }

      if (match.group) {
        const groupFee = activeStageFees.find((fee: any) =>
          this.matchesReference(fee.label, [match.group, `Grupo ${match.group}`]),
        );
        if (groupFee) {
          options.push({
            category: ParticipationCategory.GROUP,
            categoryLabel: this.getCategoryLabel(ParticipationCategory.GROUP),
            referenceId: match.group,
            referenceLabel: `Grupo ${match.group}`,
            unitAmount: groupFee.amount,
            currency: league.currency,
            deadlineAt: this.resolveDeadline(match.matchDate, league.closePredictionMinutes).toISOString(),
            enabled: true,
          });
        }
      }

      const phaseReference = ParticipationService.PHASE_LABELS[match.phase as Phase];
      const roundFee = activeStageFees.find(
        (fee: any) =>
          fee.type === StageType.ROUND &&
          this.matchesReference(fee.label, [phaseReference, match.phase]),
      );
      if (roundFee) {
        options.push({
          category: ParticipationCategory.ROUND,
          categoryLabel: this.getCategoryLabel(ParticipationCategory.ROUND),
          referenceId: match.phase,
          referenceLabel: phaseReference,
          unitAmount: roundFee.amount,
          currency: league.currency,
          deadlineAt: this.resolveDeadline(match.matchDate, league.closePredictionMinutes).toISOString(),
          enabled: true,
        });
      }

      const phaseFee = activeStageFees.find(
        (fee: any) =>
          fee.type === StageType.PHASE &&
          this.matchesReference(fee.label, [phaseReference, match.phase, match.group ? `Grupo ${match.group}` : '']),
      );
      if (phaseFee) {
        options.push({
          category: match.group ? ParticipationCategory.GROUP : ParticipationCategory.PHASE,
          categoryLabel: this.getCategoryLabel(match.group ? ParticipationCategory.GROUP : ParticipationCategory.PHASE),
          referenceId: match.group ?? match.phase,
          referenceLabel: match.group ? `Grupo ${match.group}` : phaseReference,
          unitAmount: phaseFee.amount,
          currency: league.currency,
          deadlineAt: this.resolveDeadline(match.matchDate, league.closePredictionMinutes).toISOString(),
          enabled: true,
        });
      }
    }

    return options.map((option) => {
      const existing = obligations.find(
        (item) =>
          item.category === option.category &&
          (item.referenceId ?? undefined) === option.referenceId,
      );

      return {
        ...option,
        status: existing ? existing.status : 'UNSELECTED',
        multiplier: existing
          ? (Math.min(Math.max(existing.multiplier, 1), 3) as 1 | 2 | 3)
          : 1,
      };
    });
  }

  private resolveDeadline(matchDate: Date, closePredictionMinutes: number) {
    return new Date(
      new Date(matchDate).getTime() - Math.max(closePredictionMinutes ?? 0, 0) * 60000,
    );
  }

  private buildSelectionKey(category: ParticipationCategory, referenceId?: string) {
    return `${category}:${referenceId ?? 'ROOT'}`;
  }

  private resolveMatchIdForCategory(category: ParticipationCategory, matchId?: string) {
    return category === ParticipationCategory.MATCH ? matchId ?? null : null;
  }

  private getCategoryLabel(category: ParticipationCategory) {
    switch (category) {
      case ParticipationCategory.PRINCIPAL:
        return 'Polla principal';
      case ParticipationCategory.MATCH:
        return 'Por partido';
      case ParticipationCategory.GROUP:
        return 'Por grupo';
      case ParticipationCategory.ROUND:
        return 'Por ronda';
      case ParticipationCategory.PHASE:
        return 'Por fase';
      default:
        return category;
    }
  }

  private matchesReference(label: string, candidates: string[]) {
    const normalizedLabel = this.normalizeText(label);
    return candidates
      .filter(Boolean)
      .map((candidate) => this.normalizeText(candidate))
      .some((candidate) => normalizedLabel === candidate);
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase();
  }
}
