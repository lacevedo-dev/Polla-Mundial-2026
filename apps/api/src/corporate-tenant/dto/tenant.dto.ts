import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TenantPlanTier, TenantRole, TenantStatus } from '@prisma/client';

export class CreateTenantDto {
    @IsString()
    slug: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    legalName?: string;

    @IsEmail()
    contactEmail: string;

    @IsOptional()
    @IsEnum(TenantPlanTier)
    planTier?: TenantPlanTier;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10000)
    maxUsers?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    maxLeagues?: number;
}

export class UpdateTenantDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    legalName?: string;

    @IsOptional()
    @IsEmail()
    contactEmail?: string;

    @IsOptional()
    @IsEnum(TenantStatus)
    status?: TenantStatus;

    @IsOptional()
    @IsEnum(TenantPlanTier)
    planTier?: TenantPlanTier;

    @IsOptional()
    @IsString()
    customDomain?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10000)
    maxUsers?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    maxLeagues?: number;
}

export class UpdateTenantConfigDto {
    @IsOptional()
    @IsBoolean()
    enablePayments?: boolean;

    @IsOptional()
    @IsBoolean()
    enableAiInsights?: boolean;

    @IsOptional()
    @IsBoolean()
    enablePublicLeagues?: boolean;

    @IsOptional()
    @IsBoolean()
    enableUserSelfRegister?: boolean;

    @IsOptional()
    @IsBoolean()
    requireInvitation?: boolean;

    @IsOptional()
    @IsBoolean()
    enableEmailNotif?: boolean;

    @IsOptional()
    @IsBoolean()
    enablePushNotif?: boolean;

    @IsOptional()
    @IsBoolean()
    enableStageFees?: boolean;
}

export class UpdateTenantBrandingDto {
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @IsOptional()
    @IsString()
    faviconUrl?: string;

    @IsOptional()
    @IsString()
    primaryColor?: string;

    @IsOptional()
    @IsString()
    secondaryColor?: string;

    @IsOptional()
    @IsString()
    accentColor?: string;

    @IsOptional()
    @IsString()
    fontFamily?: string;

    @IsOptional()
    @IsString()
    heroImageUrl?: string;

    @IsOptional()
    @IsString()
    companyDisplayName?: string;

    @IsOptional()
    @IsString()
    customCss?: string;

    @IsOptional()
    @IsString()
    emailHeaderHtml?: string;

    @IsOptional()
    @IsString()
    emailFooterHtml?: string;

    @IsOptional()
    @IsString()
    emailInviteTemplate?: string;
}

export class InviteTenantMemberDto {
    @IsEmail()
    email: string;

    @IsOptional()
    @IsEnum(TenantRole)
    role?: TenantRole;
}

export class ChangeTenantMemberRoleDto {
    @IsEnum(TenantRole)
    role: TenantRole;
}

export class BulkInviteTenantDto {
    @IsArray()
    @IsEmail({}, { each: true })
    emails: string[];

    @IsOptional()
    @IsEnum(TenantRole)
    role?: TenantRole;

    @IsOptional()
    @IsString()
    bulkBatchId?: string;
}
