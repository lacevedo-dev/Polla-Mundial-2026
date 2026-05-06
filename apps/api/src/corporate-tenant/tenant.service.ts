import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateTenantDto,
    UpdateTenantDto,
    UpdateTenantBrandingDto,
    UpdateTenantConfigDto,
} from './dto/tenant.dto';

@Injectable()
export class TenantService {
    private readonly slugCache = new Map<string, string | null>();
    private readonly domainCache = new Map<string, string | null>();

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

    async getPublicContext(slug: string) {
        const tenant = await this.prisma.corporateTenant.findUnique({
            where: { slug },
            select: {
                id: true,
                slug: true,
                name: true,
                legalName: true,
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
