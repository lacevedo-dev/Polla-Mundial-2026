import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
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
                apiKeys: [],
                activeKeyIndex: 0,
                model: 'claude-haiku-4-5-20251001',
                systemPrompt: '',
            };
        }
        const value = record.value as Record<string, unknown>;

        // Support legacy single apiKey and new apiKeys array
        const rawKeys: string[] = Array.isArray(value.apiKeys)
            ? (value.apiKeys as string[]).filter(Boolean)
            : typeof value.apiKey === 'string' && value.apiKey
              ? [value.apiKey]
              : [];

        // Mask all keys for the response
        const apiKeys = rawKeys.map((k) =>
            k.length > 4
                ? `${'*'.repeat(Math.max(8, k.length - 4))}${k.slice(-4)}`
                : '****',
        );

        return {
            provider: value.provider ?? 'anthropic',
            apiKeys,
            activeKeyIndex: value.activeKeyIndex ?? 0,
            model: value.model ?? 'claude-haiku-4-5-20251001',
            systemPrompt: value.systemPrompt ?? '',
        };
    }

    @Post('credits/reset')
    @ApiOperation({ summary: 'Reset all users AI credits globally' })
    async resetAllCredits() {
        const resetAt = new Date().toISOString();
        await this.adminService.setSystemConfig('si_credits_reset', { resetAt });
        return { ok: true, resetAt };
    }

    @Patch('ai')
    @ApiOperation({ summary: 'Save AI integration configuration' })
    async saveAiConfig(@Body() dto: {
        provider: string;
        apiKeys?: string[];
        activeKeyIndex?: number;
        model: string;
        systemPrompt: string;
    }) {
        const existing = await this.adminService.getSystemConfig('ai_config');
        const existingValue = existing?.value as Record<string, unknown> | null;

        // Load existing unmasked keys for resolution
        const existingKeys: string[] = Array.isArray(existingValue?.apiKeys)
            ? (existingValue.apiKeys as string[]).filter(Boolean)
            : typeof existingValue?.apiKey === 'string' && existingValue.apiKey
              ? [existingValue.apiKey]
              : [];

        // Resolve incoming keys:
        //   - Masked (****xxxx) → find the original by matching the suffix
        //   - Full key (sk-...) → keep as new
        //   - Empty string → skip
        const resolvedKeys = (dto.apiKeys ?? [])
            .map((k: string) => {
                const trimmed = k.trim();
                if (!trimmed) return null;
                if (/^\*{4,}/.test(trimmed)) {
                    // Masked — recover original by suffix match
                    const suffix = trimmed.replace(/^\*+/, '');
                    return existingKeys.find((ek) => ek.endsWith(suffix)) ?? null;
                }
                return trimmed; // new full key
            })
            .filter(Boolean) as string[];

        // Safety net: if resolution yielded no keys but there were keys before, keep existing.
        // This prevents accidental config wipe when the frontend sends an empty or unresolvable array.
        const finalKeys = resolvedKeys.length > 0 ? resolvedKeys : existingKeys;

        const config = {
            provider: dto.provider,
            apiKeys: finalKeys,
            activeKeyIndex: Math.min(dto.activeKeyIndex ?? 0, Math.max(0, finalKeys.length - 1)),
            model: dto.model,
            systemPrompt: dto.systemPrompt,
        };

        await this.adminService.setSystemConfig('ai_config', config);
        return { ok: true, keysCount: finalKeys.length };
    }
}
