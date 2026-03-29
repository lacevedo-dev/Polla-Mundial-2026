import { IsDateString, IsOptional } from 'class-validator';

export class AdminAutomationOperationsQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
