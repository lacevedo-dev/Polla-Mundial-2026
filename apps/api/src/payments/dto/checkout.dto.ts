import { IsNotEmpty, IsString, IsNumber, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @IsNotEmpty()
  @IsString()
  type: string;

  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  obligationId?: string;

  @IsOptional()
  @IsString()
  leagueId?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class CreateCheckoutSessionDto {
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsNotEmpty()
  @IsString()
  successUrl: string;

  @IsNotEmpty()
  @IsString()
  cancelUrl: string;

  @IsOptional()
  @IsString()
  currency: string = 'USD';
}
