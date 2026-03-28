import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateEmailProviderAccountInput,
  EmailProviderAccountsService,
  UpdateEmailProviderAccountInput,
} from '../email/email-provider-accounts.service';

class ListEmailProviderAccountsQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  active?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

class CreateEmailProviderAccountDto implements CreateEmailProviderAccountInput {
  @IsString()
  @MaxLength(191)
  key!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  fromEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  fromName?: string;

  @IsString()
  @MaxLength(255)
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsBoolean()
  secure!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPass?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  dailyLimit!: number;

  @IsInt()
  @Min(0)
  @Max(1000)
  reservedHighPriority!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  maxRecipientsPerMessage!: number;

  @IsInt()
  @Min(1)
  @Max(35)
  maxEmailSizeMb!: number;

  @IsInt()
  @Min(1)
  @Max(25)
  maxAttachmentSizeMb!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateEmailProviderAccountDto implements UpdateEmailProviderAccountInput {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  fromName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPass?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  dailyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  reservedHighPriority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxRecipientsPerMessage?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(35)
  maxEmailSizeMb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxAttachmentSizeMb?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/email-providers')
export class AdminEmailProvidersController {
  constructor(private readonly emailProviderAccountsService: EmailProviderAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List SMTP provider accounts' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(@Query() query: ListEmailProviderAccountsQueryDto) {
    const accounts = await this.emailProviderAccountsService.listAccounts(query);
    return accounts.map((account) => this.emailProviderAccountsService.toAdminView(account));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single SMTP provider account' })
  async findOne(@Param('id') id: string) {
    const account = await this.emailProviderAccountsService.getAccountOrThrow(id);
    return this.emailProviderAccountsService.toAdminView(account);
  }

  @Post()
  @ApiOperation({ summary: 'Create an SMTP provider account' })
  async create(@Body() dto: CreateEmailProviderAccountDto) {
    const account = await this.emailProviderAccountsService.createAccount(dto);
    return this.emailProviderAccountsService.toAdminView(account);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an SMTP provider account' })
  async update(@Param('id') id: string, @Body() dto: UpdateEmailProviderAccountDto) {
    const account = await this.emailProviderAccountsService.updateAccount(id, dto);
    return this.emailProviderAccountsService.toAdminView(account);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate an SMTP provider account' })
  async activate(@Param('id') id: string) {
    const account = await this.emailProviderAccountsService.activateAccount(id);
    return this.emailProviderAccountsService.toAdminView(account);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate an SMTP provider account' })
  async deactivate(@Param('id') id: string) {
    const account = await this.emailProviderAccountsService.deactivateAccount(id);
    return this.emailProviderAccountsService.toAdminView(account);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an SMTP provider account' })
  async remove(@Param('id') id: string) {
    return this.emailProviderAccountsService.removeAccount(id);
  }
}
