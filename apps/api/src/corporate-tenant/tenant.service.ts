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
const MEMBER_STATS_TTL_MS = 300_000;
const MEMBER_LIST_CACHE_TTL_MS = 90_000;
const MEMBER_LIST_CACHE_MAX = 150;

@Injectable()
export class TenantService {
    private readonly slugCache = new Map<string, string | null>();
    private readonly domainCache = new Map<string, string | null>();
    private readonly memberStatsCache = new Map<
        string,
        { expiresAt: number; totalActive: number; roleCounts: Record<string, number> }
    >();
    private readonly memberListCache = new Map<
        string,
        {
            expiresAt: number;
            result: {
                members: Array<{
                    id: string;
                    userId: string;
                    role: TenantRole;
                    status: string;
                    invitedAt: Date;
                    joinedAt: Date | null;
                    user: {
                        id: string;
                        name: string;
                        email: string;
                        username: string;
                        documentNumber: string;
                        avatar: string | null;
                        mustChangePassword: boolean;
                        emailVerified: boolean;
                        createdAt: Date;
                    };
                }>;
                total: number;
                totalExact: boolean;
                page: number;
                limit: number;
                hasMore: boolean;
            };
        }
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
        this.invalidateMembersListCache(tenantId);
    }

    invalidateMembersListCache(tenantId: string) {
        for (const key of this.memberListCache.keys()) {
            if (key.startsWith(`${tenantId}|`)) this.memberListCache.delete(key);
        }
    }

    private trimMemberListCache() {
        if (this.memberListCache.size <= MEMBER_LIST_CACHE_MAX) return;
        const entries = [...this.memberListCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        for (let i = 0; i < entries.length - MEMBER_LIST_CACHE_MAX; i++) {
            this.memberListCache.delete(entries[i][0]);
        }
    }

    private buildMemberUserSearchFilter(searchTrim: string): Prisma.UserWhereInput {
        if (searchTrim.includes('@')) {
            return { email: { contains: searchTrim } };
        }
        if (/^\d+$/.test(searchTrim)) {
            return {
                OR: [
                    { documentNumber: { contains: searchTrim } },
                    { username: { contains: searchTrim } },
                    { phone: { contains: searchTrim } },
                ],
            };
        }
        return {
            OR: [
                { name: { contains: searchTrim } },
                { email: { contains: searchTrim } },
                { username: { contains: searchTrim } },
                { documentNumber: { contains: searchTrim } },
                { phone: { contains: searchTrim } },
            ],
        };
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
        const searchTrim = this.normalizeMemberSearch(params.search ?? '');
        const skip = (page - 1) * limit;
        const hasSearch = searchTrim.length >= MEMBER_SEARCH_MIN_LEN;

        const cacheKey = `${tenantId}|${page}|${limit}|${searchTrim}|${role ?? ''}`;
        const now = Date.now();
        const cached = this.memberListCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.result;
        }

        const where: Prisma.TenantMemberWhereInput = {
            tenantId,
            status: 'ACTIVE',
            ...(role && { role }),
            ...(hasSearch && { user: this.buildMemberUserSearchFilter(searchTrim) }),
        };

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
        let totalExact: boolean;
        if (hasSearch) {
            // Evita COUNT con LIKE '%…%' sobre ~10k filas (muy lento en MySQL).
            total = skip + members.length + (hasMore ? 1 : 0);
            totalExact = !hasMore;
        } else if (role) {
            total = await this.prisma.tenantMember.count({ where });
            totalExact = true;
        } else {
            total = (await this.getMembersRoleStats(tenantId)).totalActive;
            totalExact = true;
        }

        const result = { members, total, totalExact, page, limit, hasMore };
        this.memberListCache.set(cacheKey, { expiresAt: now + MEMBER_LIST_CACHE_TTL_MS, result });
        this.trimMemberListCache();
        return result;
    }

    private normalizeMemberSearch(raw: string): string {
        return raw.trim().replace(/\s+/g, ' ');
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
