import { IsBoolean, IsOptional } from 'class-validator';

export class ResetSystemDto {
    @IsOptional()
    @IsBoolean()
    predictions?: boolean;

    @IsOptional()
    @IsBoolean()
    participations?: boolean;

    @IsOptional()
    @IsBoolean()
    leagues?: boolean;

    @IsOptional()
    @IsBoolean()
    payments?: boolean;

    @IsOptional()
    @IsBoolean()
    notifications?: boolean;

    @IsOptional()
    @IsBoolean()
    matches?: boolean;

    @IsOptional()
    @IsBoolean()
    auditLogs?: boolean;

    @IsOptional()
    @IsBoolean()
    emailLogs?: boolean;

    @IsOptional()
    @IsBoolean()
    automationLogs?: boolean;

    @IsOptional()
    @IsBoolean()
    footballSyncLogs?: boolean;

    @IsOptional()
    @IsBoolean()
    syncPlans?: boolean;
}
