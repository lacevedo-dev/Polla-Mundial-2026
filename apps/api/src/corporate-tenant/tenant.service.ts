import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TenantRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateTenantDto,
    UpdateTenantDto,
    UpdateTenantBrandingDto,
    UpdateTenantConfigDto,
} from './dto/tenant.dto';

const MEMBER_SEARCH_MIN_LEN = 2;
const MEMBER_SEARCH_MAX_IDS = 500;
const MEMBER_STATS_TTL_MS = 300_000;

@Injectable()
export class TenantService {
    private readonly slugCache = new Map<string, string | null>();
    private readonly domainCache = new Map<string, string | null>();
    private readonly memberStatsCache = new Map<
        string,
        { expiresAt: number; totalActive: number; roleCounts: Record<string, number> }
    >();

    constructor(private readonly prisma: PrismaService) {}

    async resolveBySlug(slug: string): Promise<string | null> {
        if (this.slugCache.has(slug)) return this.slugCache.get(slug)!;

        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { slug },
            select: { id: true, status: true },
        });

        const id = tenant?.status === 'ACTIVE' ? tenant.id : null;
        this.slugCache.set(slug, id);
        return id;
    }

    async resolveByCustomDomain(domain: string): Promise<string | null> {
        if (this.domainCache.has(domain)) return this.domainCache.get(domain)!;

        const tenant = await this.prisma.corporateTenant.findFirst({
            where: { customDomain: domain, status: 'ACTIVE' },
            select: { id: true },
        });

        const id = tenant?.id ?? null;
        this.domainCache.set(domain, id);
        return id;
    }

    invalidateCache(slug?: string, domain?: string) {
        if (slug) this.slugCache.delete(slug);
        if (domain) this.domainCache.delete(domain);
    }

    async getPublicContext(slugOrDomain: string) {
        const tenant = await this.prisma.corporateTenant.findFirst({
            where: {
                OR: [
                    { slug: slugOrDomain },
                    { customDomain: slugOrDomain },
                ],
            },
            select: {
                id: true,
                slug: true,
                name: true,
                legalName: true,
                contactEmail: true,
                status: true,
                planTier: true,
                customDomain: true,
                maxUsers: true,
                maxLeagues: true,
                branding: true,
                config: true,
                _count: { select: { members: { where: { status: 'ACTIVE' } } } },
            },
        });

        if (!tenant) throw new NotFoundException('Tenant no encontrado');
        if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
            throw new BadRequestException('Esta organización no está disponible actualmente');
        }

        return {
            ...tenant,
            memberCount: tenant._count.members,
        };
    }

    async create(dto: CreateTenantDto) {
        const existing = await this.prisma.corporateTenant.findUnique({
            where: { slug: dto.slug },
            select: { id: true },
        });
        if (existing) throw new BadRequestException('El slug ya está en uso');

        return this.prisma.corporateTenant.create({
            data: {
                slug: dto.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                name: dto.name,
                legalName: dto.legalName,
                contactEmail: dto.contactEmail,
                planTier: dto.planTier ?? 'STARTER',
                maxUsers: dto.maxUsers ?? 50,
                maxLeagues: dto.maxLeagues ?? 3,
                branding: { create: {} },
                config: { create: {} },
            },
            include: { branding: true, config: true },
        });
    }

    async findAll() {
        return this.prisma.corporateTenant.findMany({
            include: {
                _count: { select: { members: { where: { status: 'ACTIVE' } }, leagues: true } },
                subscription: { select: { status: true, billingModel: true, priceMonthly: true, currency: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id },
            include: {
                branding: true,
                config: true,
                subscription: true,
                _count: { select: { members: { where: { status: 'ACTIVE' } }, leagues: true } },
            },
        });
        if (!tenant) throw new NotFoundException('Tenant no encontrado');
        return tenant;
    }

    async update(id: string, dto: UpdateTenantDto) {
        await this.findOne(id);
        const updated = await this.prisma.corporateTenant.update({
            where: { id },
            data: dto,
            include: { branding: true, config: true },
        });
        this.invalidateCache(updated.slug, updated.customDomain ?? undefined);
        return updated;
    }

    async updateBranding(id: string, dto: UpdateTenantBrandingDto) {
        await this.findOne(id);
        return this.prisma.tenantBranding.upsert({
            where: { tenantId: id },
            create: { tenantId: id, ...dto },
            update: dto,
        });
    }

    async updateConfig(id: string, dto: UpdateTenantConfigDto) {
        await this.findOne(id);
        return this.prisma.tenantConfig.upsert({
            where: { tenantId: id },
            create: { tenantId: id, ...dto },
            update: dto,
        });
    }

    async getMembers(tenantId: string) {
        return this.prisma.tenantMember.findMany({
            where: { tenantId },
            include: {
                user: { select: { id: true, name: true, email: true, username: true, avatar: true } },
            },
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });
    }

    invalidateMembersStatsCache(tenantId: string) {
        this.memberStatsCache.delete(tenantId);
    }

    async getMembersRoleStats(tenantId: string) {
        const now = Date.now();
        const cached = this.memberStatsCache.get(tenantId);
        if (cached && cached.expiresAt > now) {
            return { totalActive: cached.totalActive, roleCounts: cached.roleCounts };
        }

        const roleCountsRaw = await this.prisma.$queryRaw<Array<{ role: TenantRole; c: bigint }>>(
            Prisma.sql`
                SELECT role, COUNT(*) AS c
                FROM TenantMember
                WHERE tenantId = ${tenantId} AND status = 'ACTIVE'
                GROUP BY role
            `,
        );

        const roleCounts = Object.fromEntries(roleCountsRaw.map((r) => [r.role, Number(r.c)]));
        const totalActive = roleCountsRaw.reduce((sum, r) => sum + Number(r.c), 0);

        this.memberStatsCache.set(tenantId, {
            expiresAt: now + MEMBER_STATS_TTL_MS,
            totalActive,
            roleCounts,
        });

        return { totalActive, roleCounts };
    }

    async listMembersPaginated(params: {
        tenantId: string;
        page: number;
        limit: number;
        search?: string;
        role?: TenantRole;
    }) {
        const { tenantId, page, limit, role } = params;
        const searchTrim = params.search?.trim() ?? '';
        const skip = (page - 1) * limit;
        const isFiltered = Boolean(role || searchTrim.length >= MEMBER_SEARCH_MIN_LEN);

        const where: Prisma.TenantMemberWhereInput = {
            tenantId,
            status: 'ACTIVE',
            ...(role && { role }),
        };

        if (searchTrim.length >= MEMBER_SEARCH_MIN_LEN) {
            const userIds = await this.resolveMemberSearchUserIds(tenantId, searchTrim);
            if (userIds.length === 0) {
                return { members: [], total: 0, page, limit, hasMore: false };
            }
            where.userId = { in: userIds };
        }

        const memberSelect = {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    username: true,
                    documentNumber: true,
                    avatar: true,
                    mustChangePassword: true,
                    emailVerified: true,
                    createdAt: true,
                },
            },
        } as const;

        const rows = await this.prisma.tenantMember.findMany({
            where,
            include: memberSelect,
            orderBy: [{ invitedAt: 'asc' }, { id: 'asc' }],
            skip,
            take: limit + 1,
        });

        const hasMore = rows.length > limit;
        const members = hasMore ? rows.slice(0, limit) : rows;

        let total: number;
        if (isFiltered) {
            total = await this.prisma.tenantMember.count({ where });
        } else {
            total = (await this.getMembersRoleStats(tenantId)).totalActive;
        }

        return { members, total, page, limit, hasMore };
    }

    private async resolveMemberSearchUserIds(tenantId: string, search: string): Promise<string[]> {
        const prefix = `${search}%`;
        const contains = `%${search}%`;
        const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>(
            Prisma.sql`
                SELECT DISTINCT tm.userId AS userId
                FROM TenantMember tm
                INNER JOIN User u ON u.id = tm.userId
                WHERE tm.tenantId = ${tenantId}
                  AND tm.status = 'ACTIVE'
                  AND (
                    u.documentNumber LIKE ${prefix}
                    OR u.username LIKE ${prefix}
                    OR u.email LIKE ${contains}
                    OR u.name LIKE ${contains}
                  )
                LIMIT ${MEMBER_SEARCH_MAX_IDS}
            `,
        );
        return rows.map((r) => r.userId);
    }

    async getStats(tenantId: string) {
        const [activeUsers, totalLeagues, activeLeagues] = await Promise.all([
            this.prisma.tenantMember.count({ where: { tenantId, status: 'ACTIVE' } }),
            this.prisma.league.count({ where: { tenantId } }),
            this.prisma.league.count({ where: { tenantId, status: 'ACTIVE' } }),
        ]);

        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { id: tenantId },
            select: { maxUsers: true, maxLeagues: true },
        });

        return {
            users: { active: activeUsers, max: tenant?.maxUsers ?? 0 },
            leagues: { total: totalLeagues, active: activeLeagues, max: tenant?.maxLeagues ?? 0 },
        };
    }
}
