import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class StageFeeItemDto {
    @IsString() type: string;
    @IsString() label: string;
    @IsInt() @Min(0) amount: number;
    @IsBoolean() active: boolean;
}

class DistributionItemDto {
    @IsString() category: string;
    @IsInt() @Min(1) position: number;
    @IsString() label: string;
    @IsNumber() @Min(0) @Max(100) percentage: number;
    @IsBoolean() active: boolean;
}

export class UpdateLeagueDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsString() description?: string;
    @IsOptional() @IsString() privacy?: string;
    @IsOptional() @IsInt() @Min(2) maxParticipants?: number;
    @IsOptional() @IsBoolean() includeBaseFee?: boolean;
    @IsOptional() @IsInt() @Min(0) baseFee?: number;
    @IsOptional() @IsString() currency?: string;
    @IsOptional() @IsInt() @Min(0) @Max(50) adminFeePercent?: number;
    @IsOptional() @IsBoolean() includeStageFees?: boolean;
    @IsOptional() @IsInt() closePredictionMinutes?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StageFeeItemDto)
    stageFees?: StageFeeItemDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DistributionItemDto)
    distributions?: DistributionItemDto[];
}
