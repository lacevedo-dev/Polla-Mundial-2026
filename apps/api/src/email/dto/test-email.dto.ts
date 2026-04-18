import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum EmailTestType {
  VERIFICATION = 'verification',
  MATCH_REMINDER = 'match_reminder',
  PREDICTION_CLOSING = 'prediction_closing',
  MATCH_RESULT = 'match_result',
  CUSTOM = 'custom',
}

export class TestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;

  @IsEnum(EmailTestType)
  @IsNotEmpty()
  type: EmailTestType;

  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  matchId?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  htmlContent?: string;

  @IsString()
  @IsOptional()
  textContent?: string;
}

export class TestEmailQueueDto {
  @IsEmail()
  @IsNotEmpty()
  recipientEmail: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  html: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class DispatchEmailJobDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsString()
  @IsOptional()
  providerKey?: string;
}
