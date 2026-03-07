import { IsNotEmpty, IsString, IsNumber, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @IsNotEmpty()
  @IsString()
  type: string; // e.g., 'BASE_FEE', 'STAGE_FEE'

  @IsNotEmpty()
  @IsString()
  id: string; // e.g., league ID, stage fee ID

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number; // Price per unit

  @IsNotEmpty()
  @IsString()
  name: string; // Display name
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
