import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
import { TenantRole, TenantMemberStatus } from '@prisma/client';

export class UpdateMemberDto {
    @IsOptional() @IsEnum(TenantRole) role?: TenantRole;
    @IsOptional() @IsEnum(TenantMemberStatus) status?: TenantMemberStatus;
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() documentNumber?: string;
    @IsOptional() @IsString() tempPassword?: string;
}
