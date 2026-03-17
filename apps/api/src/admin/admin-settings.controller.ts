import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/settings')
export class AdminSettingsController {
    constructor(private readonly adminService: AdminService) {}

    @Get('ai')
    @ApiOperation({ summary: 'Get AI integration configuration' })
    async getAiConfig() {
        const record = await this.adminService.getSystemConfig('ai_config');
        if (!record) {
            return {
                provider: 'anthropic',
                apiKey: '',
                model: 'claude-haiku-4-5-20251001',
                systemPrompt: '',
            };
        }
        const value = record.value as Record<string, unknown>;
        // Mask the API key — only return last 4 chars
        const apiKey = typeof value.apiKey === 'string' && value.apiKey.length > 4
            ? `${'*'.repeat(value.apiKey.length - 4)}${value.apiKey.slice(-4)}`
            : '';
        return { ...value, apiKey };
    }

    @Patch('ai')
    @ApiOperation({ summary: 'Save AI integration configuration' })
    async saveAiConfig(@Body() dto: {
        provider: string;
        apiKey?: string;
        model: string;
        systemPrompt: string;
    }) {
        // If apiKey contains only asterisks (masked), keep the existing one
        const existing = await this.adminService.getSystemConfig('ai_config');
        const existingValue = existing?.value as Record<string, unknown> | null;

        const apiKey = dto.apiKey && !dto.apiKey.match(/^\*+/)
            ? dto.apiKey
            : (existingValue?.apiKey as string) ?? '';

        const config = {
            provider: dto.provider,
            apiKey,
            model: dto.model,
            systemPrompt: dto.systemPrompt,
        };

        await this.adminService.setSystemConfig('ai_config', config);
        return { ok: true };
    }
}
