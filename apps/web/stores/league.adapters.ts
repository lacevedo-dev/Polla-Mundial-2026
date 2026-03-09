import type { LeagueData } from '@polla-2026/shared';
import { resolveApiAssetUrl } from '../api';

export type BackendPrivacy = 'PUBLIC' | 'PRIVATE';
export type BackendPlan = 'FREE' | 'GOLD' | 'DIAMOND';

export interface CreateLeagueRequest {
    name: string;
    description?: string;
    privacy?: BackendPrivacy;
    maxParticipants?: number;
    includeBaseFee?: boolean;
    baseFee?: number;
    currency?: string;
    plan?: BackendPlan;
}

export interface LeagueApiMember {
    role: 'ADMIN' | 'PLAYER';
    status: string;
    user?: {
        id?: string;
        name?: string | null;
        username?: string | null;
        avatar?: string | null;
    };
}

export interface LeagueApiResponse {
    id: string;
    name: string;
    description?: string | null;
    code?: string;
    privacy?: BackendPrivacy;
    status: string;
    maxParticipants?: number | null;
    includeBaseFee?: boolean;
    baseFee?: number | null;
    currency?: string | null;
    plan?: string | null;
    closePredictionMinutes?: number | null;
    _count?: {
        members?: number;
    };
    members?: LeagueApiMember[];
}

export interface LeagueContextMember {
    id: string;
    name: string;
    role: 'ADMIN' | 'MEMBER';
    status: string;
    avatar?: string;
}

export interface LeagueContext {
    id: string;
    name: string;
    description?: string;
    role: 'ADMIN' | 'MEMBER';
    status: string;
    settings: {
        privacy?: BackendPrivacy;
        plan?: string;
        currency?: string;
        maxParticipants?: number | null;
        includeBaseFee?: boolean;
        baseFee?: number | null;
        closePredictionMinutes?: number | null;
    };
    stats: {
        rank?: number;
        points?: number;
        collected?: string;
        totalPrize?: string;
        memberCount?: number;
    };
    code?: string;
    members?: LeagueContextMember[];
}

function parseOptionalInteger(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return undefined;
}

function toBackendPrivacy(value?: string): BackendPrivacy | undefined {
    if (!value) {
        return undefined;
    }

    return value.toUpperCase() === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
}

function toBackendPlan(value?: string): BackendPlan | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.toUpperCase();
    if (normalized === 'GOLD' || normalized === 'DIAMOND') {
        return normalized;
    }

    return 'FREE';
}

function trimOptionalText(value?: string | null): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function resolveRole(role?: string): 'ADMIN' | 'MEMBER' {
    return role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
}

function resolveMemberCount(response: LeagueApiResponse): number | undefined {
    if (typeof response._count?.members === 'number') {
        return response._count.members;
    }

    return response.members?.length;
}

function formatCurrencyAmount(amount: number, currency = 'COP'): string {
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount}`;
    }
}

function estimatePrizePool(
    baseFee: number | null | undefined,
    memberCount: number | undefined,
    currency: string | null | undefined,
): string | undefined {
    if (!baseFee || !memberCount) {
        return undefined;
    }

    return formatCurrencyAmount(baseFee * memberCount, currency ?? 'COP');
}

function isRichLeagueData(input: LeagueData | CreateLeagueRequest): input is LeagueData {
    return 'participantsCount' in input || 'baseFeeAmount' in input;
}

export function toCreateLeagueRequest(input: LeagueData | CreateLeagueRequest): CreateLeagueRequest {
    if (!isRichLeagueData(input)) {
        return {
            ...input,
            description: trimOptionalText(input.description),
            privacy: toBackendPrivacy(input.privacy),
            plan: toBackendPlan(input.plan),
        };
    }

    const maxParticipants = parseOptionalInteger(input.participantsCount);
    const baseFee = input.includeBaseFee ? parseOptionalInteger(input.baseFeeAmount) : undefined;

    return {
        name: input.name.trim(),
        description: trimOptionalText(input.description),
        privacy: toBackendPrivacy(input.privacy),
        maxParticipants,
        includeBaseFee: input.includeBaseFee,
        baseFee,
        currency: input.currency?.toUpperCase(),
        plan: toBackendPlan(input.plan),
    };
}

export function toLeagueContextListItem(response: LeagueApiResponse): LeagueContext {
    const memberCount = resolveMemberCount(response);

    return {
        id: response.id,
        name: response.name,
        description: trimOptionalText(response.description),
        role: resolveRole(response.members?.[0]?.role),
        status: response.status,
        code: response.code,
        settings: {
            privacy: response.privacy,
            plan: response.plan ?? undefined,
            currency: response.currency ?? undefined,
            maxParticipants: response.maxParticipants ?? undefined,
            includeBaseFee: response.includeBaseFee,
            baseFee: response.baseFee ?? undefined,
            closePredictionMinutes: response.closePredictionMinutes ?? undefined,
        },
        stats: {
            memberCount,
            totalPrize: estimatePrizePool(response.baseFee, memberCount, response.currency),
        },
    };
}

export function toLeagueContextDetail(response: LeagueApiResponse): LeagueContext {
    const baseContext = toLeagueContextListItem(response);

    return {
        ...baseContext,
        members: response.members?.map((member, index) => ({
            id: member.user?.id ?? `${response.id}-member-${index}`,
            name: member.user?.name?.trim() || member.user?.username?.trim() || `Miembro ${index + 1}`,
            role: resolveRole(member.role),
            status: member.status,
            avatar: resolveApiAssetUrl(member.user?.avatar) ?? undefined,
        })),
    };
}
